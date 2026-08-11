import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { clearAuthenticatedRoles } from "./auth";

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

const profileResponse = (
  profileType: "client" | "employee",
  architect = false,
) => ({
  profileType,
  userId: profileType === "client" ? 3 : 2,
  username: profileType === "client" ? "marta" : "ana",
  displayName: profileType === "client" ? "Marta Silva" : "Ana Martins",
  fullName: profileType === "client" ? "Marta Isabel Silva" : "Ana Sofia Martins",
  nif: "123456789",
  email: profileType === "client" ? "marta@example.test" : "ana@example.test",
  phoneNumber: "910000000",
  address: "Lisboa",
  companyId: profileType === "client" ? null : 10,
  companyName: profileType === "client" ? null : "Forma Norte",
  companyRole: profileType === "employee" ? "employee" : undefined,
  isArchitect: profileType === "employee" && architect,
  roles: profileType === "client"
    ? ["client"]
    : architect ? ["employee", "architect"] : ["employee"],
  availableCompanies: [{ id: 10, name: "Forma Norte" }],
});

const companyResponse = {
  id: 10,
  name: "Forma Norte",
  legalName: "Forma Norte — Arquitetura, Lda.",
  nif: "517403920",
  email: "geral@formanorte.pt",
  phoneNumber: "+351 213 445 890",
  address: "Rua das Flores, 28 · Lisboa",
  website: "https://formanorte.pt",
  isActive: true,
  createdAt: "2026-01-01",
  createdBy: 0,
  updatedAt: "2026-01-01",
  updatedBy: 0,
};

const dashboardProjects = [
  {
    id: 1,
    companyId: 10,
    companyName: "Forma Norte",
    title: "Casa do Vale",
    code: "CV-001",
    address: "Azeitão, Setúbal",
    googleMapsUrl: null,
    currentPhaseCode: "execution-project",
    isArchived: false,
    client: { id: 30, displayName: "Marta Silva" },
    members: [{ employeeId: 2, displayName: "Ana Martins", email: "ana@example.test" }],
  },
  {
    id: 2,
    companyId: 10,
    companyName: "Forma Norte",
    title: "Apartamento Alvalade",
    code: "AA-018",
    address: "Alvalade, Lisboa",
    googleMapsUrl: null,
    currentPhaseCode: "preliminary-study",
    isArchived: false,
    client: { id: 31, displayName: "Inês Costa" },
    members: [],
  },
  {
    id: 3,
    companyId: 10,
    companyName: "Forma Norte",
    title: "Projeto Arquivado",
    code: "ARQ-003",
    address: "Lisboa",
    googleMapsUrl: null,
    currentPhaseCode: null,
    isArchived: true,
    client: null,
    members: [],
  },
];

function mockCompanyDashboard(companyRole: "owner" | "employee" = "employee", projects = dashboardProjects) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    if (path === "/api/profile") {
      return new Response(JSON.stringify({ ...profileResponse("employee", true), companyRole }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path === "/api/projects/") {
      return new Response(JSON.stringify(projects), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path === "/api/projects/1") {
      return new Response(JSON.stringify({
        ...dashboardProjects[0],
        phases: [],
        canEditTimeline: false,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path === "/api/auth/logout" && init?.method === "POST") {
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
}

function mockClientDashboard() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    const body = path === "/api/profile" ? profileResponse("client") : dashboardProjects;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function mockProfile(profileType: "client" | "employee", architect = false) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(profileResponse(profileType, architect)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
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
  it("redirects an unauthenticated visit to the dashboard to sign-in", async () => {
    renderApp("/dashboard");

    expect(await screen.findByText("Sign in to Blueprint")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Bom dia, Ana/ })).not.toBeInTheDocument();
  });

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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      new Response(JSON.stringify(
        String(input) === "/api/auth/login"
          ? { status: "success", roles: ["platform admin"] }
          : [],
      ), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.queryByText("Sign in to Blueprint")).not.toBeInTheDocument());
    expect(await screen.findByRole("heading", { name: "Administração", level: 1 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    expect(sessionStorage.getItem("blueprint.auth.roles")).toBe(JSON.stringify(["platform admin"]));
    expect(sessionStorage.getItem("blueprint.auth.role")).toBeNull();
  });

  it("opens the dashboard after an employee logs in", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/auth/login") {
        return new Response(JSON.stringify({ status: "success", roles: ["employee"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(profileResponse("employee")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Bom dia, Ana" }))
      .toBeInTheDocument();
  });

  it("opens the dashboard after a client logs in", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/auth/login") {
        return new Response(JSON.stringify({ status: "success", roles: ["client"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(
        String(input) === "/api/profile" ? profileResponse("client") : [],
      ), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const user = await completeLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Bom dia, Marta" }))
      .toBeInTheDocument();
  });

  it("moves focus from username directly to password", async () => {
    const user = userEvent.setup();
    renderApp();

    const username = screen.getByLabelText("Username");
    const password = screen.getByLabelText("Password");
    await user.click(username);
    await user.tab();

    expect(password).toHaveFocus();
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
  beforeEach(() => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    mockCompanyDashboard();
  });

  it("renders real active projects with their phase and notification placeholder", async () => {
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projetos ativos" })).toBeInTheDocument();
    expect(await screen.findByText("Casa do Vale")).toBeInTheDocument();
    expect(screen.getByText("Projeto de Execução")).toBeInTheDocument();
    expect(screen.queryByText("Projeto Arquivado")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sem notificações")).toHaveLength(2);
    expect(screen.getByLabelText("Navegação principal")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Dashboard" })).queryByText("Mock"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar projeto/ })).not.toBeInTheDocument();
  });

  it("filters projects by client and clears the search", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await screen.findByText("Casa do Vale");

    await user.type(screen.getByLabelText("Pesquisar projetos"), "Inês Costa");

    expect(screen.getByText("Apartamento Alvalade")).toBeInTheDocument();
    expect(screen.queryByText("Casa do Vale")).not.toBeInTheDocument();
    expect(screen.getByText("1 projeto encontrado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar pesquisa" }));
    expect(screen.getByText("Casa do Vale")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Pesquisar projetos"), "Projeto inexistente");
    expect(screen.getByRole("heading", { name: "Não encontrámos projetos" })).toBeInTheDocument();
  });

  it("shows the owner action and opens a project by its real id", async () => {
    vi.restoreAllMocks();
    mockCompanyDashboard("owner");
    const user = userEvent.setup();
    renderApp("/dashboard");

    expect(await screen.findByRole("button", { name: /Criar projeto/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir projeto Casa do Vale" }));
    expect(await screen.findByRole("heading", { name: "Casa do Vale", level: 1 })).toBeInTheDocument();
  });

  it("opens the complete projects list from the dashboard link", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    await screen.findByText("Casa do Vale");
    await user.click(screen.getByRole("button", { name: "Ver todos os projetos" }));
    expect(await screen.findByRole("heading", { name: "Projetos", level: 1 })).toBeInTheDocument();
  });

  it("shows assigned architects instead of the client name on a client dashboard card", async () => {
    vi.restoreAllMocks();
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
    mockClientDashboard();
    renderApp("/dashboard");

    const title = await screen.findByText("Casa do Vale");
    const card = title.closest("article");
    expect(card).not.toBeNull();
    expect(within(card!).getByText("Ana Martins")).toBeInTheDocument();
    expect(within(card!).queryByText("Marta Silva")).not.toBeInTheDocument();
  });

  it("distinguishes an empty dashboard from a failed project request", async () => {
    vi.restoreAllMocks();
    mockCompanyDashboard("employee", []);
    const { unmount } = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Não existem projetos ativos" })).toBeInTheDocument();
    unmount();

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/profile") {
        return new Response(JSON.stringify(profileResponse("employee", true)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });
    renderApp("/dashboard");
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir a operação.");
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
    const fetchMock = vi.mocked(globalThis.fetch);
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Terminar sessão" }));

    expect(await screen.findByText("Sign in to Blueprint")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(sessionStorage.getItem("blueprint.auth.roles")).toBeNull();
    expect(sessionStorage.getItem("blueprint.auth.role")).toBeNull();
  });

  it("returns to sign-in when the active session is cleared", async () => {
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    clearAuthenticatedRoles();

    expect(await screen.findByText("Sign in to Blueprint")).toBeInTheDocument();
  });
});

describe("mockup navigation", () => {
  it("shows the completed administration destination without a mock label to platform admins", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    renderApp("/dashboard");

    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Projetos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administração" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ana Martins/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Mock parcial")).not.toBeInTheDocument();
  });

  it("hides the profile button from platform admins on shared portal navigation", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/administration");

    expect(await screen.findByRole("heading", { name: "Administração", level: 1 }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ana Martins/ })).not.toBeInTheDocument();
  });

  it("hides administration from users who are not platform admins", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    renderApp("/dashboard");

    expect(screen.queryByRole("button", { name: "Administração" })).not.toBeInTheDocument();
  });

  it("hides company settings from clients and protects direct access", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
    mockProfile("client");
    renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Definições" })).not.toBeInTheDocument();
  });

  it("hides company settings from employees without a company", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee"]));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ...profileResponse("employee"),
      companyId: null,
      companyName: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Bom dia, Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Definições" })).not.toBeInTheDocument();
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
  ])("renders %s", async (path, heading) => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee"]));
    if (path === "/administration") {
      sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    }
    if (path === "/profile") {
      sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
      mockProfile("employee", true);
    }
    if (path === "/settings") {
      sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee"]));
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
        new Response(JSON.stringify(
          String(input) === "/api/company"
            ? companyResponse
            : { ...profileResponse("employee"), companyRole: "owner" },
        ), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (path === "/projects/casa-do-vale") {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
        new Response(JSON.stringify(
          String(input) === "/api/profile"
            ? profileResponse("employee")
            : {
                id: 1,
                title: "Casa do Vale",
                code: "CV-001",
                address: "",
                googleMapsUrl: null,
                isArchived: false,
                client: null,
                members: [],
                phases: [],
                canEditTimeline: false,
              },
        ), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }
    if (path === "/clients/marta-silva") {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
        new Response(JSON.stringify(
          String(input) === "/api/profile"
            ? profileResponse("employee")
            : {
                id: 3,
                displayName: "Marta Silva",
                email: "marta@example.test",
                projectCount: 0,
                fullName: "Marta Isabel Silva",
                nif: "123456789",
                phoneNumber: "910000000",
                address: "Lisboa",
                internalNotes: "",
                projects: [],
                canManageProjects: false,
              },
        ), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }
    renderApp(path);
    expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it.each([
    [["employee"], "Perfil de colaboradora", "Ana Martins"],
    [["employee", "architect"], "Perfil de colaboradora", "Ana Martins"],
    [["client"], "Perfil de cliente", "Marta Silva"],
  ])("renders the %s page for the authenticated roles", async (roles, heading, name) => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(roles));
    mockProfile(roles.includes("client") ? "client" : "employee", roles.includes("architect"));
    renderApp("/profile");

    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name, level: 2 })).toBeInTheDocument();
  });

  it("keeps platform admins out of the client-facing profile route", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["platform admin"]));
    renderApp("/profile");

    expect(screen.getByRole("heading", { name: "Administração", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Perfil de utilizador")).not.toBeInTheDocument();
  });

  it("shows architect as an additional employee role", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    mockProfile("employee", true);
    renderApp("/profile");
    expect(await screen.findByText(/Colaboradora · Arquiteta · Forma Norte/)).toBeInTheDocument();
  });

  it("does not route the removed company role to a company profile", () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["company"]));
    renderApp("/profile");
    expect(screen.getByText("Sign in to Blueprint")).toBeInTheDocument();
    expect(screen.queryByText("Perfil de empresa")).not.toBeInTheDocument();
  });

  it("navigates from the dashboard to projects", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee"]));
    const user = userEvent.setup();
    renderApp("/dashboard");

    await user.click(screen.getByRole("button", { name: "Projetos" }));

    expect(screen.getByRole("heading", { name: "Projetos", level: 1 })).toBeInTheDocument();
  });

});
