/**
 * Namespace-level declaration emission
 *
 * Calls AST-returning declaration emitters directly, collecting
 * CSharpTypeDeclarationAst[] for the namespace body.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, indent, getIndent } from "../../../types.js";
import {
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
} from "../../../statements/declarations.js";
import type { CSharpTypeDeclarationAst } from "../backend-ast/types.js";

export type NamespaceEmissionResult = {
  readonly declarations: readonly CSharpTypeDeclarationAst[];
  readonly commentLines: readonly string[];
  readonly context: EmitterContext;
};

/**
 * Emit namespace-level declarations as AST type declarations.
 *
 * Returns AST declarations plus any comment-only lines (e.g., non-structural
 * type aliases that emit `// type Foo = ...`).
 */
export const emitNamespaceDeclarations = (
  declarations: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean
): NamespaceEmissionResult => {
  const astDecls: CSharpTypeDeclarationAst[] = [];
  const commentLines: string[] = [];
  const namespaceContext = { ...indent(baseContext), hasInheritance };
  let currentContext = namespaceContext;

  for (const decl of declarations) {
    const declContext = { ...namespaceContext, usings: currentContext.usings };

    switch (decl.kind) {
      case "classDeclaration": {
        const [classDecls, classCtx] = emitClassDeclaration(decl, declContext);
        astDecls.push(...classDecls);
        currentContext = { ...classCtx, hasInheritance };
        break;
      }

      case "interfaceDeclaration": {
        const [ifaceDecls, ifaceCtx] = emitInterfaceDeclaration(
          decl,
          declContext
        );
        astDecls.push(...ifaceDecls);
        currentContext = { ...ifaceCtx, hasInheritance };
        break;
      }

      case "enumDeclaration": {
        const [enumAst, enumCtx] = emitEnumDeclaration(decl, declContext);
        astDecls.push(enumAst);
        currentContext = { ...enumCtx, hasInheritance };
        break;
      }

      case "typeAliasDeclaration": {
        const [aliasAst, aliasCtx, commentText] = emitTypeAliasDeclaration(
          decl,
          declContext
        );
        if (aliasAst) {
          astDecls.push(aliasAst);
        } else {
          const ind = getIndent(declContext);
          commentLines.push(commentText ?? `${ind}// type ${decl.name}`);
        }
        currentContext = { ...aliasCtx, hasInheritance };
        break;
      }

      default:
        // Namespace-level declarations should only be type declarations
        break;
    }
  }

  return {
    declarations: astDecls,
    commentLines,
    context: currentContext,
  };
};
