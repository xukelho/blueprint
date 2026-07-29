namespace Blueprint.Api.Authentication;

public sealed record AuthenticatedUser(
    long Id,
    string Username,
    IReadOnlyList<string> Roles);

public interface ICredentialValidator
{
    Task<AuthenticatedUser?> GetUserForValidCredentialsAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default);
}
