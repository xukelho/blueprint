using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ClientInvitationEndpoints
{
    public static IEndpointRouteBuilder MapClientInvitationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var invitations = endpoints.MapGroup("/api/client-invitations")
            .WithTags("Client Invitations")
            .RequireAuthorization();
        invitations.MapGet("/", List);
        invitations.MapPost("/", Create);
        invitations.MapGet("/received", ListReceived);
        invitations.MapPost("/{id:long}/accept", Accept);
        invitations.MapPost("/{id:long}/reject", Reject);
        return endpoints;
    }

    private static async Task<IResult> ListReceived(
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var client = await CurrentClient(principal, db, cancellationToken);
        if (client is null) return TypedResults.Forbid();

        await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        var invitations = await db.ClientInvitations.AsNoTracking()
            .Where(invitation => invitation.Email == client.Email)
            .OrderByDescending(invitation => invitation.SentAt)
            .Select(invitation => new ReceivedClientInvitationResponse(
                invitation.Id,
                invitation.CompanyId,
                invitation.Company!.Name,
                invitation.SentAt,
                invitation.SentAt + ClientInvitationExpiry.Lifetime))
            .ToArrayAsync(cancellationToken);
        return TypedResults.Ok(invitations);
    }

    private static async Task<IResult> Accept(
        long id,
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var client = await CurrentClient(principal, db, cancellationToken);
        if (client is null) return TypedResults.Forbid();

        await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var invitation = await db.ClientInvitations.AsNoTracking()
            .Where(candidate => candidate.Id == id && candidate.Email == client.Email)
            .Select(candidate => new { candidate.CompanyId })
            .SingleOrDefaultAsync(cancellationToken);
        if (invitation is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return TypedResults.NotFound();
        }

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO company_clients (company_id, client_id, internal_notes)
            VALUES ({invitation.CompanyId}, {client.Id}, '')
            ON CONFLICT (company_id, client_id) DO NOTHING
            """,
            cancellationToken);
        var deleted = await db.ClientInvitations
            .Where(candidate => candidate.Id == id && candidate.Email == client.Email)
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return TypedResults.NotFound();
        }

        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> Reject(
        long id,
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var client = await CurrentClient(principal, db, cancellationToken);
        if (client is null) return TypedResults.Forbid();

        await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        var deleted = await db.ClientInvitations
            .Where(candidate => candidate.Id == id && candidate.Email == client.Email)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static async Task<Client?> CurrentClient(
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        CancellationToken cancellationToken)
    {
        if (!principal.IsInRole("client") ||
            !long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        return await db.Clients.AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId && candidate.User!.IsActive,
                cancellationToken);
    }

    private static async Task<IResult> List(
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var access = await Access.ForUser(principal, db, cancellationToken);
        if (access is null)
        {
            return TypedResults.NotFound();
        }

        await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        var invitations = await db.ClientInvitations.AsNoTracking()
            .Where(invitation => invitation.CompanyId == access.CompanyId)
            .OrderByDescending(invitation => invitation.SentAt)
            .Select(invitation => new ClientInvitationResponse(
                invitation.Id,
                invitation.Email,
                invitation.SentAt,
                invitation.SentAt + ClientInvitationExpiry.Lifetime))
            .ToArrayAsync(cancellationToken);
        return TypedResults.Ok(invitations);
    }

    private static async Task<IResult> Create(
        CreateClientInvitationRequest? request,
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var access = await Access.ForUser(principal, db, cancellationToken);
        if (access is null)
        {
            return TypedResults.NotFound();
        }
        if (!access.IsOwner)
        {
            return TypedResults.Forbid();
        }
        if (!EmailAddress.IsValid(request?.Email))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = ["Enter a valid email address containing at most 320 characters."]
            });
        }

        await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        var email = EmailAddress.Normalize(request!.Email);
        var isConfirmed = await db.CompanyClients.AnyAsync(
            membership => membership.CompanyId == access.CompanyId && membership.Client!.Email == email,
            cancellationToken);
        if (isConfirmed)
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(
                "This client already belongs to the company."));
        }
        if (await db.ClientInvitations.AnyAsync(
                invitation => invitation.CompanyId == access.CompanyId && invitation.Email == email,
                cancellationToken))
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(
                "An invitation is already pending for this email."));
        }

        var sentAt = timeProvider.GetUtcNow();
        var invitation = new ClientInvitation
        {
            CompanyId = access.CompanyId,
            Email = email,
            SentAt = sentAt
        };
        db.ClientInvitations.Add(invitation);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(
                "An invitation is already pending for this email."));
        }

        return TypedResults.Created(
            $"/api/client-invitations/{invitation.Id}",
            new ClientInvitationResponse(
                invitation.Id,
                invitation.Email,
                invitation.SentAt,
                invitation.SentAt + ClientInvitationExpiry.Lifetime));
    }
}
