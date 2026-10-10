import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export function createSourceStorageContextPorts(
  budget: SourceStorageBudget,
  inputsFor: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined,
) {
  const selections = new Map<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>();
  const isPort = (subject: SourceStorageSubject): boolean => subject.kind === "receiver" || subject.kind === "input";
  const firstPorts = (subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(subject);
    if (cached !== undefined) return cached;
    return budget.withRows(rows => {
      const pending: SourceStorageSubject[] = [];
      const visited = new Set<SourceStorageSubject>();
      const ports = new Set<SourceStorageSubject>();
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
          const inputs = inputsFor(current);
          if (inputs === undefined) return undefined;
          for (const input of inputs) {
            if (!budget.step() || !schedule(input)) return undefined;
          }
        }
      }
      const retained = budget.createRows();
      if (!retained.add(1 + ports.size)) { retained.release(); return undefined; }
      selections.set(subject, ports);
      return ports;
    });
  };
  return Object.freeze({ isPort, firstPorts });
}
