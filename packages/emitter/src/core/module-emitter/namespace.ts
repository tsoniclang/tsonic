/**
 * Namespace-level declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, indent } from "../../types.js";
import { emitStatement } from "../../statement-emitter.js";

export type NamespaceEmissionResult = {
  readonly code: string;
  readonly context: EmitterContext;
};

/**
 * Emit namespace-level declarations (classes, interfaces)
 */
export const emitNamespaceDeclarations = (
  declarations: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean
): NamespaceEmissionResult => {
  const namespaceParts: string[] = [];
  const namespaceContext = { ...indent(baseContext), hasInheritance };
  let currentContext = namespaceContext;

  for (const decl of declarations) {
    // Use the same base context for each declaration to maintain consistent indentation
    const [code, newContext] = emitStatement(decl, namespaceContext);
    namespaceParts.push(code);
    // Track context for using statements, but don't let indentation accumulate
    // Preserve the hasInheritance flag
    currentContext = { ...newContext, hasInheritance };
  }

  return {
    code: namespaceParts.join("\n"),
    context: currentContext,
  };
};
