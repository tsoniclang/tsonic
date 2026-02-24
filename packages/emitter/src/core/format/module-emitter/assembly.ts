/**
 * Final output assembly
 *
 * NOTE: Tsonic generally avoids `using` statements. All type and member references
 * use fully-qualified `global::` names to eliminate ambiguity.
 *
 * However, some language/tooling features require namespace `using` directives
 * (e.g., extension-method invocation syntax for EF query precompilation).
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import {
  buildCompilationUnitAstFromAssembly,
  printCompilationUnitAst,
  type CSharpClassDeclarationAst,
  type CSharpNamespaceMemberAst,
} from "../backend-ast/index.js";

export type AssemblyParts = {
  readonly header: string;
  readonly adaptersCode: string;
  readonly specializationsCode: string;
  readonly exchangesCode: string;
  readonly namespaceDeclMembers: readonly CSharpNamespaceMemberAst[];
  readonly staticContainerMember?: CSharpClassDeclarationAst;
};

/**
 * Assemble final C# output from all parts
 */
export const assembleOutput = (
  module: IrModule,
  parts: AssemblyParts,
  finalContext: EmitterContext
): string => {
  const ast = buildCompilationUnitAstFromAssembly({
    headerText: parts.header,
    usingNamespaces: Array.from(finalContext.usings),
    namespaceName: module.namespace,
    adaptersCode: parts.adaptersCode,
    specializationsCode: parts.specializationsCode,
    exchangesCode: parts.exchangesCode,
    namespaceDeclMembers: parts.namespaceDeclMembers,
    staticContainerMember: parts.staticContainerMember,
  });
  return printCompilationUnitAst(ast);
};
