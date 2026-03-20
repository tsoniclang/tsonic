import type * as ts from "typescript";
import type { Diagnostic } from "../../types/diagnostic.js";
import type { IrType } from "../types/index.js";
import type { AliasTable } from "./internal/universe/alias-table.js";
import type { UnifiedTypeCatalog } from "./internal/universe/types.js";
import { neverType, unknownType, voidType } from "./types.js";
import type { DeclId, SignatureId } from "./types.js";
import type {
  HandleRegistry,
  NominalEnvAPI,
  NominalLookupResult,
  RawSignatureInfo,
  TypeRegistryAPI,
} from "./type-system-state-types.js";

export { unknownType, neverType, voidType };

export type TypeSystemState = {
  // From TypeSystemConfig
  readonly handleRegistry: HandleRegistry;
  readonly typeRegistry: TypeRegistryAPI;
  readonly nominalEnv: NominalEnvAPI;
  readonly convertTypeNodeRaw: (node: unknown) => IrType;
  readonly unifiedCatalog: UnifiedTypeCatalog;
  readonly aliasTable: AliasTable;
  readonly resolveIdentifier: (node: unknown) => DeclId | undefined;
  readonly resolveShorthandAssignment: (node: unknown) => DeclId | undefined;
  readonly resolveCallSignature: (node: unknown) => SignatureId | undefined;
  readonly resolveConstructorSignature: (
    node: unknown
  ) => SignatureId | undefined;
  readonly checker: ts.TypeChecker;
  readonly tsCompilerOptions: ts.CompilerOptions;
  readonly sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>;

  // Mutable caches (shared by reference)
  readonly declTypeCache: Map<number, IrType>;
  readonly memberDeclaredTypeCache: Map<string, IrType>;
  readonly signatureRawCache: Map<number, RawSignatureInfo>;
  readonly nominalMemberLookupCache: Map<string, NominalLookupResult | null>;

  // Diagnostics accumulator (mutable array, shared by reference)
  readonly diagnostics: Diagnostic[];
};
