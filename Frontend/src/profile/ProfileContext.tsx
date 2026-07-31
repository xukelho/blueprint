import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  CurrentProfile,
  loadCurrentProfile,
  ProfileApiError,
  saveCurrentProfile,
  UpdateCurrentProfile,
} from "../api/profile";
import { getAuthenticatedRoles } from "../auth";

type ProfileContextValue = {
  profile: CurrentProfile | null;
  isLoading: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  refresh: () => Promise<void>;
  updateProfile: (payload: UpdateCurrentProfile) => Promise<CurrentProfile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const hasProfileRole = () => {
  const roles = getAuthenticatedRoles();
  return roles.includes("client") || roles.includes("employee");
};

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(hasProfileRole);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!hasProfileRole()) {
      setProfile(null);
      setError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      setProfile(await loadCurrentProfile());
    } catch (caught) {
      setProfile(null);
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o perfil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleAuthChange = () => void refresh();
    window.addEventListener("blueprint:auth-changed", handleAuthChange);
    return () => window.removeEventListener("blueprint:auth-changed", handleAuthChange);
  }, [refresh]);

  const updateProfile = useCallback(async (payload: UpdateCurrentProfile) => {
    setError("");
    setFieldErrors({});
    try {
      const updated = await saveCurrentProfile(payload);
      setProfile(updated);
      return updated;
    } catch (caught) {
      if (caught instanceof ProfileApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError("Não foi possível guardar o perfil.");
      }
      throw caught;
    }
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profile, isLoading, error, fieldErrors, refresh, updateProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used inside ProfileProvider.");
  }
  return context;
}

export function useOptionalProfile() {
  return useContext(ProfileContext);
}

export function profileInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join("") || "?";
}

export function profileRoleLabel(profile: CurrentProfile) {
  if (profile.profileType === "client") return "Cliente";
  return profile.isArchitect
    ? "Colaboradora · Arquiteta"
    : "Colaboradora";
}
