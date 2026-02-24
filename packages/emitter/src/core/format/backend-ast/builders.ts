/**
 * Builders for backend C# AST nodes.
 */

import type {
  CSharpClassDeclarationAst,
  CSharpClassMemberAst,
  CSharpCompilationUnitAst,
  CSharpNamespaceMemberAst,
  CSharpStatementAst,
} from "./types.js";

export type CompilationUnitAssemblyInput = {
  readonly headerText: string;
  readonly usingNamespaces: readonly string[];
  readonly namespaceName: string;
  readonly adaptersCode: string;
  readonly specializationsCode: string;
  readonly exchangesCode: string;
  readonly namespaceDeclMembers: readonly CSharpNamespaceMemberAst[];
  readonly staticContainerMember?: CSharpClassDeclarationAst;
};

export const blankLine = (): CSharpNamespaceMemberAst => ({
  kind: "blankLine",
});
export const classBlankLine = (): CSharpClassMemberAst => ({
  kind: "blankLine",
});

export const preludeSection = (
  text: string,
  indentLevel: number
): CSharpNamespaceMemberAst => ({
  kind: "preludeSection",
  text,
  indentLevel,
});

export const classDeclaration = (
  name: string,
  options: {
    readonly indentLevel?: number;
    readonly attributes?: readonly string[];
    readonly modifiers?: readonly string[];
    readonly members?: readonly CSharpClassMemberAst[];
  } = {}
): CSharpClassDeclarationAst => ({
  kind: "classDeclaration",
  indentLevel: options.indentLevel ?? 1,
  name,
  attributes: options.attributes ?? [],
  modifiers: options.modifiers ?? [],
  members: options.members ?? [],
});

export const classPreludeMember = (
  text: string,
  indentLevel: number = 0
): CSharpClassMemberAst => ({
  kind: "classPreludeMember",
  text,
  indentLevel,
});

export const methodDeclaration = (
  signature: string,
  statements: readonly CSharpStatementAst[]
): CSharpClassMemberAst => ({
  kind: "methodDeclaration",
  signature,
  body: {
    kind: "blockStatement",
    statements,
  },
});

const indentedPreludeSection = (
  text: string
): readonly CSharpNamespaceMemberAst[] =>
  text ? [preludeSection(text, 1), blankLine()] : [];

export const buildCompilationUnitAstFromAssembly = (
  input: CompilationUnitAssemblyInput
): CSharpCompilationUnitAst => {
  const staticContainerMembers = input.staticContainerMember
    ? [
        ...(input.namespaceDeclMembers.length > 0 ? [blankLine()] : []),
        input.staticContainerMember,
      ]
    : [];
  const members: readonly CSharpNamespaceMemberAst[] = [
    ...indentedPreludeSection(input.adaptersCode),
    ...indentedPreludeSection(input.specializationsCode),
    ...indentedPreludeSection(input.exchangesCode),
    ...input.namespaceDeclMembers,
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
