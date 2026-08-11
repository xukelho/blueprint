using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Validation;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class CompanyEndpoints
{
    public static IEndpointRouteBuilder MapCompanyEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var company = endpoints.MapGroup("/api/company")
            .WithTags("Company")
            .RequireAuthorization();

        company.MapGet("/", GetCurrentCompany)
            .WithName("GetCurrentCompany")
            .Produces<CompanyResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);
        company.MapPut("/", UpdateCurrentCompany)
            .WithName("UpdateCurrentCompany")
            .Accepts<UpdateCurrentCompanyRequest>("application/json")
            .Produces<CompanyResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();

        return endpoints;
    }

    private static async Task<IResult> GetCurrentCompany(
        ClaimsPrincipal principal,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await FindCurrentCompany(principal, dbContext, cancellationToken);
        return result.Error ?? TypedResults.Ok(ToResponse(result.Company!));
    }

    private static async Task<IResult> UpdateCurrentCompany(
        UpdateCurrentCompanyRequest? request,
        ClaimsPrincipal principal,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var result = await FindCurrentCompany(principal, dbContext, cancellationToken);
        if (result.Error is not null)
        {
            return result.Error;
        }

        var company = result.Company!;
        company.Name = request!.Name.Trim();
        company.LegalName = request.LegalName.Trim();
        company.Nif = request.Nif.Trim();
        company.Email = request.Email.Trim();
        company.PhoneNumber = request.PhoneNumber.Trim();
        company.Address = request.Address.Trim();
        company.Website = string.IsNullOrWhiteSpace(request.Website)
            ? null
            : request.Website.Trim();
        company.UpdatedAt = DateTimeOffset.UtcNow;
        company.UpdatedBy = GetUserId(principal);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(ToResponse(company));
    }

    private static async Task<(Company? Company, IResult? Error)> FindCurrentCompany(
        ClaimsPrincipal principal,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!principal.IsInRole("employee"))
        {
            return (null, TypedResults.Forbid());
        }

        var userId = GetUserId(principal);
        if (userId == 0)
        {
            return (null, TypedResults.Unauthorized());
        }

        var company = await dbContext.CompanyEmployees
            .Where(candidate => candidate.Employee!.UserId == userId &&
                candidate.CompanyRole == CompanyRoles.Owner && candidate.Employee.User!.IsActive)
            .Select(candidate => candidate.Company)
            .SingleOrDefaultAsync(cancellationToken);
        if (company is null || !company.IsActive)
        {
            return (null, TypedResults.NotFound());
        }

        return (company, null);
    }

    private static long GetUserId(ClaimsPrincipal principal) =>
        long.TryParse(
            principal.FindFirstValue(ClaimTypes.NameIdentifier),
            out var userId)
            ? userId
            : 0;

    private static Dictionary<string, string[]> Validate(
        UpdateCurrentCompanyRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        AdministrationValidation.ValidateCompany(
            errors,
            request.Name,
            request.LegalName,
            request.Nif,
            request.Email,
            request.PhoneNumber,
            request.Address,
            request.Website);
        return errors;
    }

    private static CompanyResponse ToResponse(Company company) =>
        new(
            company.Id,
            company.Name,
            company.LegalName,
            company.Nif,
            company.Email,
            company.PhoneNumber,
            company.Address,
            company.Website,
            company.IsActive,
            company.CreatedAt,
            company.CreatedBy,
            company.UpdatedAt,
            company.UpdatedBy);
}
