import type { Violation } from "../diag/contract.js";
import type { ModuleId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type {
  ExtensionReference, ExtensionReferenceEntry, PlatformDeclaration, ProjectSnapshot,
  SnapshotRule, SnapshotSite,
} from "./contract.js";
import type { PackageVerification } from "./verify-packages.js";
import { snapshotRows } from "./verify-packages.js";

function referenceKey(reference: ExtensionReference): string {
  return encodeKey([reference.package, reference.moduleSpecifier, reference.exportId, reference.version]);
}

function declarationKey(declaration: PlatformDeclaration): string {
  return encodeKey([declaration.providerId, declaration.providerVersion, declaration.providerModuleId,
    declaration.moduleSpecifier, declaration.exportId]);
}

function platformSite(declaration: PlatformDeclaration): SnapshotSite {
  return { kind: "platform", declaration: {
    providerId: declaration.providerId, providerVersion: declaration.providerVersion,
    providerModuleId: declaration.providerModuleId, moduleSpecifier: declaration.moduleSpecifier,
    exportId: declaration.exportId,
  } };
}

function prefixContains(prefix: string, specifier: string): boolean {
  return specifier === prefix || specifier.startsWith(prefix)
    && (prefix.endsWith("/") || prefix.endsWith(":") || specifier.charAt(prefix.length) === "/");
}

export function verifySnapshotExtensions(snapshot: ProjectSnapshot,
  actualReferences: readonly ExtensionReferenceEntry[], packages: PackageVerification): readonly Violation<SnapshotRule, SnapshotSite>[] {
  const violations: Violation<SnapshotRule, SnapshotSite>[] = [];
  const snapshotSite: SnapshotSite = { kind: "snapshot" };
  const add = (rule: SnapshotRule, site: SnapshotSite, ...details: string[]): void => {
    violations.push({ rule, site, detail: details.map(value => ({ kind: "text", value })) });
  };
  const contributions = snapshot.contributions;
  const declared: readonly ExtensionReferenceEntry[] = [
    ...snapshotRows(contributions.compilerExtensions, snapshotSite, "compilerExtensions", violations)
      .map((reference): ExtensionReferenceEntry => ({ kind: "compiler-extension", reference })),
    ...snapshotRows(contributions.declarationProviders, snapshotSite, "declarationProviders", violations)
      .map((reference): ExtensionReferenceEntry => ({ kind: "declaration-provider", reference })),
    ...snapshotRows(contributions.semanticModules, snapshotSite, "semanticModules", violations)
      .map((reference): ExtensionReferenceEntry => ({ kind: "semantics-module", reference })),
  ];
  const expectedKinds = new Map<string, Set<string>>();
  const expected = new Set<string>();
  for (const entry of declared) {
    const reference = referenceKey(entry.reference);
    const key = encodeKey([entry.kind, reference]);
    const site: SnapshotSite = { kind: "package", package: entry.reference.package };
    if (expected.has(key)) add("extension-reference-unique", site, entry.kind, entry.reference.moduleSpecifier, entry.reference.exportId);
    expected.add(key);
    if (!packages.packageIds.has(entry.reference.package)) add("extension-package-resolves", site, entry.reference.package);
    const kinds = expectedKinds.get(reference);
    if (kinds === undefined) expectedKinds.set(reference, new Set([entry.kind]));
    else kinds.add(entry.kind);
  }
  const actual = new Set<string>();
  for (const entry of snapshotRows(actualReferences, snapshotSite, "actualExtensionReferences", violations)) {
    const reference = referenceKey(entry.reference);
    const key = encodeKey([entry.kind, reference]);
    if (actual.has(key)) add("extension-reference-unique", { kind: "package", package: entry.reference.package },
      "actual", entry.kind, entry.reference.moduleSpecifier, entry.reference.exportId);
    actual.add(key);
    const kinds = expectedKinds.get(reference);
    if (kinds !== undefined && !kinds.has(entry.kind)) {
      add("extension-reference-kinds-exact", { kind: "package", package: entry.reference.package },
        entry.kind, entry.reference.moduleSpecifier, entry.reference.exportId);
    }
  }
  if (expected.size !== actual.size || [...expected].some(key => !actual.has(key))) {
    add("extension-table-equality", snapshotSite, "extensions");
  }
  const files = snapshotRows(contributions.declarationFiles, snapshotSite, "declarationFiles", violations);
  for (const path of files) {
    if (!packages.filePaths.has(path)) add("contribution-files-resolve", { kind: "file", path }, path);
  }
  const declarationModules = new Set<ModuleId>();
  for (const module of snapshot.packages.modules) {
    if (module !== undefined && module !== null && module.role === "declaration") declarationModules.add(module.id);
  }
  const libraries = new Set<ModuleId>();
  let previousLibrary: ModuleId | null = null;
  let unorderedLibraries = false;
  for (const module of snapshotRows(contributions.declarationPolicy.bundledLibraries, snapshotSite, "bundledLibraries", violations)) {
    if (!declarationModules.has(module)) add("bundled-library-declaration", { kind: "module", module }, module);
    if (libraries.has(module)) add("bundled-library-unique", { kind: "module", module }, module);
    libraries.add(module);
    if (previousLibrary !== null && module < previousLibrary) unorderedLibraries = true;
    previousLibrary = module;
  }
  if (unorderedLibraries) add("bundled-libraries-order", snapshotSite, "bundledLibraries");
  const layouts = snapshotRows(snapshot.platform.layouts, snapshotSite, "platform.layouts", violations);
  const layoutKeys = new Set<string>();
  let previousLayout: string | null = null;
  let unorderedLayouts = false;
  for (const registration of layouts) {
    const declaration = registration.declaration;
    const site = platformSite(declaration);
    const key = declarationKey(declaration);
    if (layoutKeys.has(key)) add("platform-layout-unique", site, "layout");
    layoutKeys.add(key);
    if (previousLayout !== null && key < previousLayout) unorderedLayouts = true;
    previousLayout = key;
    if ([declaration.providerId, declaration.providerVersion, declaration.providerModuleId,
      declaration.moduleSpecifier, declaration.exportId, registration.layout.fingerprint].some(value => value.length === 0)) {
      add("platform-layout-valid", site, "identity");
    }
  }
  if (unorderedLayouts) add("platform-layouts-order", snapshotSite, "platform.layouts");
  const contributedLayouts = new Set<string>();
  for (const declaration of snapshotRows(contributions.dataLayouts, snapshotSite, "dataLayouts", violations)) {
    const key = declarationKey(declaration);
    if (contributedLayouts.has(key)) add("platform-layout-unique", platformSite(declaration), "contribution");
    contributedLayouts.add(key);
  }
  if (layoutKeys.size !== contributedLayouts.size || [...layoutKeys].some(key => !contributedLayouts.has(key))) {
    add("contribution-layouts-exact", snapshotSite, "dataLayouts");
  }
  const prefixes = snapshotRows(contributions.requiredProviderModules, snapshotSite, "requiredProviderModules", violations)
    .map(entry => entry.specifierPrefix).sort();
  const ancestors: { readonly prefix: string; readonly owner: string }[] = [];
  for (const prefix of prefixes) {
    let ancestor = ancestors.at(-1);
    while (ancestor !== undefined && !prefix.startsWith(ancestor.prefix)) {
      ancestors.pop();
      ancestor = ancestors.at(-1);
    }
    let owner = prefix;
    if (ancestor !== undefined && prefixContains(ancestor.owner, prefix)) {
      owner = ancestor.owner;
      add("provider-module-prefixes-disjoint", snapshotSite, owner, prefix);
    }
    ancestors.push({ prefix, owner });
  }
  return violations;
}
