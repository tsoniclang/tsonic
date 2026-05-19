/**
 * Final output assembly
 *
 * Builds a CSharpCompilationUnitAst from all emitted parts and prints it.
 *
 * NOTE: Tsonic generally avoids `using` statements. All type and member references
 * use fully-qualified `global::` names to eliminate ambiguity.
 *
 * However, some language/tooling features require namespace `using` directives
 * (e.g., extension-method invocation syntax for EF query precompilation).
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { printCompilationUnit } from "../backend-ast/printer.js";
import { qualifiedName } from "../backend-ast/builders.js";
import type {
  CSharpCompilationUnitAst,
  CSharpNamespaceDeclarationAst,
  CSharpTypeDeclarationAst,
  CSharpTriviaAst,
  CSharpUsingDirectiveAst,
} from "../backend-ast/types.js";

export type AssemblyParts = {
  readonly leadingTrivia: readonly CSharpTriviaAst[];
  readonly adapterDecls: readonly CSharpTypeDeclarationAst[];
  readonly specializationDecls: readonly CSharpTypeDeclarationAst[];
  readonly exchangeDecls: readonly CSharpTypeDeclarationAst[];
  readonly namespaceDecls: readonly CSharpTypeDeclarationAst[];
  readonly staticContainerDecl: CSharpTypeDeclarationAst | undefined;
};

/**
 * Build CSharpCompilationUnitAst and print to C# text
 */
export const assembleOutput = (
  module: IrModule,
  parts: AssemblyParts,
  finalContext: EmitterContext
): string => {
  // Collect namespace members in order
  const namespaceMembers: CSharpTypeDeclarationAst[] = [
    ...parts.adapterDecls,
    ...parts.specializationDecls,
    ...parts.exchangeDecls,
  ];

  namespaceMembers.push(...parts.namespaceDecls);

  if (parts.staticContainerDecl) {
    namespaceMembers.push(parts.staticContainerDecl);
  }

  const namespaceDecl: CSharpNamespaceDeclarationAst = {
    kind: "namespaceDeclaration",
    name: qualifiedName(module.namespace),
    members: namespaceMembers,
  };

  // Collect using directives
  const usings: CSharpUsingDirectiveAst[] = Array.from(finalContext.usings)
    .sort()
    .map((ns) => ({
      kind: "usingDirective" as const,
      namespace: qualifiedName(ns),
    }));

  const compilationUnit: CSharpCompilationUnitAst = {
    kind: "compilationUnit",
    leadingTrivia:
      parts.leadingTrivia.length > 0 ? parts.leadingTrivia : undefined,
    usings,
    members: [namespaceDecl],
  };

  return printCompilationUnit(compilationUnit);
};
