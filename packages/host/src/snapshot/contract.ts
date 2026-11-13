import type { Diagnostic, Violation } from "../diag/contract.js";
import type { LibraryExportIdentity, ModuleId, PackageId } from "../ids/contract.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonRecord;

export interface JsonRecord {
  readonly kind: "record";
  readonly fields: readonly (readonly [string, JsonValue])[];
}

export type TargetOptions = JsonRecord;

export interface TargetSelection {
  readonly id: string;
  readonly surfaces: readonly string[];
  readonly options: TargetOptions;
}

export interface SelectedSurfaces {
  readonly target: TargetSelection;
  readonly providerId: string;
  readonly surfaceIds: readonly string[];
}

export interface SelectedTarget {
  readonly target: TargetSelection;
  readonly providerId: string;
  readonly capabilityIds: readonly string[];
  readonly surfaceIds: readonly string[];
}

export interface PhysicalFile {
  readonly kind: "physical";
  readonly path: string;
  readonly realPath: string;
  readonly text: string;
}

export interface VirtualDeclarationFile {
  readonly kind: "virtual";
  readonly path: string;
  readonly text: string;
  readonly owner: PackageId;
}

export type CapturedFile = PhysicalFile | VirtualDeclarationFile;

export interface PackageDependency {
  readonly name: string;
  readonly range: string;
  readonly kind: "dependency" | "optional" | "peer" | "development";
  readonly resolved: PackageId | null;
}

export interface PackageExport {
  readonly specifier: string;
  readonly module: ModuleId;
}

export interface PackageModule {
  readonly id: ModuleId;
  readonly package: PackageId;
  readonly path: string;
  readonly role: "source" | "declaration";
}

export interface SnapshotPackage {
  readonly id: PackageId;
  readonly name: string | null;
  readonly version: string | null;
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly manifestPath: string | null;
  readonly dependencies: readonly PackageDependency[];
  readonly exports: readonly PackageExport[];
  readonly pluginEntry: string | null;
  readonly libraryEntry: string | null;
}

export type LibraryRole =
  | "source-primitive" | "js-string" | "attribute" | "default-value" | "struct" | "field" | "fixed-array"
  | "function-pointer" | "pointer" | "raw-pointer" | "read-only-reference" | "read-write-reference"
  | "write-only-reference" | "shared-borrow" | "mutable-borrow" | "move" | "allocate" | "address-of"
  | "bind-pointer" | "bind-raw-pointer" | "project-pointer" | "load" | "store" | "equal-pointer" | "equal-raw-pointer"
  | "hash-pointer" | "hash-raw-pointer" | "error-declaration" | "error-storage-field";

export interface LibraryRoleEntry {
  readonly identity: LibraryExportIdentity;
  readonly role: LibraryRole;
}

export type CallbackInput =
  | { readonly kind: "receiver-element" | "receiver-rejection"; readonly parameterIndex: number }
  | { readonly kind: "argument-element"; readonly parameterIndex: number; readonly sourceParameterIndex: number };

export interface SummaryCallback {
  readonly parameterIndex: number;
  readonly timing: "synchronous" | "deferred";
  readonly rejection: number | null;
  readonly inputs: readonly CallbackInput[];
}

export type LibrarySummaryProjection =
  | { readonly kind: "field" | "method-value"; readonly identity: LibraryExportIdentity }
  | { readonly kind: "element" | "deref" }
  | { readonly kind: "index"; readonly constant: bigint };

export interface LibrarySummaryPath {
  readonly id: number;
  readonly parent: number | null;
  readonly projection: LibrarySummaryProjection;
}

export type LibrarySummaryProducer = { readonly id: number; readonly path: number | null } & (
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "receiver" }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "shared"; readonly identity: LibraryExportIdentity }
  | { readonly kind: "allocation"; readonly site: number }
);

export type LibrarySummaryOrigins = {
  readonly id: number;
  readonly producers: readonly number[];
  readonly includesAbsence: boolean;
} & (
  | { readonly kind: "complete" }
  | { readonly kind: "open"; readonly boundaries: readonly [number, ...number[]] }
);

export interface LibrarySummaryBoundary {
  readonly id: number;
  readonly kind: "external-input" | "external-write" | "opaque-write" | "opaque-result"
    | "unclassified-exposure" | "opaque-invocation" | "unresolved-transport";
  readonly site: number;
  readonly subject: number;
  readonly owner: number | null;
  readonly detail: string;
}

export type LibrarySummaryEffectPaths =
  | { readonly kind: "complete"; readonly paths: readonly number[] }
  | { readonly kind: "open"; readonly paths: readonly number[];
      readonly boundaries: readonly [number, ...number[]] };

export interface LibrarySummaryParameterEffect {
  readonly slot: { readonly kind: "receiver" } | { readonly kind: "parameter"; readonly index: number };
  readonly reads: LibrarySummaryEffectPaths;
  readonly writes: LibrarySummaryEffectPaths;
}

export interface LibrarySummaryCaptureEffect {
  readonly index: number;
  readonly reads: LibrarySummaryEffectPaths;
  readonly writes: LibrarySummaryEffectPaths;
}

export type LibrarySummaryEscapeTarget =
  | { readonly kind: "return" | "throw" }
  | { readonly kind: "shared"; readonly identity: LibraryExportIdentity; readonly path: number | null }
  | { readonly kind: "parameter" | "capture"; readonly index: number; readonly path: number | null }
  | { readonly kind: "receiver"; readonly path: number | null }
  | { readonly kind: "callback" | "suspension"; readonly site: number }
  | { readonly kind: "external"; readonly boundary: number };

export interface LibrarySummaryWrite {
  readonly target: number;
  readonly value: number;
}

export interface LibrarySummaryRetention {
  readonly source: number;
  readonly into: LibrarySummaryEscapeTarget;
}

export interface LibraryAuthoredSummary {
  readonly identity: LibraryExportIdentity;
  readonly projections: readonly LibrarySummaryPath[];
  readonly producers: readonly LibrarySummaryProducer[];
  readonly origins: readonly LibrarySummaryOrigins[];
  readonly boundaries: readonly LibrarySummaryBoundary[];
  readonly parameters: readonly LibrarySummaryParameterEffect[];
  readonly captures: readonly LibrarySummaryCaptureEffect[];
  readonly result: number;
  readonly thrown: number;
  readonly writes: readonly LibrarySummaryWrite[];
  readonly retention: readonly LibrarySummaryRetention[];
  readonly callbacks: readonly SummaryCallback[];
  readonly invocationOnlyParameters: readonly number[];
  readonly suspends: boolean;
  readonly bindingDependent: boolean;
}

export interface PackageLibraryData {
  readonly package: PackageId;
  readonly path: string;
  readonly roles: readonly LibraryRoleEntry[];
  readonly declaredSummaries: readonly LibraryAuthoredSummary[];
}

export interface PackageComponent {
  readonly representative: PackageId;
  readonly packages: readonly PackageId[];
  readonly dependencies: readonly PackageId[];
}

export interface PackageSnapshot {
  readonly fingerprint: string;
  readonly rootPackage: PackageId;
  readonly packages: readonly SnapshotPackage[];
  readonly components: readonly PackageComponent[];
  readonly modules: readonly PackageModule[];
  readonly files: readonly CapturedFile[];
  readonly libraryData: readonly PackageLibraryData[];
}

export interface PlatformDeclaration {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly moduleSpecifier: string;
  readonly exportId: string;
}

export interface PlatformLayout {
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}

export interface PlatformLayoutRegistration {
  readonly declaration: PlatformDeclaration;
  readonly layout: PlatformLayout;
}

export interface PlatformFacts {
  readonly layouts: readonly PlatformLayoutRegistration[];
}

export interface ExtensionReference {
  readonly package: PackageId;
  readonly moduleSpecifier: string;
  readonly exportId: string;
  readonly version: string;
}

export interface ExtensionReferenceEntry {
  readonly kind: "compiler-extension" | "declaration-provider" | "semantics-module";
  readonly reference: ExtensionReference;
}

/**
 * One declaration library bundled with the checker, carried with its text. A checked program is opened on exactly
 * these texts, never on what an installed checker happens to bundle. `name` is the library's file name; the
 * libraries are in ascending order of name, each name once.
 */
export interface BundledLibrary {
  readonly name: string;
  readonly text: string;
}

export interface SourceDeclarationPolicy {
  readonly bundledLibraries: readonly BundledLibrary[];
  readonly installedDeclarations: "none" | "package-contract";
}

export interface RequiredProviderModule {
  readonly specifierPrefix: string;
  readonly providerId: string | null;
  readonly message: string;
}

export interface SourceSafetyNames {
  readonly moduleSpecifier: string;
  readonly unsafeContextExport: string;
  readonly safetyExport: string;
  readonly safetyBuilderExport: string;
  readonly safetyMemberBuilderExport: string;
}

export interface SourceSafetyProvider {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly names: SourceSafetyNames;
}

export interface SourceContributions {
  readonly declarationFiles: readonly string[];
  readonly declarationPolicy: SourceDeclarationPolicy;
  readonly requiredProviderModules: readonly RequiredProviderModule[];
  readonly compilerExtensions: readonly ExtensionReference[];
  readonly declarationProviders: readonly ExtensionReference[];
  readonly semanticModules: readonly ExtensionReference[];
  readonly safetyProviders: readonly SourceSafetyProvider[];
  readonly dataLayouts: readonly PlatformDeclaration[];
}

export interface ProjectSnapshot {
  readonly packages: PackageSnapshot;
  readonly entryPoint: ModuleId;
  readonly roots: readonly ModuleId[];
  readonly selection: SelectedTarget;
  readonly contributions: SourceContributions;
  readonly platform: PlatformFacts;
}

export interface EffectFailure {
  readonly operation: "read" | "stat" | "list" | "realpath" | "write" | "rename" | "remove"
    | "mkdir" | "mkdtemp" | "kill" | "spawn";
  readonly path: string;
  readonly systemCode: string;
}

export type EffectResult<Value> =
  | { readonly kind: "done"; readonly value: Value }
  | { readonly kind: "failed"; readonly failure: EffectFailure };

export type SnapshotRule =
  | "library-data-package-resolves" | "library-data-path-resolves" | "library-data-entry-exact"
  | "library-data-owner-exact" | "library-data-order" | "library-data-unique"
  | "package-id-unique"
  | "root-package-resolves"
  | "module-id-unique"
  | "module-package-resolves"
  | "module-path-contained"
  | "module-file-resolves"
  | "file-path-unique"
  | "canonical-path"
  | "package-dependency-resolves"
  | "package-export-unique"
  | "export-module-resolves"
  | "export-package-agrees"
  | "component-package-resolves"
  | "component-membership-exact"
  | "component-representative"
  | "component-dependencies-exact"
  | "component-acyclic"
  | "snapshot-fingerprint"
  | "entry-point-resolves"
  | "root-module-resolves"
  | "roots-unique"
  | "entry-point-root"
  | "selection-capability-unique"
  | "selection-surface-unique"
  | "selection-surfaces-agree"
  | "platform-layout-unique"
  | "platform-layout-valid"
  | "extension-reference-unique"
  | "extension-package-resolves"
  | "extension-reference-kinds-exact"
  | "extension-table-equality"
  | "contribution-files-resolve"
  | "bundled-library-named"
  | "bundled-library-unique"
  | "bundled-libraries-order"
  | "virtual-file-owner-resolves"
  | "contribution-layouts-exact"
  | "provider-module-prefixes-disjoint"
  | "packages-order"
  | "modules-order"
  | "files-order"
  | "exports-order"
  | "components-order"
  | "platform-layouts-order"
  | "stable-order";

export type SnapshotSite =
  | { readonly kind: "snapshot" }
  | { readonly kind: "package"; readonly package: PackageId }
  | { readonly kind: "module"; readonly module: ModuleId }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "selection"; readonly targetId: string }
  | { readonly kind: "platform"; readonly declaration: PlatformDeclaration };

export type VerifySnapshot = (snapshot: ProjectSnapshot,
  actualExtensionReferences: readonly ExtensionReferenceEntry[]) => readonly Violation<SnapshotRule, SnapshotSite>[];

export type ImportSyntax =
  | { readonly kind: "import" | "export"; readonly placement: "statement" | "ambient-module" }
  | { readonly kind: "import-type" | "require"; readonly placement: "statement" | "ambient-module" | "expression" }
  | { readonly kind: "dynamic-import"; readonly placement: "expression" }
  | { readonly kind: "reference-path" | "reference-types" | "reference-lib"; readonly placement: "directive" };

export type ImportReference = ImportSyntax & {
  readonly specifier: string;
  readonly start: number;
  readonly length: number;
  readonly mode: "import" | "require" | "none";
  readonly resolution: { readonly kind: "resolved"; readonly fileName: string } | { readonly kind: "unresolved" };
};

export interface ImportFile {
  readonly fileName: string;
  readonly declarationFile: boolean;
  readonly references: readonly ImportReference[];
}

export interface ImportRoot {
  readonly fileName: string;
  readonly state: "loaded" | "missing";
}

export interface ImportPreparation {
  readonly roots: readonly ImportRoot[];
  readonly files: readonly ImportFile[];
  readonly diagnostics: readonly Diagnostic[];
}
