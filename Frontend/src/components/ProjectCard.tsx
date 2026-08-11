import { Bell, ChevronRight, FolderKanban, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Project } from "../api/projects";
import { phaseLabel } from "../projectPhases";

type ProjectCardProps = {
  project: Project;
  canViewArchitects: boolean;
  showNotificationBar?: boolean;
  contactDisplay?: "client" | "architects";
};

export function ProjectCard({
  project,
  canViewArchitects,
  showNotificationBar = false,
  contactDisplay = "client",
}: ProjectCardProps) {
  const navigate = useNavigate();
  const openProject = () => navigate(`/projects/${project.id}`);
  const contactName = contactDisplay === "architects"
    ? project.members?.map((member) => member.displayName).join(", ") || "Sem arquiteto"
    : project.client?.displayName ?? "Sem cliente";

  return (
    <article className="mock-project-card mock-project-card--dashboard">
      <button
        className="mock-project-preview"
        type="button"
        aria-label={`Abrir projeto ${project.title}`}
        onClick={openProject}
      >
        <span className="mock-project-code">{project.code}</span>
        <FolderKanban aria-hidden="true" size={42} strokeWidth={1.35} />
      </button>
      <button className="mock-project-content" type="button" onClick={openProject}>
        <span className="mock-project-title">
          <strong>{project.title}</strong>
          <ChevronRight size={17} aria-hidden="true" />
        </span>
        <span>{contactName}</span>
        <span className="mock-muted-row">
          <MapPin size={14} aria-hidden="true" />
          {project.address}
        </span>
        {contactDisplay === "client" && canViewArchitects && project.members?.length ? (
          <span className="mock-project-members">
            Arquiteto{project.members.length === 1 ? "" : "s"}: {project.members.map((member) => member.displayName).join(", ")}
          </span>
        ) : null}
        <span className="mock-project-meta">
          <span>{phaseLabel(project.currentPhaseCode) ?? "Sem fase atual"}</span>
          <span>{project.code}</span>
        </span>
      </button>
      {showNotificationBar && (
        <div className="mock-project-footer" aria-label={`Notificações de ${project.title}`}>
          <span className="mock-notification-count mock-notification-count--empty">
            <Bell size={15} aria-hidden="true" />
            Sem notificações
          </span>
        </div>
      )}
    </article>
  );
}
