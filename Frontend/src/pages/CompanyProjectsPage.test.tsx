import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { setAuthenticatedRoles } from "../auth";
import { ProfileProvider } from "../profile/ProfileContext";
import { CompanyProjectsPage } from "./CompanyProjectsPage";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const ownerProfile = { profileType: "employee", userId: 1, username: "ana", displayName: "Ana", fullName: "Ana Martins", nif: "123", email: "ana@example.test", phoneNumber: "910", address: "Lisboa", companyId: 1, companyName: "Forma Norte", roles: ["employee"], availableCompanies: [], companyRole: "owner", isArchitect: true };
const project = { companyId: 1, companyName: "Forma Norte", address: "Lisboa", googleMapsUrl: null, client: null, members: [], currentPhaseCode: null };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("separates active and archived projects", async () => {
  setAuthenticatedRoles(["employee"]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input) === "/api/profile"
    ? response(ownerProfile)
    : response([
      { ...project, id: 1, title: "Projeto Ativo", code: "AT-1", isArchived: false },
      { ...project, id: 2, title: "Projeto Arquivado", code: "AR-2", isArchived: true },
    ]));

  render(<MemoryRouter><ProfileProvider><CompanyProjectsPage /></ProfileProvider></MemoryRouter>);

  const activeSection = (await screen.findByText("Projetos ativos")).closest("section")!;
  const archivedSection = screen.getByText("Projetos arquivados").closest("section")!;
  expect(within(activeSection).getByText("Projeto Ativo")).toBeInTheDocument();
  expect(within(activeSection).queryByText("Projeto Arquivado")).not.toBeInTheDocument();
  expect(within(archivedSection).getByText("Projeto Arquivado")).toBeInTheDocument();
  expect(within(archivedSection).queryByText("Projeto Ativo")).not.toBeInTheDocument();
});
