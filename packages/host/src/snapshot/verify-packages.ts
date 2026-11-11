import type { Violation } from "../diag/contract.js";
import type { ModuleId, PackageId } from "../ids/contract.js";
import type {
  CapturedFile, PackageComponent, PackageSnapshot, SnapshotPackage, SnapshotRule, SnapshotSite,
} from "./contract.js";

type SnapshotViolation = Violation<SnapshotRule, SnapshotSite>;

interface PackageNode {
  readonly id: PackageId;
  readonly references: readonly PackageId[];
  readonly owner: ComponentNode;
  readonly outgoing: PackageNode[];
  readonly incoming: PackageNode[];
}

interface PackageRecord {
  readonly value: SnapshotPackage;
  readonly references: PackageId[];
}

interface ComponentNode {
  readonly value: PackageComponent;
  readonly references: readonly PackageId[];
  readonly members: PackageNode[];
  readonly dependencies: Map<PackageId, ComponentNode>;
  readonly dependents: Map<PackageId, ComponentNode>;
  pending: number;
}

export interface PackageVerification {
  readonly violations: readonly SnapshotViolation[];
  readonly packageIds: ReadonlySet<PackageId>;
  readonly modulePackages: ReadonlyMap<ModuleId, ReadonlySet<PackageId>>;
  readonly filePaths: ReadonlySet<string>;
}

export function snapshotRows<Value>(values: readonly Value[], site: SnapshotSite,
  field: string, violations: SnapshotViolation[]): readonly Value[] {
  const present: Value[] = [];
  for (const [index, value] of values.entries()) {
    if (Object.hasOwn(values, index)) present.push(value);
    else violations.push({ rule: "stable-order", site,
      detail: [{ kind: "text", value: field }, { kind: "number", value: index }] });
  }
  return present;
}

function canonicalPath(path: string): boolean {
  if (path === "/" || /^[A-Za-z]:\/$/u.test(path)) return true;
  return /^\/{0,2}(?:[^/\\\0]+\/)*[^/\\\0]+$/u.test(path)
    && !/(?:^|\/)\.{1,2}(?:\/|$)/u.test(path);
}

function contained(root: string, path: string): boolean {
  return path.length > root.length && path.startsWith(root)
    && (root.endsWith("/") || path.charAt(root.length) === "/");
}

function connected(members: readonly PackageNode[], reverse: boolean): boolean {
  const allowed = new Set(members.map(member => member.id));
  for (const first of members.slice(0, 1)) {
    const visited = new Set<PackageId>([first.id]);
    const work = [first];
    for (const node of work) {
      for (const next of reverse ? node.incoming : node.outgoing) {
        if (allowed.has(next.id) && !visited.has(next.id)) {
          visited.add(next.id);
          work.push(next);
        }
      }
    }
    return visited.size === allowed.size;
  }
  return true;
}

export function verifyPackageSnapshot(snapshot: PackageSnapshot): PackageVerification {
  const violations: SnapshotViolation[] = [];
  const snapshotSite: SnapshotSite = { kind: "snapshot" };
  const add = (rule: SnapshotRule, site: SnapshotSite, ...details: string[]): void => {
    violations.push({ rule, site, detail: details.map(value => ({ kind: "text", value })) });
  };
  const ordered = <Value>(values: readonly Value[], key: (value: Value) => string,
    rule: SnapshotRule, site: SnapshotSite, field: string): void => {
    let previous: string | null = null;
    for (const value of values) {
      const current = key(value);
      if (previous !== null && current < previous) {
        add(rule, site, field);
        return;
      }
      previous = current;
    }
  };
  const path = (value: string, site: SnapshotSite): void => {
    if (!canonicalPath(value)) add("canonical-path", site, value);
  };
  const packages = snapshotRows(snapshot.packages, snapshotSite, "packages", violations);
  const modules = snapshotRows(snapshot.modules, snapshotSite, "modules", violations);
  const files = snapshotRows(snapshot.files, snapshotSite, "files", violations);
  const components = snapshotRows(snapshot.components, snapshotSite, "components", violations);
  const libraryData = snapshotRows(snapshot.libraryData, snapshotSite, "libraryData", violations);
  const packageGroups = new Map<PackageId, [PackageRecord, ...PackageRecord[]]>();
  const modulePackages = new Map<ModuleId, Set<PackageId>>();
  const filePaths = new Set<string>();
  const filesByPath = new Map<string, [CapturedFile, ...CapturedFile[]]>();
  const packageNodes = new Map<PackageId, PackageNode>();
  ordered(packages, entry => entry.id, "packages-order", snapshotSite, "packages");
  ordered(modules, entry => entry.id, "modules-order", snapshotSite, "modules");
  ordered(files, entry => entry.path, "files-order", snapshotSite, "files");
  ordered(components, entry => entry.representative, "components-order", snapshotSite, "components");
  ordered(libraryData, entry => entry.package, "library-data-order", snapshotSite, "libraryData");
  for (const entry of packages) {
    const record: PackageRecord = { value: entry, references: [] };
    const group = packageGroups.get(entry.id);
    if (group === undefined) packageGroups.set(entry.id, [record]);
    else {
      group.push(record);
      add("package-id-unique", { kind: "package", package: entry.id }, entry.id);
    }
  }
  if (!packageGroups.has(snapshot.rootPackage)) {
    add("root-package-resolves", snapshotSite, snapshot.rootPackage);
  }
  for (const entry of modules) {
    const group = modulePackages.get(entry.id);
    if (group === undefined) modulePackages.set(entry.id, new Set([entry.package]));
    else {
      group.add(entry.package);
      add("module-id-unique", { kind: "module", module: entry.id }, entry.id);
    }
  }
  for (const file of files) {
    const site: SnapshotSite = { kind: "file", path: file.path };
    if (filePaths.has(file.path)) add("file-path-unique", site, file.path);
    filePaths.add(file.path);
    const matching = filesByPath.get(file.path);
    if (matching === undefined) filesByPath.set(file.path, [file]);
    else matching.push(file);
    path(file.path, site);
    switch (file.kind) {
      case "physical": path(file.realPath, site); break;
      case "virtual":
        if (!packageGroups.has(file.owner)) add("virtual-file-owner-resolves", site, file.owner);
        break;
    }
  }
  for (const group of packageGroups.values()) {
    for (const record of group) {
      const entry = record.value;
      const site: SnapshotSite = { kind: "package", package: entry.id };
      path(entry.packageRoot, site);
      path(entry.sourceRoot, site);
      if (entry.manifestPath !== null) path(entry.manifestPath, site);
      if (entry.pluginEntry !== null) path(entry.pluginEntry, site);
      if (entry.libraryEntry !== null) path(entry.libraryEntry, site);
      const dependencies = snapshotRows(entry.dependencies, site, "dependencies", violations);
      const exports = snapshotRows(entry.exports, site, "exports", violations);
      ordered(dependencies, dependency => `${dependency.name}\0${dependency.kind}`, "stable-order", site, "dependencies");
      ordered(exports, exported => exported.specifier, "exports-order", site, "exports");
      for (const dependency of dependencies) {
        if (dependency.resolved === null) {
          if (dependency.kind !== "optional") add("package-dependency-resolves", site, dependency.name);
        } else if (!packageGroups.has(dependency.resolved)) {
          add("package-dependency-resolves", site, dependency.name, dependency.resolved);
        } else record.references.push(dependency.resolved);
      }
      const specifiers = new Set<string>();
      for (const exported of exports) {
        if (specifiers.has(exported.specifier)) add("package-export-unique", site, exported.specifier);
        specifiers.add(exported.specifier);
        const targets = modulePackages.get(exported.module);
        if (targets === undefined) add("export-module-resolves", site, exported.module);
        else if (targets.size !== 1 || !targets.has(entry.id)) {
          add("export-package-agrees", site, exported.module);
        }
      }
    }
  }
  for (const entry of modules) {
    const site: SnapshotSite = { kind: "module", module: entry.id };
    path(entry.path, site);
    const owners = packageGroups.get(entry.package);
    if (owners === undefined) add("module-package-resolves", site, entry.package);
    else if (owners.length === 1) {
      const owner = owners[0].value;
      const root = entry.role === "source" ? owner.sourceRoot : owner.packageRoot;
      if (!contained(root, entry.path)) add("module-path-contained", site, entry.path, root);
    }
    if (!filePaths.has(entry.path)) add("module-file-resolves", site, entry.path);
  }
  const libraryOwners = new Set<PackageId>();
  for (const entry of libraryData) {
    const site: SnapshotSite = { kind: "package", package: entry.package };
    path(entry.path, { kind: "file", path: entry.path });
    if (libraryOwners.has(entry.package)) add("library-data-unique", site, entry.package);
    libraryOwners.add(entry.package);
    const owners = packageGroups.get(entry.package);
    if (owners === undefined) add("library-data-package-resolves", site, entry.package);
    else if (owners.length === 1) {
      const owner = owners[0].value;
      if (owner.libraryEntry !== entry.path) add("library-data-entry-exact", site, entry.path);
      if (!contained(owner.packageRoot, entry.path)) add("library-data-owner-exact", site, entry.path);
    }
    const matchingFiles = filesByPath.get(entry.path);
    if (matchingFiles === undefined) add("library-data-path-resolves", site, entry.path);
    else if (matchingFiles.length === 1) {
      const file = matchingFiles[0];
      if (file.kind === "virtual" && file.owner !== entry.package) {
        add("library-data-owner-exact", site, entry.path);
      }
    }
  }
  for (const entry of packages) {
    if (entry.libraryEntry !== null && !libraryOwners.has(entry.id)) {
      add("library-data-entry-exact", { kind: "package", package: entry.id }, entry.libraryEntry);
    }
  }
  const componentNodes: ComponentNode[] = [];
  const componentGroups = new Map<PackageId, [ComponentNode, ...ComponentNode[]]>();
  const memberships = new Map<PackageId, number>();
  let partition = true;
  for (const component of components) {
    const site: SnapshotSite = { kind: "package", package: component.representative };
    const memberIds = snapshotRows(component.packages, site, "component.packages", violations);
    ordered(memberIds, id => id, "stable-order", site, "component.packages");
    const references = snapshotRows(component.dependencies, site, "component.dependencies", violations);
    ordered(references, id => id, "stable-order", site, "component.dependencies");
    const members: PackageNode[] = [];
    const node: ComponentNode = { value: component, references, members, dependencies: new Map(), dependents: new Map(), pending: 0 };
    componentNodes.push(node);
    const matching = componentGroups.get(component.representative);
    if (matching === undefined) componentGroups.set(component.representative, [node]);
    else {
      matching.push(node);
      partition = false;
      add("component-membership-exact", site, "representative", component.representative);
    }
    let minimum: PackageId | null = null;
    for (const id of memberIds) {
      if (minimum === null || id < minimum) minimum = id;
      const matchingPackages = packageGroups.get(id);
      if (matchingPackages === undefined) {
        add("component-package-resolves", site, id);
        partition = false;
      } else if (matchingPackages.length === 1) {
        const member: PackageNode = { id, references: matchingPackages[0].references,
          owner: node, outgoing: [], incoming: [] };
        members.push(member);
        packageNodes.set(id, member);
      } else partition = false;
      const count = memberships.get(id);
      memberships.set(id, count === undefined ? 1 : count + 1);
      if (count !== undefined) partition = false;
    }
    if (minimum !== component.representative) add("component-representative", site, component.representative);
  }
  for (const id of packageGroups.keys()) {
    const count = memberships.get(id);
    if (count !== 1) {
      partition = false;
      add("component-membership-exact", { kind: "package", package: id }, id);
    }
  }
  for (const member of packageNodes.values()) {
    for (const reference of member.references) {
      const target = packageNodes.get(reference);
      if (target !== undefined) {
        member.outgoing.push(target);
        target.incoming.push(member);
      }
    }
  }
  if (partition) {
    for (const node of componentNodes) {
      const site: SnapshotSite = { kind: "package", package: node.value.representative };
      if (!connected(node.members, false) || !connected(node.members, true)) {
        add("component-membership-exact", site, "strongly-connected");
      }
      const expected = new Set<PackageId>();
      for (const member of node.members) {
        for (const target of member.outgoing) {
          if (target.owner.value.representative !== node.value.representative) expected.add(target.owner.value.representative);
        }
      }
      const expectedOrder = [...expected].sort();
      const actual = node.references;
      if (actual.length !== expectedOrder.length || actual.some((id, index) => id !== expectedOrder[index])) {
        add("component-dependencies-exact", site, "dependencies");
      }
      for (const id of actual) {
        const targets = componentGroups.get(id);
        if (targets !== undefined) {
          const dependency = targets[0];
          node.dependencies.set(dependency.value.representative, dependency);
          dependency.dependents.set(node.value.representative, node);
        }
      }
    }
    for (const node of componentNodes) node.pending = node.dependencies.size;
    const work = componentNodes.filter(node => node.dependencies.size === 0);
    for (const node of work) {
      for (const dependent of node.dependents.values()) {
        dependent.pending -= 1;
        if (dependent.pending === 0) work.push(dependent);
      }
    }
    if (work.length !== componentNodes.length) add("component-acyclic", snapshotSite, "components");
  }
  return { violations, packageIds: new Set(packageGroups.keys()), modulePackages, filePaths };
}
