import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const profile = { profileType: "client", userId: 3, username: "marta", displayName: "Marta", fullName: "Marta Silva", nif: "1", email: "marta@example.test", phoneNumber: "9", address: "Lisboa", companyId: null, companyName: null, roles: ["client"], availableCompanies: [{ id: 10, name: "Forma Norte" }, { id: 20, name: "Atelier Sul" }] };
const projects = [
  { id: 1, companyId: 10, companyName: "Forma Norte", title: "Casa Norte", code: "N-1", address: "Porto", googleMapsUrl: null, currentPhaseCode: null, isArchived: false, client: { id: 3, displayName: "Marta" }, members: [] },
  { id: 2, companyId: 20, companyName: "Atelier Sul", title: "Casa Sul", code: "S-1", address: "Faro", googleMapsUrl: null, currentPhaseCode: null, isArchived: false, client: { id: 3, displayName: "Marta" }, members: [] },
];

afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

it("groups client projects by company and searches by company name", async () => {
  sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile" ? jsonResponse(profile) : jsonResponse(projects));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/projects"]}><App /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: "Forma Norte", level: 2 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Atelier Sul", level: 2 })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Criar projeto/ })).not.toBeInTheDocument();
  await user.type(screen.getByRole("searchbox", { name: "Pesquisar projetos" }), "Forma Norte");
  expect(screen.getByText("Casa Norte")).toBeInTheDocument();
  expect(screen.queryByText("Casa Sul")).not.toBeInTheDocument();
});
