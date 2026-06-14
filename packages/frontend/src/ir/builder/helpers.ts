/**
 * IR Builder helper functions
 */

import type { TstsNode } from "@tsonic/tsts";
import { hasTstsDefaultModifier, hasTstsExportModifier } from "@tsonic/tsts";

/**
 * Check if a node has export modifier
 */
export const hasExportModifier = (node: TstsNode): boolean =>
  hasTstsExportModifier(node);

/**
 * Check if a node has default modifier
 */
export const hasDefaultModifier = (node: TstsNode): boolean =>
  hasTstsDefaultModifier(node);
