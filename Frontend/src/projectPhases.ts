import { Calculator, ClipboardCheck, ClipboardList, CreditCard, DraftingCompass, FileCheck2, FilePenLine, Gavel, HardHat, KeyRound, Landmark, Network, PencilRuler, Ruler, SearchCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProjectPhaseDefinition = { code: string; label: string; icon: LucideIcon };

export const PROJECT_PHASES: ProjectPhaseDefinition[] = [
  { code: "preliminary-program", label: "Programa Preliminar / Definição de Requisitos", icon: ClipboardList },
  { code: "feasibility-studies", label: "Estudos de Viabilidade", icon: SearchCheck },
  { code: "topographic-survey", label: "Levantamento Topográfico", icon: Ruler },
  { code: "preliminary-study", label: "Estudo Prévio", icon: PencilRuler },
  { code: "preliminary-design", label: "Anteprojeto", icon: FilePenLine },
  { code: "licensing-project", label: "Projeto de Licenciamento", icon: Landmark },
  { code: "specialty-projects", label: "Projeto de Especialidades", icon: Network },
  { code: "execution-project", label: "Projeto de Execução", icon: DraftingCompass },
  { code: "measurements-and-budgeting", label: "Medições e Orçamentação", icon: Calculator },
  { code: "contractor-tender", label: "Concurso / Consulta a Empreiteiros", icon: Gavel },
  { code: "technical-construction-assistance", label: "Assistência Técnica à Obra", icon: HardHat },
  { code: "construction-supervision", label: "Fiscalização da Obra", icon: ClipboardCheck },
  { code: "handover-and-occupancy-license", label: "Receção da Obra e Licença de Utilização", icon: KeyRound },
  { code: "as-built", label: "As Built / Telas Finais", icon: FileCheck2 },
  { code: "payment", label: "Pagamento", icon: CreditCard }
];

export const QUICK_FILL_PHASE_CODES = [
  "feasibility-studies", "topographic-survey", "preliminary-study", "licensing-project", "specialty-projects", "execution-project", "measurements-and-budgeting", "technical-construction-assistance", "construction-supervision", "handover-and-occupancy-license", "as-built"
];

export const phaseLabel = (code: string | null | undefined) => PROJECT_PHASES.find((phase) => phase.code === code)?.label ?? null;
export const phaseDefinition = (code: string) => PROJECT_PHASES.find((phase) => phase.code === code)!;
