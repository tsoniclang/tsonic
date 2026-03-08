/**
 * Core intrinsic provenance validation
 *
 * Airplane-grade rule: Intrinsics (core numeric types, ptr/out/ref wrappers, and
 * language intrinsics like stackalloc/trycast/thisarg) must come from @tsonic/core.
 *
 * If a project defines or imports a same-named symbol from somewhere else, it must
 * NOT be treated as an intrinsic. We enforce this as a hard error to avoid
 * silent miscompilation.
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  CORE_LANG_TYPE_NAMES,
  CORE_LANG_VALUE_NAMES,
  CORE_PACKAGE_NAME,
  CORE_TYPES_TYPE_NAMES,
  type CoreModule,
  isSymbolFromCore,
} from "../core-intrinsics/provenance.js";

const getRightmostTypeNameIdentifier = (
  typeName: ts.EntityName
): ts.Identifier | undefined => {
  return ts.isIdentifier(typeName) ? typeName : typeName.right;
};

/**
 * Validate that core intrinsic names resolve to @tsonic/core symbols.
 */
export const validateCoreIntrinsics = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const checker = program.checker;

  const report = (
    acc: DiagnosticsCollector,
    node: ts.Node,
    name: string,
    module: CoreModule,
    hint: string
  ): DiagnosticsCollector =>
    addDiagnostic(
      acc,
      createDiagnostic(
        "TSN7440",
        "error",
        `Core intrinsic '${name}' must resolve to ${CORE_PACKAGE_NAME}/${module}.js`,
        getNodeLocation(sourceFile, node),
        hint
      )
    );

  const visitor = (
    node: ts.Node,
    acc: DiagnosticsCollector
  ): DiagnosticsCollector => {
    let current = acc;

    // Disallow declaring reserved intrinsic type names in user source.
    if (
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const nameNode = node.name;
      if (nameNode && CORE_TYPES_TYPE_NAMES.has(nameNode.text)) {
        // Project source cannot define these; they map to CLR keywords/emission.
        current = report(
          current,
          nameNode,
          nameNode.text,
          "types",
          `Remove this declaration and import '${nameNode.text}' from "@tsonic/core/types.js".`
        );
      }
      if (nameNode && CORE_LANG_TYPE_NAMES.has(nameNode.text)) {
        current = report(
          current,
          nameNode,
          nameNode.text,
          "lang",
          `Remove this declaration and import '${nameNode.text}' from "@tsonic/core/lang.js".`
        );
      }
    }

    // Disallow declaring reserved intrinsic value names in user source.
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      if (CORE_LANG_VALUE_NAMES.has(name)) {
        current = report(
          current,
          node.name,
          name,
          "lang",
          `Remove this declaration and import '${name}' from "@tsonic/core/lang.js".`
        );
      }
    }

    // Enforce provenance at use sites (types).
    if (ts.isTypeReferenceNode(node)) {
      const nameNode = getRightmostTypeNameIdentifier(node.typeName);
      const name = nameNode?.text;
      if (nameNode && name && CORE_TYPES_TYPE_NAMES.has(name)) {
        const symbol = checker.getSymbolAtLocation(nameNode);
        if (!isSymbolFromCore(checker, symbol, "types")) {
          current = report(
            current,
            nameNode,
            name,
            "types",
            `Import '${name}' from "@tsonic/core/types.js" (do not redefine or spoof it).`
          );
        }
      }
      if (nameNode && name && CORE_LANG_TYPE_NAMES.has(name)) {
        const symbol = checker.getSymbolAtLocation(nameNode);
        if (!isSymbolFromCore(checker, symbol, "lang")) {
          current = report(
            current,
            nameNode,
            name,
            "lang",
            `Import '${name}' from "@tsonic/core/lang.js" (do not redefine or spoof it).`
          );
        }
      }
    }

    // Enforce provenance at use sites (value intrinsics).
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (CORE_LANG_VALUE_NAMES.has(name)) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        if (!isSymbolFromCore(checker, symbol, "lang")) {
          current = report(
            current,
            node.expression,
            name,
            "lang",
            `Import '${name}' from "@tsonic/core/lang.js" (do not redefine or spoof it).`
          );
        }
      }
    }

    // IMPORTANT: Do not return a value from the forEachChild callback.
    // TypeScript's ts.forEachChild short-circuits when the callback returns
    // non-undefined, which would cause us to only visit the first child.
    ts.forEachChild(node, (child) => {
      current = visitor(child, current);
    });
    return current;
  };

  return visitor(sourceFile, collector);
};
