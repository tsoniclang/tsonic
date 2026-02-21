/**
 * Core IR module types (Module, Import, Export)
 */

import { IrStatement } from "./statements.js";
import { IrExpression } from "./expressions.js";

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
  readonly isClr: boolean; // True if import is from a CLR bindings package
  readonly specifiers: readonly IrImportSpecifier[];
  readonly resolvedNamespace?: string; // For CLR imports or local imports (e.g., "System" or "MultiFileCheck.utils")
  // For module bindings (Node.js APIs mapped to CLR types)
  readonly resolvedClrType?: string; // e.g., "Tsonic.NodeApi.fs"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.NodeApi"
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
      /** Whether this import is a type (interface/class) - emitted at namespace level in C# */
      readonly isType?: boolean;
      /**
       * For CLR namespace imports, some facade entrypoints re-export types from
       * *other* CLR namespaces (e.g., `@jotster/core/Jotster.Core.js` exporting
       * `JotsterDbContext` from `Jotster.Core.db`).
       *
       * When present, this is the fully-qualified CLR type name (C# syntax, no backticks),
       * and the emitter must use it instead of `${import.resolvedNamespace}.${name}`.
       *
       * This is ONLY used for type imports (`isType === true`).
       */
      readonly resolvedClrType?: string | undefined;
      /**
       * For CLR namespace imports, tsbindgen can optionally provide a stable "flattened"
       * named export surface (e.g. `export const buildSite = BuildSite.buildSite`).
       *
       * When present, Tsonic binds the imported identifier to the declaring CLR type
       * + member (so `buildSite(req)` emits as `global::<DeclaringType>.<member>(req)`).
       *
       * This is ONLY used for value imports (`isType !== true`).
       */
      readonly resolvedClrValue?:
        | {
            readonly declaringClrType: string;
            readonly declaringAssemblyName: string;
            readonly memberName: string;
          }
        | undefined;
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
