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
        return endpoints;
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
