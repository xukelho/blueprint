namespace Blueprint.Api.Authentication;

public interface ICredentialValidator
{
    Task<string?> GetRoleForValidCredentialsAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default);
}
