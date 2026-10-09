using System.Security.Claims;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public sealed record ProjectFileAccess(long UserId, bool IsProfessional, bool IsArchived);

public static class ProjectDocumentAccessService
{
    public static async Task<ProjectFileAccess?> FindAccessAsync(long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
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

    // Call inside the mutation transaction. Reload after the row lock so tracked state
    // from an earlier authorization/read cannot determine the transition or audience.
    public static async Task<ProjectDocument?> LockAsync(BlueprintDbContext db, Guid documentId, CancellationToken ct)
    {
        if (db.Database.IsRelational())
        {
            if (db.Database.CurrentTransaction is null)
                throw new InvalidOperationException("Document locks require a transaction.");
            var ids = await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM project_documents WHERE id = {documentId} FOR UPDATE")
                .ToArrayAsync(ct);
            if (ids.Length == 0) return null;
        }

        var document = await db.ProjectDocuments.SingleOrDefaultAsync(item => item.Id == documentId, ct);
        if (document is null) return null;
        await db.Entry(document).ReloadAsync(ct);
        document.StoredObject = await db.StoredObjects.SingleOrDefaultAsync(item => item.Id == document.StoredObjectId, ct);
        if (document.StoredObject is not null) await db.Entry(document.StoredObject).ReloadAsync(ct);
        return document;
    }

    public static bool CanRead(ProjectDocument document, ProjectFileAccess access) =>
        !document.IsDeleted && (access.IsProfessional ||
            document.IsVisible && document.StoredObject?.Status == StoredObjectStatus.Available);
}
