import type { Violation } from "../diag/contract.js";
import type { ModuleId } from "../ids/contract.js";
import type { ExtensionReferenceEntry, ProjectSnapshot, SnapshotRule, SnapshotSite, VerifyPreparedSource } from "./contract.js";
import { verifySnapshotExtensions } from "./verify-extensions.js";
import { snapshotRows, verifyPackageSnapshot } from "./verify-packages.js";

export function verifyProjectSnapshot(snapshot: ProjectSnapshot,
  actualExtensionReferences: readonly ExtensionReferenceEntry[]): readonly Violation<SnapshotRule, SnapshotSite>[] {
  const input = snapshot.source.input;
  const packages = verifyPackageSnapshot(input.packages);
  const violations: Violation<SnapshotRule, SnapshotSite>[] = [...packages.violations,
    ...verifySnapshotExtensions(snapshot, actualExtensionReferences, packages)];
  const snapshotSite: SnapshotSite = { kind: "snapshot" };
  const selectionSite: SnapshotSite = { kind: "selection", targetId: snapshot.selection.target.id };
  const add = (rule: SnapshotRule, site: SnapshotSite, ...details: string[]): void => {
    violations.push({ rule, site, detail: details.map(value => ({ kind: "text", value })) });
  };
  if (input.packages.fingerprint.length === 0) add("snapshot-fingerprint", snapshotSite, "fingerprint");
  const entry = packages.modulePackages.get(snapshot.entryPoint);
  if (entry === undefined) add("entry-point-resolves", snapshotSite, snapshot.entryPoint);
  else if (entry.size !== 1 || !entry.has(input.packages.rootPackage)) {
    add("entry-point-root", snapshotSite, snapshot.entryPoint);
  }
  const roots = snapshotRows(input.roots, snapshotSite, "roots", violations);
  const rootIds = new Set<ModuleId>();
  for (const root of roots) {
    if (!packages.modulePackages.has(root)) add("root-module-resolves", { kind: "module", module: root }, root);
    if (rootIds.has(root)) add("roots-unique", { kind: "module", module: root }, root);
    rootIds.add(root);
  }
  if (!rootIds.has(snapshot.entryPoint)) add("entry-point-root", snapshotSite, snapshot.entryPoint);
  const external = snapshot.contributions.externalEntries;
  if (!Array.isArray(external)) add("external-entry-resolves", selectionSite, "externalEntries");
  else {
    const names = new Map<ModuleId, Set<string>>();
    for (const entry of snapshotRows(snapshot.contributions.externalEntries, selectionSite, "externalEntries", violations)) {
      if (typeof entry.module !== "string" || typeof entry.name !== "string" || !packages.modulePackages.has(entry.module)) {
        add("external-entry-resolves", selectionSite, "externalEntries");
        continue;
      }
      const selected = names.get(entry.module);
      if (selected === undefined) names.set(entry.module, new Set([entry.name]));
      else if (selected.has(entry.name)) add("external-entry-unique", selectionSite, entry.module, entry.name);
      else selected.add(entry.name);
    }
  }
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

export const verifyPreparedSource: VerifyPreparedSource = ({ input, preparation }) => {
  const violations: Violation<SnapshotRule, SnapshotSite>[] = [];
  const fail = (rule: SnapshotRule, detail: string, path?: string): void => {
    violations.push({ rule, site: path === undefined ? { kind: "snapshot" } : { kind: "file", path },
      detail: [{ kind: "text", value: detail }] });
  };
  const key = (path: string): string => input.caseSensitive ? path : path.toLowerCase();
  const modules = new Map<ModuleId, string>();
  for (const module of input.packages.modules) if (module != null) modules.set(module.id, module.path);
  const expected = new Set<string>();
  const root = (id: ModuleId): void => {
    const path = modules.get(id);
    if (path === undefined) fail("prepared-roots-exact", id);
    else expected.add(key(path));
  };
  for (const id of input.roots) root(id);
  for (const id of input.declarationModules) root(id);
  for (const binding of input.declarationPolicy.bundledLibraries) if (binding != null) root(binding.module);
  const original = new Map<string, string>();
  for (const file of input.packages.files) {
    if (file == null) continue;
    const path = key(file.path);
    if (original.has(path)) fail("prepared-file-exact", "captured path", file.path);
    original.set(path, file.text);
  }
  let position = 0;
  const rootPaths = [...expected];
  for (const row of preparation.roots) {
    if (row == null || key(row.fileName) !== rootPaths[position] || row.state !== "loaded") {
      fail("prepared-roots-exact", String(position));
    }
    position += 1;
  }
  if (position !== expected.size) fail("prepared-roots-exact", "root count");
  const prepared = new Set<string>();
  for (const file of preparation.files) {
    if (file == null) { fail("prepared-file-exact", "missing file row"); continue; }
    const path = key(file.fileName);
    if (!original.has(path) || prepared.has(path)) fail("prepared-file-exact", "file membership", file.fileName);
    prepared.add(path);
  }
  for (const rootPath of expected) if (!prepared.has(rootPath)) fail("prepared-file-exact", "root file", rootPath);
  for (const file of preparation.files) {
    if (file == null) continue;
    const text = original.get(key(file.fileName));
    if (text === undefined) continue;
    const length = text.charCodeAt(0) === 0xfeff ? text.length - 1 : text.length;
    for (const reference of file.references) {
      if (reference == null || !Number.isSafeInteger(reference.start) || !Number.isSafeInteger(reference.length) ||
        reference.start < 0 || reference.length < 0 || reference.start > length - reference.length ||
        (reference.resolution.kind === "resolved" && !prepared.has(key(reference.resolution.fileName)))) {
        fail("prepared-reference-exact", "reference site or resolved file", file.fileName);
      }
    }
  }
  return violations;
};
