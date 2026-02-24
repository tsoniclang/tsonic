/**
 * Backend AST nodes for C# emission.
 *
 * Phase 6 starts by introducing a typed backend surface for module assembly.
 * Lower-level declaration/expression emitters still produce text and are
 * represented as raw members here.
 */

export type CSharpCompilationUnitAst = {
  readonly kind: "compilationUnit";
  readonly headerText?: string;
  readonly usingDirectives: readonly CSharpUsingDirectiveAst[];
  readonly namespace: CSharpNamespaceDeclarationAst;
};

export type CSharpUsingDirectiveAst = {
  readonly kind: "usingDirective";
  readonly namespace: string;
};

export type CSharpNamespaceDeclarationAst = {
  readonly kind: "namespaceDeclaration";
  readonly name: string;
  readonly members: readonly CSharpNamespaceMemberAst[];
};

export type CSharpNamespaceMemberAst = CSharpRawMemberAst | CSharpBlankLineAst;

export type CSharpRawMemberAst = {
  readonly kind: "rawMember";
  readonly text: string;
  readonly baseIndent: number;
};

export type CSharpBlankLineAst = {
  readonly kind: "blankLine";
};
