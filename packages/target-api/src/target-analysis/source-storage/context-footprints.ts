import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export interface SourceStorageContextFootprint {
  readonly ports: ReadonlySet<SourceStorageSubject>;
  readonly locations: ReadonlySet<SourceStorageSubject>;
}

export function createSourceStorageContextFootprints(
  budget: SourceStorageBudget,
  inputsFor: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined,
  isLocation: (subject: SourceStorageSubject) => boolean,
  applicationFor: (subject: SourceStorageSubject) => SourceStorageContextFootprint | undefined = () => undefined,
) {
  const selections = new Map<SourceStorageSubject, SourceStorageContextFootprint>();
  const isPort = (subject: SourceStorageSubject): boolean => subject.kind === "receiver" || subject.kind === "input";
  const select = (subject: SourceStorageSubject): SourceStorageContextFootprint | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(subject);
    if (cached !== undefined) return cached;
    return budget.withRows(rows => {
      const pending: SourceStorageSubject[] = [];
      const visited = new Set<SourceStorageSubject>();
      const ports = new Set<SourceStorageSubject>();
      const locations = new Set<SourceStorageSubject>();
      const schedule = (input: SourceStorageSubject): boolean => {
        if (visited.has(input)) return true;
        if (!rows.add(1)) return false;
        visited.add(input);
        pending.push(input);
        return true;
      };
      if (!schedule(subject)) return undefined;
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const current = pending.pop()!;
        if (isPort(current)) ports.add(current);
        else {
          const application = applicationFor(current);
          if (budget.failure() !== undefined) return undefined;
          if (application !== undefined) {
            for (const port of application.ports) { if (!budget.step()) return undefined; ports.add(port); }
            for (const location of application.locations) { if (!budget.step()) return undefined; locations.add(location); }
            continue;
          }
          if (isLocation(current)) locations.add(current);
          const inputs = inputsFor(current);
          if (inputs === undefined) return undefined;
          for (const input of inputs) {
            if (!budget.step() || !schedule(input)) return undefined;
          }
        }
      }
      const retained = budget.createRows();
      if (!retained.add(1 + ports.size + locations.size)) { retained.release(); return undefined; }
      const footprint = Object.freeze({ ports, locations });
      selections.set(subject, footprint);
      return footprint;
    });
  };
  return Object.freeze({ select });
}
