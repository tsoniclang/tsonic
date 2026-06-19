export interface CsharpCompilationUnit {
  readonly usings: readonly CsharpUsing[];
  readonly members: readonly CsharpMember[];
}

export interface CsharpUsing {
  readonly namespace: string;
}

export type CsharpMember = CsharpNamespace | CsharpTypeDeclaration;

export interface CsharpNamespace {
  readonly kind: "namespace";
  readonly name: string;
  readonly members: readonly CsharpTypeDeclaration[];
}

export type CsharpTypeDeclaration = CsharpClassDeclaration | CsharpStructDeclaration;

export interface CsharpClassDeclaration {
  readonly kind: "class";
  readonly name: string;
  readonly modifiers: readonly CsharpModifier[];
  readonly members: readonly CsharpTypeMember[];
}

export interface CsharpStructDeclaration {
  readonly kind: "struct";
  readonly name: string;
  readonly modifiers: readonly CsharpModifier[];
  readonly members: readonly CsharpTypeMember[];
}

export type CsharpTypeMember = CsharpConstructorDeclaration | CsharpMethodDeclaration | CsharpFieldDeclaration;

export interface CsharpConstructorDeclaration {
  readonly kind: "constructor";
  readonly name: string;
  readonly modifiers: readonly CsharpModifier[];
  readonly parameters: readonly CsharpParameter[];
  readonly body: CsharpBlock;
}

export interface CsharpMethodDeclaration {
  readonly kind: "method";
  readonly name: string;
  readonly modifiers: readonly CsharpModifier[];
  readonly returnType: CsharpTypeNode;
  readonly parameters: readonly CsharpParameter[];
  readonly body: CsharpBlock;
}

export interface CsharpFieldDeclaration {
  readonly kind: "field";
  readonly name: string;
  readonly modifiers: readonly CsharpModifier[];
  readonly type: CsharpTypeNode;
  readonly initializer?: CsharpExpression;
}

export interface CsharpParameter {
  readonly name: string;
  readonly type: CsharpTypeNode;
  readonly passing?: "in" | "out" | "ref";
}

export type CsharpModifier = "public" | "internal" | "private" | "static" | "readonly";

export type CsharpTypeNode =
  | { readonly kind: "predefined"; readonly name: string }
  | { readonly kind: "named"; readonly name: string; readonly typeArguments?: readonly CsharpTypeNode[] }
  | { readonly kind: "qualified"; readonly left: CsharpTypeNode; readonly name: string; readonly typeArguments?: readonly CsharpTypeNode[] }
  | { readonly kind: "array"; readonly elementType: CsharpTypeNode; readonly rank?: number };

export interface CsharpBlock {
  readonly statements: readonly CsharpStatement[];
}

export type CsharpStatement =
  | { readonly kind: "return"; readonly expression?: CsharpExpression }
  | { readonly kind: "expression"; readonly expression: CsharpExpression }
  | { readonly kind: "local"; readonly name: string; readonly type: CsharpTypeNode; readonly initializer?: CsharpExpression }
  | { readonly kind: "block"; readonly body: CsharpBlock }
  | { readonly kind: "if"; readonly condition: CsharpExpression; readonly thenBody: CsharpBlock; readonly elseBody?: CsharpBlock }
  | { readonly kind: "while"; readonly condition: CsharpExpression; readonly body: CsharpBlock }
  | { readonly kind: "do"; readonly body: CsharpBlock; readonly condition: CsharpExpression }
  | {
      readonly kind: "for";
      readonly initializer?: CsharpForInitializer;
      readonly condition?: CsharpExpression;
      readonly incrementor?: CsharpExpression;
      readonly body: CsharpBlock;
    };

export type CsharpForInitializer =
  | { readonly kind: "locals"; readonly locals: readonly CsharpLocalDeclaration[] }
  | { readonly kind: "expression"; readonly expression: CsharpExpression };

export interface CsharpLocalDeclaration {
  readonly name: string;
  readonly type: CsharpTypeNode;
  readonly initializer?: CsharpExpression;
}

export type CsharpExpression =
  | { readonly kind: "identifier"; readonly name: string }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | { readonly kind: "parenthesized"; readonly expression: CsharpExpression }
  | { readonly kind: "call"; readonly callee: CsharpExpression; readonly arguments: readonly CsharpArgument[] }
  | { readonly kind: "new"; readonly type: CsharpTypeNode; readonly arguments: readonly CsharpArgument[] }
  | { readonly kind: "member"; readonly receiver: CsharpExpression; readonly name: string }
  | { readonly kind: "element"; readonly receiver: CsharpExpression; readonly argument: CsharpExpression }
  | { readonly kind: "binary"; readonly left: CsharpExpression; readonly operator: string; readonly right: CsharpExpression }
  | { readonly kind: "prefixUnary"; readonly operator: string; readonly operand: CsharpExpression }
  | { readonly kind: "postfixUnary"; readonly operand: CsharpExpression; readonly operator: string }
  | { readonly kind: "conditional"; readonly condition: CsharpExpression; readonly whenTrue: CsharpExpression; readonly whenFalse: CsharpExpression }
  | { readonly kind: "array"; readonly elements: readonly CsharpExpression[] };

export interface CsharpArgument {
  readonly expression: CsharpExpression;
  readonly passing?: "in" | "out" | "ref";
}
