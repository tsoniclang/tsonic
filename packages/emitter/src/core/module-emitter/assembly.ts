/**
 * Final output assembly
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterContext, formatUsings } from "../../types.js";

export type AssemblyParts = {
  readonly header: string;
  readonly adaptersCode: string;
  readonly specializationsCode: string;
  readonly exchangesCode: string;
  readonly namespaceDeclsCode: string;
  readonly staticContainerCode: string;
};

/**
 * Assemble final C# output from all parts
 */
export const assembleOutput = (
  module: IrModule,
  parts: AssemblyParts,
  finalContext: EmitterContext
): string => {
  const usings = formatUsings(finalContext.usings);

  const result: string[] = [];

  if (parts.header) {
    result.push(parts.header);
  }

  result.push(usings);
  result.push("");
  result.push(`namespace ${module.namespace}`);
  result.push("{");

  // Emit adapters before class code
  if (parts.adaptersCode) {
    const indentedAdapters = parts.adaptersCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    result.push(indentedAdapters);
    result.push("");
  }

  // Emit specializations after adapters
  if (parts.specializationsCode) {
    const indentedSpecializations = parts.specializationsCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    result.push(indentedSpecializations);
    result.push("");
  }

  // Emit generator exchange objects after specializations
  if (parts.exchangesCode) {
    const indentedExchanges = parts.exchangesCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    result.push(indentedExchanges);
    result.push("");
  }

  // Emit namespace-level declarations first
  if (parts.namespaceDeclsCode) {
    result.push(parts.namespaceDeclsCode);
  }

  // Then emit static container if needed
  if (parts.staticContainerCode) {
    if (parts.namespaceDeclsCode) {
      result.push("");
    }
    result.push(parts.staticContainerCode);
  }

  result.push("}");

  return result.join("\n");
};
