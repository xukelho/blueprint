using Blueprint.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Authentication;

public sealed class DatabaseCredentialValidator(BlueprintDbContext dbContext)
    : ICredentialValidator
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<AuthenticatedUser?> GetUserForValidCredentialsAsync(
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

        if (user is null || !user.IsActive ||
            _passwordHasher.VerifyHashedPassword(user, user.Password, password) ==
                PasswordVerificationResult.Failed)
        {
            return null;
        }

        var roles = user.UserRoles
            .OrderBy(candidate => candidate.RoleId)
            .Select(candidate => candidate.Role!.Name)
            .ToArray();
        return new AuthenticatedUser(user.Id, user.Username, roles);
    }
}
