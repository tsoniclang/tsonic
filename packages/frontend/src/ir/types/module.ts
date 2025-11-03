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
  readonly resolvedNamespace?: string; // For .NET imports
  // For module bindings (Node.js APIs mapped to CLR types)
  readonly resolvedClrType?: string; // e.g., "Tsonic.NodeApi.fs"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.NodeApi"
};

export type IrImportSpecifier =
  | { readonly kind: "default"; readonly localName: string }
  | { readonly kind: "namespace"; readonly localName: string }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    };

export type IrExport =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    }
  | { readonly kind: "default"; readonly expression: IrExpression }
  | { readonly kind: "declaration"; readonly declaration: IrStatement };
