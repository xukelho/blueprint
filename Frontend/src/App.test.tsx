import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
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
});

describe("mockup navigation", () => {
  it.each([
    ["/projects", "Projetos"],
    ["/projects/new", "Criar projeto"],
    ["/projects/casa-do-vale", "Casa do Vale"],
    ["/clients", "Clientes"],
    ["/clients/marta-silva", "Marta Silva"],
    ["/settings", "Definições"],
    ["/notifications", "Notificações"],
    ["/help", "Como podemos ajudar?"],
    ["/profile", "Perfil de utilizador"],
  ])("renders %s", (path, heading) => {
    renderApp(path);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it("navigates from the dashboard to projects", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Projetos" }));

    expect(screen.getByRole("heading", { name: "Projetos", level: 1 })).toBeInTheDocument();
  });
});
