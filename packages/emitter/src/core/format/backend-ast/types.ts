/**
 * Backend C# AST type definitions
 *
 * Structured AST nodes for deterministic C# code generation.
 * These types follow Roslyn syntax node semantics with camelCase TypeScript naming.
 *
 * Pipeline: IR -> typed CSharpAst -> deterministic printer -> C# text
 *
 * INVARIANT: No `rawType` or `rawExpression` nodes exist. Every construct
 * must be represented by an explicit, strongly-typed AST node.
 */

// ============================================================
// Type AST
// ============================================================

export type CSharpPredefinedTypeKeyword =
  | "bool"
  | "byte"
  | "sbyte"
  | "short"
  | "ushort"
  | "int"
  | "uint"
  | "long"
  | "ulong"
  | "nint"
  | "nuint"
  | "char"
  | "float"
  | "double"
  | "decimal"
  | "string"
  | "object"
  | "void";

export type CSharpPredefinedTypeAst = {
  readonly kind: "predefinedType";
  /** True C# predefined type keyword (for example "int", "string", "bool", "double", "void", "object"). */
  readonly keyword: CSharpPredefinedTypeKeyword;
};

export type CSharpIdentifierTypeAst = {
  readonly kind: "identifierType";
  /** Simple type name without qualification (e.g. "List", "Task", "MyType"). */
  readonly name: string;
  readonly typeArguments?: readonly CSharpTypeAst[];
};

export type CSharpQualifiedNameAst = {
  /** Optional alias qualifier like `global` in `global::System.String`. */
  readonly aliasQualifier?: string;
  /** Dot-separated identifier path segments. */
  readonly segments: readonly string[];
};

export type CSharpQualifiedIdentifierTypeAst = {
  readonly kind: "qualifiedIdentifierType";
  readonly name: CSharpQualifiedNameAst;
  readonly typeArguments?: readonly CSharpTypeAst[];
};

export type CSharpNullableTypeAst = {
  readonly kind: "nullableType";
  readonly underlyingType: CSharpTypeAst;
};

export type CSharpArrayTypeAst = {
  readonly kind: "arrayType";
  readonly elementType: CSharpTypeAst;
  /** Array rank: 1 for T[], 2 for T[,], etc. */
  readonly rank: number;
};

export type CSharpPointerTypeAst = {
  readonly kind: "pointerType";
  readonly elementType: CSharpTypeAst;
};

export type CSharpTupleElementAst = {
  readonly type: CSharpTypeAst;
  readonly name?: string;
};

export type CSharpTupleTypeAst = {
  readonly kind: "tupleType";
  readonly elements: readonly CSharpTupleElementAst[];
};

export type CSharpVarTypeAst = {
  readonly kind: "varType";
};

export type CSharpTypeAst =
  | CSharpPredefinedTypeAst
  | CSharpIdentifierTypeAst
  | CSharpQualifiedIdentifierTypeAst
  | CSharpNullableTypeAst
  | CSharpArrayTypeAst
  | CSharpPointerTypeAst
  | CSharpTupleTypeAst
  | CSharpVarTypeAst;

// ============================================================
// Expression AST
// ============================================================

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

// ============================================================
// Pattern AST (for is-expressions and switch patterns)
// ============================================================

export type CSharpTypePatternAst = {
  readonly kind: "typePattern";
  readonly type: CSharpTypeAst;
};

export type CSharpDeclarationPatternAst = {
  readonly kind: "declarationPattern";
  readonly type: CSharpTypeAst;
  readonly designation: string;
};

export type CSharpVarPatternAst = {
  readonly kind: "varPattern";
  readonly designation: string;
};

export type CSharpConstantPatternAst = {
  readonly kind: "constantPattern";
  readonly expression: CSharpExpressionAst;
};

export type CSharpDiscardPatternAst = {
  readonly kind: "discardPattern";
};

export type CSharpNegatedPatternAst = {
  readonly kind: "negatedPattern";
  readonly pattern: CSharpPatternAst;
};

export type CSharpPatternAst =
  | CSharpTypePatternAst
  | CSharpDeclarationPatternAst
  | CSharpVarPatternAst
  | CSharpConstantPatternAst
  | CSharpDiscardPatternAst
  | CSharpNegatedPatternAst;

// ============================================================
// Statement AST
// ============================================================

export type CSharpBlockStatementAst = {
  readonly kind: "blockStatement";
  readonly statements: readonly CSharpStatementAst[];
};

export type CSharpVariableDeclaratorAst = {
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpLocalDeclarationStatementAst = {
  readonly kind: "localDeclarationStatement";
  /** Modifiers like "private", "static", "readonly" (for static field patterns) */
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly declarators: readonly CSharpVariableDeclaratorAst[];
};

export type CSharpParameterAst = {
  readonly name: string;
  readonly type: CSharpTypeAst;
  readonly defaultValue?: CSharpExpressionAst;
  /** "ref", "out", "in", "params", "this" */
  readonly modifiers?: readonly string[];
  readonly attributes?: readonly CSharpAttributeAst[];
};

export type CSharpLocalFunctionStatementAst = {
  readonly kind: "localFunctionStatement";
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly typeParameters?: readonly string[];
  readonly parameters: readonly CSharpParameterAst[];
  readonly body: CSharpBlockStatementAst;
};

export type CSharpExpressionStatementAst = {
  readonly kind: "expressionStatement";
  readonly expression: CSharpExpressionAst;
};

export type CSharpIfStatementAst = {
  readonly kind: "ifStatement";
  readonly condition: CSharpExpressionAst;
  readonly thenStatement: CSharpStatementAst;
  readonly elseStatement?: CSharpStatementAst;
};

export type CSharpWhileStatementAst = {
  readonly kind: "whileStatement";
  readonly condition: CSharpExpressionAst;
  readonly body: CSharpStatementAst;
};

export type CSharpForStatementAst = {
  readonly kind: "forStatement";
  readonly declaration?: CSharpLocalDeclarationStatementAst;
  readonly initializers?: readonly CSharpExpressionAst[];
  readonly condition?: CSharpExpressionAst;
  readonly incrementors: readonly CSharpExpressionAst[];
  readonly body: CSharpStatementAst;
};

export type CSharpForeachStatementAst = {
  readonly kind: "foreachStatement";
  readonly isAwait: boolean;
  readonly type: CSharpTypeAst;
  readonly identifier: string;
  readonly expression: CSharpExpressionAst;
  readonly body: CSharpStatementAst;
};

export type CSharpCaseSwitchLabelAst = {
  readonly kind: "caseSwitchLabel";
  readonly value: CSharpExpressionAst;
};

export type CSharpCasePatternSwitchLabelAst = {
  readonly kind: "casePatternSwitchLabel";
  readonly pattern: CSharpPatternAst;
  readonly whenClause?: CSharpExpressionAst;
};

export type CSharpDefaultSwitchLabelAst = {
  readonly kind: "defaultSwitchLabel";
};

export type CSharpSwitchLabelAst =
  | CSharpCaseSwitchLabelAst
  | CSharpCasePatternSwitchLabelAst
  | CSharpDefaultSwitchLabelAst;

export type CSharpSwitchSectionAst = {
  readonly labels: readonly CSharpSwitchLabelAst[];
  readonly statements: readonly CSharpStatementAst[];
};

export type CSharpSwitchStatementAst = {
  readonly kind: "switchStatement";
  readonly expression: CSharpExpressionAst;
  readonly sections: readonly CSharpSwitchSectionAst[];
};

export type CSharpCatchClauseAst = {
  readonly type?: CSharpTypeAst;
  readonly identifier?: string;
  readonly filter?: CSharpExpressionAst;
  readonly body: CSharpBlockStatementAst;
};

export type CSharpTryStatementAst = {
  readonly kind: "tryStatement";
  readonly body: CSharpBlockStatementAst;
  readonly catches: readonly CSharpCatchClauseAst[];
  readonly finallyBody?: CSharpBlockStatementAst;
};

export type CSharpThrowStatementAst = {
  readonly kind: "throwStatement";
  readonly expression?: CSharpExpressionAst;
};

export type CSharpReturnStatementAst = {
  readonly kind: "returnStatement";
  readonly expression?: CSharpExpressionAst;
};

export type CSharpBreakStatementAst = {
  readonly kind: "breakStatement";
};

export type CSharpContinueStatementAst = {
  readonly kind: "continueStatement";
};

export type CSharpEmptyStatementAst = {
  readonly kind: "emptyStatement";
};

export type CSharpYieldStatementAst = {
  readonly kind: "yieldStatement";
  /** true = "yield break;", false = "yield return expr;" */
  readonly isBreak: boolean;
  readonly expression?: CSharpExpressionAst;
};

export type CSharpStatementAst =
  | CSharpBlockStatementAst
  | CSharpLocalDeclarationStatementAst
  | CSharpLocalFunctionStatementAst
  | CSharpExpressionStatementAst
  | CSharpIfStatementAst
  | CSharpWhileStatementAst
  | CSharpForStatementAst
  | CSharpForeachStatementAst
  | CSharpSwitchStatementAst
  | CSharpTryStatementAst
  | CSharpThrowStatementAst
  | CSharpReturnStatementAst
  | CSharpBreakStatementAst
  | CSharpContinueStatementAst
  | CSharpEmptyStatementAst
  | CSharpYieldStatementAst;

// ============================================================
// Declaration/Member AST (for module-level emission)
// ============================================================

export type CSharpAttributeAst = {
  readonly type: CSharpTypeAst;
  readonly arguments?: readonly CSharpExpressionAst[];
  /** Attribute target specifier, e.g. "return", "assembly", "field" */
  readonly target?: string;
};

export type CSharpFieldDeclarationAst = {
  readonly kind: "fieldDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpPropertyDeclarationAst = {
  readonly kind: "propertyDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly explicitInterface?: CSharpTypeAst;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly setterAccessibility?: "private" | "protected" | "internal";
  /** C# 9 init-only setter (`{ get; init; }`) */
  readonly hasInit?: boolean;
  readonly initializer?: CSharpExpressionAst;
  readonly isAutoProperty: boolean;
  /** Explicit getter body (when isAutoProperty is false) */
  readonly getterBody?: CSharpBlockStatementAst;
  /** Explicit setter body (when isAutoProperty is false) */
  readonly setterBody?: CSharpBlockStatementAst;
};

export type CSharpMethodDeclarationAst = {
  readonly kind: "methodDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly explicitInterface?: CSharpTypeAst;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly parameters: readonly CSharpParameterAst[];
  readonly body?: CSharpBlockStatementAst;
  readonly expressionBody?: CSharpExpressionAst;
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpConstructorDeclarationAst = {
  readonly kind: "constructorDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
  readonly baseArguments?: readonly CSharpExpressionAst[];
  readonly body: CSharpBlockStatementAst;
};

export type CSharpEnumMemberAst = {
  readonly name: string;
  readonly value?: CSharpExpressionAst;
};

export type CSharpTypeParameterAst = {
  readonly name: string;
};

export type CSharpTypeParameterConstraintNodeAst =
  | {
      readonly kind: "typeConstraint";
      readonly type: CSharpTypeAst;
    }
  | {
      readonly kind: "classConstraint";
    }
  | {
      readonly kind: "structConstraint";
    }
  | {
      readonly kind: "constructorConstraint";
    };

export type CSharpTypeParameterConstraintAst = {
  readonly typeParameter: string;
  readonly constraints: readonly CSharpTypeParameterConstraintNodeAst[];
};

export type CSharpDelegateDeclarationAst = {
  readonly kind: "delegateDeclaration";
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
};

export type CSharpMemberAst =
  | CSharpFieldDeclarationAst
  | CSharpPropertyDeclarationAst
  | CSharpMethodDeclarationAst
  | CSharpConstructorDeclarationAst
  | CSharpDelegateDeclarationAst;

export type CSharpClassDeclarationAst = {
  readonly kind: "classDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly baseType?: CSharpTypeAst;
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpStructDeclarationAst = {
  readonly kind: "structDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpInterfaceDeclarationAst = {
  readonly kind: "interfaceDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly CSharpTypeParameterAst[];
  readonly interfaces: readonly CSharpTypeAst[];
  readonly members: readonly CSharpMemberAst[];
  readonly constraints?: readonly CSharpTypeParameterConstraintAst[];
};

export type CSharpEnumDeclarationAst = {
  readonly kind: "enumDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly members: readonly CSharpEnumMemberAst[];
};

export type CSharpTypeDeclarationAst =
  | CSharpClassDeclarationAst
  | CSharpStructDeclarationAst
  | CSharpInterfaceDeclarationAst
  | CSharpEnumDeclarationAst;

// ============================================================
// Top-level compilation unit
// ============================================================

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
