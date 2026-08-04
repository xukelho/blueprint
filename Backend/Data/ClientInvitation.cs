namespace Blueprint.Api.Data;

public sealed class ClientInvitation
{
    public long Id { get; set; }

    public long CompanyId { get; set; }

    public required string Email { get; set; }

    public DateTimeOffset SentAt { get; set; }

    public Company? Company { get; set; }
}
