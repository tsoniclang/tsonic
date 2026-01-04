/**
 * Module information extraction orchestrator
 */

import * as ts from "typescript";
import { TsonicProgram } from "../../program.js";
import { ModuleInfo, Import, Export } from "../../types/module.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../../resolver.js";
import { hasExportModifier, isTopLevelCode } from "../helpers.js";
import { extractImport } from "./imports.js";
import { extractExport } from "./exports.js";

/**
 * Extract module information from a TypeScript source file
 */
export const extractModuleInfo = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): ModuleInfo => {
  const imports: Import[] = [];
  const exports: Export[] = [];
  let hasTopLevelCode = false;

  const visitor = (node: ts.Node): void => {
    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const imp = extractImport(node, sourceFile, program);
      if (imp) {
        imports.push(imp);
      }
    }

    // Extract exports
    if (ts.isExportDeclaration(node)) {
      const exp = extractExport(node);
      if (exp) {
        exports.push(exp);
      }
    }

    if (ts.isExportAssignment(node)) {
      exports.push({
        kind: "default",
        localName: node.expression.getText(),
      });
    }

    // Check for exported declarations
    if (hasExportModifier(node)) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              kind: "named",
              name: decl.name.text,
              localName: decl.name.text,
            });
          }
        });
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        exports.push({
          kind: "named",
          name: node.name.text,
          localName: node.name.text,
        });
      }
    }

    // Check for top-level code (non-declaration statements)
    if (isTopLevelCode(node)) {
      hasTopLevelCode = true;
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);

  const namespace = getNamespaceFromPath(
    sourceFile.fileName,
    program.options.sourceRoot,
    program.options.rootNamespace
  );

  const className = getClassNameFromPath(
    sourceFile.fileName,
    program.options.namingPolicy?.classes
  );

  return {
    filePath: sourceFile.fileName,
    sourceText: sourceFile.getFullText(),
    imports,
    exports,
    hasTopLevelCode,
    namespace,
    className,
  };
};
