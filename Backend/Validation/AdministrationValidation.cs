namespace Blueprint.Api.Validation;

internal static class AdministrationValidation
{
    public static void ValidateProfile(
        Dictionary<string, string[]> errors,
        string? displayName,
        string? fullName,
        string? nif,
        string? email,
        string? phoneNumber,
        string? address)
    {
        ValidateRequired(errors, "displayName", displayName, "Display name", 256);
        ValidateRequired(errors, "fullName", fullName, "Full name", 512);
        ValidateRequired(errors, "nif", nif, "NIF", 32);
        ValidateRequired(errors, "email", email, "Email", 320);
        ValidateRequired(errors, "phoneNumber", phoneNumber, "Phone number", 64);
        ValidateRequired(errors, "address", address, "Address", 1024);
    }

    public static void ValidateRequired(
        Dictionary<string, string[]> errors,
        string key,
        string? value,
        string label,
        int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[key] = [$"{label} is required."];
        }
        else if (value.Length > maximumLength)
        {
            errors[key] = [$"{label} must not exceed {maximumLength} characters."];
        }
    }
}
