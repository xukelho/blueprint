import { useEffect, useState } from "react";
import { administrationRequest, jsonRequest } from "../../api/administration";
import { formatStorage } from "../StorageSettings";

type Settings = { baseLimitBytes: number; updatedAt: string; updatedBy: number };
type Allocation = {
  companyId: number; adminExtraBytes: number; purchasedExtraBytes: number; totalCapacityBytes: number;
  occupiedBytes: number; reservedBytes: number; availableBytes: number; usagePercent: number; isOverCapacity: boolean;
};
const GB = 1_000_000_000;
const toInput = (bytes: number) => String(bytes / GB);

export default function AdminStoragePanel({ companyId, disabled }: { companyId: number; disabled: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [base, setBase] = useState("");
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [nextSettings, nextAllocation] = await Promise.all([
      administrationRequest<Settings>("/api/admin/storage-settings"),
      administrationRequest<Allocation>(`/api/admin/companies/${companyId}/storage`),
    ]);
    setSettings(nextSettings); setAllocation(nextAllocation);
    setBase(toInput(nextSettings.baseLimitBytes)); setExtra(toInput(nextAllocation.adminExtraBytes));
  };
  useEffect(() => { setError(""); setMessage(""); void load().catch(() => setError("Não foi possível carregar as definições de armazenamento.")); }, [companyId]);

  const bytes = (value: string) => Math.round(Number(value) * GB);
  const valid = (value: string) => Number.isFinite(Number(value)) && Number(value) >= 0 && Math.abs(Number(value) * 10 - Math.round(Number(value) * 10)) < 0.000001;
  const save = async (kind: "base" | "extra") => {
    const value = kind === "base" ? base : extra;
    if (!valid(value)) { setError("Utilize um valor não negativo em incrementos de 0,1 GB."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      if (kind === "base") await administrationRequest<Settings>("/api/admin/storage-settings", jsonRequest("PUT", { baseLimitBytes: bytes(value) }));
      else await administrationRequest<Allocation>(`/api/admin/companies/${companyId}/storage`, jsonRequest("PUT", { adminExtraBytes: bytes(value) }));
      await load(); setMessage("Capacidade atualizada.");
    } catch { setError("Não foi possível atualizar a capacidade."); }
    finally { setSaving(false); }
  };

  return <fieldset className="admin-profile-fields admin-storage" disabled={disabled || saving}>
    <legend>Armazenamento</legend>
    {error && <div className="admin-form-error" role="alert">{error}</div>}
    {message && <p className="admin-storage__success" role="status">{message}</p>}
    {!settings || !allocation ? <p>A carregar armazenamento…</p> : <>
      <div className="admin-form-grid">
        <label>Limite base global (GB)<span className="admin-storage__input"><input type="number" min="0" step="0.1" value={base} onChange={(event) => setBase(event.target.value)} /><button type="button" onClick={() => void save("base")}>Guardar</button></span><small>Aplica-se a todas as empresas.</small></label>
        <label>Espaço adicional (GB)<span className="admin-storage__input"><input type="number" min="0" step="0.1" value={extra} onChange={(event) => setExtra(event.target.value)} /><button type="button" onClick={() => void save("extra")}>Guardar</button></span><small>Concedido especificamente a esta empresa.</small></label>
        <label>Espaço adquirido<input readOnly value={formatStorage(allocation.purchasedExtraBytes)} /><small>Reservado para uma futura integração de faturação.</small></label>
        <label>Capacidade efetiva<input readOnly value={formatStorage(allocation.totalCapacityBytes)} /></label>
      </div>
      <dl className="admin-storage__usage">
        <div><dt>Ocupado</dt><dd>{formatStorage(allocation.occupiedBytes)}</dd></div>
        <div><dt>Reservado</dt><dd>{formatStorage(allocation.reservedBytes)}</dd></div>
        <div><dt>Disponível</dt><dd>{formatStorage(allocation.availableBytes)}</dd></div>
        <div><dt>Utilização</dt><dd className={allocation.isOverCapacity ? "is-over" : ""}>{allocation.usagePercent}%{allocation.isOverCapacity ? " · Acima do limite" : ""}</dd></div>
      </dl>
    </>}
  </fieldset>;
}
