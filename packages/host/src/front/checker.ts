import { createCompilerSessionFromFiles, createSourceSemanticsExtension } from "@tsonic/tsts";
import type { CompilerExtension, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts";
import type { InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { ModuleId, PackageId } from "../ids/contract.js";
import { encodeKey, encodeModuleId } from "../ids/index.js";
import type { ExtensionReference, ExtensionReferenceEntry, ImportPreparation, ProjectSnapshot } from "../snapshot/contract.js";
import type { CaptureDeps, CheckedProgram, CheckerExtensions, CheckerRegistration, ProgramModule, ProgramModuleSet, SessionDocument } from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import type { ProviderRegistration } from "./handles.js";
import { optionSet } from "./options.js";

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

/** The key of the join from a session document's provider to the registration that supplied it. */
function providerKey(identity: { readonly id: string; readonly version: string }): string {
  return encodeKey([identity.id, identity.version]);
}

function referenceKey(kind: string, reference: ExtensionReference): string {
  return encodeKey([kind, reference.package, reference.moduleSpecifier, reference.exportId, reference.version]);
}

/**
 * A declaration provider reaches the checker through an extension that registers it. The extension carries the
 * provider's own identity; nothing else is added.
 */
function providerExtension(provider: SourceDeclarationProvider): CompilerExtension {
  return ({
    identity: { id: provider.identity.id, version: provider.identity.version },
    initialize: context => { context.registerSourceDeclarationProvider(provider); },
  });
}

export function createExtensionTable(registrations: readonly CheckerRegistration[]): CheckerExtensions {
  const seen = new Set<string>();
  const entries: ExtensionReferenceEntry[] = [];
  const extensions: CompilerExtension[] = [];
  const providers = new Map<string, ProviderRegistration>();
  const semantics: SourceSemanticsModule[] = [];
  let semanticsPosition: number | null = null;
  registrations.forEach(registration => {
    const key = referenceKey(registration.value.kind, registration.reference);
    if (seen.has(key)) throw new TypeError("front: a registration was given twice");
    seen.add(key);
    entries.push({ kind: registration.value.kind, reference: registration.reference });
    switch (registration.value.kind) {
      case "compiler-extension": extensions.push(registration.value.value); break;
      case "declaration-provider":
        // A second registration of one provider identity is not recorded here. The table refuses nothing: it is the
        // session that reports two extensions of one identity, and then no program is opened on this table.
        if (!providers.has(providerKey(registration.value.value.identity))) {
          providers.set(providerKey(registration.value.value.identity), { reference: registration.reference, provider: registration.value.value });
        }
        extensions.push(providerExtension(registration.value.value));
        break;
      case "semantics-module":
        if (semanticsPosition === null) semanticsPosition = extensions.length;
        semantics.push(registration.value.value);
        break;
    }
  });
  if (semanticsPosition !== null) extensions.splice(semanticsPosition, 0, createSourceSemanticsExtension({ modules: semantics }));
  return ExtensionTable.create(entries, extensions, providers);
}

export function extensionReferences(table: CheckerExtensions): readonly ExtensionReferenceEntry[] {
  return ExtensionTable.entries(table);
}

/** What one compiler session is created from, computed from the snapshot alone. */
export interface SessionInputs {
  readonly currentDirectory: string;
  readonly files: ReadonlyMap<string, string>;
  readonly rootFiles: readonly string[];
  readonly options: Readonly<Record<string, boolean | string | readonly string[]>>;
  readonly modules: ReadonlyMap<string, ModuleId>;
  readonly packageNames: ReadonlyMap<PackageId, string | null>;
}

/**
 * The session is on exactly the snapshot's texts: every captured file is a file of the session, and its roots are
 * the snapshot's root modules, its contributed declaration modules and its bundled library modules. The options are
 * the one option table's. Under them the checker follows no library reference of its own: the bundled library
 * modules that the declaration policy lists are the whole library set of the program, and no text of the installed
 * checker is read. Whether that list is closed under the libraries' own references is stated by the import
 * preparation's reference rows and is not decided here.
 *
 * A configuration file the project captured is an ordinary file of the session: the session is opened in the
 * checker's options mode, which reads no file as configuration (SDK 86b0512f, K-3265).
 */
export function sessionInputs(snapshot: ProjectSnapshot): SessionInputs {
  const modules = new Map<string, ModuleId>();
  const paths = new Map<ModuleId, string>();
  snapshot.packages.modules.forEach(module => {
    modules.set(module.path, module.id);
    paths.set(module.id, module.path);
  });
  const packageNames = new Map<PackageId, string | null>();
  let projectRoot: string | undefined;
  snapshot.packages.packages.forEach(entry => {
    packageNames.set(entry.id, entry.name);
    if (entry.id === snapshot.packages.rootPackage) projectRoot = entry.packageRoot;
  });
  if (projectRoot === undefined) throw new TypeError("front: the snapshot's root package is not among its packages");
  const files = new Map<string, string>();
  snapshot.packages.files.forEach(file => { files.set(file.path, file.text); });
  const rootFiles: string[] = [];
  const rooted = new Set<string>();
  const root = (path: string | undefined): void => {
    if (path === undefined) throw new TypeError("front: a root, contributed declaration or bundled library of the snapshot names no module of the snapshot");
    if (!rooted.has(path)) {
      rooted.add(path);
      rootFiles.push(path);
    }
  };
  snapshot.roots.forEach(module => { root(paths.get(module)); });
  snapshot.contributions.declarationModules.forEach(module => { root(paths.get(module)); });
  snapshot.contributions.declarationPolicy.bundledLibraries.forEach(module => { root(paths.get(module)); });
  const options: Record<string, boolean | string | readonly string[]> = {};
  optionSet(snapshot.contributions.declarationPolicy.installedDeclarations).forEach(option => { options[option.name] = option.value; });
  return ({ currentDirectory: projectRoot, files, rootFiles, options, modules, packageNames });
}

/**
 * One compiler session on the inputs above and the extension table, in the checker's options mode: the options are
 * the table's and no file of the session is read as configuration, whatever the snapshot captured. A diagnostic that
 * names no file (an option the checker rejects among them) belongs to no module: the program is not opened.
 * The import preparation is an input of the run and is not read here.
 */
export function openProgram(deps: CaptureDeps, snapshot: ProjectSnapshot, preparation: ImportPreparation): Result<CheckedProgram> {
  void preparation;
  const inputs = sessionInputs(snapshot);
  const session = createCompilerSessionFromFiles({
    currentDirectory: inputs.currentDirectory,
    files: inputs.files,
    rootFiles: inputs.rootFiles,
    compilerOptions: inputs.options,
    extensionHostOptions: {
      extensions: ExtensionTable.extensions(deps.extensions),
      requiredProviderModules: snapshot.contributions.requiredProviderModules.map(required => required.providerId === null
        ? { specifierPrefix: required.specifierPrefix, message: required.message }
        : { specifierPrefix: required.specifierPrefix, providerId: required.providerId, message: required.message }),
    },
    useCaseSensitiveFileNames: true,
  });
  const checked = session.checkSource();
  const sessionLevel = [
    ...session.getDiagnostics("all").map(diagnostic => requirePresent(diagnostic, invariant("The checker returned an empty diagnostic.")))
      .filter(diagnostic => diagnostic.file === undefined)
      .map(diagnostic => `TS${diagnostic.code}`),
    ...checked.extensionDiagnostics.filter(diagnostic => diagnostic.nodeOrSpan === undefined)
      .map(diagnostic => `${diagnostic.extensionId}:${diagnostic.extensionCode}`),
  ];
  if (sessionLevel.length !== 0) {
    throw new TypeError(`front: the session reported diagnostics that name no file (${[...new Set(sessionLevel)].join(", ")}); the refusal that carries them waits for the checker's message accessor`);
  }
  return ({ kind: "ok", value: OpenedProgram.create(checked, deps.extensions, inputs.modules, inputs.packageNames, inputs.files), diagnostics: [] });
}

export function programModules(deps: CaptureDeps, program: CheckedProgram): ProgramModuleSet {
  if (OpenedProgram.table(program) !== deps.extensions) throw new TypeError("front: the extension table is not the one the program was opened with");
  const checked = OpenedProgram.checked(program);
  const modules = OpenedProgram.modules(program);
  const packageNames = OpenedProgram.packageNames(program);
  const providers = ExtensionTable.providers(deps.extensions);
  const found = new Map<ModuleId, ProgramModule>();
  const add = (module: ModuleId, value: ProgramModule): void => {
    if (found.has(module)) throwInvariant(invariant("Two files of the opened program have one module identity."));
    found.set(module, value);
  };
  checked.getSourceFiles().forEach(file => {
    const name = checked.ast.getFileName(file);
    const module = modules.get(name);
    if (module !== undefined) {
      add(module, { kind: "snapshot", module });
      return;
    }
    const document = checked.sourceFacts.getVirtualDeclarationDocument(name);
    if (document === undefined) return throwInvariant(invariant("A file of the opened program is neither a module of the snapshot nor a session document."));
    const origin = providers.get(providerKey(document.provider));
    if (origin === undefined) return throwInvariant(invariant("A session document names a provider that no loaded registration supplied."));
    const packageName = packageNames.get(origin.reference.package);
    if (packageName === undefined) return throwInvariant(invariant("The registering package of a session document is not a package of the snapshot."));
    const session: SessionDocument = {
      module: encodeModuleId({ package: origin.reference.package, path: document.uri }),
      package: origin.reference.package,
      provider: { providerId: document.provider.id, providerVersion: document.provider.version, packageName,
        moduleSpecifier: document.moduleSpecifier, providerModuleId: document.providerModuleId },
      artifact: document.artifactKind,
      text: checked.ast.getSourceText(file),
    };
    add(session.module, { kind: "session-document", document: session });
  });
  return ({ modules: [...found.entries()].sort((left, right) => left[0] < right[0] ? -1 : 1).map(entry => entry[1]) });
}
