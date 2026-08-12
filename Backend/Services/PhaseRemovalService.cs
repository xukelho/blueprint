using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public enum PhaseRemovalMode
{
    EmptyOnly,
    MoveDocuments,
    DeleteDocuments
}

public sealed record PhaseRemovalCommand(long ProjectId, long PhaseId, PhaseRemovalMode Mode, long? TargetPhaseId, long ActorId);

public sealed class PhaseRemovalService(BlueprintDbContext db, IFileService fileService, TimeProvider timeProvider)
{
    public async Task RemoveAsync(PhaseRemovalCommand command, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var phase = await db.ProjectPhases.SingleOrDefaultAsync(
            candidate => candidate.Id == command.PhaseId && candidate.ProjectId == command.ProjectId, cancellationToken)
            ?? throw new FileDomainException("Phase not found.");
        var documents = await db.ProjectDocuments.Where(document => document.ProjectId == command.ProjectId && document.PhaseId == command.PhaseId).ToListAsync(cancellationToken);

        switch (command.Mode)
        {
            case PhaseRemovalMode.EmptyOnly when documents.Count != 0:
                throw new PhaseHasDocumentsException();
            case PhaseRemovalMode.MoveDocuments:
                if (command.TargetPhaseId is null || command.TargetPhaseId == command.PhaseId ||
                    !await db.ProjectPhases.AnyAsync(candidate => candidate.Id == command.TargetPhaseId && candidate.ProjectId == command.ProjectId, cancellationToken))
                    throw new FileDomainException("A different target phase in the same project is required.");
                foreach (var document in documents)
                {
                    document.PhaseId = command.TargetPhaseId.Value;
                    document.UpdatedAt = timeProvider.GetUtcNow();
                    document.UpdatedBy = command.ActorId;
                }
                break;
            case PhaseRemovalMode.DeleteDocuments:
                foreach (var document in documents.Where(candidate => !candidate.IsDeleted))
                    await fileService.DeleteAsync(document.Id, command.ActorId, cancellationToken);
                // Deleted logical documents cannot retain a required reference to a removed phase.
                db.ProjectDocuments.RemoveRange(documents);
                break;
            case PhaseRemovalMode.EmptyOnly:
                break;
            default:
                throw new FileDomainException("The phase removal strategy is ambiguous.");
        }

        db.ProjectPhases.Remove(phase);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
