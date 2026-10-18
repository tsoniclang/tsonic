import { createTargetGraphComponentQuery } from "../../graph-component-query.js";
import type { TargetGraphComponentMember } from "../../graph-component-query.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageContextLocation } from "./context-locations.js";

export interface SourceStorageContextFootprint {
  readonly ports: ReadonlySet<SourceStorageSubject>;
  readonly locations: ReadonlySet<SourceStorageSubject>;
}

interface FootprintInput {
  readonly port: SourceStorageSubject | undefined;
  readonly location: SourceStorageSubject | undefined;
  readonly application: SourceStorageContextFootprint | undefined;
}

export function createSourceStorageContextFootprints(
  budget: SourceStorageBudget,
  inputsFor: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined,
  locationFor: (subject: SourceStorageSubject) => SourceStorageContextLocation | undefined,
  applicationFor: (subject: SourceStorageSubject) => SourceStorageContextFootprint | undefined = () => undefined,
) {
  const noInputs = new Set<SourceStorageSubject>();
  const selections = new Map<SourceStorageSubject, SourceStorageContextFootprint>();
  const selectionRows = budget.createRows();
  let empty: SourceStorageContextFootprint | undefined;
  let pendingEmpty: SourceStorageContextFootprint | undefined;
  let generated: Map<SourceStorageContextFootprint, SourceStorageRows> | undefined;
  let running = false;
  const load = (subject: SourceStorageSubject) => {
    const selected = selections.get(subject);
    if (selected !== undefined) return { data: { port: undefined, location: undefined, application: selected }, neighbours: noInputs };
    const port = subject.kind === "receiver" || subject.kind === "input";
    const application = port ? undefined : applicationFor(subject);
    if (budget.failure() !== undefined) return undefined;
    const location = port || application !== undefined ? undefined : locationFor(subject);
    const inputs = port || application !== undefined || location === "binding" ? noInputs : inputsFor(subject);
    if (inputs === undefined || budget.failure() !== undefined) return undefined;
    return { data: { port: port ? subject : undefined, location: location === undefined ? undefined : subject, application },
      neighbours: inputs };
  };
  const reduce = (members: readonly TargetGraphComponentMember<SourceStorageSubject,
    FootprintInput, SourceStorageContextFootprint>[]): SourceStorageContextFootprint | undefined => {
    let selected: SourceStorageContextFootprint | undefined;
    let mutable: { readonly rows: SourceStorageRows; readonly ports: Set<SourceStorageSubject>;
      readonly locations: Set<SourceStorageSubject>; readonly value: SourceStorageContextFootprint } | undefined;
    const add = (kind: "ports" | "locations", value: SourceStorageSubject): boolean => {
      if ((mutable ?? selected)?.[kind].has(value)) return true;
      if (mutable === undefined) {
        const rows = budget.createRows();
        if (!rows.add(1)) return false;
        const ports = new Set<SourceStorageSubject>();
        const locations = new Set<SourceStorageSubject>();
        const value = Object.freeze({ ports, locations });
        mutable = { rows, ports, locations, value };
        generated?.set(value, rows);
        if (selected !== undefined) for (const name of ["ports", "locations"] as const)
          for (const input of selected[name]) {
            if (!budget.step() || !rows.add(1)) return false;
            mutable[name].add(input);
          }
      }
      if (!mutable.rows.add(1)) return false;
      mutable[kind].add(value);
      return true;
    };
    const merge = (footprint: SourceStorageContextFootprint): boolean => {
      if (selected === footprint && mutable === undefined) return true;
      if (selected === undefined && mutable === undefined) { selected = footprint; return true; }
      for (const name of ["ports", "locations"] as const) for (const input of footprint[name])
        if (!budget.step() || !add(name, input)) return false;
      return true;
    };
    for (const member of members) {
      for (const successor of member.successors) if (!merge(successor)) return undefined;
      const { port, location, application } = member.data;
      if (application !== undefined && !merge(application)) return undefined;
      if (port !== undefined && !add("ports", port)) return undefined;
      if (location !== undefined && !add("locations", location)) return undefined;
    }
    if (mutable !== undefined) {
      return mutable.value;
    }
    if (selected !== undefined) return selected;
    if (pendingEmpty === undefined) {
      const rows = budget.createRows();
      if (!rows.add(1)) return undefined;
      pendingEmpty = Object.freeze({ ports: new Set<SourceStorageSubject>(), locations: new Set<SourceStorageSubject>() });
      generated?.set(pendingEmpty, rows);
    }
    return pendingEmpty;
  };
  return Object.freeze({ select(subject: SourceStorageSubject): SourceStorageContextFootprint | undefined {
    if (!budget.step()) return undefined;
    const retained = selections.get(subject);
    if (retained !== undefined) return retained;
    if (running) {
      budget.reject("Source storage context footprints cannot expose an unfinished reentrant selection.");
      return undefined;
    }
    running = true;
    pendingEmpty = empty;
    generated = new Map();
    const queryRows: SourceStorageRows[] = [];
    let completed = false;
    let selected: SourceStorageContextFootprint | undefined;
    try {
      selected = (() => createTargetGraphComponentQuery<SourceStorageSubject, FootprintInput, SourceStorageContextFootprint>(load,
        reduce, { step: budget.step, createRows() {
          const rows = budget.createRows();
          queryRows.push(rows);
          return rows;
        } })(subject))();
      if (selected === undefined || budget.failure() !== undefined) return undefined;
      if (!selectionRows.add(1)) return undefined;
      selections.set(subject, selected);
      completed = true;
      empty = pendingEmpty;
      return selected;
    } finally {
      running = false;
      for (const rows of queryRows) rows.release();
      queryRows.length = 0;
      for (const [value, rows] of generated ?? []) if (!completed || value !== selected && value !== empty) rows.release();
      generated?.clear();
      generated = undefined;
      pendingEmpty = undefined;
    }
  } });
}
