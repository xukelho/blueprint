import { FormEvent, useEffect, useState } from "react";
import { Trash2, UserPlus, X } from "lucide-react";
import {
  CompanyMember,
  CreateCompanyMember,
  createMember,
  deactivateMember,
  loadMembers,
  updateMember,
} from "../api/members";

const initial: CreateCompanyMember = {
  username: "",
  password: "",
  displayName: "",
  fullName: "",
  companyRole: "employee",
  isArchitect: false,
};

export default function MembersSettings() {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [form, setForm] = useState(initial);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<CompanyMember | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setMembers(await loadMembers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os membros.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true); setError("");
    try {
      const member = await createMember(form);
      setMembers((current) => [...current, member].sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-PT")));
      setForm(initial);
      setIsCreateDialogOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o membro.");
    } finally { setCreating(false); }
  };

  const change = async (member: CompanyMember, patch: Partial<Pick<CompanyMember, "companyRole" | "isArchitect">>) => {
    setUpdatingId(member.employeeId); setError("");
    try {
      const updated = await updateMember(member.employeeId, { companyRole: patch.companyRole ?? member.companyRole, isArchitect: patch.isArchitect ?? member.isArchitect });
      setMembers((current) => current.map((item) => item.employeeId === updated.employeeId ? updated : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o membro.");
    } finally { setUpdatingId(null); }
  };

  const deactivate = async (member: CompanyMember) => {
    setUpdatingId(member.employeeId); setError("");
    try {
      await deactivateMember(member.employeeId);
      setMembers((current) => current.filter((item) => item.employeeId !== member.employeeId));
      setMemberToDeactivate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desativar o membro.");
    } finally { setUpdatingId(null); }
  };

  return <div className="members-settings">
    {error && !isCreateDialogOpen && <div className="admin-form-error" role="alert">{error}</div>}
    {isLoading ? <p role="status">A carregar membros…</p> : <table>
      <thead><tr><th>Nome</th><th>Nome de apresentação</th><th>Função</th><th>Arquiteto/a</th><th /></tr></thead>
      <tbody>{members.map((member) => {
        const isUpdating = updatingId === member.employeeId;
        return <tr key={member.employeeId}>
          <td>{member.fullName}</td><td>{member.displayName}</td>
          <td><select aria-label={`Função de ${member.displayName}`} disabled={isUpdating} value={member.companyRole} onChange={(event) => void change(member, { companyRole: event.target.value as "owner" | "employee" })}><option value="owner">Proprietário</option><option value="employee">Colaborador</option></select></td>
          <td><input aria-label={`Arquiteto/a ${member.displayName}`} disabled={isUpdating} type="checkbox" checked={member.isArchitect} onChange={(event) => void change(member, { isArchitect: event.target.checked })} /></td>
          <td><button aria-label={`Desativar ${member.displayName}`} className="members-settings__delete" disabled={isUpdating} title="Desativar membro" type="button" onClick={() => { setError(""); setMemberToDeactivate(member); }}><Trash2 size={16} /></button></td>
        </tr>;
      })}{members.length === 0 && <tr><td colSpan={5}>Ainda não existem membros ativos.</td></tr>}</tbody>
    </table>}
    <div className="members-settings__actions">
      <button className="primary-action" type="button" onClick={() => { setError(""); setIsCreateDialogOpen(true); }}>
        <UserPlus size={17} />Criar membro
      </button>
    </div>
    {isCreateDialogOpen && <div className="mock-modal-backdrop" role="presentation">
      <section className="mock-modal members-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-member-title">
        <button className="mock-modal-close" type="button" aria-label="Fechar" disabled={creating} onClick={() => setIsCreateDialogOpen(false)}><X size={19} /></button>
        <h2 id="create-member-title">Criar membro</h2>
        <p>Adiciona um novo membro à empresa selecionada.</p>
        <form onSubmit={create} className="members-create-dialog__form">
          {error && <div className="admin-form-error" role="alert">{error}</div>}
          <label className="mock-field">Nome de utilizador<input required autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label className="mock-field">Palavra-passe temporária<input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label className="mock-field">Nome de apresentação<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
          <label className="mock-field">Nome completo<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
          <label className="mock-field">Função<select value={form.companyRole} onChange={(event) => setForm({ ...form, companyRole: event.target.value as "owner" | "employee" })}><option value="employee">Colaborador</option><option value="owner">Proprietário</option></select></label>
          <label className="mock-profile-check"><input type="checkbox" checked={form.isArchitect} onChange={(event) => setForm({ ...form, isArchitect: event.target.checked })} /> Arquiteto/a</label>
          <div className="mock-form-actions members-create-dialog__actions"><button className="secondary-action" type="button" disabled={creating} onClick={() => setIsCreateDialogOpen(false)}>Cancelar</button><button className="primary-action" disabled={creating}>{creating ? "A criar…" : "Criar membro"}</button></div>
        </form>
      </section>
    </div>}
    {memberToDeactivate && <div className="mock-modal-backdrop" role="presentation">
      <section className="mock-modal members-deactivate-dialog" role="alertdialog" aria-modal="true" aria-labelledby="deactivate-member-title" aria-describedby="deactivate-member-description">
        <button className="mock-modal-close" type="button" aria-label="Fechar" disabled={updatingId !== null} onClick={() => setMemberToDeactivate(null)}><X size={19} /></button>
        <span className="members-deactivate-dialog__icon"><Trash2 size={20} /></span>
        <h2 id="deactivate-member-title">Desativar membro?</h2>
        <p id="deactivate-member-description">{memberToDeactivate.displayName} deixará de ter acesso ao atelier. Poderás voltar a criar o membro mais tarde, se necessário.</p>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        <div className="mock-form-actions members-deactivate-dialog__actions">
          <button className="secondary-action" type="button" disabled={updatingId !== null} onClick={() => setMemberToDeactivate(null)}>Cancelar</button>
          <button className="admin-delete admin-delete--solid" type="button" disabled={updatingId !== null} onClick={() => void deactivate(memberToDeactivate)}>{updatingId !== null ? "A desativar…" : "Desativar membro"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
