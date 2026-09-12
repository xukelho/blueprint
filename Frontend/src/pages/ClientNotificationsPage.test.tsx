import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const profile = {
  profileType: "client",
  userId: 3,
  username: "marta",
  displayName: "Marta Silva",
  fullName: "Marta Silva",
  nif: "123456789",
  email: "marta@example.test",
  phoneNumber: "910000000",
  address: "Lisboa",
  companyId: null,
  companyName: null,
  roles: ["client"],
  availableCompanies: [] as Array<{ id: number; name: string }>,
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function renderPage() {
  sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["client"]));
  return render(<MemoryRouter initialEntries={["/notifications"]}><App /></MemoryRouter>);
}

describe("client notifications", () => {
  it("shows accessible invitation cards and updates memberships after accepting", async () => {
    let accepted = false;
    let releaseAccept!: () => void;
    const acceptPending = new Promise<void>((resolve) => { releaseAccept = resolve; });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return jsonResponse({ ...profile, availableCompanies: accepted ? [{ id: 10, name: "Forma Norte" }] : [] });
      if (path === "/api/notifications") return jsonResponse({ items: [], hasMore: false });
      if (path === "/api/notifications/summary") return jsonResponse({ unreadCount: 0, pendingInvitationCount: 2, total: 2 });
      if (path === "/api/client-invitations/received") return jsonResponse([
        { id: 41, companyId: 10, companyName: "Forma Norte", sentAt: "2026-08-04T10:00:00Z", expiresAt: "2026-08-07T10:00:00Z" },
        { id: 42, companyId: 20, companyName: "Atelier Sul", sentAt: "2026-08-03T10:00:00Z", expiresAt: "2026-08-06T10:00:00Z" },
      ]);
      if (path === "/api/client-invitations/41/accept" && init?.method === "POST") {
        await acceptPending;
        accepted = true;
        return new Response(null, { status: 204 });
      }
      if (path === "/api/client-invitations/42/reject" && init?.method === "POST") return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Recebeu um convite da empresa Forma Norte.")).toBeInTheDocument();
    const firstCard = screen.getByText("Recebeu um convite da empresa Forma Norte.").closest("article")!;
    expect(firstCard.parentElement).toHaveClass("mock-client-grid");
    expect(firstCard).toHaveClass("mock-client-card");
    expect(within(firstCard).getByText("FN")).toBeInTheDocument();
    const accept = within(firstCard).getByRole("button", { name: "Aceitar convite da empresa Forma Norte" });
    const reject = within(firstCard).getByRole("button", { name: "Recusar convite da empresa Forma Norte" });
    expect(accept).toHaveAttribute("title", "Aceitar convite da empresa Forma Norte");

    await user.click(accept);
    expect(accept).toBeDisabled();
    expect(reject).toBeDisabled();
    releaseAccept();
    await waitFor(() => expect(screen.queryByText("Recebeu um convite da empresa Forma Norte.")).not.toBeInTheDocument());
    expect(screen.getByText("Empresas associadas").nextElementSibling).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Recusar convite da empresa Atelier Sul" }));
    await waitFor(() => expect(screen.queryByText("Recebeu um convite da empresa Atelier Sul.")).not.toBeInTheDocument());
    expect(screen.getAllByText("Mock").length).toBeGreaterThan(0);
    const notificationsButton = screen.getByRole("button", { name: "Notificações" });
    expect(within(notificationsButton).queryByText("Mock")).not.toBeInTheDocument();
  });

  it("shows loading and error states", async () => {
    let rejectInvitations!: (reason: Error) => void;
    const pending = new Promise<Response>((_resolve, reject) => { rejectInvitations = reject; });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/profile") return jsonResponse(profile);
      if (String(input) === "/api/notifications") return jsonResponse({ items: [], hasMore: false });
      if (String(input) === "/api/notifications/summary") return jsonResponse({ unreadCount: 0, pendingInvitationCount: 0, total: 0 });
      if (String(input) === "/api/client-invitations/received") return pending;
      throw new Error("Unexpected request");
    });
    renderPage();
    expect(await screen.findByText("A carregar notificações…")).toBeInTheDocument();
    rejectInvitations(new Error("Falha de rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
  });

  it("renders project activity and marks a notification read", async () => {
    let markedRead = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === "/api/profile") return jsonResponse({ ...profile, profileType: "employee", companyId: 10, companyName: "Forma Norte", companyRole: "employee", isArchitect: true, roles: ["employee", "architect"] });
      if (path === "/api/notifications") return jsonResponse({ items: [{
        id: 71, type: "project.global_message_created", projectId: 9, projectTitle: "Casa do Vale",
        actorDisplayName: "Ana Martins", summary: "adicionou uma mensagem à conversa geral.",
        createdAt: "2026-09-11T10:30:00Z", readAt: markedRead ? "2026-09-11T10:31:00Z" : null,
        target: { kind: "globalMessage", projectId: 9, documentId: null, conversationId: null, messageId: 101 },
      }], hasMore: false });
      if (path === "/api/notifications/summary") return jsonResponse({ unreadCount: markedRead ? 0 : 1, pendingInvitationCount: 0, total: markedRead ? 0 : 1 });
      if (path === "/api/notifications/71/read" && init?.method === "PUT") { markedRead = true; return new Response(null, { status: 204 }); }
      throw new Error(`Unexpected request: ${path}`);
    });
    sessionStorage.setItem("blueprint.auth.roles", JSON.stringify(["employee", "architect"]));
    render(<MemoryRouter initialEntries={["/notifications"]}><App /></MemoryRouter>);

    const notification = await screen.findByRole("button", { name: /Ana Martins adicionou uma mensagem/ });
    await userEvent.setup().click(notification);
    await waitFor(() => expect(notification).not.toHaveClass("is-unread"));
    expect(markedRead).toBe(true);
  });
});
