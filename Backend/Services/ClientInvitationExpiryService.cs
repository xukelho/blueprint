using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public static class ClientInvitationExpiry
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(3);

    public static async Task<int> DeleteExpiredAsync(
        BlueprintDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var cutoff = timeProvider.GetUtcNow() - Lifetime;
        return await db.ClientInvitations
            .Where(invitation => invitation.SentAt <= cutoff)
            .ExecuteDeleteAsync(cancellationToken);
    }
}

public sealed class ClientInvitationExpiryService(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<ClientInvitationExpiryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await DeleteExpiredAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1), timeProvider);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await DeleteExpiredAsync(stoppingToken);
        }
    }

    private async Task DeleteExpiredAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<BlueprintDbContext>();
            await ClientInvitationExpiry.DeleteExpiredAsync(db, timeProvider, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Failed to delete expired client invitations.");
        }
    }
}
