using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Blueprint.Api.IntegrationTests;

public sealed class FileServiceTests
{
    [Fact]
    public async Task UploadMoveReplaceDownloadAndDeleteFollowTheLifecycle()
    {
        await using var db = CreateDb();
        var (project, first, second) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock);
        var service = CreateService(db, store, clock);

        var pending = await service.CreatePendingUploadAsync(project.Id, first.Id, "drawing.pdf", "application/pdf", 12, 7);
        var stored = await db.StoredObjects.SingleAsync(candidate => candidate.Id == pending.StoredObjectId);
        Assert.Equal(StoredObjectStatus.PendingUpload, stored.Status);
        Assert.DoesNotContain("drawing.pdf", stored.ObjectKey);

        store.Metadata[stored.ObjectKey] = new ObjectMetadata(12, "application/pdf", "etag-one", clock.GetUtcNow());
        await service.CompleteUploadAsync(pending.DocumentId, 7);
        await service.CompleteUploadAsync(pending.DocumentId, 7);
        Assert.Equal(StoredObjectStatus.Available, stored.Status);

        await service.MoveAsync(pending.DocumentId, second.Id, 8);
        Assert.Equal(second.Id, (await db.ProjectDocuments.FindAsync(pending.DocumentId))!.PhaseId);
        var download = await service.CreateDownloadGrantAsync(pending.DocumentId);
        Assert.Contains(stored.ObjectKey, download.Url.AbsoluteUri);

        var replacement = await service.CreateReplacementUploadAsync(pending.DocumentId, "drawing-new.pdf", "application/pdf", 20, 8);
        var newObject = await db.StoredObjects.SingleAsync(candidate => candidate.Id == replacement.StoredObjectId);
        Assert.NotEqual(stored.ObjectKey, newObject.ObjectKey);
        store.Metadata[newObject.ObjectKey] = new ObjectMetadata(20, "application/pdf", "etag-two", clock.GetUtcNow());
        await service.CompleteReplacementAsync(pending.DocumentId, replacement.StoredObjectId, 8);
        await service.CompleteReplacementAsync(pending.DocumentId, replacement.StoredObjectId, 8);
        Assert.Equal(StoredObjectStatus.DeletionPending, stored.Status);
        Assert.Equal(replacement.StoredObjectId, (await db.ProjectDocuments.FindAsync(pending.DocumentId))!.StoredObjectId);

        await service.DeleteAsync(pending.DocumentId, 9);
        await service.DeleteAsync(pending.DocumentId, 9);
        Assert.True((await db.ProjectDocuments.FindAsync(pending.DocumentId))!.IsDeleted);
        Assert.Equal(StoredObjectStatus.DeletionPending, newObject.Status);
    }

    [Fact]
    public async Task CompletionRejectsMissingOrMismatchedObjectWithoutAdvancingState()
    {
        await using var db = CreateDb();
        var (project, phase, _) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock);
        var service = CreateService(db, store, clock);
        var pending = await service.CreatePendingUploadAsync(project.Id, phase.Id, "x.bin", "application/octet-stream", 4, 1);

        await Assert.ThrowsAsync<FileConflictException>(() => service.CompleteUploadAsync(pending.DocumentId, 1));
        var stored = await db.StoredObjects.SingleAsync(candidate => candidate.Id == pending.StoredObjectId);
        store.Metadata[stored.ObjectKey] = new ObjectMetadata(5, "application/octet-stream", null, null);
        await Assert.ThrowsAsync<FileConflictException>(() => service.CompleteUploadAsync(pending.DocumentId, 1));
        Assert.Equal(StoredObjectStatus.PendingUpload, stored.Status);
    }

    [Fact]
    public async Task MaintenanceRetriesTemporaryDeletionFailuresThenCompletes()
    {
        await using var db = CreateDb();
        var (project, phase, _) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock) { DeleteFailuresRemaining = 1 };
        var service = CreateService(db, store, clock);
        var pending = await service.CreatePendingUploadAsync(project.Id, phase.Id, "x.bin", "application/octet-stream", 4, 1);
        var stored = await db.StoredObjects.SingleAsync(candidate => candidate.Id == pending.StoredObjectId);
        store.Metadata[stored.ObjectKey] = new ObjectMetadata(4, "application/octet-stream", null, null);
        await service.CompleteUploadAsync(pending.DocumentId, 1);
        await service.DeleteAsync(pending.DocumentId, 1);

        var processor = new FileMaintenanceProcessor(db, store, clock, NullLogger<FileMaintenanceProcessor>.Instance);
        await processor.ProcessBatchAsync();
        Assert.Equal(StoredObjectStatus.DeletionPending, stored.Status);
        Assert.Equal(1, stored.MaintenanceAttempts);
        clock.Advance(TimeSpan.FromMinutes(2));
        await processor.ProcessBatchAsync();
        Assert.Equal(StoredObjectStatus.Deleted, stored.Status);
        Assert.Contains(stored.ObjectKey, store.DeletedKeys);
    }

    [Fact]
    public async Task MaintenanceExpiresAbandonedPendingUploadsAndDeletesTheirObjects()
    {
        await using var db = CreateDb();
        var (project, phase, _) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock);
        var pending = await CreateService(db, store, clock).CreatePendingUploadAsync(
            project.Id, phase.Id, "abandoned.bin", "application/octet-stream", 3, 1);
        var stored = await db.StoredObjects.FindAsync(pending.StoredObjectId);
        clock.Advance(TimeSpan.FromHours(2));

        await new FileMaintenanceProcessor(db, store, clock, NullLogger<FileMaintenanceProcessor>.Instance).ProcessBatchAsync();

        Assert.Equal(StoredObjectStatus.Deleted, stored!.Status);
        Assert.True((await db.ProjectDocuments.FindAsync(pending.DocumentId))!.IsDeleted);
        Assert.Contains(stored.ObjectKey, store.DeletedKeys);
    }

    [Fact]
    public async Task PhaseRemovalRejectsImplicitLossAndSupportsExplicitMove()
    {
        await using var db = CreateDb();
        var (project, first, second) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock);
        var files = CreateService(db, store, clock);
        var pending = await files.CreatePendingUploadAsync(project.Id, first.Id, "x.bin", "application/octet-stream", 1, 1);
        var removal = new PhaseRemovalService(db, files, clock);

        await Assert.ThrowsAsync<PhaseHasDocumentsException>(() => removal.RemoveAsync(
            new PhaseRemovalCommand(project.Id, first.Id, PhaseRemovalMode.EmptyOnly, null, 1)));

        await removal.RemoveAsync(new PhaseRemovalCommand(project.Id, first.Id, PhaseRemovalMode.MoveDocuments, second.Id, 1));
        Assert.Null(await db.ProjectPhases.FindAsync(first.Id));
        Assert.Equal(second.Id, (await db.ProjectDocuments.FindAsync(pending.DocumentId))!.PhaseId);
    }

    [Fact]
    public async Task ExplicitDeletePhaseRemovalQueuesPhysicalDeletion()
    {
        await using var db = CreateDb();
        var (project, first, _) = SeedProject(db);
        var clock = new TestTimeProvider(DateTimeOffset.Parse("2026-08-12T10:00:00Z"));
        var store = new FakeObjectStore(clock);
        var files = CreateService(db, store, clock);
        var pending = await files.CreatePendingUploadAsync(project.Id, first.Id, "x.bin", "application/octet-stream", 1, 1);
        var stored = await db.StoredObjects.FindAsync(pending.StoredObjectId);

        await new PhaseRemovalService(db, files, clock).RemoveAsync(
            new PhaseRemovalCommand(project.Id, first.Id, PhaseRemovalMode.DeleteDocuments, null, 2));

        Assert.Null(await db.ProjectPhases.FindAsync(first.Id));
        Assert.Null(await db.ProjectDocuments.FindAsync(pending.DocumentId));
        Assert.Equal(StoredObjectStatus.DeletionPending, stored!.Status);
    }

    private static BlueprintDbContext CreateDb() => new(new DbContextOptionsBuilder<BlueprintDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);

    private static (Project Project, ProjectPhase First, ProjectPhase Second) SeedProject(BlueprintDbContext db)
    {
        var now = DateTimeOffset.UtcNow;
        var project = new Project { Id = 10, CompanyId = 1, Title = "P", Code = "P", Address = "", CreatedAt = now, UpdatedAt = now, CreatedBy = 1, UpdatedBy = 1 };
        var first = new ProjectPhase { Id = 20, ProjectId = project.Id, PhaseCode = ProjectPhaseCatalog.FeasibilityStudies, Position = 0 };
        var second = new ProjectPhase { Id = 21, ProjectId = project.Id, PhaseCode = ProjectPhaseCatalog.ExecutionProject, Position = 1 };
        db.Projects.Add(project);
        db.ProjectPhases.AddRange(first, second);
        db.SaveChanges();
        return (project, first, second);
    }

    private static FileService CreateService(BlueprintDbContext db, FakeObjectStore store, TimeProvider clock) =>
        new(db, store, Options.Create(new ObjectStorageOptions
        {
            Endpoint = "http://storage.test", Region = "test", Bucket = "private", AccessKey = "a", SecretKey = "s",
            UploadGrantLifetime = TimeSpan.FromMinutes(15), DownloadGrantLifetime = TimeSpan.FromMinutes(5), PendingUploadLifetime = TimeSpan.FromHours(1)
        }), clock);

    private sealed class FakeObjectStore(TestTimeProvider clock) : IObjectStore
    {
        public Dictionary<string, ObjectMetadata> Metadata { get; } = [];
        public List<string> DeletedKeys { get; } = [];
        public int DeleteFailuresRemaining { get; set; }
        public Task<PresignedUploadGrant> CreateUploadGrantAsync(string key, string contentType, TimeSpan lifetime, CancellationToken cancellationToken = default) =>
            Task.FromResult(new PresignedUploadGrant(new Uri($"https://storage.test/{key}"), clock.GetUtcNow().Add(lifetime), new Dictionary<string, string> { ["Content-Type"] = contentType }));
        public Task<ObjectMetadata?> GetMetadataAsync(string key, CancellationToken cancellationToken = default) => Task.FromResult(Metadata.GetValueOrDefault(key));
        public Task<PresignedDownloadGrant> CreateDownloadGrantAsync(string key, string downloadFileName, TimeSpan lifetime, CancellationToken cancellationToken = default) =>
            Task.FromResult(new PresignedDownloadGrant(new Uri($"https://storage.test/{key}"), clock.GetUtcNow().Add(lifetime)));
        public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken = default) => Task.FromResult<Stream?>(null);
        public Task PutAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
        {
            if (DeleteFailuresRemaining-- > 0) throw new ObjectStoreException("temporary", true);
            DeletedKeys.Add(key);
            return Task.CompletedTask;
        }
    }

    private sealed class TestTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan duration) => now = now.Add(duration);
    }
}
