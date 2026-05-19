import type { CSharpExpressionAst } from "./expression-ast.js";
import type { CSharpPatternAst } from "./pattern-ast.js";
import type { CSharpParameterAst } from "./signature-ast.js";
import type { CSharpTypeAst } from "./type-ast.js";

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
