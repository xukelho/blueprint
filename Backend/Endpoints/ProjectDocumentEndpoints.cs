using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ProjectDocumentEndpoints
{
    public static IEndpointRouteBuilder MapProjectDocumentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var projects = endpoints.MapGroup("/api/projects/{projectId:long}")
            .WithTags("Project documents")
            .RequireAuthorization();

        projects.MapGet("/documents", List)
            .Produces<IReadOnlyList<ProjectDocumentResponse>>()
            .Produces(StatusCodes.Status404NotFound);
        projects.MapPost("/phases/{phaseId:long}/documents/uploads", CreateUpload)
            .Accepts<CreateDocumentUploadRequest>("application/json")
            .Produces<PendingDocumentUploadResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        projects.MapPost("/documents/{documentId:guid}/complete", CompleteUpload)
            .Produces<CompleteDocumentUploadResponse>()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        projects.MapPost("/documents/{documentId:guid}/download", CreateDownload)
            .Produces<DownloadGrantResponse>()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        projects.MapPut("/documents/{documentId:guid}/phase", Move)
            .Accepts<MoveDocumentRequest>("application/json")
            .Produces<ProjectDocumentResponse>()
            .ProducesValidationProblem()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound);
        projects.MapPost("/documents/{documentId:guid}/replacements", CreateReplacement)
            .Accepts<CreateReplacementUploadRequest>("application/json")
            .Produces<PendingReplacementUploadResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        projects.MapPost("/documents/{documentId:guid}/replacements/{storedObjectId:guid}/complete", CompleteReplacement)
            .Produces<CompleteDocumentUploadResponse>()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        projects.MapDelete("/documents/{documentId:guid}", Delete)
            .Produces(StatusCodes.Status204NoContent)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound);
        projects.MapPost("/phases/{phaseId:long}/remove", RemovePhase)
            .Accepts<RemoveProjectPhaseRequest>("application/json")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status404NotFound);

        return endpoints;
    }

    private static async Task<IResult> List(long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await FindAccessAsync(projectId, principal, db, ct);
        if (access is null) return TypedResults.NotFound();

        var query = db.ProjectDocuments.AsNoTracking()
            .Where(document => document.ProjectId == projectId && !document.IsDeleted &&
                document.StoredObject!.Status != StoredObjectStatus.DeletionPending &&
                document.StoredObject.Status != StoredObjectStatus.Deleted);
        if (!access.IsProfessional)
            query = query.Where(document => document.StoredObject!.Status == StoredObjectStatus.Available);

        var documents = await query
            .Include(document => document.StoredObject)
            .Include(document => document.Phase)
            .OrderBy(document => document.Phase!.Position)
            .ThenBy(document => document.CreatedAt)
            .ThenBy(document => document.Id)
            .ToArrayAsync(ct);
        var uploaderNames = await UploaderNamesAsync(documents.Select(document => document.CreatedBy), db, ct);
        return TypedResults.Ok(documents.Select(document => ToResponse(document, uploaderNames.GetValueOrDefault(document.CreatedBy, string.Empty))).ToArray());
    }

    private static async Task<IResult> CreateUpload(long projectId, long phaseId, CreateDocumentUploadRequest? request,
        ClaimsPrincipal principal, BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (request is null) return MissingBody();
        if (!await db.ProjectPhases.AnyAsync(phase => phase.Id == phaseId && phase.ProjectId == projectId, ct)) return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            var pending = await files.CreatePendingUploadAsync(projectId, phaseId, request.FileName, request.ContentType, request.Length, accessResult.Access!.UserId, ct);
            var response = new PendingDocumentUploadResponse(pending.DocumentId, pending.StoredObjectId, ToResponse(pending.Grant));
            return TypedResults.Created($"/api/projects/{projectId}/documents/{pending.DocumentId}", response);
        });
    }

    private static async Task<IResult> CompleteUpload(long projectId, Guid documentId, ClaimsPrincipal principal,
        BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (!await ActiveDocumentBelongsToProjectAsync(projectId, documentId, db, ct)) return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            await files.CompleteUploadAsync(documentId, accessResult.Access!.UserId, ct);
            return TypedResults.Ok(new CompleteDocumentUploadResponse((await GetDocumentAsync(projectId, documentId, db, ct))!));
        });
    }

    private static async Task<IResult> CreateDownload(long projectId, Guid documentId, ClaimsPrincipal principal,
        BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var access = await FindAccessAsync(projectId, principal, db, ct);
        if (access is null || !await ActiveDocumentBelongsToProjectAsync(projectId, documentId, db, ct)) return TypedResults.NotFound();
        if (!access.IsProfessional && !await db.ProjectDocuments.AnyAsync(document => document.Id == documentId && document.ProjectId == projectId &&
                !document.IsDeleted && document.StoredObject!.Status == StoredObjectStatus.Available, ct))
            return TypedResults.NotFound();
        return await ExecuteAsync(async () =>
        {
            var grant = await files.CreateDownloadGrantAsync(documentId, ct);
            return TypedResults.Ok(new DownloadGrantResponse(grant.Url, grant.ExpiresAt));
        });
    }

    private static async Task<IResult> Move(long projectId, Guid documentId, MoveDocumentRequest? request,
        ClaimsPrincipal principal, BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (request is null) return MissingBody();
        if (!await ActiveDocumentBelongsToProjectAsync(projectId, documentId, db, ct) ||
            !await db.ProjectPhases.AnyAsync(phase => phase.ProjectId == projectId && phase.Id == request.TargetPhaseId, ct))
            return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            await files.MoveAsync(documentId, request.TargetPhaseId, accessResult.Access!.UserId, ct);
            return TypedResults.Ok((await GetDocumentAsync(projectId, documentId, db, ct))!);
        });
    }

    private static async Task<IResult> CreateReplacement(long projectId, Guid documentId, CreateReplacementUploadRequest? request,
        ClaimsPrincipal principal, BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (request is null) return MissingBody();
        if (!await ActiveDocumentBelongsToProjectAsync(projectId, documentId, db, ct)) return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            var pending = await files.CreateReplacementUploadAsync(documentId, request.FileName, request.ContentType, request.Length, accessResult.Access!.UserId, ct);
            var response = new PendingReplacementUploadResponse(pending.StoredObjectId, ToResponse(pending.Grant));
            return TypedResults.Created($"/api/projects/{projectId}/documents/{documentId}/replacements/{pending.StoredObjectId}", response);
        });
    }

    private static async Task<IResult> CompleteReplacement(long projectId, Guid documentId, Guid storedObjectId,
        ClaimsPrincipal principal, BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (!await ActiveDocumentBelongsToProjectAsync(projectId, documentId, db, ct) ||
            !await db.StoredObjects.AnyAsync(storedObject => storedObject.Id == storedObjectId && storedObject.ProjectId == projectId, ct))
            return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            await files.CompleteReplacementAsync(documentId, storedObjectId, accessResult.Access!.UserId, ct);
            return TypedResults.Ok(new CompleteDocumentUploadResponse((await GetDocumentAsync(projectId, documentId, db, ct))!));
        });
    }

    private static async Task<IResult> Delete(long projectId, Guid documentId, ClaimsPrincipal principal,
        BlueprintDbContext db, IFileService files, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (!await db.ProjectDocuments.AnyAsync(document => document.Id == documentId && document.ProjectId == projectId, ct)) return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            await files.DeleteAsync(documentId, accessResult.Access!.UserId, ct);
            return TypedResults.NoContent();
        });
    }

    private static async Task<IResult> RemovePhase(long projectId, long phaseId, RemoveProjectPhaseRequest? request,
        ClaimsPrincipal principal, BlueprintDbContext db, PhaseRemovalService removal, CancellationToken ct)
    {
        var accessResult = await RequireMutationAccessAsync(projectId, principal, db, ct);
        if (accessResult.Result is not null) return accessResult.Result;
        if (request is null) return MissingBody();
        if (!TryParseRemovalMode(request.Mode, out var mode))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["mode"] = ["Mode must be emptyOnly, moveDocuments, or deleteDocuments."] });
        if (!await db.ProjectPhases.AnyAsync(phase => phase.ProjectId == projectId && phase.Id == phaseId, ct)) return TypedResults.NotFound();
        if (mode == PhaseRemovalMode.MoveDocuments && request.TargetPhaseId is null)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["targetPhaseId"] = ["A target phase is required when moving documents."] });
        if (mode == PhaseRemovalMode.MoveDocuments && request.TargetPhaseId == phaseId)
            return TypedResults.Conflict(new AdministrationErrorResponse("The target phase must be different from the phase being removed."));
        if (mode == PhaseRemovalMode.MoveDocuments &&
            !await db.ProjectPhases.AnyAsync(phase => phase.ProjectId == projectId && phase.Id == request.TargetPhaseId, ct))
            return TypedResults.NotFound();

        return await ExecuteAsync(async () =>
        {
            await removal.RemoveAsync(new PhaseRemovalCommand(projectId, phaseId, mode, request.TargetPhaseId, accessResult.Access!.UserId), ct);
            return TypedResults.NoContent();
        });
    }

    private static async Task<(ProjectFileAccess? Access, IResult? Result)> RequireMutationAccessAsync(
        long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await FindAccessAsync(projectId, principal, db, ct);
        if (access is null || !access.IsProfessional) return (null, TypedResults.NotFound());
        if (access.IsArchived) return (access, TypedResults.Conflict(new AdministrationErrorResponse("Archived projects are read-only.")));
        return (access, null);
    }

    private static async Task<ProjectFileAccess?> FindAccessAsync(long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        if (!long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;

        var professional = await db.Projects.AsNoTracking()
            .Where(project => project.Id == projectId && project.Company!.IsActive &&
                project.Company.CompanyEmployees.Any(membership => membership.Employee!.UserId == userId && membership.Employee.User!.IsActive &&
                    (membership.CompanyRole == CompanyRoles.Owner || membership.IsArchitect && project.Members.Any(member => member.EmployeeId == membership.EmployeeId))))
            .Select(project => new ProjectFileAccess(userId, true, project.IsArchived))
            .SingleOrDefaultAsync(ct);
        if (professional is not null) return professional;

        return await db.Projects.AsNoTracking()
            .Where(project => project.Id == projectId && project.Company!.IsActive && project.ProjectClients.Any(projectClient =>
                projectClient.Client!.UserId == userId && projectClient.Client.User!.IsActive &&
                projectClient.Client.CompanyClients.Any(membership => membership.CompanyId == project.CompanyId)))
            .Select(project => new ProjectFileAccess(userId, false, project.IsArchived))
            .SingleOrDefaultAsync(ct);
    }

    private static Task<bool> ActiveDocumentBelongsToProjectAsync(long projectId, Guid documentId, BlueprintDbContext db, CancellationToken ct) =>
        db.ProjectDocuments.AnyAsync(document => document.Id == documentId && document.ProjectId == projectId && !document.IsDeleted, ct);

    private static async Task<ProjectDocumentResponse?> GetDocumentAsync(long projectId, Guid documentId, BlueprintDbContext db, CancellationToken ct)
    {
        var document = await db.ProjectDocuments.AsNoTracking().Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.ProjectId == projectId && candidate.Id == documentId && !candidate.IsDeleted, ct);
        if (document is null) return null;
        var uploaderNames = await UploaderNamesAsync([document.CreatedBy], db, ct);
        return ToResponse(document, uploaderNames.GetValueOrDefault(document.CreatedBy, string.Empty));
    }

    private static ProjectDocumentResponse ToResponse(ProjectDocument document, string uploaderDisplayName) => new(
        document.Id,
        document.PhaseId,
        document.StoredObject!.FileName,
        document.StoredObject.ContentType,
        document.StoredObject.VerifiedLength ?? document.StoredObject.ExpectedLength,
        document.StoredObject.Status.ToString(),
        document.CreatedBy,
        uploaderDisplayName,
        document.CreatedAt,
        document.StoredObject.UploadedAt);

    private static async Task<Dictionary<long, string>> UploaderNamesAsync(IEnumerable<long> userIds, BlueprintDbContext db, CancellationToken ct)
    {
        var ids = userIds.Distinct().ToArray();
        return await db.Users.AsNoTracking().Where(user => ids.Contains(user.Id))
            .Select(user => new
            {
                user.Id,
                DisplayName = user.Employee != null ? user.Employee.DisplayName : user.Client != null ? user.Client.DisplayName : user.Username
            })
            .ToDictionaryAsync(user => user.Id, user => user.DisplayName, ct);
    }

    private static UploadGrantResponse ToResponse(PresignedUploadGrant grant) => new(grant.Url, grant.ExpiresAt, grant.RequiredHeaders);

    private static IResult MissingBody() => TypedResults.ValidationProblem(
        new Dictionary<string, string[]> { ["request"] = ["A JSON request body is required."] });

    private static bool TryParseRemovalMode(string? value, out PhaseRemovalMode mode)
    {
        mode = value?.Trim().ToLowerInvariant() switch
        {
            "emptyonly" => PhaseRemovalMode.EmptyOnly,
            "movedocuments" => PhaseRemovalMode.MoveDocuments,
            "deletedocuments" => PhaseRemovalMode.DeleteDocuments,
            _ => (PhaseRemovalMode)(-1)
        };
        return Enum.IsDefined(mode);
    }

    private static async Task<IResult> ExecuteAsync(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (FileValidationException exception)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { [exception.Field] = [exception.Message] });
        }
        catch (FileResourceNotFoundException)
        {
            return TypedResults.NotFound();
        }
        catch (FileConflictException exception)
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(exception.Message));
        }
        catch (ObjectStoreException exception)
        {
            return Results.Problem(
                title: exception.IsTransient ? "Object storage is temporarily unavailable." : "Object storage request failed.",
                statusCode: exception.IsTransient ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status502BadGateway);
        }
    }

    private sealed record ProjectFileAccess(long UserId, bool IsProfessional, bool IsArchived);
}
