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
  readonly isDotNet: boolean;
  readonly specifiers: readonly IrImportSpecifier[];
  readonly resolvedNamespace?: string; // For .NET imports or local imports (e.g., "MultiFileCheck.utils")
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
