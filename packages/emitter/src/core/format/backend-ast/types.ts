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

export type CSharpPredefinedTypeAst = {
  readonly kind: "predefinedType";
  /** C# keyword: "int", "string", "bool", "double", "void", "object", "char", "decimal", "float", "long", etc. */
  readonly keyword: string;
};

export type CSharpIdentifierTypeAst = {
  readonly kind: "identifierType";
  /** Type name, potentially fully-qualified (e.g. "global::System.Collections.Generic.List") */
  readonly name: string;
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
  | CSharpNullableTypeAst
  | CSharpArrayTypeAst
  | CSharpPointerTypeAst
  | CSharpTupleTypeAst
  | CSharpVarTypeAst;

// ============================================================
// Expression AST
// ============================================================

export type CSharpLiteralExpressionAst = {
  readonly kind: "literalExpression";
  /** The literal token text: "null", "default", "true", "false", "42", "3.14", `"hello"`, `'c'` */
  readonly text: string;
};

export type CSharpIdentifierExpressionAst = {
  readonly kind: "identifierExpression";
  readonly identifier: string;
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
  /** Indent hint for block bodies (expressions don't track indentation) */
  readonly bodyIndent?: string;
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
  | CSharpLiteralExpressionAst
  | CSharpIdentifierExpressionAst
  | CSharpParenthesizedExpressionAst
  | CSharpMemberAccessExpressionAst
  | CSharpConditionalMemberAccessExpressionAst
  | CSharpElementAccessExpressionAst
  | CSharpConditionalElementAccessExpressionAst
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
  readonly name: string;
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
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly initializer?: CSharpExpressionAst;
  readonly isAutoProperty: boolean;
};

export type CSharpMethodDeclarationAst = {
  readonly kind: "methodDeclaration";
  readonly attributes: readonly CSharpAttributeAst[];
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
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

export type CSharpTypeParameterConstraintAst = {
  readonly typeParameter: string;
  readonly constraints: readonly string[];
};

export type CSharpMemberAst =
  | CSharpFieldDeclarationAst
  | CSharpPropertyDeclarationAst
  | CSharpMethodDeclarationAst
  | CSharpConstructorDeclarationAst;

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
  readonly namespace: string;
};

export type CSharpNamespaceDeclarationAst = {
  readonly kind: "namespaceDeclaration";
  readonly name: string;
  readonly members: readonly CSharpTypeDeclarationAst[];
};

export type CSharpCompilationUnitAst = {
  readonly kind: "compilationUnit";
  readonly usings: readonly CSharpUsingDirectiveAst[];
  readonly members: readonly (
    | CSharpNamespaceDeclarationAst
    | CSharpTypeDeclarationAst
  )[];
};
