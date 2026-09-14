import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminStoragePanel from "./AdminStoragePanel";

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AdminStoragePanel", () => {
  it("validates tenths of a GB and saves company extra capacity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/admin/storage-settings") return response({ baseLimitBytes: 5_000_000_000, updatedAt: "2026-01-01", updatedBy: 1 });
      if (url === "/api/admin/companies/10/storage" && init?.method === "PUT") return response({ ...JSON.parse(String(init.body)), companyId: 10 });
      if (url === "/api/admin/companies/10/storage") return response({ companyId: 10, adminExtraBytes: 500_000_000, purchasedExtraBytes: 0, totalCapacityBytes: 5_500_000_000, occupiedBytes: 1_000_000_000, reservedBytes: 0, availableBytes: 4_500_000_000, usagePercent: 18.2, isOverCapacity: false });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    render(<AdminStoragePanel companyId={10} disabled={false} />);
    const extra = await screen.findByLabelText(/Espaço adicional/);
    await user.clear(extra); await user.type(extra, "0.55");
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("incrementos de 0,1 GB");
    await user.clear(extra); await user.type(extra, "1.2");
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[1]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/companies/10/storage", expect.objectContaining({ body: JSON.stringify({ adminExtraBytes: 1_200_000_000 }) })));
  });
});
