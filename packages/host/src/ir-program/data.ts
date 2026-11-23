import type { Diagnostic } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, NodeId, PackageId, SigId } from "../ids/contract.js";
import type { HirModuleBinding, HirModuleExport } from "../ir-hir/contract.js";
import type { ArtifactBindings, BodyInstance, ConstValue, ConstantReference, Execution, TypeTable } from "../ir-types/contract.js";
import type { DependencyInventory, MetadataRecord, ModuleStaticCellRef, Summary } from "../ir-facts/contract.js";

export interface PackageExport {
  readonly specifier: string;
  readonly module: ModuleId;
}

export interface PackageRecord {
  readonly id: PackageId;
  readonly name: string | null;
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly dependencies: readonly PackageId[];
  readonly exports: readonly PackageExport[];
}

export interface DefinitionNode {
  readonly definition: DefId;
  readonly node: NodeId;
}

export interface ModuleRecord {
  readonly module: ModuleId;
  readonly package: PackageId;
  readonly items: readonly DefinitionNode[];
  readonly exports: readonly HirModuleExport[];
  readonly bindings: readonly HirModuleBinding[];
  readonly checkerDiagnostics: readonly Diagnostic[];
}

export type SignatureRecord = {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
  // Position among endpoints of this kind, in declaration endpoint-vector order.
  readonly ordinal: number;
  readonly signature: SigId;
} & (
  | { readonly kind: "advertised" | "api-signature" }
  | { readonly kind: "api-body"; readonly body: BodyId | null }
);

export type BodyRecord = {
  readonly instance: BodyInstance;
  readonly module: ModuleId;
  readonly owner: DefId;
  readonly root: NodeId;
} & (
  | { readonly kind: "template" }
  | { readonly kind: "selected"; readonly mirLocalCount: number; readonly mirConstantCount: number;
      readonly mirPlaceCount: number; readonly mirBlockCount: number }
);

export interface ConstantRecord {
  readonly reference: ConstantReference;
  readonly value: ConstValue;
}

export type SupportedProgramSchema = 1;

export interface ResolvedExternalEntry {
  readonly module: ModuleId;
  readonly name: string;
  readonly definitions: readonly [DefId, ...DefId[]];
  readonly storage: readonly ModuleStaticCellRef[];
}

export interface ProgramInitialization {
  readonly entry: ModuleId;
  readonly external: readonly ResolvedExternalEntry[];
  readonly modules: readonly Execution[];
  readonly entries: readonly Execution[];
}

export interface ProgramIndex {
  readonly schema: number;
  readonly nativeFactsKey: string;
  readonly rootPackage: PackageId;
  readonly packages: readonly PackageRecord[];
  readonly modules: readonly ModuleRecord[];
  readonly types: TypeTable;
  readonly signatures: readonly SignatureRecord[];
  readonly bodies: readonly BodyRecord[];
  readonly dependencyInventory: DependencyInventory;
  readonly metadata: readonly MetadataRecord[];
  readonly summaries: readonly Summary[];
  readonly constants: readonly ConstantRecord[];
  readonly diagnostics: readonly Diagnostic[];
  readonly initialization: ProgramInitialization;
}
