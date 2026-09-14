import { HardDrive, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { CompanyStorageUsage, loadCompanyStorage } from "../api/company";

const GB = 1_000_000_000;
const MB = 1_000_000;
export const formatStorage = (bytes: number) => bytes === 0 || bytes >= 100 * MB
  ? `${(bytes / GB).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} GB`
  : `${(bytes / MB).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB`;

export default function StorageSettings() {
  const [usage, setUsage] = useState<CompanyStorageUsage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadCompanyStorage().then((value) => active && setUsage(value)).catch(() => active && setError("Não foi possível carregar a utilização de armazenamento."));
    return () => { active = false; };
  }, []);

  if (error) return <div className="admin-form-error" role="alert">{error}</div>;
  if (!usage) return <div className="storage-loading" role="status"><HardDrive size={24} />A carregar armazenamento…</div>;

  const denominator = Math.max(usage.totalCapacityBytes, usage.occupiedBytes + usage.reservedBytes, 1);
  const usedWidth = Math.min(100, usage.occupiedBytes * 100 / denominator);
  const reservedWidth = Math.min(100 - usedWidth, usage.reservedBytes * 100 / denominator);
  return <div className="storage-settings">
    <section className={`storage-summary${usage.isOverCapacity ? " is-over" : ""}`} aria-labelledby="storage-summary-title">
      <div className="storage-summary__heading"><div><h3 id="storage-summary-title">Armazenamento partilhado</h3><p>Todos os membros e projetos utilizam este espaço.</p></div><strong>{formatStorage(usage.totalCapacityBytes)} total</strong></div>
      <div className="storage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, usage.usagePercent)} aria-valuetext={`${usage.usagePercent}% utilizado`}>
        <span className="storage-bar__used" style={{ width: `${usedWidth}%` }} />
        <span className="storage-bar__reserved" style={{ width: `${reservedWidth}%` }} />
      </div>
      <div className="storage-summary__figures">
        <span><i className="is-used" />{formatStorage(usage.occupiedBytes)} ocupados</span>
        <span><i className="is-reserved" />{formatStorage(usage.reservedBytes)} reservados</span>
        <span>{formatStorage(usage.availableBytes)} livres</span>
        <strong>{usage.usagePercent}%</strong>
      </div>
      {usage.isOverCapacity && <p className="storage-overage" role="alert">O atelier excedeu a capacidade disponível. Novos carregamentos estão bloqueados.</p>}
    </section>
    <div className="storage-info"><Info size={18} /><p>Para aumentar a capacidade, contacte um administrador da plataforma.</p></div>
    <section className="storage-projects" aria-labelledby="storage-projects-title">
      <div className="storage-projects__heading"><div><h3 id="storage-projects-title">Utilização por projeto</h3><p>Inclui projetos ativos e arquivados.</p></div></div>
      <div className="storage-projects__table-wrap"><table><thead><tr><th>Projeto</th><th>Ocupado</th><th>Reservado</th><th>Total</th></tr></thead><tbody>
        {usage.projects.length === 0 && <tr><td className="storage-projects__empty" colSpan={4}>Ainda não existem projetos.</td></tr>}
        {usage.projects.map((project) => <tr key={project.projectId}><td><strong>{project.title}</strong><small>{project.code}{project.isArchived ? " · Arquivado" : ""}</small></td><td>{formatStorage(project.occupiedBytes)}</td><td>{formatStorage(project.reservedBytes)}</td><td><strong>{formatStorage(project.totalBytes)}</strong></td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}
