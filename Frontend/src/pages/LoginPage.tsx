import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { setAuthenticatedRoles } from "../auth";
import { BlueprintLogoMark } from "../components/BlueprintLogoMark";

type FieldErrors = {
  username?: string;
  password?: string;
};

type LoginResponse = {
  status: string;
  roles?: string[];
};

type QuickLoginOption = {
  label: string;
  username: string;
  password: string;
};

const QUICK_LOGIN_OPTIONS: QuickLoginOption[] = [
  { label: "Login as Admin", username: "admin", password: "admin" },
  { label: "Login as Architect", username: "arc1", password: "arc1" },
  { label: "Login as Client", username: "client1", password: "client1" },
];

function LoginPage() {
  const navigate = useNavigate();
  const isDevelopment = import.meta.env.MODE === "development";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = async (loginUsername: string, loginPassword: string) => {
    setErrors({});
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (response.ok) {
        const result = (await response.json()) as LoginResponse;
        if (result.status === "success") {
          const roles = result.roles ?? [];
          setAuthenticatedRoles(roles);
          navigate("/dashboard", { replace: true });
          return;
        }
      }

      if (response.status === 401) {
        setMessage("The username or password is incorrect.");
      } else {
        setMessage("We couldn't sign you in. Please try again.");
      }
    } catch {
      setMessage("We couldn't reach Blueprint. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!username.trim()) {
      nextErrors.username = "Enter your username.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    setMessage("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await login(username.trim(), password);
  };

  return (
    <main className="login-page">
      <section className="brand-panel" aria-label="About Blueprint">
        <div className="brand-panel__grid" aria-hidden="true" />
        <header className="brand">
          <span className="brand__mark" aria-hidden="true">
            <BlueprintLogoMark />
          </span>
          <span className="brand__name">blueprint</span>
        </header>

        <div className="brand-copy">
          <p className="eyebrow">Built for better decisions</p>
          <h1>Architecture is collaborative. Your workspace should be too.</h1>
          <p className="brand-copy__summary">
            Review revisions, resolve feedback, and keep every project decision
            clear—from first sketch to final approval.
          </p>
          <div className="project-card" aria-hidden="true">
            <div className="project-card__top">
              <span>Residence No. 04</span>
              <span className="status"><i /> In review</span>
            </div>
            <div className="drawing">
              <span className="drawing__room drawing__room--one" />
              <span className="drawing__room drawing__room--two" />
              <span className="drawing__room drawing__room--three" />
              <span className="drawing__room drawing__room--four" />
              <span className="drawing__note drawing__note--one"><Check size={12} /> 3</span>
              <span className="drawing__note drawing__note--two">2</span>
            </div>
            <div className="project-card__footer">
              <span>Ground floor · Revision 08</span>
              <div className="avatars">
                <span>MC</span><span>AR</span><span>+2</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="brand-panel__footer">
          <span>One source of truth for every project.</span>
          <span>© 2026 Blueprint</span>
        </footer>
      </section>

      <section className="form-panel">
        <div className="mobile-brand brand">
          <span className="brand__mark" aria-hidden="true">
            <BlueprintLogoMark />
          </span>
          <span className="brand__name">blueprint</span>
        </div>

        <div className="login-card">
          <div className="login-card__heading">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to Blueprint</h2>
            <p>Continue to your projects and conversations.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="username">Username</label>
              <div className={`input-wrap ${errors.username ? "input-wrap--error" : ""}`}>
                <User size={18} aria-hidden="true" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  maxLength={256}
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setErrors((current) => ({ ...current, username: undefined }));
                  }}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? "username-error" : undefined}
                />
              </div>
              {errors.username && <p className="field-error" id="username-error">{errors.username}</p>}
            </div>

            <div className="field">
              <div className="label-row">
                <label htmlFor="password">Password</label>
              </div>
              <div className={`input-wrap ${errors.password ? "input-wrap--error" : ""}`}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={1024}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button className="text-button forgot-password" type="button">Forgot password?</button>
              {errors.password && <p className="field-error" id="password-error">{errors.password}</p>}
            </div>

            <label className="remember">
              <input type="checkbox" name="remember" />
              <span className="checkbox" aria-hidden="true"><Check size={12} /></span>
              Keep me signed in
            </label>

            <button
              className="submit-button"
              type="submit"
              disabled={isSubmitting}
              autoFocus={isDevelopment}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
            <p className="form-message" role={message ? "alert" : "status"}>{message}</p>
          </form>

          {isDevelopment && (
            <section className="quick-login" aria-labelledby="quick-login-title">
              <div className="quick-login__heading">
                <h3 id="quick-login-title">Quick login</h3>
                <span>Development only</span>
              </div>
              <div className="quick-login__actions">
                {QUICK_LOGIN_OPTIONS.map((option) => (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void login(option.username, option.password)}
                    key={option.username}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="support-copy">
            New to Blueprint? <button className="text-button" type="button">Contact your practice administrator</button>
          </p>
        </div>

        <footer className="form-panel__footer">
          <button type="button">Privacy</button>
          <button type="button">Terms</button>
          <button type="button">Help</button>
        </footer>
      </section>
    </main>
  );
}

export default LoginPage;
