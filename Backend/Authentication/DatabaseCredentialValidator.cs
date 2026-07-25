using Blueprint.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Authentication;

public sealed class DatabaseCredentialValidator(BlueprintDbContext dbContext)
    : ICredentialValidator
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<bool> ValidateAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Username == username,
                cancellationToken);

        return user is not null &&
            _passwordHasher.VerifyHashedPassword(user, user.Password, password) !=
                PasswordVerificationResult.Failed;
    }
}
