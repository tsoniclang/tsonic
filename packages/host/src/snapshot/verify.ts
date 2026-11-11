import type { Violation } from "../diag/contract.js";
import type { ModuleId } from "../ids/contract.js";
import type { ExtensionReferenceEntry, ProjectSnapshot, SnapshotRule, SnapshotSite } from "./contract.js";
import { verifySnapshotExtensions } from "./verify-extensions.js";
import { snapshotRows, verifyPackageSnapshot } from "./verify-packages.js";

export function verifyProjectSnapshot(snapshot: ProjectSnapshot,
  actualExtensionReferences: readonly ExtensionReferenceEntry[]): readonly Violation<SnapshotRule, SnapshotSite>[] {
  const packages = verifyPackageSnapshot(snapshot.packages);
  const violations: Violation<SnapshotRule, SnapshotSite>[] = [...packages.violations,
    ...verifySnapshotExtensions(snapshot, actualExtensionReferences, packages)];
  const snapshotSite: SnapshotSite = { kind: "snapshot" };
  const selectionSite: SnapshotSite = { kind: "selection", targetId: snapshot.selection.target.id };
  const add = (rule: SnapshotRule, site: SnapshotSite, ...details: string[]): void => {
    violations.push({ rule, site, detail: details.map(value => ({ kind: "text", value })) });
  };
  const entry = packages.moduleOwners.get(snapshot.entryPoint);
  if (entry === undefined) add("entry-point-resolves", snapshotSite, snapshot.entryPoint);
  else if (entry.some(module => module.package !== snapshot.packages.rootPackage)) {
    add("entry-point-root", snapshotSite, snapshot.entryPoint);
  }
  const roots = snapshotRows(snapshot.roots, snapshotSite, "roots", violations);
  const rootIds = new Set<ModuleId>();
  for (const root of roots) {
    if (!packages.moduleOwners.has(root)) add("root-module-resolves", { kind: "module", module: root }, root);
    if (rootIds.has(root)) add("roots-unique", { kind: "module", module: root }, root);
    rootIds.add(root);
  }
  if (!rootIds.has(snapshot.entryPoint)) add("entry-point-root", snapshotSite, snapshot.entryPoint);
  const capabilities = snapshotRows(snapshot.selection.capabilityIds, selectionSite, "capabilityIds", violations);
  const capabilityIds = new Set<string>();
  for (const id of capabilities) {
    if (capabilityIds.has(id)) add("selection-capability-unique", selectionSite, id);
    capabilityIds.add(id);
  }
  const surfaces = snapshotRows(snapshot.selection.surfaceIds, selectionSite, "surfaceIds", violations);
  const surfaceIds = new Set<string>();
  for (const id of surfaces) {
    if (surfaceIds.has(id)) add("selection-surface-unique", selectionSite, id);
    surfaceIds.add(id);
  }
  const requested = snapshotRows(snapshot.selection.target.surfaces, selectionSite, "target.surfaces", violations);
  if (requested.length !== surfaces.length || requested.some((id, index) => id !== surfaces[index])) {
    add("selection-surfaces-agree", selectionSite, "surfaces");
  }
  const keyed = violations.map(value => ({ value,
    key: JSON.stringify([value.site, value.detail]),
  }));
  keyed.sort((left, right) => left.value.rule < right.value.rule ? -1 : left.value.rule > right.value.rule ? 1
    : left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  return keyed.map(entry => entry.value);
}
