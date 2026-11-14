import type { CheckerDiagnosticRef } from "../diag/contract.js";
import type { DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { CapturedFact } from "./contract.js";

export type HirExportTarget =
  | { readonly kind: "declarations"; readonly definitions: readonly [DefId, ...DefId[]] }
  | { readonly kind: "binding"; readonly occurrence: SourceNodeRef };

export interface HirModuleExport {
  readonly name: string;
  readonly target: HirExportTarget;
}

export type HirBindingSemanticTarget =
  | { readonly kind: "declarations"; readonly definitions: readonly [DefId, ...DefId[]] }
  | { readonly kind: "module"; readonly module: ModuleId }
  | { readonly kind: "member"; readonly through: HirExportTarget;
      readonly key: CapturedFact<MemberKey>; readonly origins: CapturedFact<readonly MemberOrigin[]> }
  | { readonly kind: "unresolved"; readonly diagnostics: readonly [CheckerDiagnosticRef, ...CheckerDiagnosticRef[]] };

export type HirBindingTarget = HirBindingSemanticTarget
  | { readonly kind: "binding"; readonly occurrence: SourceNodeRef };

export interface HirModuleBinding {
  readonly occurrence: SourceNodeRef;
  readonly target: CapturedFact<HirBindingTarget>;
}

export interface HirBindingResolution {
  readonly target: CapturedFact<HirBindingSemanticTarget>;
  readonly aliases: readonly SourceNodeRef[];
  readonly cycle: SourceNodeRef | null;
}

export interface HirBindingViews {
  readonly bindingOf: (occurrence: SourceNodeRef) => HirModuleBinding | null;
}

export interface HirExportViews extends HirBindingViews {
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
}

export type ResolveModuleBinding = (views: HirBindingViews, occurrence: SourceNodeRef) => HirBindingResolution;
export type CreateModuleBindingViews = (tables: readonly (readonly HirModuleBinding[])[]) => HirBindingViews;
export type ProjectExportDeclarations = (views: HirExportViews, entry: HirModuleExport) => HirBindingResolution;
