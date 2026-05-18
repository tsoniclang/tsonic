/**
 * File header generation
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterOptions } from "../../../types.js";
import { generateFileHeaderTrivia } from "../../../constants.js";
import type { CSharpTriviaAst } from "../backend-ast/types.js";

/**
 * Generate file header with source info
 */
export const generateHeader = (
  module: IrModule,
  options: EmitterOptions
): readonly CSharpTriviaAst[] => {
  return generateFileHeaderTrivia(module.filePath, {
    includeTimestamp: options.includeTimestamp,
  });
};
