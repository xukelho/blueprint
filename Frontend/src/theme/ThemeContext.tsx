import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useProfile } from "../profile/ProfileContext";
import {
  applyThemePreference,
  cacheThemePreference,
  clearCachedThemePreference,
  millisecondsUntilNextBoundary,
  readCachedThemePreference,
  ThemePreference,
} from "../theme";

type ThemeContextValue = {
  preference: ThemePreference;
  previewTheme: (preference: ThemePreference) => void;
  clearThemePreview: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, isLoading } = useProfile();
  const [persistedPreference, setPersistedPreference] = useState<ThemePreference>(
    readCachedThemePreference,
  );
  const [previewPreference, setPreviewPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    if (profile) {
      setPersistedPreference(profile.themePreference);
      cacheThemePreference(profile.themePreference);
      return;
    }
    if (!isLoading) {
      setPersistedPreference("light");
      setPreviewPreference(null);
      clearCachedThemePreference();
    }
  }, [isLoading, profile]);

  const preference = previewPreference ?? persistedPreference;

  useEffect(() => {
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;

    const synchronise = () => {
      applyThemePreference(preference);
      if (boundaryTimer) clearTimeout(boundaryTimer);
      if (preference === "dynamic") {
        boundaryTimer = setTimeout(synchronise, millisecondsUntilNextBoundary());
      }
    };
    const synchroniseWhenVisible = () => {
      if (document.visibilityState === "visible") synchronise();
    };

    synchronise();
    window.addEventListener("focus", synchronise);
    document.addEventListener("visibilitychange", synchroniseWhenVisible);
    return () => {
      if (boundaryTimer) clearTimeout(boundaryTimer);
      window.removeEventListener("focus", synchronise);
      document.removeEventListener("visibilitychange", synchroniseWhenVisible);
    };
  }, [preference]);

  const previewTheme = useCallback((nextPreference: ThemePreference) => {
    setPreviewPreference(nextPreference);
  }, []);
  const clearThemePreview = useCallback(() => setPreviewPreference(null), []);
  const value = useMemo(
    () => ({ preference, previewTheme, clearThemePreview }),
    [clearThemePreview, preference, previewTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
