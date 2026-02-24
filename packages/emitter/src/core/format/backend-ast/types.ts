/**
 * Backend AST nodes for C# emission.
 *
 * This file defines the canonical backend syntax model used by the emitter.
 * It intentionally mirrors C# syntax categories (compilation unit, declarations,
 * statements, expressions, and types) so backend passes can stay structure-first.
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

export type CSharpNamespaceMemberAst =
  | CSharpPreludeSectionAst
  | CSharpTypeDeclarationAst
  | CSharpGlobalMethodDeclarationAst
  | CSharpBlankLineAst;

export type CSharpPreludeSectionAst = {
  readonly kind: "preludeSection";
  readonly text: string;
  readonly indentLevel: number;
};

export type CSharpBlankLineAst = {
  readonly kind: "blankLine";
};

export type CSharpTypeDeclarationAst =
  | CSharpClassDeclarationAst
  | CSharpInterfaceDeclarationAst
  | CSharpStructDeclarationAst
  | CSharpEnumDeclarationAst;

export type CSharpClassDeclarationAst = {
  readonly kind: "classDeclaration";
  readonly indentLevel: number;
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly string[];
  readonly baseTypes?: readonly string[];
  readonly whereClauses?: readonly string[];
  readonly members: readonly CSharpClassMemberAst[];
};

export type CSharpStructDeclarationAst = {
  readonly kind: "structDeclaration";
  readonly indentLevel: number;
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly string[];
  readonly baseTypes?: readonly string[];
  readonly whereClauses?: readonly string[];
  readonly members: readonly CSharpClassMemberAst[];
};

export type CSharpInterfaceDeclarationAst = {
  readonly kind: "interfaceDeclaration";
  readonly indentLevel: number;
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly typeParameters?: readonly string[];
  readonly baseTypes?: readonly string[];
  readonly whereClauses?: readonly string[];
  readonly members: readonly CSharpInterfaceMemberAst[];
};

export type CSharpEnumDeclarationAst = {
  readonly kind: "enumDeclaration";
  readonly indentLevel: number;
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly members: readonly CSharpEnumMemberAst[];
};

export type CSharpEnumMemberAst = {
  readonly kind: "enumMember";
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpClassMemberAst =
  | CSharpFieldDeclarationAst
  | CSharpPropertyDeclarationAst
  | CSharpMethodDeclarationAst
  | CSharpConstructorDeclarationAst
  | CSharpTypeDeclarationAst
  | CSharpBlankLineAst
  | CSharpClassPreludeMemberAst;

export type CSharpInterfaceMemberAst =
  | CSharpPropertyDeclarationAst
  | CSharpMethodDeclarationAst
  | CSharpBlankLineAst
  | CSharpClassPreludeMemberAst;

export type CSharpClassPreludeMemberAst = {
  readonly kind: "classPreludeMember";
  readonly text: string;
  readonly indentLevel: number;
};

export type CSharpFieldDeclarationAst = {
  readonly kind: "fieldDeclaration";
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpPropertyDeclarationAst = {
  readonly kind: "propertyDeclaration";
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly accessorList: readonly CSharpAccessorDeclarationAst[];
  readonly initializer?: CSharpExpressionAst;
};

export type CSharpAccessorDeclarationAst = {
  readonly kind: "accessorDeclaration";
  readonly accessorKind: "get" | "set" | "init";
  readonly body?: CSharpBlockStatementAst;
};

export type CSharpMethodDeclarationAst = {
  readonly kind: "methodDeclaration";
  readonly attributes?: readonly string[];
  readonly modifiers?: readonly string[];
  readonly returnType?: CSharpTypeAst;
  readonly signature: string;
  readonly body: CSharpBlockStatementAst;
};

export type CSharpGlobalMethodDeclarationAst = {
  readonly kind: "globalMethodDeclaration";
  readonly indentLevel: number;
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly returnType: CSharpTypeAst;
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
  readonly body: CSharpBlockStatementAst;
};

export type CSharpConstructorDeclarationAst = {
  readonly kind: "constructorDeclaration";
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly name: string;
  readonly parameters: readonly CSharpParameterAst[];
  readonly initializer?: CSharpConstructorInitializerAst;
  readonly body: CSharpBlockStatementAst;
};

export type CSharpConstructorInitializerAst = {
  readonly kind: "constructorInitializer";
  readonly initializerKind: "base" | "this";
  readonly arguments: readonly CSharpExpressionAst[];
};

export type CSharpParameterAst = {
  readonly kind: "parameter";
  readonly attributes: readonly string[];
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly name: string;
  readonly defaultValue?: CSharpExpressionAst;
};

export type CSharpBlockStatementAst = {
  readonly kind: "blockStatement";
  readonly statements: readonly CSharpStatementAst[];
};

export type CSharpStatementAst =
  | CSharpBlockStatementAst
  | CSharpLocalDeclarationStatementAst
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

export type CSharpLocalDeclarationStatementAst = {
  readonly kind: "localDeclarationStatement";
  readonly modifiers: readonly string[];
  readonly type: CSharpTypeAst;
  readonly declarators: readonly CSharpVariableDeclaratorAst[];
};

export type CSharpVariableDeclaratorAst = {
  readonly kind: "variableDeclarator";
  readonly name: string;
  readonly initializer?: CSharpExpressionAst;
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
  readonly statement: CSharpStatementAst;
};

export type CSharpForStatementAst = {
  readonly kind: "forStatement";
  readonly initializer?: CSharpStatementAst;
  readonly condition?: CSharpExpressionAst;
  readonly iterator?: readonly CSharpExpressionAst[];
  readonly statement: CSharpStatementAst;
};

export type CSharpForeachStatementAst = {
  readonly kind: "foreachStatement";
  readonly awaitModifier: boolean;
  readonly type: CSharpTypeAst;
  readonly identifier: string;
  readonly expression: CSharpExpressionAst;
  readonly statement: CSharpStatementAst;
};

export type CSharpSwitchStatementAst = {
  readonly kind: "switchStatement";
  readonly expression: CSharpExpressionAst;
  readonly sections: readonly CSharpSwitchSectionAst[];
};

export type CSharpSwitchSectionAst = {
  readonly kind: "switchSection";
  readonly labels: readonly CSharpSwitchLabelAst[];
  readonly statements: readonly CSharpStatementAst[];
};

export type CSharpSwitchLabelAst =
  | {
      readonly kind: "caseSwitchLabel";
      readonly value: CSharpExpressionAst;
    }
  | {
      readonly kind: "defaultSwitchLabel";
    };

export type CSharpTryStatementAst = {
  readonly kind: "tryStatement";
  readonly block: CSharpBlockStatementAst;
  readonly catches: readonly CSharpCatchClauseAst[];
  readonly finallyBlock?: CSharpBlockStatementAst;
};

export type CSharpCatchClauseAst = {
  readonly kind: "catchClause";
  readonly declarationType?: CSharpTypeAst;
  readonly declarationIdentifier?: string;
  readonly block: CSharpBlockStatementAst;
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

export type CSharpYieldStatementAst =
  | {
      readonly kind: "yieldReturnStatement";
      readonly expression: CSharpExpressionAst;
    }
  | {
      readonly kind: "yieldBreakStatement";
    };

export type CSharpExpressionAst =
  | CSharpLiteralExpressionAst
  | CSharpIdentifierExpressionAst
  | CSharpMemberAccessExpressionAst
  | CSharpInvocationExpressionAst
  | CSharpObjectCreationExpressionAst
  | CSharpArrayCreationExpressionAst
  | CSharpAssignmentExpressionAst
  | CSharpBinaryExpressionAst
  | CSharpUnaryExpressionAst
  | CSharpConditionalExpressionAst
  | CSharpCastExpressionAst
  | CSharpAwaitExpressionAst
  | CSharpLambdaExpressionAst
  | CSharpRawExpressionAst;

export type CSharpRawExpressionAst = {
  readonly kind: "rawExpression";
  readonly text: string;
};

export type CSharpLiteralExpressionAst = {
  readonly kind: "literalExpression";
  readonly text: string;
};

export type CSharpIdentifierExpressionAst = {
  readonly kind: "identifierExpression";
  readonly identifier: string;
};

export type CSharpMemberAccessExpressionAst = {
  readonly kind: "memberAccessExpression";
  readonly expression: CSharpExpressionAst;
  readonly memberName: string;
};

export type CSharpInvocationExpressionAst = {
  readonly kind: "invocationExpression";
  readonly expression: CSharpExpressionAst;
  readonly arguments: readonly CSharpExpressionAst[];
};

export type CSharpObjectCreationExpressionAst = {
  readonly kind: "objectCreationExpression";
  readonly type: CSharpTypeAst;
  readonly arguments: readonly CSharpExpressionAst[];
  readonly initializer?: readonly CSharpExpressionAst[];
};

export type CSharpArrayCreationExpressionAst = {
  readonly kind: "arrayCreationExpression";
  readonly elementType: CSharpTypeAst;
  readonly rankSpecifiers: readonly CSharpExpressionAst[];
  readonly initializer?: readonly CSharpExpressionAst[];
};

export type CSharpAssignmentExpressionAst = {
  readonly kind: "assignmentExpression";
  readonly operatorToken: string;
  readonly left: CSharpExpressionAst;
  readonly right: CSharpExpressionAst;
};

export type CSharpBinaryExpressionAst = {
  readonly kind: "binaryExpression";
  readonly operatorToken: string;
  readonly left: CSharpExpressionAst;
  readonly right: CSharpExpressionAst;
};

export type CSharpUnaryExpressionAst = {
  readonly kind: "unaryExpression";
  readonly operatorToken: string;
  readonly operand: CSharpExpressionAst;
  readonly prefix: boolean;
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

export type CSharpAwaitExpressionAst = {
  readonly kind: "awaitExpression";
  readonly expression: CSharpExpressionAst;
};

export type CSharpLambdaExpressionAst = {
  readonly kind: "lambdaExpression";
  readonly parameters: readonly string[];
  readonly body: CSharpStatementAst | CSharpExpressionAst;
  readonly asyncModifier: boolean;
};

export type CSharpTypeAst =
  | {
      readonly kind: "rawType";
      readonly text: string;
    }
  | {
      readonly kind: "identifierType";
      readonly name: string;
      readonly typeArguments?: readonly CSharpTypeAst[];
    }
  | {
      readonly kind: "arrayType";
      readonly elementType: CSharpTypeAst;
      readonly rank: number;
    }
  | {
      readonly kind: "nullableType";
      readonly underlyingType: CSharpTypeAst;
    };
