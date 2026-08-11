import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const employeeProfile = {
  profileType: "employee",
  userId: 2,
  username: "ana",
  displayName: "Ana Martins",
  fullName: "Ana Sofia Martins",
  nif: "123456789",
  email: "ana@forma.test",
  phoneNumber: "910000000",
  address: "Lisboa",
  companyId: 10,
  companyName: "Forma Norte",
  companyRole: "employee",
  isArchitect: true,
  roles: ["employee", "architect"],
  availableCompanies: [
    { id: 10, name: "Forma Norte" },
    { id: 20, name: "Atelier Sul" },
  ],
};

const clientProfile = {
  ...employeeProfile,
  profileType: "client",
  userId: 3,
  username: "marta",
  displayName: "Marta Silva",
  fullName: "Marta Isabel Silva",
  email: "marta@example.test",
  companyId: null,
  companyName: null,
  roles: ["client"],
};

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json" } },
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("editable profile", () => {
  it("loads and saves employee data, associations, and navigation identity", async () => {
    sessionStorage.setItem(
      "blueprint.auth.roles",
      JSON.stringify(["employee", "architect"]),
    );
    let submitted: Record<string, unknown> | null = null;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        if (String(input) !== "/api/profile") {
          throw new Error(`Unexpected request: ${String(input)}`);
        }
        if (init?.method === "PUT") {
          submitted = JSON.parse(String(init.body));
          return jsonResponse({
            ...employeeProfile,
            ...submitted,
            companyName: "Atelier Sul",
            roles: ["employee"],
          });
        }
        return jsonResponse(employeeProfile);
      },
    );
    const user = userEvent.setup();
    renderApp("/profile");

    expect(await screen.findByDisplayValue("Ana Sofia Martins")).toBeInTheDocument();
    const profileButton = screen.getByRole("button", { name: /Ana Martins/ });
    expect(within(profileButton).queryByText("Mock")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nome de apresentação"));
    await user.type(screen.getByLabelText("Nome de apresentação"), "Ana Costa");
    await user.selectOptions(screen.getByLabelText("Empresa"), "20");
    await user.click(screen.getByLabelText(/Arquiteta/));
    await user.click(screen.getByRole("button", { name: "Contactos" }));
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "ana.costa@example.test");
    await user.type(screen.getByLabelText("Website"), "https://mock.example");
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(await screen.findByRole("button", { name: /Guardado/ })).toBeInTheDocument();
    expect(submitted).toMatchObject({
      displayName: "Ana Costa",
      email: "ana.costa@example.test",
      companyId: 20,
      isArchitect: false,
    });
    expect(submitted).not.toHaveProperty("website");
    expect(screen.getByRole("button", { name: /Ana Costa/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("preserves entered values and displays backend field errors", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") {
        return jsonResponse({
          title: "Validation failed",
          errors: { Username: ["Username is required."] },
        }, 400);
      }
      return jsonResponse(clientProfile);
    });
    const user = userEvent.setup();
    renderApp("/profile");

    const username = await screen.findByLabelText("Nome de utilizador");
    expect(screen.queryByLabelText("Empresa")).not.toBeInTheDocument();
    expect(screen.getAllByText("Empresas associadas")).toHaveLength(2);
    expect(screen.getByText("Forma Norte")).toBeInTheDocument();
    expect(screen.getByText("Atelier Sul")).toBeInTheDocument();
    await user.clear(username);
    await user.click(screen.getByRole("button", { name: "Guardar alterações" }));

    expect(await screen.findByText("Username is required.")).toBeInTheDocument();
    expect(username).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível guardar o perfil.",
    );
  });

  it("uses the real client identity button to reach the client page from dashboard", async () => {
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      jsonResponse(String(input) === "/api/profile" ? clientProfile : []),
    );
    const user = userEvent.setup();
    renderApp("/dashboard");

    const profileButton = await screen.findByRole("button", { name: /Marta Silva/ });
    expect(within(profileButton).queryByText("Mock")).not.toBeInTheDocument();
    await user.click(profileButton);

    expect(await screen.findByRole("heading", {
      name: "Perfil de cliente",
      level: 1,
    })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Marta Silva", level: 2 }))
        .toBeInTheDocument();
    });
  });
});
