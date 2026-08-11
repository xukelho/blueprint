import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUp, MessageCircle, Pin, Send } from "lucide-react";
import { phaseDefinition, phaseLabel } from "../projectPhases";
import type { TimelinePhase } from "./ProjectTimelineEditor";

type ProjectFloorPlanProps = { phaseCode: string | null };
type MockMessage = { id: string; author: string; time: string; body: string; own?: boolean };
type MockConversation = { id: string; title: string; scope: "global" | string; messages: MockMessage[] };

const globalConversation: MockConversation = {
  id: "global",
  title: "Conversa geral do projeto",
  scope: "global",
  messages: [
    { id: "global-1", author: "Ana Martins", time: "09:42", body: "Partilhei a atualização do projeto para revisão." },
    { id: "global-2", author: "Marta Silva", time: "10:06", body: "Obrigada. Vamos rever e deixamos comentários ainda hoje." },
  ],
};

const phaseConversations = (phase: TimelinePhase): MockConversation[] => {
  const label = phaseLabel(phase.code) ?? phase.code;
  return [
    {
      id: `${phase.id}:decisions`, title: "Decisões e validações", scope: phase.id,
      messages: [
        { id: `${phase.id}-d1`, author: "Ana Martins", time: "Ontem", body: `Reuni neste tópico as decisões relativas a ${label.toLocaleLowerCase("pt-PT")}.` },
        { id: `${phase.id}-d2`, author: "Marta Silva", time: "08:35", body: "A solução apresentada está alinhada. Podemos avançar." },
      ],
    },
    {
      id: `${phase.id}:details`, title: "Dúvidas sobre a planta", scope: phase.id,
      messages: [
        { id: `${phase.id}-p1`, author: "Marta Silva", time: "11:18", body: "Podemos confirmar a dimensão livre junto à entrada da sala?" },
      ],
    },
  ];
};

export function ProjectFloorPlan({ phaseCode }: ProjectFloorPlanProps) {
  const phase = phaseCode ? phaseDefinition(phaseCode) : null;
  const PhaseIcon = phase?.icon;
  return <section className="mock-surface project-floor-plan" aria-labelledby="floor-plan-title">
    <header className="project-workspace-heading">
      <div><h2 id="floor-plan-title">Planta do projeto</h2><p>Planta ilustrativa · Piso 0</p></div>
      {phase && <span className="project-context-label">{PhaseIcon && <PhaseIcon size={15} aria-hidden="true" />}{phase.label}</span>}
    </header>
    <div className="project-floor-plan__canvas">
      <svg viewBox="0 0 920 560" role="img" aria-label="Planta ilustrativa do piso térreo">
        <title id="floor-plan-svg-title">Planta ilustrativa do piso térreo</title>
        <desc id="floor-plan-svg-description">Distribuição de sala, cozinha, escritório, quartos, instalações sanitárias e circulação.</desc>
        <defs>
          <pattern id="floor-plan-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" /></pattern>
        </defs>
        <rect className="floor-plan-grid" x="0" y="0" width="920" height="560" />
        <g className="floor-plan-walls">
          <path d="M90 58H830V500H90Z" />
          <path d="M90 300H545M545 58V500M690 58V300M545 196H830M295 300V500" />
        </g>
        <g className="floor-plan-windows">
          <path d="M170 58H310M380 58H500M830 105V165M830 350V430M365 500H485M130 500H230" />
        </g>
        <g className="floor-plan-doors">
          <path d="M545 236V294A58 58 0 0 1 487 236M690 142V194A52 52 0 0 1 638 142M295 385V438A53 53 0 0 1 242 385M545 385V442A57 57 0 0 1 488 385" />
        </g>
        <g className="floor-plan-fixtures">
          <rect x="115" y="84" width="174" height="42" rx="3" /><circle cx="145" cy="105" r="13" /><circle cx="185" cy="105" r="13" />
          <rect x="344" y="105" width="116" height="66" rx="3" /><rect x="365" y="120" width="74" height="36" rx="2" />
          <rect x="584" y="84" width="68" height="35" rx="3" /><rect x="720" y="89" width="74" height="78" rx="3" />
          <rect x="122" y="349" width="122" height="64" rx="4" /><rect x="334" y="350" width="164" height="90" rx="4" />
          <rect x="608" y="345" width="165" height="94" rx="4" /><circle cx="723" cy="247" r="23" />
        </g>
        <g className="floor-plan-labels">
          <text x="318" y="248">Sala de estar</text><text x="195" y="175">Cozinha</text><text x="612" y="156">I.S.</text>
          <text x="758" y="247">Escritório</text><text x="190" y="466">Quarto 1</text><text x="420" y="466">Quarto 2</text>
          <text x="688" y="468">Suite</text><text x="607" y="285">Circulação</text>
        </g>
        {phaseCode && <g className="floor-plan-annotations">
          <circle cx="545" cy="300" r="17" /><text x="545" y="305">1</text>
          <path d="M562 300H635" /><rect x="635" y="276" width="170" height="48" rx="5" />
          <text className="floor-plan-annotation-title" x="649" y="296">Ponto em revisão</text><text x="649" y="313">Encontro entre espaços</text>
        </g>}
        <g className="floor-plan-scale"><path d="M716 528H816M716 522V534M766 522V534M816 522V534" /><text x="716" y="551">0</text><text x="808" y="551">5 m</text></g>
      </svg>
    </div>
  </section>;
}

export function ProjectConversations({ phases, viewedPhaseId, currentUser }: { phases: TimelinePhase[]; viewedPhaseId: string | null; currentUser: string }) {
  const scopedConversations = useMemo(() => {
    const phase = phases.find((candidate) => candidate.id === viewedPhaseId);
    return phase ? phaseConversations(phase) : [];
  }, [phases, viewedPhaseId]);
  const allInitialMessages = useMemo(() => Object.fromEntries([globalConversation, ...phases.flatMap(phaseConversations)].map((thread) => [thread.id, thread.messages])), [phases]);
  const [messages, setMessages] = useState<Record<string, MockMessage[]>>(allInitialMessages);
  const [selectedThreadId, setSelectedThreadId] = useState(globalConversation.id);
  const [draft, setDraft] = useState("");

  useEffect(() => { setMessages(allInitialMessages); }, [allInitialMessages]);
  useEffect(() => {
    if (selectedThreadId !== globalConversation.id && !scopedConversations.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(scopedConversations[0]?.id ?? globalConversation.id);
    }
  }, [scopedConversations, selectedThreadId]);

  const availableThreads = [globalConversation, ...scopedConversations];
  const selectedThread = availableThreads.find((thread) => thread.id === selectedThreadId) ?? globalConversation;
  const selectedMessages = messages[selectedThread.id] ?? selectedThread.messages;
  const selectedPhase = phases.find((phase) => phase.id === viewedPhaseId);
  const submit = (event: FormEvent) => {
    event.preventDefault(); const body = draft.trim(); if (!body) return;
    setMessages((current) => ({ ...current, [selectedThread.id]: [...(current[selectedThread.id] ?? []), { id: `${selectedThread.id}-${Date.now()}`, author: currentUser, time: "Agora", body, own: true }] }));
    setDraft("");
  };

  return <aside className="mock-surface project-conversations" aria-labelledby="project-conversations-title">
    <header className="project-conversations__header"><div><h2 id="project-conversations-title">Conversas</h2><p>Cliente e equipa de arquitetura</p></div><MessageCircle size={20} aria-hidden="true" /></header>
    <nav className="project-conversations__threads" aria-label="Conversas do projeto">
      <div className="project-conversations__scope"><span>Projeto</span>
        <button className={selectedThreadId === globalConversation.id ? "is-active" : ""} type="button" onClick={() => setSelectedThreadId(globalConversation.id)}><Pin size={14} aria-hidden="true" /><span><strong>{globalConversation.title}</strong><small>Sempre disponível</small></span></button>
      </div>
      {selectedPhase && <div className="project-conversations__scope"><span>{phaseLabel(selectedPhase.code)}</span>
        {scopedConversations.map((thread) => <button className={selectedThreadId === thread.id ? "is-active" : ""} type="button" key={thread.id} onClick={() => setSelectedThreadId(thread.id)}><span className="project-conversation-dot" aria-hidden="true" /><span><strong>{thread.title}</strong><small>{messages[thread.id]?.length ?? thread.messages.length} mensagens</small></span></button>)}
      </div>}
    </nav>
    <section className="project-conversations__chat" aria-label={selectedThread.title}>
      <header><div><strong>{selectedThread.title}</strong><small>{selectedThread.scope === "global" ? "Todo o projeto" : phaseLabel(selectedPhase?.code)}</small></div>{selectedThread.scope === "global" && <Pin size={15} aria-label="Conversa global" />}</header>
      <div className="project-conversations__messages" aria-live="polite">
        {selectedMessages.map((message) => <article className={message.own ? "is-own" : ""} key={message.id}><div><strong>{message.author}</strong><time>{message.time}</time></div><p>{message.body}</p></article>)}
      </div>
      <form className="project-conversations__composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="project-conversation-message">Nova mensagem</label>
        <textarea id="project-conversation-message" rows={2} placeholder="Escrever uma mensagem…" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" aria-label="Enviar mensagem" disabled={!draft.trim()}><Send size={17} aria-hidden="true" /></button>
      </form>
    </section>
    <p className="project-conversations__mock-note"><ArrowUp size={13} aria-hidden="true" />Pré-visualização local — as mensagens não são guardadas.</p>
  </aside>;
}
