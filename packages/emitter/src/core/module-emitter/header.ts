/**
 * File header generation
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterOptions } from "../../types.js";
import { generateFileHeader } from "../../constants.js";

/**
 * Generate file header with source info
 */
export const generateHeader = (
  module: IrModule,
  options: EmitterOptions
): string => {
  return generateFileHeader(module.filePath, {
    includeTimestamp: options.includeTimestamp,
  });
};
