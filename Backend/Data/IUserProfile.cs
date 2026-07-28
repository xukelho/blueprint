namespace Blueprint.Api.Data;

public interface IUserProfile
{
    long Id { get; set; }

    long UserId { get; set; }

    string DisplayName { get; set; }

    string FullName { get; set; }

    string Nif { get; set; }

    string Email { get; set; }

    string PhoneNumber { get; set; }

    string Address { get; set; }
}
