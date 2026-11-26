import { createCompilerSessionFromFiles, createSourceSemanticsExtension, prepareSourceImports as prepareCheckerImports } from "@tsonic/tsts";
import type { CheckedSourceProgram, CompilerExtension, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts";
import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { hostDiagnosticCode, requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { ModuleId, PackageId } from "../ids/contract.js";
import { encodeKey, encodeModuleId } from "../ids/index.js";
import type { PlatformFacts, PlatformLayout } from "../ir-types/contract.js";
import { platformDeclarationKey } from "../ir-types/index.js";
import type { ExtensionReference, ExtensionReferenceEntry, ImportPreparation, PreparedSource, ProjectSnapshot, SourcePreparationInput } from "../snapshot/contract.js";
import { verifyPreparedSource } from "../snapshot/index.js";
import type { CaptureDeps, CheckedProgram, CheckerExtensions, CheckerRegistration, PrepareSourceImports, ProgramModuleSet, SessionDocument } from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import type { OpenedFile, ProviderRegistration } from "./handles.js";
import { optionSet } from "./options.js";
import { captureSessionDiagnostics, importDiagnostic } from "./diagnostics.js";

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
  return ExtensionTable.create(entries, extensions, providers, semantics);
}

export function extensionReferences(table: CheckerExtensions): readonly ExtensionReferenceEntry[] {
  return ExtensionTable.entries(table);
}

/** What one compiler session is created from, computed from the snapshot alone. */
export interface SessionInputs {
  readonly currentDirectory: string;
  readonly useCaseSensitiveFileNames: boolean;
  readonly files: ReadonlyMap<string, string>;
  readonly rootFiles: readonly string[];
  readonly selectedLibraries: ReadonlyMap<string, string>;
  readonly installedDeclarations: SourcePreparationInput["declarationPolicy"]["installedDeclarations"];
  readonly options: Readonly<Record<string, boolean | string | readonly string[]>>;
  readonly modules: ReadonlyMap<string, ModuleId>;
  readonly packageNames: ReadonlyMap<PackageId, string | null>;
}

function sameEntries<Key, Value>(left: ReadonlyMap<Key, Value>, right: ReadonlyMap<Key, Value>): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) if (right.get(key) !== value) return false;
  return true;
}

const completedPreparations = new WeakMap<PreparedSource, SessionInputs>();

function openingInputs(source: PreparedSource): SessionInputs | null {
  const prepared = completedPreparations.get(source);
  if (prepared === undefined) return null;
  const presented = sessionInputs(source.input);
  if (presented.installedDeclarations !== prepared.installedDeclarations || presented.currentDirectory !== prepared.currentDirectory
    || presented.useCaseSensitiveFileNames !== prepared.useCaseSensitiveFileNames
    || presented.rootFiles.length !== prepared.rootFiles.length || presented.rootFiles.some((file, index) => file !== prepared.rootFiles[index])
    || !sameEntries(prepared.selectedLibraries, presented.selectedLibraries) || !sameEntries(prepared.files, presented.files)
    || !sameEntries(prepared.modules, presented.modules) || !sameEntries(prepared.packageNames, presented.packageNames)) return null;
  return prepared;
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
export function sessionInputs(source: SourcePreparationInput): SessionInputs {
  const modules = new Map<string, ModuleId>();
  const paths = new Map<ModuleId, string>();
  source.packages.modules.forEach(module => {
    modules.set(module.path, module.id);
    paths.set(module.id, module.path);
  });
  const packageNames = new Map<PackageId, string | null>();
  source.packages.packages.forEach(entry => {
    packageNames.set(entry.id, entry.name);
  });
  const files = new Map<string, string>();
  source.packages.files.forEach(file => { files.set(file.path, file.text); });
  const rootFiles: string[] = [];
  const rooted = new Set<string>();
  const root = (path: string | undefined): string => {
    if (path === undefined) throw new TypeError("front: a root, contributed declaration or bundled library of the snapshot names no module of the snapshot");
    if (!rooted.has(path)) {
      rooted.add(path);
      rootFiles.push(path);
    }
    return path;
  };
  source.roots.forEach(module => { root(paths.get(module)); });
  source.declarationModules.forEach(module => { root(paths.get(module)); });
  const selectedLibraries = new Map<string, string>();
  source.declarationPolicy.bundledLibraries.forEach(binding => {
    selectedLibraries.set(binding.name, root(paths.get(binding.module)));
  });
  const options: Record<string, boolean | string | readonly string[]> = {};
  const installedDeclarations = source.declarationPolicy.installedDeclarations;
  optionSet(installedDeclarations).forEach(option => { options[option.name] = option.value; });
  return { currentDirectory: source.currentDirectory, useCaseSensitiveFileNames: source.caseSensitive,
    files, rootFiles, selectedLibraries, installedDeclarations, options, modules, packageNames };
}

function compilerFiles(inputs: SessionInputs) {
  return { currentDirectory: inputs.currentDirectory, files: inputs.files, rootFiles: inputs.rootFiles,
    compilerOptions: inputs.options, selectedLibraries: inputs.selectedLibraries, includeBundledLibraries: false,
    useCaseSensitiveFileNames: inputs.useCaseSensitiveFileNames };
}

function preparedRefusal(site: Diagnostic["site"], message: string): { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] } {
  const code = hostDiagnosticCode("TSONIC_SOURCE_PREPARATION_INVALID");
  return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code },
    severity: "error", site, source: "front", evidence: [], message, arguments: [], related: [], fix: null }] };
}

function preparedFailure(source: PreparedSource): ReturnType<typeof preparedRefusal> | null {
  const first = verifyPreparedSource(source)[0];
  return first === undefined ? null : preparedRefusal(first.site.kind === "file" ? first.site : { kind: "none" },
    `The prepared source does not match the captured project (${first.rule}).`);
}

export const prepareImports: PrepareSourceImports = ({ navigationCapture }, input) => {
  const inputs = sessionInputs(input);
  const prepared = prepareCheckerImports(compilerFiles(inputs));
  for (const file of prepared.files) {
    const maximum = navigationCapture.maximumCapturedEdgesPerModule;
    if (file.references.length > maximum) return { kind: "refused", diagnostics: [resourceLimitDiagnostic({
      owner: "front", limit: "front.maximumCapturedEdgesPerModule", maximum,
      site: { kind: "file", path: file.fileName },
      unit: { request: { query: "prepareSourceImports", key: file.fileName }, position: { kind: "result" } },
    })] };
    for (const reference of file.references) {
      Object.freeze(reference.resolution);
      Object.freeze(reference);
    }
    Object.freeze(file.references);
    Object.freeze(file);
  }
  for (const root of prepared.roots) Object.freeze(root);
  const diagnostics = prepared.diagnostics.map(entry => importDiagnostic(entry, path => {
    const module = inputs.modules.get(path);
    const text = inputs.files.get(path);
    return module === undefined || text === undefined ? undefined
      : { module, displacement: text.charCodeAt(0) === 0xfeff ? 1 : 0 };
  }));
  const preparation: ImportPreparation = Object.freeze({ roots: Object.freeze(prepared.roots),
    files: Object.freeze(prepared.files), diagnostics: Object.freeze(diagnostics) });
  const source: PreparedSource = Object.freeze({ input, preparation });
  const mismatch = preparedFailure(source);
  if (mismatch !== null) return mismatch;
  completedPreparations.set(source, inputs);
  return { kind: "ok", value: source, diagnostics: [] };
};

/**
 * One compiler session on the inputs above and the extension table, in the checker's options mode: the options are
 * the table's and no file of the session is read as configuration, whatever the snapshot captured. A diagnostic that
 * names no file (an option the checker rejects among them) belongs to no module: the program is not opened.
 */
export function openProgram(deps: CaptureDeps, snapshot: ProjectSnapshot): Result<CheckedProgram> {
  const mismatch = preparedFailure(snapshot.source);
  if (mismatch !== null) return mismatch;
  const inputs = openingInputs(snapshot.source);
  if (inputs === null) return preparedRefusal({ kind: "none" }, "The prepared source does not retain its actual completed compiler input.");
  const session = createCompilerSessionFromFiles({
    ...compilerFiles(inputs),
    extensionHostOptions: {
      extensions: ExtensionTable.extensions(deps.extensions),
      requiredProviderModules: snapshot.contributions.requiredProviderModules.map(required => required.providerId === null
        ? { specifierPrefix: required.specifierPrefix, message: required.message }
        : { specifierPrefix: required.specifierPrefix, providerId: required.providerId, message: required.message }),
    },
  });
  const checked = session.checkSource();
  const actualPath = (path: string): string => inputs.useCaseSensitiveFileNames ? path : session.host.FS().Realpath(path);
  const program = OpenedProgram.create(checked, deps.extensions, programFiles(checked, deps.extensions, inputs, actualPath, snapshot.nativeFacts.geometry),
    snapshot.source.input.packages.libraryData, snapshot.contributions);
  const diagnostics = captureSessionDiagnostics(program);
  return diagnostics === null ? { kind: "ok", value: program, diagnostics: [] } : { kind: "refused", diagnostics };
}

export function programModules(deps: CaptureDeps, program: CheckedProgram): ProgramModuleSet {
  if (OpenedProgram.table(program) !== deps.extensions) throw new TypeError("front: the extension table is not the one the program was opened with");
  return OpenedProgram.modules(program);
}

function programFiles(checked: CheckedSourceProgram, table: CheckerExtensions, inputs: SessionInputs,
  actualPath: (path: string) => string, geometry: PlatformFacts): readonly Omit<OpenedFile, "displacement">[] {
  const providers = ExtensionTable.providers(table);
  const layoutRegistry = geometry.layouts.length === 0 ? null :
    new Map(geometry.layouts.map(row => [platformDeclarationKey(row.declaration), row.layout]));
  const found = new Map<ModuleId, Omit<OpenedFile, "displacement">>();
  const add = (module: ModuleId, value: Omit<OpenedFile, "displacement">): void => {
    if (found.has(module)) throwInvariant(invariant("Two files of the opened program have one module identity."));
    found.set(module, value);
  };
  checked.programSourceFiles.forEach(entry => {
    const file = requirePresent(entry, invariant("The checker returned an absent source file in the opened program."));
    const name = checked.ast.getFileName(file);
    const path = actualPath(name);
    const module = inputs.modules.get(path);
    if (module !== undefined) {
      const text = requirePresent(inputs.files.get(path), invariant("A snapshot module of the opened program has no captured text."));
      add(module, { file, origin: { kind: "snapshot", module }, text, providerModel: null, platformLayouts: null });
      return;
    }
    const document = checked.sourceFacts.getVirtualDeclarationDocument(name);
    if (document === undefined) return throwInvariant(invariant("A file of the opened program is neither a module of the snapshot nor a session document."));
    const origin = providers.get(providerKey(document.provider));
    if (origin === undefined) return throwInvariant(invariant("A session document names a provider that no loaded registration supplied."));
    const packageName = inputs.packageNames.get(origin.reference.package);
    if (packageName === undefined) return throwInvariant(invariant("The registering package of a session document is not a package of the snapshot."));
    const session: SessionDocument = {
      module: encodeModuleId({ package: origin.reference.package, path: document.uri }),
      package: origin.reference.package,
      provider: { providerId: document.provider.id, providerVersion: document.provider.version, packageName,
        moduleSpecifier: document.moduleSpecifier, providerModuleId: document.providerModuleId },
      artifact: document.artifactKind,
      text: document.sourceText,
    };
    let platformLayouts: Map<string, PlatformLayout> | null = null;
    if (layoutRegistry !== null && session.artifact === "canonical-export-owner") {
      for (const entry of document.declarationModel.exports) if (entry.kind === "value") {
        const layout = layoutRegistry.get(platformDeclarationKey({ ...session.provider, exportId: entry.id }));
        if (layout !== undefined) {
          platformLayouts ??= new Map();
          platformLayouts.set(entry.id, layout);
        }
      }
    }
    add(session.module, { file, origin: { kind: "session-document", document: session }, text: session.text,
      providerModel: session.artifact === "public" ? document.declarationModel : null, platformLayouts });
  });
  return [...found.entries()].sort((left, right) => left[0] < right[0] ? -1 : 1).map(entry => entry[1]);
}
