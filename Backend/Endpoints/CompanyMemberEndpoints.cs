using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Validation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class CompanyMemberEndpoints
{
    public static IEndpointRouteBuilder MapCompanyMemberEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var members = endpoints.MapGroup("/api/company/members").WithTags("Company members").RequireAuthorization();
        members.MapGet("/", List).Produces<IReadOnlyList<CompanyMemberResponse>>();
        members.MapPost("/", Create).Accepts<CreateCompanyMemberRequest>("application/json").Produces<CompanyMemberResponse>(StatusCodes.Status201Created).ProducesValidationProblem();
        members.MapPut("/{employeeId:long}", Update).Accepts<UpdateCompanyMemberRequest>("application/json").Produces<CompanyMemberResponse>().ProducesValidationProblem();
        members.MapDelete("/{employeeId:long}", Delete).Produces(StatusCodes.Status204NoContent);
        return endpoints;
    }

    private static async Task<IResult> List(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var companyId = await OwnerCompanyId(principal, db, ct); if (companyId is null) return TypedResults.Forbid();
        var values = await db.CompanyEmployees.AsNoTracking().Where(x => x.CompanyId == companyId && x.Employee!.User!.IsActive)
            .OrderBy(x => x.Employee!.DisplayName).Select(x => new CompanyMemberResponse(x.EmployeeId, x.Employee!.UserId, x.Employee.User!.Username, x.Employee.DisplayName, x.Employee.FullName, x.CompanyRole, x.IsArchitect)).ToListAsync(ct);
        return TypedResults.Ok(values);
    }

    private static async Task<IResult> Create(CreateCompanyMemberRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var companyId = await OwnerCompanyId(principal, db, ct); if (companyId is null) return TypedResults.Forbid();
        var errors = Validate(request?.Username, request?.Password, request?.DisplayName, request?.FullName, request?.CompanyRole);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        var value = request!; var username = value.Username.Trim();
        if (await db.Users.AnyAsync(x => x.Username == username, ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A user with this username already exists."));
        var now = DateTimeOffset.UtcNow; var user = new User { Username = username, Password = string.Empty, IsActive = true, CreatedAt = now, CreatedBy = UserId(principal), UpdatedAt = now, UpdatedBy = UserId(principal) };
        user.Password = new PasswordHasher<User>().HashPassword(user, value.Password);
        user.UserRoles.Add(new UserRole { RoleId = RoleIds.Employee });
        if (value.CompanyRole.Trim().Equals(CompanyRoles.Owner, StringComparison.OrdinalIgnoreCase))
            user.UserRoles.Add(new UserRole { RoleId = RoleIds.CompanyOwner });
        var employee = new Employee { User = user, DisplayName = value.DisplayName.Trim(), FullName = value.FullName.Trim() };
        var membership = new CompanyEmployee { CompanyId = companyId.Value, Employee = employee, CompanyRole = value.CompanyRole.Trim().ToLowerInvariant(), IsArchitect = value.IsArchitect };
        db.CompanyEmployees.Add(membership); await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/company/members/{employee.Id}", ToResponse(membership));
    }

    private static async Task<IResult> Update(long employeeId, UpdateCompanyMemberRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var companyId = await OwnerCompanyId(principal, db, ct); if (companyId is null) return TypedResults.Forbid();
        var errors = Validate(null, null, null, null, request?.CompanyRole); if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        var membership = await db.CompanyEmployees.Include(x => x.Employee).ThenInclude(x => x!.User).SingleOrDefaultAsync(x => x.CompanyId == companyId && x.EmployeeId == employeeId, ct);
        if (membership is null || !membership.Employee!.User!.IsActive) return TypedResults.NotFound();
        var role = request!.CompanyRole.Trim().ToLowerInvariant();
        if (membership.CompanyRole == CompanyRoles.Owner && role != CompanyRoles.Owner && !await HasAnotherOwner(companyId.Value, employeeId, db, ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A company must retain an active owner."));
        if (membership.CompanyRole != role)
        {
            var ownerRole = await db.UserRoles.SingleOrDefaultAsync(x => x.UserId == membership.Employee!.UserId && x.RoleId == RoleIds.CompanyOwner, ct);
            if (role == CompanyRoles.Owner && ownerRole is null) db.UserRoles.Add(new UserRole { UserId = membership.Employee.UserId, RoleId = RoleIds.CompanyOwner });
            if (role != CompanyRoles.Owner && ownerRole is not null) db.UserRoles.Remove(ownerRole);
        }
        membership.CompanyRole = role; membership.IsArchitect = request.IsArchitect; await db.SaveChangesAsync(ct); return TypedResults.Ok(ToResponse(membership));
    }

    private static async Task<IResult> Delete(long employeeId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var companyId = await OwnerCompanyId(principal, db, ct); if (companyId is null) return TypedResults.Forbid();
        var membership = await db.CompanyEmployees.Include(x => x.Employee).ThenInclude(x => x!.User).SingleOrDefaultAsync(x => x.CompanyId == companyId && x.EmployeeId == employeeId, ct);
        if (membership is null || !membership.Employee!.User!.IsActive) return TypedResults.NotFound();
        if (membership.CompanyRole == CompanyRoles.Owner && !await HasAnotherOwner(companyId.Value, employeeId, db, ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A company must retain an active owner."));
        membership.Employee.User!.IsActive = false; membership.Employee.User.DeactivatedAt = DateTimeOffset.UtcNow; membership.Employee.User.DeactivatedBy = UserId(principal); await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static CompanyMemberResponse ToResponse(CompanyEmployee x) => new(x.EmployeeId, x.Employee!.UserId, x.Employee.User!.Username, x.Employee.DisplayName, x.Employee.FullName, x.CompanyRole, x.IsArchitect);
    private static async Task<bool> HasAnotherOwner(long companyId, long employeeId, BlueprintDbContext db, CancellationToken ct) => await db.CompanyEmployees.AnyAsync(x => x.CompanyId == companyId && x.EmployeeId != employeeId && x.CompanyRole == CompanyRoles.Owner && x.Employee!.User!.IsActive, ct);
    private static async Task<long?> OwnerCompanyId(ClaimsPrincipal p, BlueprintDbContext db, CancellationToken ct) { var userId = UserId(p); return userId == 0 ? null : await db.CompanyEmployees.Where(x => x.Employee!.UserId == userId && x.CompanyRole == CompanyRoles.Owner && x.Employee.User!.IsActive && x.Company!.IsActive).Select(x => (long?)x.CompanyId).SingleOrDefaultAsync(ct); }
    private static long UserId(ClaimsPrincipal p) => long.TryParse(p.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    private static Dictionary<string,string[]> Validate(string? username, string? password, string? display, string? full, string? role) { var e = new Dictionary<string,string[]>(); if (username is not null) AdministrationValidation.ValidateRequired(e,"username",username,"Username",256); if (password is not null) AdministrationValidation.ValidateRequired(e,"password",password,"Password",1024); if (display is not null) AdministrationValidation.ValidateRequired(e,"displayName",display,"Display name",256); if (full is not null) AdministrationValidation.ValidateRequired(e,"fullName",full,"Full name",512); if (role is null || (role.Trim().ToLowerInvariant() != CompanyRoles.Owner && role.Trim().ToLowerInvariant() != CompanyRoles.Employee)) e["companyRole"]=["Company role must be owner or employee."]; return e; }
}
