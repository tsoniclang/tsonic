import type { DefId, LibraryExportIdentity, LibraryModuleIdentity, LibraryTypeId } from "../ids/contract.js";
import type { Result, Violation } from "../diag/contract.js";
import type { BindingScope, BindingVector, ExactRational, LiteralTypeValue, NativePrimitive, PassingMode, Signature, SignatureRequest } from "../ir-types/contract.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { LibraryAuthoredSummary, LibraryRole, LibraryRoleEntry } from "../snapshot/contract.js";

export type WellKnownSymbol =
  | "asyncDispose" | "asyncIterator" | "dispose" | "hasInstance" | "isConcatSpreadable"
  | "iterator" | "match" | "matchAll" | "replace" | "search" | "species" | "split"
  | "toPrimitive" | "toStringTag" | "unscopables";

export type LibraryPropertyName =
  | { readonly kind: "identifier" | "string-literal"; readonly text: string }
  | { readonly kind: "number-literal"; readonly value: ExactRational }
  | { readonly kind: "well-known-symbol"; readonly name: WellKnownSymbol };

export interface LibraryTypeParameter {
  readonly name: string;
  readonly constraints: readonly LibraryTypeId[];
  readonly defaultType: LibraryTypeId | null;
  readonly variance: "in" | "out" | "invariant";
}

export type LibraryType = { readonly id: LibraryTypeId } & (
  | { readonly kind: "any" | "unknown" | "void" | "never" | "absence"
      | "boolean" | "string" | "number" | "bigint" | "object" }
  | { readonly kind: "source-primitive"; readonly name: NativePrimitive }
  | { readonly kind: "source-global"; readonly name: string; readonly typeArguments: readonly LibraryTypeId[] }
  | { readonly kind: "type-parameter"; readonly name: string }
  | { readonly kind: "array"; readonly elementType: LibraryTypeId }
  | { readonly kind: "tuple"; readonly elementTypes: readonly LibraryTypeId[] }
  | { readonly kind: "union" | "intersection"; readonly types: readonly LibraryTypeId[] }
  | { readonly kind: "function"; readonly signature: LibrarySignature }
  | { readonly kind: "literal"; readonly value: LiteralTypeValue }
  | { readonly kind: "provider-ref"; readonly moduleSpecifier: string; readonly exportName: string;
      readonly localName: string | null; readonly namespaceImport: string | null;
      readonly typeArguments: readonly LibraryTypeId[] }
);

export interface LibraryParameter {
  readonly name: string;
  readonly type: LibraryTypeId;
  readonly passingMode: PassingMode;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly defaultType: LibraryTypeId | null;
}

export interface LibrarySignature {
  readonly id: string;
  readonly name: string | null;
  readonly accessibility: "public" | "protected" | "protected-internal";
  readonly parameters: readonly LibraryParameter[];
  readonly returnType: LibraryTypeId | null;
  readonly typeParameters: readonly LibraryTypeParameter[];
  readonly documentation: string | null;
}

export interface LibraryMember {
  readonly id: string;
  readonly name: LibraryPropertyName;
  readonly kind: "method" | "constructor" | "property" | "field" | "indexer";
  readonly static: boolean;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly type: LibraryTypeId | null;
  readonly signatures: readonly LibrarySignature[];
  readonly documentation: string | null;
}

export interface LibraryTypeFamily {
  readonly exportName: string;
  readonly typeArgumentCount: number;
}

export interface LibraryHeritage {
  readonly kind: "extends" | "implements";
  readonly type: LibraryTypeId;
}

export interface LibraryDeclaration {
  readonly id: string;
  readonly name: string;
  readonly exportName: string;
  readonly exportKind: "named" | "default";
  readonly kind: "type" | "value" | "namespace" | "function" | "class" | "interface" | "enum";
  readonly typeFamily: LibraryTypeFamily | null;
  readonly type: LibraryTypeId | null;
  readonly typeParameters: readonly LibraryTypeParameter[];
  readonly heritage: readonly LibraryHeritage[];
  readonly members: readonly LibraryMember[];
  readonly signatures: readonly LibrarySignature[];
  readonly documentation: string | null;
}

export interface LibraryNamedImport {
  readonly exportedName: string;
  readonly kind: "type" | "value" | "namespace";
}

export interface LibraryImport {
  readonly moduleSpecifier: string;
  readonly defaultImport: string | null;
  readonly namespaceImport: string | null;
  readonly typeOnly: boolean;
  readonly namedImports: readonly LibraryNamedImport[];
}

export interface LibraryModule {
  readonly identity: LibraryModuleIdentity;
  readonly types: readonly LibraryType[];
  readonly imports: readonly LibraryImport[];
  readonly exports: readonly LibraryDeclaration[];
  readonly roles: readonly LibraryRoleEntry[];
}

export interface LibraryText {
  readonly fileName: string;
  readonly sourceText: string;
  readonly module: LibraryModuleIdentity | null;
}

export interface SourceLibrary {
  readonly id: string;
  readonly modules: readonly LibraryModule[];
  readonly declarations: readonly LibraryText[];
}

export interface LibraryRoleBinding {
  readonly identity: LibraryExportIdentity;
  readonly role: LibraryRole;
  readonly definition: DefId;
}

export interface AdmittedNativeGuarantee {
  readonly statement: LibraryAuthoredSummary;
  readonly declaration: DefId;
}

export interface LibraryCatalogue {
  readonly sources: readonly SourceLibrary[];
}

export interface BoundLibraries {
  readonly sources: readonly SourceLibrary[];
  readonly sourceRoles: readonly LibraryRoleBinding[];
}

export interface Libraries {
  readonly sources: readonly SourceLibrary[];
  readonly sourceRoles: readonly LibraryRoleBinding[];
  readonly guarantees: readonly AdmittedNativeGuarantee[];
}

export type BindRoles = (
  catalogue: LibraryCatalogue,
  definitionOfExport: (identity: LibraryExportIdentity) => DefId,
) => Result<BoundLibraries>;

export type NativeExportAssociation = { readonly identity: LibraryExportIdentity;
  readonly member: MemberSelection | null } & (
  | { readonly kind: "callable"; readonly request: SignatureRequest; readonly signature: Signature; readonly scope: BindingScope;
      readonly guarantee: LibraryExportIdentity | null }
  | { readonly kind: "noncallable"; readonly declaration: DefId; readonly bindings: BindingVector }
);

export type AdmitGuarantees = (
  bound: BoundLibraries,
  declared: readonly LibraryAuthoredSummary[],
  associations: readonly NativeExportAssociation[],
) => Result<Libraries>;

export type LibraryRolesOf = (libraries: BoundLibraries, role: LibraryRole) => readonly DefId[];
export type LibraryRoleOf = (libraries: LibraryCatalogue, identity: LibraryExportIdentity) => LibraryRole | null;
export type LibraryExportKey = (identity: LibraryExportIdentity) => string;

export type LibraryRule =
  | "source-ids-unique" | "module-identities-order" | "module-identities-unique"
  | "type-id-dense" | "type-reference-resolves" | "type-parameter-resolves" | "type-parameter-names-unique"
  | "literal-exact" | "declaration-ids-unique" | "member-ids-unique" | "signature-ids-unique"
  | "export-names-unique" | "rest-parameter-last" | "type-family-arity-exact"
  | "role-identities-order" | "role-identities-unique" | "role-export-resolves"
  | "role-bindings-order" | "role-definition-resolves" | "role-binding-exact" | "text-module-resolves"
  | "declared-summary-identity-resolves" | "declared-summaries-order"
  | "authored-summary-identity-resolves" | "authored-summaries-order" | "authored-summary-identity-unique"
  | "authored-summary-id-dense" | "authored-summary-reference-resolves" | "authored-summary-path-parent-precedes"
  | "authored-summary-parameter-range" | "authored-summary-capture-range" | "authored-summary-site-integral"
  | "authored-summary-producer-unique" | "authored-summary-origins-order" | "authored-summary-effects-order"
  | "summary-binding-definition-exact" | "summary-binding-signature-exact" | "summary-binding-origin-exact";

export type LibrarySite =
  | { readonly kind: "catalogue" }
  | { readonly kind: "source"; readonly source: string }
  | { readonly kind: "module"; readonly module: LibraryModuleIdentity }
  | { readonly kind: "type"; readonly module: LibraryModuleIdentity; readonly type: LibraryTypeId }
  | { readonly kind: "export"; readonly identity: LibraryExportIdentity }
  | { readonly kind: "text"; readonly fileName: string }
  | { readonly kind: "authored-summary"; readonly identity: LibraryExportIdentity;
      readonly table: "projection" | "producer" | "origins" | "boundary" | "parameter" | "capture"
        | "write" | "retention" | "callback";
      readonly index: number | null };

export type VerifyLibraryCatalogue = (catalogue: LibraryCatalogue) => readonly Violation<LibraryRule, LibrarySite>[];

export type VerifyAuthoredSummaries = (
  catalogue: LibraryCatalogue,
  declared: readonly LibraryAuthoredSummary[],
) => readonly Violation<LibraryRule, LibrarySite>[];

export interface LibraryRoleVerificationContext {
  readonly definitionExists: (definition: DefId) => boolean;
  readonly definitionOfExport: (identity: LibraryExportIdentity) => DefId;
}

export interface LibraryVerificationContext extends LibraryRoleVerificationContext {
  readonly associations: readonly NativeExportAssociation[];
}

export type VerifyBoundLibraries = (libraries: BoundLibraries,
  context: LibraryRoleVerificationContext) => readonly Violation<LibraryRule, LibrarySite>[];

export type VerifyLibraries = (libraries: Libraries,
  context: LibraryVerificationContext) => readonly Violation<LibraryRule, LibrarySite>[];
