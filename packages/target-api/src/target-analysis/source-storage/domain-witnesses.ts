import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageDomainBoundary } from "./types.js";

interface WitnessGroup {
  readonly values: SourceStorageDomainBoundary[];
  readonly kinds: Map<SourceStorageDomainBoundary["kind"], Map<Node, Set<SourceStorageSubject | undefined>>>;
  inputs?: Set<SourceStorageSubject | undefined>;
}

export function createSourceStorageDomainWitnesses(budget: SourceStorageBudget) {
  const groups = new Map<SourceStorageSubject, WitnessGroup>();
  const rows = budget.createRows();
  const empty: readonly SourceStorageDomainBoundary[] = Object.freeze([]);
  const noInputs: ReadonlySet<SourceStorageSubject | undefined> = new Set();
  return Object.freeze({
    add(subject: SourceStorageSubject | undefined, kind: SourceStorageDomainBoundary["kind"], exposure: Node,
      owner?: SourceStorageSubject): void {
      if (subject === undefined || !budget.step()) return;
      const group = groups.get(subject);
      const exposures = group?.kinds.get(kind);
      const owners = exposures?.get(exposure);
      if (owners?.has(owner)) return;
      const newInput = kind === "external-input" && group?.inputs?.has(owner) !== true;
      const cost = 2 + (group === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) + (owners === undefined ? 1 : 0)
        + (newInput ? group?.inputs === undefined ? 2 : 1 : 0);
      if (!rows.add(cost)) return;
      const selected: WitnessGroup = group ?? { values: [], kinds: new Map() };
      const selectedExposures = exposures ?? new Map<Node, Set<SourceStorageSubject | undefined>>();
      const selectedOwners = owners ?? new Set<SourceStorageSubject | undefined>();
      selectedOwners.add(owner);
      selectedExposures.set(exposure, selectedOwners);
      selected.kinds.set(kind, selectedExposures);
      selected.values.push(Object.freeze({ kind, subject, exposure, ...(owner === undefined ? {} : { owner }) }));
      if (newInput) {
        selected.inputs ??= new Set();
        selected.inputs.add(owner);
      }
      groups.set(subject, selected);
    },
    forSubject(subject: SourceStorageSubject): readonly SourceStorageDomainBoundary[] {
      return groups.get(subject)?.values ?? empty;
    },
    inputOwners(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject | undefined> {
      return groups.get(subject)?.inputs ?? noInputs;
    },
  });
}
