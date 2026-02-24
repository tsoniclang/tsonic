/**
 * Builders for backend C# AST nodes.
 */

import type {
  CSharpCompilationUnitAst,
  CSharpNamespaceMemberAst,
} from "./types.js";

export type CompilationUnitAssemblyInput = {
  readonly headerText: string;
  readonly usingNamespaces: readonly string[];
  readonly namespaceName: string;
  readonly adaptersCode: string;
  readonly specializationsCode: string;
  readonly exchangesCode: string;
  readonly namespaceDeclsCode: string;
  readonly staticContainerCode: string;
};

const rawMember = (
  text: string,
  baseIndent: number
): CSharpNamespaceMemberAst => ({
  kind: "rawMember",
  text,
  baseIndent,
});

const blankLine = (): CSharpNamespaceMemberAst => ({ kind: "blankLine" });

const indentedSection = (text: string): readonly CSharpNamespaceMemberAst[] =>
  text ? [rawMember(text, 1), blankLine()] : [];

export const buildCompilationUnitAstFromAssembly = (
  input: CompilationUnitAssemblyInput
): CSharpCompilationUnitAst => {
  const namespaceDeclMembers = input.namespaceDeclsCode
    ? [rawMember(input.namespaceDeclsCode, 0)]
    : [];
  const staticContainerMembers = input.staticContainerCode
    ? [
        ...(input.namespaceDeclsCode ? [blankLine()] : []),
        rawMember(input.staticContainerCode, 0),
      ]
    : [];
  const members: readonly CSharpNamespaceMemberAst[] = [
    ...indentedSection(input.adaptersCode),
    ...indentedSection(input.specializationsCode),
    ...indentedSection(input.exchangesCode),
    ...namespaceDeclMembers,
    ...staticContainerMembers,
  ];

  return {
    kind: "compilationUnit",
    headerText: input.headerText || undefined,
    usingDirectives: input.usingNamespaces.map((namespace) => ({
      kind: "usingDirective",
      namespace,
    })),
    namespace: {
      kind: "namespaceDeclaration",
      name: input.namespaceName,
      members,
    },
  };
};
