using Blueprint.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Authentication;

public sealed class DatabaseCredentialValidator(BlueprintDbContext dbContext)
    : ICredentialValidator
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<IReadOnlyList<string>?> GetRolesForValidCredentialsAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .Include(candidate => candidate.UserRoles)
                .ThenInclude(candidate => candidate.Role)
            .SingleOrDefaultAsync(
                candidate => candidate.Username == username,
                cancellationToken);

        if (user is null ||
            _passwordHasher.VerifyHashedPassword(user, user.Password, password) ==
                PasswordVerificationResult.Failed)
        {
            return null;
        }

        return user.UserRoles
            .OrderBy(candidate => candidate.RoleId)
            .Select(candidate => candidate.Role!.Name)
            .ToArray();
    }
}
