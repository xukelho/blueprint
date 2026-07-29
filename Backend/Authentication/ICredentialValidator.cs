namespace Blueprint.Api.Authentication;

public interface ICredentialValidator
{
    Task<IReadOnlyList<string>?> GetRolesForValidCredentialsAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default);
}
