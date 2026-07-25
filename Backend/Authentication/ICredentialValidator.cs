namespace Blueprint.Api.Authentication;

public interface ICredentialValidator
{
    Task<bool> ValidateAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default);
}
