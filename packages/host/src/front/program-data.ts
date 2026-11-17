import type { LibraryModuleIdentity, ModuleId, PackageId } from "../ids/contract.js";

export interface SessionDocument {
  readonly module: ModuleId;
  readonly package: PackageId;
  readonly provider: LibraryModuleIdentity;
  readonly artifact: "public" | "canonical-export-owner";
  readonly text: string;
}

export type ProgramModule =
  | { readonly kind: "snapshot"; readonly module: ModuleId }
  | { readonly kind: "session-document"; readonly document: SessionDocument };

export interface ProgramModuleSet {
  readonly modules: readonly ProgramModule[];
}
