using Blueprint.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Authentication;

public sealed class DatabaseCredentialValidator(BlueprintDbContext dbContext)
    : ICredentialValidator
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<string?> GetRoleForValidCredentialsAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .Include(candidate => candidate.Role)
            .SingleOrDefaultAsync(
                candidate => candidate.Username == username,
                cancellationToken);

        if (user is null ||
            _passwordHasher.VerifyHashedPassword(user, user.Password, password) ==
                PasswordVerificationResult.Failed)
        {
            return null;
        }

        return user.Role?.Role;
    }
}
