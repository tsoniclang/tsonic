import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageScope } from "./scoped-model.js";

export interface SourceStorageDomainWitness extends Omit<SourceStorageDomainBoundary, "bindings"> {
  readonly creationBindings?: SourceStorageScope;
}

type WitnessKinds = Map<SourceStorageDomainBoundary["kind"], Map<Node, Set<SourceStorageSubject | undefined>>>;

interface WitnessGroup {
  readonly values: SourceStorageDomainWitness[];
  readonly kinds: WitnessKinds;
  contexts?: Map<SourceStorageScope, WitnessKinds>;
  inputs?: Set<SourceStorageSubject | undefined>;
}

export function createSourceStorageDomainWitnesses(budget: SourceStorageBudget) {
  const groups = new Map<SourceStorageSubject, WitnessGroup>();
  const rows = budget.createRows();
  let hasInputs = false;
  const empty: readonly SourceStorageDomainWitness[] = Object.freeze([]);
  const noInputs: ReadonlySet<SourceStorageSubject | undefined> = new Set();
  return Object.freeze({
    hasInputs: (): boolean => hasInputs,
    add(subject: SourceStorageSubject | undefined, kind: SourceStorageDomainBoundary["kind"], exposure: Node,
      owner?: SourceStorageSubject, creationBindings?: SourceStorageScope): void {
      if (subject === undefined || !budget.step()) return;
      const group = groups.get(subject);
      const kinds = creationBindings === undefined ? group?.kinds : group?.contexts?.get(creationBindings);
      const exposures = kinds?.get(kind);
      const owners = exposures?.get(exposure);
      if (owners?.has(owner)) return;
      const newInput = kind === "external-input" && group?.inputs?.has(owner) !== true;
      const cost = 2 + (group === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) + (owners === undefined ? 1 : 0)
        + (newInput ? group?.inputs === undefined ? 2 : 1 : 0)
        + (creationBindings === undefined ? 0 : 1 + (group?.contexts === undefined ? 1 : 0) + (kinds === undefined ? 1 : 0));
      if (!rows.add(cost)) return;
      const selected: WitnessGroup = group ?? { values: [], kinds: new Map() };
      const selectedKinds = creationBindings === undefined ? selected.kinds
        : kinds ?? new Map<SourceStorageDomainBoundary["kind"], Map<Node, Set<SourceStorageSubject | undefined>>>();
      const selectedExposures = exposures ?? new Map<Node, Set<SourceStorageSubject | undefined>>();
      const selectedOwners = owners ?? new Set<SourceStorageSubject | undefined>();
      selectedOwners.add(owner);
      selectedExposures.set(exposure, selectedOwners);
      selectedKinds.set(kind, selectedExposures);
      if (creationBindings !== undefined) {
        selected.contexts ??= new Map();
        selected.contexts.set(creationBindings, selectedKinds);
      }
      const witness = Object.freeze({ kind, subject, exposure, ...(owner === undefined ? {} : { owner }),
        ...(creationBindings === undefined ? {} : { creationBindings }) });
      selected.values.push(witness);
      if (newInput) {
        selected.inputs ??= new Set();
        selected.inputs.add(owner);
        hasInputs = true;
      }
      groups.set(subject, selected);
    },
    forSubject(subject: SourceStorageSubject, kind?: "external-input"): readonly SourceStorageDomainWitness[] {
      const group = groups.get(subject);
      if (kind === undefined) return group?.values ?? empty;
      if (group?.inputs === undefined) return empty;
      return group.values.filter(value => budget.step() && value.kind === kind);
    },
    inputOwners(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject | undefined> {
      return groups.get(subject)?.inputs ?? noInputs;
    },
  });
}
