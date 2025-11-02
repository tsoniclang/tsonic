/**
 * Validation helper functions
 */

import * as ts from "typescript";

// Re-export hasExportModifier from graph helpers to avoid duplication
export { hasExportModifier } from "../graph/helpers.js";

/**
 * Get location information for a node
 */
export const getNodeLocation = (
  sourceFile: ts.SourceFile,
  node: ts.Node
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart()
  );
  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    length: node.getWidth(),
  };
};
