/**
 * Builders for backend C# AST nodes.
 */

import type {
  CSharpClassDeclarationAst,
  CSharpClassMemberAst,
  CSharpCompilationUnitAst,
  CSharpMethodDeclarationAst,
  CSharpNamespaceMemberAst,
  CSharpStatementAst,
} from "./types.js";
import { typeAstFromText } from "./type-factories.js";

export type CompilationUnitAssemblyInput = {
  readonly headerText: string;
  readonly usingNamespaces: readonly string[];
  readonly namespaceName: string;
  readonly namespaceMembers: readonly CSharpNamespaceMemberAst[];
  readonly staticContainerMember?: CSharpClassDeclarationAst;
};

export const blankLine = (): CSharpNamespaceMemberAst => ({
  kind: "blankLine",
});
export const classBlankLine = (): CSharpClassMemberAst => ({
  kind: "blankLine",
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

export const methodDeclaration = (
  name: string,
  options: {
    readonly attributes?: readonly string[];
    readonly modifiers?: readonly string[];
    readonly returnType?: CSharpMethodDeclarationAst["returnType"];
    readonly typeParameters?: readonly string[];
    readonly parameters?: CSharpMethodDeclarationAst["parameters"];
    readonly whereClauses?: readonly string[];
  },
  statements: readonly CSharpStatementAst[]
): CSharpClassMemberAst => ({
  kind: "methodDeclaration",
  attributes: options.attributes ?? [],
  modifiers: options.modifiers ?? [],
  returnType: options.returnType ?? typeAstFromText("void"),
  name,
  typeParameters: options.typeParameters,
  parameters: options.parameters ?? [],
  whereClauses: options.whereClauses,
  body: {
    kind: "blockStatement",
    statements,
  },
});

export const buildCompilationUnitAstFromAssembly = (
  input: CompilationUnitAssemblyInput
): CSharpCompilationUnitAst => {
  const staticContainerMembers = input.staticContainerMember
    ? [
        ...(input.namespaceMembers.length > 0 ? [blankLine()] : []),
        input.staticContainerMember,
      ]
    : [];
  const members: readonly CSharpNamespaceMemberAst[] = [
    ...input.namespaceMembers,
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
