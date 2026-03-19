import type { CSharpPatternAst } from "./pattern-ast.js";
import type { CSharpBlockStatementAst } from "./statement-ast.js";
import type { CSharpTypeAst, CSharpQualifiedNameAst } from "./type-ast.js";

export type CSharpNullLiteralExpressionAst = {
  readonly kind: "nullLiteralExpression";
};

export type CSharpBooleanLiteralExpressionAst = {
  readonly kind: "booleanLiteralExpression";
  readonly value: boolean;
};

export type CSharpStringLiteralExpressionAst = {
  readonly kind: "stringLiteralExpression";
  readonly value: string;
};

export type CSharpCharLiteralExpressionAst = {
  readonly kind: "charLiteralExpression";
  readonly value: string;
};

export type CSharpNumericLiteralBase = "decimal" | "hexadecimal" | "binary";

export type CSharpNumericLiteralSuffix = "L" | "U" | "UL" | "f" | "d" | "m";

export type CSharpNumericLiteralExpressionAst = {
  readonly kind: "numericLiteralExpression";
  readonly base: CSharpNumericLiteralBase;
  readonly wholePart: string;
  readonly fractionalPart?: string;
  readonly exponentSign?: "+" | "-";
  readonly exponentDigits?: string;
  readonly suffix?: CSharpNumericLiteralSuffix;
};

export type CSharpIdentifierExpressionAst = {
  readonly kind: "identifierExpression";
  /** Simple identifier without qualification. */
  readonly identifier: string;
};

export type CSharpQualifiedIdentifierExpressionAst = {
  readonly kind: "qualifiedIdentifierExpression";
  readonly name: CSharpQualifiedNameAst;
};

export type CSharpTypeReferenceExpressionAst = {
  readonly kind: "typeReferenceExpression";
  readonly type: CSharpTypeAst;
};

export type CSharpParenthesizedExpressionAst = {
  readonly kind: "parenthesizedExpression";
  readonly expression: CSharpExpressionAst;
};

export type CSharpMemberAccessExpressionAst = {
  readonly kind: "memberAccessExpression";
  readonly expression: CSharpExpressionAst;
  readonly memberName: string;
};

export type CSharpConditionalMemberAccessExpressionAst = {
  readonly kind: "conditionalMemberAccessExpression";
  readonly expression: CSharpExpressionAst;
  readonly memberName: string;
};

export type CSharpElementAccessExpressionAst = {
  readonly kind: "elementAccessExpression";
  readonly expression: CSharpExpressionAst;
  readonly arguments: readonly CSharpExpressionAst[];
};

export type CSharpConditionalElementAccessExpressionAst = {
  readonly kind: "conditionalElementAccessExpression";
  readonly expression: CSharpExpressionAst;
  readonly arguments: readonly CSharpExpressionAst[];
};

export type CSharpImplicitElementAccessExpressionAst = {
  readonly kind: "implicitElementAccessExpression";
  readonly arguments: readonly CSharpExpressionAst[];
};

export type CSharpInvocationExpressionAst = {
  readonly kind: "invocationExpression";
  readonly expression: CSharpExpressionAst;
  readonly arguments: readonly CSharpExpressionAst[];
  readonly typeArguments?: readonly CSharpTypeAst[];
};

export type CSharpObjectCreationExpressionAst = {
  readonly kind: "objectCreationExpression";
  readonly type: CSharpTypeAst;
  readonly arguments: readonly CSharpExpressionAst[];
  /** Object/collection initializer entries */
  readonly initializer?: readonly CSharpExpressionAst[];
};

export type CSharpArrayCreationExpressionAst = {
  readonly kind: "arrayCreationExpression";
  readonly elementType: CSharpTypeAst;
  readonly sizeExpression?: CSharpExpressionAst;
  readonly initializer?: readonly CSharpExpressionAst[];
};

export type CSharpStackAllocArrayCreationExpressionAst = {
  readonly kind: "stackAllocArrayCreationExpression";
  readonly elementType: CSharpTypeAst;
  readonly sizeExpression: CSharpExpressionAst;
};

export type CSharpAssignmentExpressionAst = {
  readonly kind: "assignmentExpression";
  /** "=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", "??=" */
  readonly operatorToken: string;
  readonly left: CSharpExpressionAst;
  readonly right: CSharpExpressionAst;
};

export type CSharpBinaryExpressionAst = {
  readonly kind: "binaryExpression";
  /** "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "??", "&", "|", "^", "<<", ">>" */
  readonly operatorToken: string;
  readonly left: CSharpExpressionAst;
  readonly right: CSharpExpressionAst;
};

export type CSharpPrefixUnaryExpressionAst = {
  readonly kind: "prefixUnaryExpression";
  /** "++", "--", "!", "-", "~", "+" */
  readonly operatorToken: string;
  readonly operand: CSharpExpressionAst;
};

export type CSharpPostfixUnaryExpressionAst = {
  readonly kind: "postfixUnaryExpression";
  /** "++", "--" */
  readonly operatorToken: string;
  readonly operand: CSharpExpressionAst;
};

export type CSharpConditionalExpressionAst = {
  readonly kind: "conditionalExpression";
  readonly condition: CSharpExpressionAst;
  readonly whenTrue: CSharpExpressionAst;
  readonly whenFalse: CSharpExpressionAst;
};

export type CSharpCastExpressionAst = {
  readonly kind: "castExpression";
  readonly type: CSharpTypeAst;
  readonly expression: CSharpExpressionAst;
};

export type CSharpAsExpressionAst = {
  readonly kind: "asExpression";
  readonly expression: CSharpExpressionAst;
  readonly type: CSharpTypeAst;
};

export type CSharpIsExpressionAst = {
  readonly kind: "isExpression";
  readonly expression: CSharpExpressionAst;
  readonly pattern: CSharpPatternAst;
};

export type CSharpDefaultExpressionAst = {
  readonly kind: "defaultExpression";
  /** When undefined, emits untyped "default". When present, emits "default(T)". */
  readonly type?: CSharpTypeAst;
};

export type CSharpSizeOfExpressionAst = {
  readonly kind: "sizeOfExpression";
  readonly type: CSharpTypeAst;
};

export type CSharpAwaitExpressionAst = {
  readonly kind: "awaitExpression";
  readonly expression: CSharpExpressionAst;
};

export type CSharpLambdaParameterAst = {
  readonly name: string;
  readonly type?: CSharpTypeAst;
  /** "ref", "out", "in" */
  readonly modifier?: string;
};

export type CSharpLambdaExpressionAst = {
  readonly kind: "lambdaExpression";
  readonly isAsync: boolean;
  readonly parameters: readonly CSharpLambdaParameterAst[];
  readonly body: CSharpExpressionAst | CSharpBlockStatementAst;
};

export type CSharpInterpolatedStringPartText = {
  readonly kind: "text";
  readonly text: string;
};

export type CSharpInterpolatedStringPartInterpolation = {
  readonly kind: "interpolation";
  readonly expression: CSharpExpressionAst;
  readonly formatClause?: string;
};

export type CSharpInterpolatedStringPart =
  | CSharpInterpolatedStringPartText
  | CSharpInterpolatedStringPartInterpolation;

export type CSharpInterpolatedStringExpressionAst = {
  readonly kind: "interpolatedStringExpression";
  readonly parts: readonly CSharpInterpolatedStringPart[];
};

export type CSharpThrowExpressionAst = {
  readonly kind: "throwExpression";
  readonly expression: CSharpExpressionAst;
};

export type CSharpSuppressNullableWarningExpressionAst = {
  readonly kind: "suppressNullableWarningExpression";
  readonly expression: CSharpExpressionAst;
};

export type CSharpTypeofExpressionAst = {
  readonly kind: "typeofExpression";
  readonly type: CSharpTypeAst;
};

export type CSharpArgumentModifierExpressionAst = {
  readonly kind: "argumentModifierExpression";
  /** "ref", "out", "in", "params" */
  readonly modifier: string;
  readonly expression: CSharpExpressionAst;
};

export type CSharpTupleExpressionAst = {
  readonly kind: "tupleExpression";
  readonly elements: readonly CSharpExpressionAst[];
};

export type CSharpSwitchExpressionArmAst = {
  readonly pattern: CSharpPatternAst;
  readonly whenClause?: CSharpExpressionAst;
  readonly expression: CSharpExpressionAst;
};

export type CSharpSwitchExpressionAst = {
  readonly kind: "switchExpression";
  readonly governingExpression: CSharpExpressionAst;
  readonly arms: readonly CSharpSwitchExpressionArmAst[];
};

export type CSharpExpressionAst =
  | CSharpNullLiteralExpressionAst
  | CSharpBooleanLiteralExpressionAst
  | CSharpStringLiteralExpressionAst
  | CSharpCharLiteralExpressionAst
  | CSharpNumericLiteralExpressionAst
  | CSharpIdentifierExpressionAst
  | CSharpQualifiedIdentifierExpressionAst
  | CSharpTypeReferenceExpressionAst
  | CSharpParenthesizedExpressionAst
  | CSharpMemberAccessExpressionAst
  | CSharpConditionalMemberAccessExpressionAst
  | CSharpElementAccessExpressionAst
  | CSharpConditionalElementAccessExpressionAst
  | CSharpImplicitElementAccessExpressionAst
  | CSharpInvocationExpressionAst
  | CSharpObjectCreationExpressionAst
  | CSharpArrayCreationExpressionAst
  | CSharpStackAllocArrayCreationExpressionAst
  | CSharpAssignmentExpressionAst
  | CSharpBinaryExpressionAst
  | CSharpPrefixUnaryExpressionAst
  | CSharpPostfixUnaryExpressionAst
  | CSharpConditionalExpressionAst
  | CSharpCastExpressionAst
  | CSharpAsExpressionAst
  | CSharpIsExpressionAst
  | CSharpDefaultExpressionAst
  | CSharpSizeOfExpressionAst
  | CSharpAwaitExpressionAst
  | CSharpLambdaExpressionAst
  | CSharpInterpolatedStringExpressionAst
  | CSharpThrowExpressionAst
  | CSharpSuppressNullableWarningExpressionAst
  | CSharpTypeofExpressionAst
  | CSharpSwitchExpressionAst
  | CSharpArgumentModifierExpressionAst
  | CSharpTupleExpressionAst;
