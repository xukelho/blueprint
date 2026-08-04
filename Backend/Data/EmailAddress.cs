using System.Net.Mail;

namespace Blueprint.Api.Data;

public static class EmailAddress
{
    public static string Normalize(string value) => value.Trim().ToLowerInvariant();

    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 320)
        {
            return false;
        }

        try
        {
            var parsed = new MailAddress(value.Trim());
            return string.Equals(parsed.Address, value.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
