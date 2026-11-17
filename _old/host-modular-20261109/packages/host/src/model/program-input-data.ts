import type {
  ProgramIdentity, Identity, Original, Presence, Diagnostic,
} from "./foundation-data.js";
import type { LibraryModule, LibraryModuleIdentity } from "./library-data.js";
import type { ObservedDataLayout } from "./core-input-data.js";

export interface SourceFileInput {
  readonly path: string;
  readonly text: string;
  readonly role: "project" | "installed-declaration" | "profile-declaration"
    | "package-manifest";
  readonly owner: Presence<string>;
}
export interface SourceDeclarationPolicy {
  readonly bundledLibraries: readonly string[];
  readonly installedDeclarations: "none" | "package-contract";
}
export interface SourceSafetyProviderInput {
  readonly providerId: string;
  readonly version: string;
  readonly providerModuleId: string;
  readonly moduleSpecifier: string;
  readonly unsafeContextExport: string;
  readonly safetyExport: string;
  readonly safetyBuilderExport: string;
  readonly safetyMemberBuilderExport: string;
}
export interface SourceModuleOwnership {
  readonly specifierPrefix: string;
  readonly providerId: Presence<string>;
  readonly message: Presence<string>;
}
export interface SourceProfileInput {
  readonly id: string;
  readonly libraries: readonly string[];
  readonly declarationOwners: readonly {
    readonly path: string; readonly owner: string;
  }[];
}
export interface SourceCheckRequest {
  readonly currentDirectory: string;
  readonly projectRoot: string;
  readonly entryPoint: string;
  readonly rootFiles: readonly string[];
  readonly caseSensitive: boolean;
  readonly files: readonly SourceFileInput[];
  readonly declarations: readonly LibraryModule[];
  readonly declarationPolicy: SourceDeclarationPolicy;
  readonly moduleOwnership: readonly SourceModuleOwnership[];
  readonly requiredProviderModules: readonly LibraryModuleIdentity[];
  readonly profile: SourceProfileInput;
  readonly dataLayouts: readonly ObservedDataLayout[];
  readonly safetyProviders: readonly SourceSafetyProviderInput[];
}
export interface SourceDocument {
  readonly original: Original;
  readonly path: string;
  readonly text: string;
  readonly declarationFile: boolean;
  readonly project: boolean;
  readonly profileOwner: Presence<string>;
  readonly provider: Presence<LibraryModuleIdentity>;
}
export interface ObservedDiagnostic {
  readonly original: Original;
  readonly diagnostic: Diagnostic;
  readonly parent: Presence<Original>;
  readonly children: readonly Original[];
}
export interface SourceProgramInput {
  readonly programIdentity: ProgramIdentity;
  readonly identity: Identity;
  readonly entryPoint: Original;
  readonly roots: readonly Original[];
  readonly documents: readonly SourceDocument[];
  readonly profile: SourceProfileInput;
  readonly libraries: readonly string[];
  readonly providers: readonly LibraryModuleIdentity[];
  readonly diagnostics: readonly ObservedDiagnostic[];
}
export type SourceCheckResult =
  | { readonly kind: "checked"; readonly input: SourceProgramInput }
  | { readonly kind: "invalid-input"; readonly diagnostics: readonly Diagnostic[] };
export type OriginalSelection =
  | { readonly kind: "record"; readonly original: Original }
  | { readonly kind: "document"; readonly path: string }
  | { readonly kind: "reference"; readonly original: Original;
      readonly meaning: "source" | "project" }
  | { readonly kind: "module"; readonly document: Original }
  | { readonly kind: "implementation"; readonly declaration: Original;
      readonly contract: Presence<Original> }
  | { readonly kind: "member-contracts"; readonly declaration: Original }
  | { readonly kind: "member-dispatch"; readonly declaration: Original }
  | { readonly kind: "heritage"; readonly declaration: Original;
      readonly target: Presence<Original> }
  | { readonly kind: "constructors" | "callable-association" | "enum";
      readonly declaration: Original }
  | { readonly kind: "provider"; readonly original: Original };
export interface OriginalObservationInput {
  readonly input: SourceProgramInput;
  readonly selection: OriginalSelection;
}
export interface SyntaxObservationInput {
  readonly input: SourceProgramInput;
  readonly original: Original;
}
export type ComponentSelection =
  | { readonly kind: "syntax"; readonly original: Original }
  | { readonly kind: "describe"; readonly component: Original }
  | { readonly kind: "class-facets"; readonly declaration: Original }
  | { readonly kind: "signature"; readonly signature: Original }
  | { readonly kind: "declaration-signature"; readonly declaration: Original }
  | { readonly kind: "signature-component"; readonly signature: Original;
      readonly root: Original; readonly part:
        | { readonly kind: "parameter"; readonly index: number }
        | { readonly kind: "receiver" | "result" } };
export interface ComponentObservationInput {
  readonly input: SourceProgramInput;
  readonly selection: ComponentSelection;
}
export type ApplicationSelection =
  | { readonly kind: "invocation"; readonly invocation: Original }
  | { readonly kind: "constraints"; readonly occurrence: Original };
export interface ApplicationObservationInput {
  readonly input: SourceProgramInput;
  readonly selection: ApplicationSelection;
}
export type MemberSelection =
  | { readonly kind: "inventory"; readonly component: Original }
  | { readonly kind: "use"; readonly occurrence: Original }
  | { readonly kind: "property-name"; readonly occurrence: Original };
export interface MemberObservationInput {
  readonly input: SourceProgramInput;
  readonly selection: MemberSelection;
}
export interface ExtensionObservationInput {
  readonly input: SourceProgramInput;
  readonly original: Original;
  readonly family: "core" | "iteration" | "generator" | "yield"
    | "resource-management" | "callable-completion" | "flow-conditions";
}
