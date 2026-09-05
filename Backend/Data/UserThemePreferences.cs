namespace Blueprint.Api.Data;

public static class UserThemePreferences
{
    public const string Light = "light";
    public const string Dark = "dark";
    public const string Dynamic = "dynamic";

    public static bool IsValid(string? value) =>
        value is Light or Dark or Dynamic;
}
