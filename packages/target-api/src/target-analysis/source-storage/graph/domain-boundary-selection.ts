import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageScope } from "./scoped-model.js";
import type { SourceStorageDomainWitness } from "./domain-witnesses.js";

type BoundaryOwners = Set<SourceStorageSubject | undefined>;
type BoundaryKinds = Map<SourceStorageDomainBoundary["kind"], BoundaryOwners>;
type BoundaryExposures = Map<Node, BoundaryKinds>;

export function createSourceStorageDomainBoundarySelection(rows: SourceStorageRows) {
  const contexts = new Map<SourceStorageScope, Map<SourceStorageSubject, BoundaryExposures>>();
  const values: SourceStorageDomainBoundary<SourceStorageScope>[] = [];
  const retain = (boundary: SourceStorageDomainWitness, bindings: SourceStorageScope): void => {
    const context = boundary.creationBindings ?? bindings;
    const subjects = contexts.get(context);
    const exposures = subjects?.get(boundary.subject);
    const kinds = exposures?.get(boundary.exposure);
    const owners = kinds?.get(boundary.kind);
    if (owners?.has(boundary.owner)) return;
    if (!rows.add(2 + (subjects === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) +
      (kinds === undefined ? 1 : 0) + (owners === undefined ? 1 : 0))) return;
    const selectedSubjects = subjects ?? new Map<SourceStorageSubject, BoundaryExposures>();
    const selectedExposures = exposures ?? new Map<Node, BoundaryKinds>();
    const selectedKinds = kinds ?? new Map<SourceStorageDomainBoundary["kind"], BoundaryOwners>();
    const selectedOwners = owners ?? new Set<SourceStorageSubject | undefined>();
    selectedOwners.add(boundary.owner);
    selectedKinds.set(boundary.kind, selectedOwners);
    selectedExposures.set(boundary.exposure, selectedKinds);
    selectedSubjects.set(boundary.subject, selectedExposures);
    contexts.set(context, selectedSubjects);
    values.push(Object.freeze({ kind: boundary.kind, subject: boundary.subject, exposure: boundary.exposure,
      ...(boundary.owner === undefined ? {} : { owner: boundary.owner }), bindings: context }));
  };
  return { values, retain };
}
