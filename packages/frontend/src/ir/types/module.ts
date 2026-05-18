/**
 * Core IR module types (Module, Import, Export)
 */

import { IrStatement } from "./statements.js";
import { IrExpression } from "./expressions.js";
import type {
  MemberSymbolId,
  ModuleSymbolId,
  TypeSymbolId,
} from "../../symbols/index.js";

export type IrModule = {
  readonly kind: "module";
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string; // File name becomes class name
  readonly isStaticContainer: boolean; // True if module only has exports, no top-level code
  readonly imports: readonly IrImport[];
  readonly body: readonly IrStatement[];
  readonly exports: readonly IrExport[];
};

export type IrImport = {
  readonly kind: "import";
  readonly source: string; // Import path
  readonly isLocal: boolean;
  readonly isExternalSurface?: boolean;
  readonly resolutionKind?: "local" | "externalSurface" | "phantomTypeOnly";
  readonly moduleSymbolId?: ModuleSymbolId;
  /** Canonical resolved source file for local-like imports (e.g. installed source packages). */
  readonly resolvedPath?: string;
  readonly specifiers: readonly IrImportSpecifier[];
  readonly resolvedNamespace?: string; // For external imports or local imports.
  // For module bindings mapped to target surface symbols.
  readonly targetQualifiedName?: string;
  readonly targetOwnerIdentity?: string;
  readonly typeSymbolId?: TypeSymbolId;
  // For local imports: the target module's container class name
  readonly targetContainerName?: string; // e.g., "Math" for ./utils/Math.ts
};

export type IrImportSpecifier =
  | { readonly kind: "default"; readonly localName: string }
  | { readonly kind: "namespace"; readonly localName: string }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
      /** Whether this import is a type (interface/class). */
      readonly isType?: boolean;
      /**
       * For external namespace imports, some facade entrypoints re-export types from
       * *other* external namespaces (e.g., `@jotster/core/Jotster.Core.js` exporting
       * `JotsterDbContext` from `Jotster.Core.db`).
       *
       * When present, this is the fully-qualified provider type name,
       * and the emitter must use it instead of `${import.resolvedNamespace}.${name}`.
       *
       * This is ONLY used for type imports (`isType === true`).
       */
      readonly targetQualifiedName?: string | undefined;
      readonly typeSymbolId?: TypeSymbolId | undefined;
      /**
       * For external namespace imports, tsbindgen can optionally provide a stable "flattened"
       * named export surface (e.g. `export const buildSite = BuildSite.buildSite`).
       *
       * When present, Tsonic binds the imported identifier to the declaring provider type
       * + member.
       *
       * This is ONLY used for value imports (`isType !== true`).
       */
      readonly targetValue?:
        | {
            readonly ownerQualifiedName: string;
            readonly ownerIdentity: string;
            readonly memberName: string;
          }
        | undefined;
      readonly memberSymbolId?: MemberSymbolId | undefined;
    };

export type IrExport =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    }
  | { readonly kind: "default"; readonly expression: IrExpression }
  | { readonly kind: "declaration"; readonly declaration: IrStatement }
  | {
      readonly kind: "reexport";
      readonly name: string; // Exported name
      readonly originalName: string; // Name in source module (may differ if aliased)
      readonly fromModule: string; // Source module path (e.g., "./math.ts")
    };
