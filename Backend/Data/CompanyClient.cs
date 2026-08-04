namespace Blueprint.Api.Data;

public sealed class CompanyClient
{
    public long CompanyId { get; set; }

    public long ClientId { get; set; }

    public string InternalNotes { get; set; } = string.Empty;

    public Company? Company { get; set; }

    public Client? Client { get; set; }
}
