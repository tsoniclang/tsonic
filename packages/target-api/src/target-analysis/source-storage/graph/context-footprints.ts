import { createTargetGraphComponentQuery } from "../../graph-component-query.js";
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
  let empty: SourceStorageContextFootprint | undefined;
  let pendingEmpty: SourceStorageContextFootprint | undefined;
  let generated: SourceStorageRows[] | undefined;
  let running = false;
  const ownRows = (): SourceStorageRows => {
    const rows = budget.createRows();
    (generated ??= []).push(rows);
    return rows;
  };
  const select = createTargetGraphComponentQuery<SourceStorageSubject, FootprintInput, SourceStorageContextFootprint>(subject => {
    const port = (subject.kind === "receiver" || subject.kind === "input") && subject.projection.length === 0;
    const application = port ? undefined : applicationFor(subject);
    if (budget.failure() !== undefined) return undefined;
    const location = port || application !== undefined ? undefined : locationFor(subject);
    const inputs = port || application !== undefined || location === "binding" ? noInputs : inputsFor(subject);
    if (inputs === undefined || budget.failure() !== undefined) return undefined;
    return { data: { port: port ? subject : undefined, location: location === undefined ? undefined : subject, application },
      neighbours: inputs };
  }, members => {
    let selected: SourceStorageContextFootprint | undefined;
    let mutable: { readonly rows: SourceStorageRows; readonly ports: Set<SourceStorageSubject>;
      readonly locations: Set<SourceStorageSubject> } | undefined;
    const add = (kind: "ports" | "locations", value: SourceStorageSubject): boolean => {
      if ((mutable ?? selected)?.[kind].has(value)) return true;
      if (mutable === undefined) {
        const rows = ownRows();
        if (!rows.add(1)) return false;
        mutable = { rows, ports: new Set(), locations: new Set() };
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
    if (mutable !== undefined) return Object.freeze({ ports: mutable.ports, locations: mutable.locations });
    if (selected !== undefined) return selected;
    if (pendingEmpty === undefined) {
      if (!ownRows().add(1)) return undefined;
      pendingEmpty = Object.freeze({ ports: new Set<SourceStorageSubject>(), locations: new Set<SourceStorageSubject>() });
    }
    return pendingEmpty;
  }, budget);
  return Object.freeze({ select(subject: SourceStorageSubject): SourceStorageContextFootprint | undefined {
    if (running) {
      budget.reject("Source storage context footprints cannot expose an unfinished reentrant selection.");
      return undefined;
    }
    running = true;
    pendingEmpty = empty;
    let completed = false;
    try {
      const selected = select(subject);
      if (selected === undefined || budget.failure() !== undefined) return undefined;
      completed = true;
      empty = pendingEmpty;
      return selected;
    } finally {
      running = false;
      if (!completed) for (const rows of generated ?? []) rows.release();
      generated = undefined;
      pendingEmpty = undefined;
    }
  } });
}
