/**
 * Validation helper functions
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import { getTstsNodeLocation, hasTstsExportModifier } from "@tsonic/tsts";

export const hasExportModifier = (node: TstsNode): boolean =>
  hasTstsExportModifier(node);

/**
 * Get location information for a node
 */
export const getNodeLocation = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} =>
  getTstsNodeLocation(sourceFile, node) ?? {
    file: sourceFile.FileName(),
    line: 1,
    column: 1,
    length: 0,
  };
