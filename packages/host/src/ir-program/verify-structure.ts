import { ProgramWork } from "./work.js";
import type { DefId, ModuleId, PackageId } from "../ids/contract.js";
import { encodeDefId, encodeModuleId } from "../ids/index.js";
import type { ArtifactBindings, BodyInstance } from "../ir-types/contract.js";
import { bindingVectorKey, instanceKey } from "../ir-types/index.js";
import { encodeKey } from "../ids/index.js";
import type { ProgramIndex, ProgramSite, ProgramVerificationContext } from "./contract.js";
import type { ProgramLookup, ProgramViolation } from "./program-values.js";
import { compareInstances, compareText, numberDetail, summaryBindingsOf, summaryReferenceKey, summaryReferenceOf, textDetail } from "./program-values.js";

export function verifyBindingBounds(index: ProgramIndex, context: ProgramVerificationContext): readonly ProgramViolation[] {
  const maximum = ProgramWork.state(context.resources).limits.maximumBindingVectorsPerArtifact;
  const groups = new Map<string, { readonly bindings: Set<string>; exceeded: boolean }>();
  const violations: ProgramViolation[] = [];
  function register(artifact: string, bindings: ArtifactBindings, site: ProgramSite): void {
    if (bindings.kind === "parametric") return;
    let group = groups.get(artifact);
    if (group === undefined) {
      group = { bindings: new Set<string>(), exceeded: false };
      groups.set(artifact, group);
    }
    if (group.exceeded) return;
    const key = bindingVectorKey(bindings.bindings);
    if (group.bindings.has(key)) return;
    group.bindings.add(key);
    if (group.bindings.size > maximum) {
      group.exceeded = true;
      violations.push({ rule: "binding-vectors-bounded", site, detail: [numberDetail(maximum), numberDetail(group.bindings.size)] });
    }
  }
  for (const body of index.bodies) register(encodeKey(["body", body.instance.body]), body.instance.bindings, { kind: "body", instance: body.instance });
  for (const metadata of index.metadata) register(encodeKey(["metadata", metadata.key.definition]), metadata.key.bindings, {
    kind: "artifact", artifact: { kind: "metadata", definition: metadata.key.definition }, bindings: metadata.key.bindings,
  });
  for (const summary of index.summaries) register(summaryReferenceKey(summaryReferenceOf(summary.key)), summaryBindingsOf(summary.key), {
    kind: "artifact", artifact: summaryReferenceOf(summary.key), bindings: summaryBindingsOf(summary.key),
  });
  return violations;
}

export function verifyPackages(lookup: ProgramLookup, index: ProgramIndex): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const root = lookup.packages.get(index.rootPackage);
  if (root === undefined || root === null) {
    violations.push({
      rule: "root-package-resolves", site: { kind: "index" }, detail: [textDetail(index.rootPackage)],
    });
  }
  let previousPackage: PackageId | null = null;
  for (const record of index.packages) {
    const site: ProgramSite = { kind: "package", package: record.id };
    if (previousPackage !== null && compareText(previousPackage, record.id) >= 0) {
      violations.push({ rule: "packages-order", site, detail: [textDetail(previousPackage), textDetail(record.id)] });
    }
    previousPackage = record.id;
    let previousDependency: PackageId | null = null;
    for (const dependency of record.dependencies) {
      if (previousDependency !== null && compareText(previousDependency, dependency) >= 0) {
        violations.push({
          rule: "package-dependencies-order", site,
          detail: [textDetail(previousDependency), textDetail(dependency)],
        });
      }
      previousDependency = dependency;
      const target = lookup.packages.get(dependency);
      if (target === undefined || target === null) {
        violations.push({ rule: "package-dependency-resolves", site, detail: [textDetail(dependency)] });
      }
    }
    let previousExport: string | null = null;
    for (const exported of record.exports) {
      if (previousExport !== null && compareText(previousExport, exported.specifier) >= 0) {
        violations.push({
          rule: "package-exports-order", site,
          detail: [textDetail(previousExport), textDetail(exported.specifier)],
        });
      }
      previousExport = exported.specifier;
      const target = lookup.modules.get(exported.module);
      if (target === undefined || target === null) {
        violations.push({
          rule: "package-export-resolves", site,
          detail: [textDetail(exported.specifier), textDetail(exported.module)],
        });
      }
    }
  }
  return violations;
}

export function verifyModules(lookup: ProgramLookup, index: ProgramIndex, context: ProgramVerificationContext): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  let previousModule: ModuleId | null = null;
  for (const record of index.modules) {
    const site: ProgramSite = { kind: "module", module: record.module };
    if (previousModule !== null && compareText(previousModule, record.module) >= 0) {
      violations.push({
        rule: "modules-order", site, detail: [textDetail(previousModule), textDetail(record.module)],
      });
    }
    previousModule = record.module;
    const owner = lookup.packages.get(record.package);
    const modulePath = context.modulePathOf(record.module);
    let ownershipMismatch = modulePath === null;
    if (modulePath !== null) {
      const encoded = encodeModuleId(modulePath);
      if (encoded !== record.module) violations.push({
        rule: "identity-path-exact", site, detail: [textDetail(record.module), textDetail(encoded)],
      });
      else ownershipMismatch = modulePath.package !== record.package;
    }
    if (owner === undefined || owner === null || ownershipMismatch) {
      violations.push({ rule: "module-package-resolves", site, detail: [textDetail(record.package)] });
    }
    let previousDefinition: DefId | null = null;
    for (const entry of record.items) {
      const itemSite: ProgramSite = { kind: "definition", definition: entry.definition };
      if (previousDefinition !== null && compareText(previousDefinition, entry.definition) >= 0) {
        violations.push({
          rule: "items-order", site: itemSite,
          detail: [textDetail(previousDefinition), textDetail(entry.definition)],
        });
      }
      previousDefinition = entry.definition;
      const definitionPath = context.definitionPathOf(entry.definition);
      if (definitionPath === null) {
        violations.push({
          rule: "definition-node-owner-exact", site: itemSite,
          detail: [textDetail(record.module), numberDetail(entry.node)],
        });
      } else {
        const encoded = encodeDefId(definitionPath);
        if (encoded !== entry.definition) violations.push({
          rule: "identity-path-exact", site: itemSite, detail: [textDetail(entry.definition), textDetail(encoded)],
        });
        else if (definitionPath.module !== record.module) violations.push({
          rule: "definition-node-owner-exact", site: itemSite,
          detail: [textDetail(record.module), numberDetail(entry.node)],
        });
      }
    }
    let previousExport: string | null = null;
    for (const exported of record.exports) {
      if (previousExport !== null && compareText(previousExport, exported.name) >= 0) {
        violations.push({
          rule: "exports-order", site,
          detail: [textDetail(previousExport), textDetail(exported.name)],
        });
      }
      previousExport = exported.name;
      const definition = lookup.definitions.get(exported.definition);
      if (definition === undefined || definition === null) {
        violations.push({
          rule: "export-definition-resolves", site,
          detail: [textDetail(exported.name), textDetail(exported.definition)],
        });
      }
    }
  }
  return violations;
}

export function verifyBodyInventory(lookup: ProgramLookup, index: ProgramIndex, context: ProgramVerificationContext): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  let previousInstance: BodyInstance | null = null;
  for (const record of index.bodies) {
    const site: ProgramSite = { kind: "body", instance: record.instance };
    const key = instanceKey(record.instance);
    if (previousInstance !== null && compareInstances(previousInstance, record.instance) >= 0) {
      violations.push({ rule: "body-index-order", site, detail: [textDetail(instanceKey(previousInstance)), textDetail(key)] });
    }
    previousInstance = record.instance;
    const owner = lookup.definitions.get(record.owner);
    if (owner === undefined || owner === null || context.facts.bodyOwner(record.instance.body) !== record.owner) {
      violations.push({ rule: "body-owner-resolves", site, detail: [textDetail(record.owner)] });
    }
    const module = lookup.modules.get(record.module);
    if (module === undefined || module === null || owner === undefined || owner === null || owner.module !== record.module) {
      violations.push({ rule: "body-module-resolves", site, detail: [textDetail(record.module)] });
    }
    const counts: readonly { readonly name: string; readonly count: number }[] = [
      { name: "mirLocalCount", count: record.mirLocalCount },
      { name: "mirConstantCount", count: record.mirConstantCount },
      { name: "mirPlaceCount", count: record.mirPlaceCount },
      { name: "mirBlockCount", count: record.mirBlockCount },
    ];
    for (const { name, count } of counts) {
      if (!Number.isSafeInteger(count) || count < 0 || Object.is(count, -0)) {
        violations.push({
          rule: "mir-counts-integral", site,
          detail: [textDetail(name), numberDetail(count)],
        });
      }
    }
  }
  return violations;
}
