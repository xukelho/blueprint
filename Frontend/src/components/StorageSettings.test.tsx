import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StorageSettings from "./StorageSettings";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("StorageSettings", () => {
  it("shows shared capacity, reservations, and sorted project usage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      baseLimitBytes: 5_000_000_000, adminExtraBytes: 0, purchasedExtraBytes: 0, totalCapacityBytes: 5_000_000_000,
      occupiedBytes: 2_000_000_000, reservedBytes: 500_000_000, availableBytes: 2_500_000_000,
      usagePercent: 50, isOverCapacity: false,
      projects: [
        { projectId: 2, title: "Projeto maior", code: "PM", isArchived: false, occupiedBytes: 2_000_000_000, reservedBytes: 500_000_000, totalBytes: 2_500_000_000 },
        { projectId: 1, title: "Projeto vazio", code: "PV", isArchived: true, occupiedBytes: 0, reservedBytes: 0, totalBytes: 0 },
      ],
    }), { headers: { "Content-Type": "application/json" } }));
    render(<MemoryRouter><StorageSettings /></MemoryRouter>);

    expect(await screen.findByText("5 GB total")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("2 GB ocupados")).toBeInTheDocument();
    expect(screen.getByText("0,5 GB reservados")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Projeto maior")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Projeto vazio")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Arquivado/)).toBeInTheDocument();
  });

  it("caps the visual percentage and announces over-capacity usage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      baseLimitBytes: 5_000_000_000, adminExtraBytes: 0, purchasedExtraBytes: 0, totalCapacityBytes: 5_000_000_000,
      occupiedBytes: 5_500_000_000, reservedBytes: 0, availableBytes: 0, usagePercent: 110, isOverCapacity: true, projects: [],
    }), { headers: { "Content-Type": "application/json" } }));
    render(<MemoryRouter><StorageSettings /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("excedeu a capacidade");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("110%")).toBeInTheDocument();
    expect(screen.getByText("Ainda não existem projetos.")).toBeInTheDocument();
  });
});
