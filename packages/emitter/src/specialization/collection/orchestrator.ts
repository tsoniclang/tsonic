/**
 * Main specialization collection orchestration
 */

import { IrModule } from "@tsonic/frontend";
import { SpecializationRequest } from "../types.js";
import { collectFromStatement } from "./statements.js";

/**
 * Collect all specialization requests from a module
 * Walks the IR tree looking for calls/news with requiresSpecialization flag
 */
export const collectSpecializations = (
  module: IrModule
): readonly SpecializationRequest[] => {
  const requests: SpecializationRequest[] = [];
  const seen = new Set<string>(); // Avoid duplicates

  // Walk through all statements and expressions to find specialization needs
  for (const stmt of module.body) {
    collectFromStatement(stmt, requests, seen, module);
  }

  return requests;
};
