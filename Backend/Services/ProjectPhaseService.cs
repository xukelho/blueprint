using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public sealed class ProjectPhaseService(BlueprintDbContext db)
{
    public async Task ReconcileAsync(Project project, IReadOnlyList<string> phaseCodes, int? currentPhaseIndex, CancellationToken cancellationToken = default)
    {
        var unmatched = project.Phases.OrderBy(candidate => candidate.Position).ToList();
        var desired = new List<ProjectPhase>(phaseCodes.Count);

        foreach (var (code, position) in phaseCodes.Select((code, position) => (code, position)))
        {
            var existing = unmatched.FirstOrDefault(candidate => candidate.PhaseCode == code);
            if (existing is not null)
            {
                unmatched.Remove(existing);
                desired.Add(existing);
            }
            else
            {
                desired.Add(new ProjectPhase { ProjectId = project.Id, PhaseCode = code });
            }
        }

        if (unmatched.Count != 0 && await db.ProjectDocuments.AnyAsync(
                document => document.ProjectId == project.Id && unmatched.Select(phase => phase.Id).Contains(document.PhaseId), cancellationToken))
        {
            throw new PhaseHasDocumentsException();
        }

        // One set-based update moves persisted rows out of the unique position range.
        // Row-at-a-time updates can make PostgreSQL wait on a position being swapped.
        await db.ProjectPhases.Where(phase => phase.ProjectId == project.Id)
            .ExecuteUpdateAsync(update => update
                .SetProperty(phase => phase.Position, phase => -1_000_000 - phase.Position)
                .SetProperty(phase => phase.IsCurrent, false), cancellationToken);
        foreach (var phase in project.Phases.Where(phase => phase.Id != 0))
        {
            var temporaryPosition = -1_000_000 - phase.Position;
            var entry = db.Entry(phase);
            entry.Property(candidate => candidate.Position).CurrentValue = temporaryPosition;
            entry.Property(candidate => candidate.Position).OriginalValue = temporaryPosition;
            entry.Property(candidate => candidate.IsCurrent).CurrentValue = false;
            entry.Property(candidate => candidate.IsCurrent).OriginalValue = false;
        }

        foreach (var removed in unmatched)
        {
            project.Phases.Remove(removed);
        }
        foreach (var (phase, position) in desired.Select((phase, position) => (phase, position)))
        {
            phase.Position = position;
            phase.IsCurrent = position == currentPhaseIndex;
            if (phase.Id == 0)
            {
                project.Phases.Add(phase);
            }
            else
            {
                db.Entry(phase).Property(candidate => candidate.Position).IsModified = true;
                db.Entry(phase).Property(candidate => candidate.IsCurrent).IsModified = true;
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class PhaseHasDocumentsException()
    : InvalidOperationException("A phase with documents requires an explicit move-or-delete removal operation.");
