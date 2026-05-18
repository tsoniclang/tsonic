import type { CSharpTypeDeclarationAst } from "./declaration-ast.js";
import type { CSharpQualifiedNameAst } from "./type-ast.js";

export type CSharpUsingDirectiveAst = {
  readonly kind: "usingDirective";
  readonly namespace: CSharpQualifiedNameAst;
};

export type CSharpSingleLineCommentTriviaAst = {
  readonly kind: "singleLineCommentTrivia";
  readonly text: string;
};

export type CSharpBlankLineTriviaAst = {
  readonly kind: "blankLineTrivia";
};

export type CSharpTriviaAst =
  | CSharpSingleLineCommentTriviaAst
  | CSharpBlankLineTriviaAst;

export type CSharpNamespaceDeclarationAst = {
  readonly kind: "namespaceDeclaration";
  readonly name: CSharpQualifiedNameAst;
  readonly members: readonly CSharpTypeDeclarationAst[];
};

export type CSharpCompilationUnitAst = {
  readonly kind: "compilationUnit";
  readonly leadingTrivia?: readonly CSharpTriviaAst[];
  readonly usings: readonly CSharpUsingDirectiveAst[];
  readonly members: readonly (
    | CSharpNamespaceDeclarationAst
    | CSharpTypeDeclarationAst
  )[];
};
