import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

async function completeLoginForm() {
  const user = userEvent.setup();
  renderApp();
  await user.type(screen.getByLabelText("Username"), "admin");
  await user.type(screen.getByLabelText("Password"), "admin");
  return user;
}

describe("login", () => {
  it("validates empty credentials without calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your username.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts credentials and navigates after a successful login", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
    sessionStorage.setItem("blueprint.auth.role", "company");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success", roles: ["platform admin"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.queryByText("Sign in to Blueprint")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    expect(sessionStorage.getItem("blueprint.auth.roles")).toBe(JSON.stringify(["platform admin"]));
    expect(sessionStorage.getItem("blueprint.auth.role")).toBeNull();
  });

  it("opens administration after the current session gains the platform-admin role", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/auth/login") {
        return new Response(JSON.stringify({ status: "success", roles: ["platform admin"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if ([
        "/api/admin/roles",
        "/api/admin/users",
        "/api/admin/employees",
        "/api/admin/clients",
        "/api/admin/companies?includeInactive=true",
      ].includes(path)) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(await screen.findByRole("button", { name: "Administração" }));

    expect(await screen.findByRole("heading", { name: "Administração", level: 1 }))
      .toBeInTheDocument();
  });

  it("shows an invalid-credentials error for a rejected login", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "fail" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The username or password is incorrect.",
    );
    expect(screen.getByText("Sign in to Blueprint")).toBeInTheDocument();
  });

  it("shows a network error when the API cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network error"));
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach Blueprint. Please try again.",
    );
  });
});

describe("dashboard", () => {
  it("renders the architect dashboard and active projects", () => {
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projetos ativos" })).toBeInTheDocument();
    expect(screen.getByText("Casa do Vale")).toBeInTheDocument();
    expect(screen.getByLabelText("Navegação principal")).toBeInTheDocument();
  });

  it("filters projects by client and clears the search", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.type(screen.getByLabelText("Pesquisar projetos"), "Inês Costa");

    expect(screen.getByText("Apartamento Alvalade")).toBeInTheDocument();
    expect(screen.queryByText("Casa do Vale")).not.toBeInTheDocument();
    expect(screen.getByText("1 projeto encontrado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar pesquisa" }));
    expect(screen.getByText("Casa do Vale")).toBeInTheDocument();
  });

  it("collapses and expands the navigation", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Recolher navegação" }));
    expect(screen.getByRole("button", { name: "Expandir navegação" })).toBeInTheDocument();
  });

  it("logs out and returns to the sign-in page", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee"]));
    sessionStorage.setItem("blueprint.auth.role", "architect");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Terminar sessão" }));

    expect(await screen.findByText("Sign in to Blueprint")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(sessionStorage.getItem("blueprint.auth.roles")).toBeNull();
    expect(sessionStorage.getItem("blueprint.auth.role")).toBeNull();
  });
});

describe("mockup navigation", () => {
  it("shows the completed administration destination without a mock label to platform admins", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    renderApp("/dashboard");

    expect(screen.getByRole("button", { name: "Administração" })).toBeInTheDocument();
    expect(screen.queryByText("Mock parcial")).not.toBeInTheDocument();
  });

  it("hides administration from users who are not platform admins", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    renderApp("/dashboard");

    expect(screen.queryByRole("button", { name: "Administração" })).not.toBeInTheDocument();
  });

  it.each([
    ["/projects", "Projetos"],
    ["/projects/new", "Criar projeto"],
    ["/projects/casa-do-vale", "Casa do Vale"],
    ["/clients", "Clientes"],
    ["/clients/marta-silva", "Marta Silva"],
    ["/administration", "Administração"],
    ["/settings", "Definições"],
    ["/notifications", "Notificações"],
    ["/help", "Como podemos ajudar?"],
    ["/profile", "Perfil de colaboradora"],
  ])("renders %s", (path, heading) => {
    if (path === "/administration") {
      sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    }
    if (path === "/profile") {
      sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    }
    renderApp(path);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it.each([
    [["employee"], "Perfil de colaboradora", "Ana Martins"],
    [["employee", "architect"], "Perfil de colaboradora", "Ana Martins"],
    [["client"], "Perfil de cliente", "Marta Silva"],
  ])("renders the %s page for the authenticated roles", (roles, heading, name) => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(roles));
    renderApp("/profile");

    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name, level: 2 })).toBeInTheDocument();
  });

  it("keeps platform admins out of the client-facing profile route", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    renderApp("/profile");

    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.queryByText("Perfil de utilizador")).not.toBeInTheDocument();
  });

  it("shows architect as an additional employee role", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    renderApp("/profile");
    expect(screen.getByText(/Colaboradora · Arquiteta · Forma Norte/)).toBeInTheDocument();
  });

  it("does not route the removed company role to a company profile", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["company"]));
    renderApp("/profile");
    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.queryByText("Perfil de empresa")).not.toBeInTheDocument();
  });

  it("navigates from the dashboard to projects", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Projetos" }));

    expect(screen.getByRole("heading", { name: "Projetos", level: 1 })).toBeInTheDocument();
  });

});
