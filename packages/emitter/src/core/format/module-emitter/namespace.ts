/**
 * Namespace-level declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, indent } from "../../../types.js";
import { emitStatement } from "../../../statement-emitter.js";
import {
  preludeSection,
  type CSharpNamespaceMemberAst,
} from "../backend-ast/index.js";

export type NamespaceEmissionResult = {
  readonly members: readonly CSharpNamespaceMemberAst[];
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
  const members: CSharpNamespaceMemberAst[] = [];
  const namespaceContext = { ...indent(baseContext), hasInheritance };
  let currentContext = namespaceContext;

  for (const decl of declarations) {
    // Use the same base context for each declaration to maintain consistent indentation
    const [code, newContext] = emitStatement(decl, namespaceContext);
    members.push(preludeSection(code, 0));
    // Track context for using statements, but don't let indentation accumulate
    // Preserve the hasInheritance flag
    currentContext = { ...newContext, hasInheritance };
  }

  return {
    members,
    context: currentContext,
  };
};
