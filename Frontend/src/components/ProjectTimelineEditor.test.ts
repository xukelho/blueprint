import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { ProjectTimelineView, TimelinePhase, TimelineRect, reorderTimelinePhase, timelineConnectorPath, timelineInsertionIndex } from "./ProjectTimelineEditor";

const rect = (left: number, top: number, width = 170, height = 166): TimelineRect => ({ left, top, width, height, right: left + width, bottom: top + height });
const phases: TimelinePhase[] = [{ id: "a", code: "feasibility-studies" }, { id: "b", code: "preliminary-design" }, { id: "c", code: "licensing-design" }];
const viewPhases: TimelinePhase[] = [{ id: "a", code: "feasibility-studies" }, { id: "b", code: "preliminary-study" }, { id: "c", code: "licensing-project" }];

describe("ProjectTimelineEditor helpers", () => {
  it("connects the final card of a row to the first card of the next row", () => {
    const root = rect(0, 0, 970, 368);
    const e = rect(784, 16);
    const f = rect(16, 200);

    expect(timelineConnectorPath(e, f, root)).toBe("M 869 182 V 191 H 101 V 200");
  });

  it("appends a catalog phase when dropped on the empty timeline area", () => {
    expect(timelineInsertionIndex([], "timeline-drop", false)).toBe(0);
    expect(timelineInsertionIndex(phases, "timeline-drop", false)).toBe(3);
  });

  it("inserts before or after the phase under the pointer", () => {
    expect(timelineInsertionIndex(phases, "b", false)).toBe(1);
    expect(timelineInsertionIndex(phases, "b", true)).toBe(2);
  });

  it("removes an existing phase when it is dropped outside the timeline", () => {
    expect(reorderTimelinePhase(phases, "b", null).map((phase) => phase.id)).toEqual(["a", "c"]);
  });

  it("renders only phases before the current one as completed", () => {
    render(createElement(ProjectTimelineView, { phases: viewPhases, currentPhaseId: "b" }));

    expect(screen.getByRole("button", { name: "Estudos de Viabilidade" })).toHaveClass("is-completed");
    expect(screen.getByRole("button", { name: "Estudo Prévio, fase atual" })).toHaveClass("is-current");
    expect(screen.getByRole("button", { name: "Projeto de Licenciamento" })).not.toHaveClass("is-completed", "is-current");
    expect(screen.queryByText("Projeto de Licenciamento")).not.toBeInTheDocument();
  });

  it("reveals labels only in expanded mode", () => {
    const { rerender } = render(createElement(ProjectTimelineView, { phases: viewPhases, currentPhaseId: "b" }));

    expect(screen.queryByText("Projeto de Licenciamento")).not.toBeInTheDocument();
    rerender(createElement(ProjectTimelineView, { phases: viewPhases, currentPhaseId: "b", expanded: true }));
    expect(screen.getByText("Projeto de Licenciamento")).toBeInTheDocument();
  });
});
