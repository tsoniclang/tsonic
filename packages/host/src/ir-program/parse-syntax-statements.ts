
import type { NodeList, ModifierList, Identifier, EmptyStatement, IfStatement, DoStatement, WhileStatement, ForStatement, ForInStatement, ForOfStatement, BreakStatement, ContinueStatement, ReturnStatement, WithStatement, SwitchStatement, CaseBlock, CaseClause, DefaultClause, CaseOrDefaultClause, ThrowStatement, TryStatement, CatchClause, DebuggerStatement, LabeledStatement, ExpressionStatement, Block, VariableStatement, VariableDeclaration, VariableDeclarationList, BindingPattern, ParameterDeclaration, BindingElement, MissingDeclaration, FunctionDeclaration, ClassDeclaration, ClassExpression, HeritageClause, InterfaceDeclaration, TypeAliasDeclaration, EnumMember, EnumDeclaration, ModuleBlock, NotEmittedStatement, NotEmittedTypeElement, CallSignatureDeclaration, ConstructSignatureDeclaration, ConstructorDeclaration, GetAccessorDeclaration, SetAccessorDeclaration, IndexSignatureDeclaration, MethodSignatureDeclaration, MethodDeclaration, PropertySignatureDeclaration, PropertyDeclaration, SemicolonClassElement, ClassStaticBlockDeclaration, ExpressionWithTypeArguments, TypeParameterDeclaration, Expression, Statement, TypeNode, BlockOrExpression, PropertyName, ForInitializer, BindingName, ClassElement, TypeElement, DotDotDotToken, QuestionToken, ExclamationToken, AsteriskToken, AwaitKeyword } from "../ir-hir/contract.js";
import type { TypedIteration, TypedControlTransfer, TypedBinding, TypedBindingPattern, TypedParameter, TypedVariableList, TypedCallable, TypedClass, TypedClassValue, TypedHeritage, TypedInterface, TypedAlias, TypedEnum, TypedStorageDeclaration, TypedStaticBlock, TypedIndexDeclaration, TypedPhase, TypedBindingElement } from "../ir-tir/contract.js";
import type { Cursor, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { readBoolean, readNull, readStringChoice, atomicText, fieldText } from "./parse-values.js";
import { readTypedBindingElementText, readTypedBindingText, readTypedBindingPatternText, readTypedParameterText, readTypedCallableText, readTypedClassText, readTypedHeritageText, readTypedInterfaceText, readTypedAliasText, readTypedStorageDeclarationText, readTypedEnumText, readTypedIndexDeclarationText, readTypedStaticBlockText } from "./parse-phase-declarations.js";
import { readTypedIterationText, readTypedControlTransferText, readTypedVariableListText, readTypedClassValueText } from "./parse-phase.js";
import { resolveSyntaxValue, syntaxAlternatives, readSyntaxRecord, finishSyntaxRecord, readSyntaxReference, readNullableSyntax, readSyntaxList } from "./parse-syntax-values.js";

export function readEmptyStatementSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "EmptyStatement", finish: (value: SyntaxValue<EmptyStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<EmptyStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readIfStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "IfStatement", finish: (value: SyntaxValue<IfStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "thenStatement", (next, done) => readSyntaxReference(next, ports.Statement, done), thenStatementValue =>
    fieldText<SyntaxValue<Statement<TypedPhase> | null>, Root>(cursor, fields, "elseStatement", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Statement, done), done), elseStatementValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<IfStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(thenStatementValue, thenStatementResolved => resolveSyntaxValue(elseStatementValue, elseStatementResolved => ({ ...header, kind, expression: expressionResolved, thenStatement: thenStatementResolved, elseStatement: elseStatementResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readDoStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "DoStatement", finish: (value: SyntaxValue<DoStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<DoStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementValue, statementResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, statement: statementResolved, expression: expressionResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readWhileStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "WhileStatement", finish: (value: SyntaxValue<WhileStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<WhileStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementValue, statementResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, statement: statementResolved, expression: expressionResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readForStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ForStatement", finish: (value: SyntaxValue<ForStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<SyntaxValue<ForInitializer<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ForInitializer, done), done), initializerValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "condition", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), conditionValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "incrementor", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), incrementorValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ForStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementValue, statementResolved => resolveSyntaxValue(initializerValue, initializerResolved => resolveSyntaxValue(conditionValue, conditionResolved => resolveSyntaxValue(incrementorValue, incrementorResolved => ({ ...header, kind, statement: statementResolved, initializer: initializerResolved, condition: conditionResolved, incrementor: incrementorResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readForInStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ForInStatement", finish: (value: SyntaxValue<ForInStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "awaitModifier", (next, done) => atomicText(next, readNull, done), awaitModifierValue =>
    fieldText<SyntaxValue<ForInitializer<TypedPhase>>, Root>(cursor, fields, "initializer", (next, done) => readSyntaxReference(next, ports.ForInitializer, done), initializerValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<TypedIteration, Root>(cursor, fields, "tsonic", readTypedIterationText, tsonicValue =>
    finishSyntaxRecord<ForInStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(initializerValue, initializerResolved => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(statementValue, statementResolved => ({ ...header, kind, awaitModifier: awaitModifierValue, initializer: initializerResolved, expression: expressionResolved, statement: statementResolved, tsonic: tsonicValue })))),
    }, finish)))))));
}

export function readForOfStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ForOfStatement", finish: (value: SyntaxValue<ForOfStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<AwaitKeyword<TypedPhase> | null>, Root>(cursor, fields, "awaitModifier", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AwaitKeyword, done), done), awaitModifierValue =>
    fieldText<SyntaxValue<ForInitializer<TypedPhase>>, Root>(cursor, fields, "initializer", (next, done) => readSyntaxReference(next, ports.ForInitializer, done), initializerValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<TypedIteration, Root>(cursor, fields, "tsonic", readTypedIterationText, tsonicValue =>
    finishSyntaxRecord<ForOfStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(awaitModifierValue, awaitModifierResolved => resolveSyntaxValue(initializerValue, initializerResolved => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(statementValue, statementResolved => ({ ...header, kind, awaitModifier: awaitModifierResolved, initializer: initializerResolved, expression: expressionResolved, statement: statementResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readBreakStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "BreakStatement", finish: (value: SyntaxValue<BreakStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "label", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), labelValue =>
    fieldText<TypedControlTransfer, Root>(cursor, fields, "tsonic", readTypedControlTransferText, tsonicValue =>
    finishSyntaxRecord<BreakStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(labelValue, labelResolved => ({ ...header, kind, label: labelResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readContinueStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ContinueStatement", finish: (value: SyntaxValue<ContinueStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "label", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), labelValue =>
    fieldText<TypedControlTransfer, Root>(cursor, fields, "tsonic", readTypedControlTransferText, tsonicValue =>
    finishSyntaxRecord<ContinueStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(labelValue, labelResolved => ({ ...header, kind, label: labelResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readReturnStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ReturnStatement", finish: (value: SyntaxValue<ReturnStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "expression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ReturnStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readWithStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "WithStatement", finish: (value: SyntaxValue<WithStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<WithStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(statementValue, statementResolved => ({ ...header, kind, expression: expressionResolved, statement: statementResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readSwitchStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SwitchStatement", finish: (value: SyntaxValue<SwitchStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<CaseBlock<TypedPhase>>, Root>(cursor, fields, "caseBlock", (next, done) => readSyntaxReference(next, ports.CaseBlock, done), caseBlockValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<SwitchStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(caseBlockValue, caseBlockResolved => ({ ...header, kind, expression: expressionResolved, caseBlock: caseBlockResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readCaseBlockSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "CaseBlock", finish: (value: SyntaxValue<CaseBlock<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<CaseOrDefaultClause<TypedPhase>>>, Root>(cursor, fields, "clauses", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.CaseOrDefaultClause, done), "NodeList", done), clausesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<CaseBlock<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(clausesValue, clausesResolved => ({ ...header, kind, clauses: clausesResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readCaseClauseSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "CaseClause", finish: (value: SyntaxValue<CaseClause<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<NodeList<Statement<TypedPhase>>>, Root>(cursor, fields, "statements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Statement, done), "NodeList", done), statementsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<CaseClause<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(statementsValue, statementsResolved => ({ ...header, kind, expression: expressionResolved, statements: statementsResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readDefaultClauseSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "DefaultClause", finish: (value: SyntaxValue<DefaultClause<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readNull, done), expressionValue =>
    fieldText<SyntaxValue<NodeList<Statement<TypedPhase>>>, Root>(cursor, fields, "statements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Statement, done), "NodeList", done), statementsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<DefaultClause<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementsValue, statementsResolved => ({ ...header, kind, expression: expressionValue, statements: statementsResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readThrowStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ThrowStatement", finish: (value: SyntaxValue<ThrowStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ThrowStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readTryStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TryStatement", finish: (value: SyntaxValue<TryStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Block<TypedPhase>>, Root>(cursor, fields, "tryBlock", (next, done) => readSyntaxReference(next, ports.Block, done), tryBlockValue =>
    fieldText<SyntaxValue<CatchClause<TypedPhase> | null>, Root>(cursor, fields, "catchClause", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.CatchClause, done), done), catchClauseValue =>
    fieldText<SyntaxValue<Block<TypedPhase> | null>, Root>(cursor, fields, "finallyBlock", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Block, done), done), finallyBlockValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<TryStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tryBlockValue, tryBlockResolved => resolveSyntaxValue(catchClauseValue, catchClauseResolved => resolveSyntaxValue(finallyBlockValue, finallyBlockResolved => ({ ...header, kind, tryBlock: tryBlockResolved, catchClause: catchClauseResolved, finallyBlock: finallyBlockResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readCatchClauseSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "CatchClause", finish: (value: SyntaxValue<CatchClause<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<VariableDeclaration<TypedPhase> | null>, Root>(cursor, fields, "variableDeclaration", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.VariableDeclaration, done), done), variableDeclarationValue =>
    fieldText<SyntaxValue<Block<TypedPhase>>, Root>(cursor, fields, "block", (next, done) => readSyntaxReference(next, ports.Block, done), blockValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<CatchClause<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(variableDeclarationValue, variableDeclarationResolved => resolveSyntaxValue(blockValue, blockResolved => ({ ...header, kind, variableDeclaration: variableDeclarationResolved, block: blockResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readDebuggerStatementSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "DebuggerStatement", finish: (value: SyntaxValue<DebuggerStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<DebuggerStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readLabeledStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "LabeledStatement", finish: (value: SyntaxValue<LabeledStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "label", (next, done) => readSyntaxReference(next, ports.Identifier, done), labelValue =>
    fieldText<SyntaxValue<Statement<TypedPhase>>, Root>(cursor, fields, "statement", (next, done) => readSyntaxReference(next, ports.Statement, done), statementValue =>
    fieldText<TypedControlTransfer, Root>(cursor, fields, "tsonic", readTypedControlTransferText, tsonicValue =>
    finishSyntaxRecord<LabeledStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(labelValue, labelResolved => resolveSyntaxValue(statementValue, statementResolved => ({ ...header, kind, label: labelResolved, statement: statementResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readExpressionStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExpressionStatement", finish: (value: SyntaxValue<ExpressionStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ExpressionStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readBlockSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "Block", finish: (value: SyntaxValue<Block<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<Statement<TypedPhase>>>, Root>(cursor, fields, "statements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Statement, done), "NodeList", done), statementsValue =>
    fieldText<boolean, Root>(cursor, fields, "multiLine", (next, done) => atomicText(next, readBoolean, done), multiLineValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<Block<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementsValue, statementsResolved => ({ ...header, kind, statements: statementsResolved, multiLine: multiLineValue, tsonic: tsonicValue })),
    }, finish)))));
}

export function readVariableStatementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "VariableStatement", finish: (value: SyntaxValue<VariableStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<VariableDeclarationList<TypedPhase>>, Root>(cursor, fields, "declarationList", (next, done) => readSyntaxReference(next, ports.VariableDeclarationList, done), declarationListValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<VariableStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(declarationListValue, declarationListResolved => ({ ...header, kind, modifiers: modifiersResolved, declarationList: declarationListResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readVariableDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "VariableDeclaration", finish: (value: SyntaxValue<VariableDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<BindingName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.BindingName, done), nameValue =>
    fieldText<SyntaxValue<ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "exclamationToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ExclamationToken, done), done), exclamationTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedBinding, Root>(cursor, fields, "tsonic", readTypedBindingText, tsonicValue =>
    finishSyntaxRecord<VariableDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(exclamationTokenValue, exclamationTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, name: nameResolved, exclamationToken: exclamationTokenResolved, type: typeResolved, initializer: initializerResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readVariableDeclarationListSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "VariableDeclarationList", finish: (value: SyntaxValue<VariableDeclarationList<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<VariableDeclaration<TypedPhase>>>, Root>(cursor, fields, "declarations", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.VariableDeclaration, done), "NodeList", done), declarationsValue =>
    fieldText<TypedVariableList, Root>(cursor, fields, "tsonic", readTypedVariableListText, tsonicValue =>
    finishSyntaxRecord<VariableDeclarationList<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(declarationsValue, declarationsResolved => ({ ...header, kind, declarations: declarationsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readBindingPatternSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ObjectBindingPattern" | "ArrayBindingPattern", finish: (value: SyntaxValue<BindingPattern<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<BindingElement<TypedPhase>>>, Root>(cursor, fields, "elements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.BindingElement, done), "NodeList", done), elementsValue =>
    fieldText<TypedBindingPattern, Root>(cursor, fields, "tsonic", readTypedBindingPatternText, tsonicValue =>
    finishSyntaxRecord<BindingPattern<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementsValue, elementsResolved => ({ ...header, kind, elements: elementsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readParameterDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "Parameter", finish: (value: SyntaxValue<ParameterDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<DotDotDotToken<TypedPhase> | null>, Root>(cursor, fields, "dotDotDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.DotDotDotToken, done), done), dotDotDotTokenValue =>
    fieldText<SyntaxValue<BindingName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.BindingName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | null>, Root>(cursor, fields, "questionToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionToken, done), done), questionTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedParameter, Root>(cursor, fields, "tsonic", readTypedParameterText, tsonicValue =>
    finishSyntaxRecord<ParameterDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(dotDotDotTokenValue, dotDotDotTokenResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(questionTokenValue, questionTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, modifiers: modifiersResolved, dotDotDotToken: dotDotDotTokenResolved, name: nameResolved, questionToken: questionTokenResolved, type: typeResolved, initializer: initializerResolved, tsonic: tsonicValue }))))))),
    }, finish)))))))));
}

export function readBindingElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "BindingElement", finish: (value: SyntaxValue<BindingElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<DotDotDotToken<TypedPhase> | null>, Root>(cursor, fields, "dotDotDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.DotDotDotToken, done), done), dotDotDotTokenValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase> | null>, Root>(cursor, fields, "propertyName", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.PropertyName, done), done), propertyNameValue =>
    fieldText<SyntaxValue<BindingName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BindingName, done), done), nameValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedBindingElement, Root>(cursor, fields, "tsonic", readTypedBindingElementText, tsonicValue =>
    finishSyntaxRecord<BindingElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(dotDotDotTokenValue, dotDotDotTokenResolved => resolveSyntaxValue(propertyNameValue, propertyNameResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, dotDotDotToken: dotDotDotTokenResolved, propertyName: propertyNameResolved, name: nameResolved, initializer: initializerResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readMissingDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "MissingDeclaration", finish: (value: SyntaxValue<MissingDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<MissingDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => ({ ...header, kind, modifiers: modifiersResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readFunctionDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "FunctionDeclaration", finish: (value: SyntaxValue<FunctionDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), nameValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<FunctionDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, name: nameResolved, tsonic: tsonicValue }))))))))),
    }, finish)))))))))));
}

export function readClassDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ClassDeclaration", finish: (value: SyntaxValue<ClassDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), nameValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<HeritageClause<TypedPhase>> | null>, Root>(cursor, fields, "heritageClauses", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.HeritageClause, done), "NodeList", done), done), heritageClausesValue =>
    fieldText<SyntaxValue<NodeList<ClassElement<TypedPhase>>>, Root>(cursor, fields, "members", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ClassElement, done), "NodeList", done), membersValue =>
    fieldText<TypedClass, Root>(cursor, fields, "tsonic", readTypedClassText, tsonicValue =>
    finishSyntaxRecord<ClassDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(heritageClausesValue, heritageClausesResolved => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, typeParameters: typeParametersResolved, heritageClauses: heritageClausesResolved, members: membersResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readClassExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ClassExpression", finish: (value: SyntaxValue<ClassExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), nameValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<HeritageClause<TypedPhase>> | null>, Root>(cursor, fields, "heritageClauses", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.HeritageClause, done), "NodeList", done), done), heritageClausesValue =>
    fieldText<SyntaxValue<NodeList<ClassElement<TypedPhase>>>, Root>(cursor, fields, "members", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ClassElement, done), "NodeList", done), membersValue =>
    fieldText<TypedClassValue, Root>(cursor, fields, "tsonic", readTypedClassValueText, tsonicValue =>
    finishSyntaxRecord<ClassExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(heritageClausesValue, heritageClausesResolved => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, typeParameters: typeParametersResolved, heritageClauses: heritageClausesResolved, members: membersResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readHeritageClauseSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "HeritageClause", finish: (value: SyntaxValue<HeritageClause<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<"ExtendsKeyword" | "ImplementsKeyword", Root>(cursor, fields, "token", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["ExtendsKeyword","ImplementsKeyword"]), done), tokenValue =>
    fieldText<SyntaxValue<NodeList<ExpressionWithTypeArguments<TypedPhase>>>, Root>(cursor, fields, "types", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ExpressionWithTypeArguments, done), "NodeList", done), typesValue =>
    fieldText<TypedHeritage, Root>(cursor, fields, "tsonic", readTypedHeritageText, tsonicValue =>
    finishSyntaxRecord<HeritageClause<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typesValue, typesResolved => ({ ...header, kind, token: tokenValue, types: typesResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readInterfaceDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "InterfaceDeclaration", finish: (value: SyntaxValue<InterfaceDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<HeritageClause<TypedPhase>> | null>, Root>(cursor, fields, "heritageClauses", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.HeritageClause, done), "NodeList", done), done), heritageClausesValue =>
    fieldText<SyntaxValue<NodeList<TypeElement<TypedPhase>>>, Root>(cursor, fields, "members", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeElement, done), "NodeList", done), membersValue =>
    fieldText<TypedInterface, Root>(cursor, fields, "tsonic", readTypedInterfaceText, tsonicValue =>
    finishSyntaxRecord<InterfaceDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(heritageClausesValue, heritageClausesResolved => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, typeParameters: typeParametersResolved, heritageClauses: heritageClausesResolved, members: membersResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readTypeAliasDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeAliasDeclaration" | "JSTypeAliasDeclaration", finish: (value: SyntaxValue<TypeAliasDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedAlias, Root>(cursor, fields, "tsonic", readTypedAliasText, tsonicValue =>
    finishSyntaxRecord<TypeAliasDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, typeParameters: typeParametersResolved, type: typeResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readEnumMemberSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "EnumMember", finish: (value: SyntaxValue<EnumMember<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedStorageDeclaration, Root>(cursor, fields, "tsonic", readTypedStorageDeclarationText, tsonicValue =>
    finishSyntaxRecord<EnumMember<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, initializer: initializerResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readEnumDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "EnumDeclaration", finish: (value: SyntaxValue<EnumDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<NodeList<EnumMember<TypedPhase>>>, Root>(cursor, fields, "members", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.EnumMember, done), "NodeList", done), membersValue =>
    fieldText<TypedEnum, Root>(cursor, fields, "tsonic", readTypedEnumText, tsonicValue =>
    finishSyntaxRecord<EnumDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, members: membersResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readModuleBlockSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ModuleBlock", finish: (value: SyntaxValue<ModuleBlock<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<Statement<TypedPhase>>>, Root>(cursor, fields, "statements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Statement, done), "NodeList", done), statementsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ModuleBlock<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementsValue, statementsResolved => ({ ...header, kind, statements: statementsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readNotEmittedStatementSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "NotEmittedStatement", finish: (value: SyntaxValue<NotEmittedStatement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<NotEmittedStatement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readNotEmittedTypeElementSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "NotEmittedTypeElement", finish: (value: SyntaxValue<NotEmittedTypeElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<NotEmittedTypeElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readCallSignatureDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "CallSignature", finish: (value: SyntaxValue<CallSignatureDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<CallSignatureDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readConstructSignatureDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ConstructSignature", finish: (value: SyntaxValue<ConstructSignatureDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<ConstructSignatureDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readConstructorDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "Constructor", finish: (value: SyntaxValue<ConstructorDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<ConstructorDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, tsonic: tsonicValue })))))))),
    }, finish))))))))));
}

export function readGetAccessorDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "GetAccessor", finish: (value: SyntaxValue<GetAccessorDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<GetAccessorDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, tsonic: tsonicValue })))))))))),
    }, finish))))))))))));
}

export function readSetAccessorDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SetAccessor", finish: (value: SyntaxValue<SetAccessorDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<SetAccessorDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, tsonic: tsonicValue })))))))))),
    }, finish))))))))))));
}

export function readIndexSignatureDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "IndexSignature", finish: (value: SyntaxValue<IndexSignatureDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedIndexDeclaration, Root>(cursor, fields, "tsonic", readTypedIndexDeclarationText, tsonicValue =>
    finishSyntaxRecord<IndexSignatureDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readMethodSignatureDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "MethodSignature", finish: (value: SyntaxValue<MethodSignatureDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<MethodSignatureDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue })))))))),
    }, finish))))))))));
}

export function readMethodDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "MethodDeclaration", finish: (value: SyntaxValue<MethodDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<TypedCallable, Root>(cursor, fields, "tsonic", readTypedCallableText, tsonicValue =>
    finishSyntaxRecord<MethodDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, tsonic: tsonicValue })))))))))),
    }, finish))))))))))));
}

export function readPropertySignatureDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PropertySignature", finish: (value: SyntaxValue<PropertySignatureDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedStorageDeclaration, Root>(cursor, fields, "tsonic", readTypedStorageDeclarationText, tsonicValue =>
    finishSyntaxRecord<PropertySignatureDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, type: typeResolved, initializer: initializerResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readPropertyDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PropertyDeclaration", finish: (value: SyntaxValue<PropertyDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), initializerValue =>
    fieldText<TypedStorageDeclaration, Root>(cursor, fields, "tsonic", readTypedStorageDeclarationText, tsonicValue =>
    finishSyntaxRecord<PropertyDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, type: typeResolved, initializer: initializerResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readSemicolonClassElementSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "SemicolonClassElement", finish: (value: SyntaxValue<SemicolonClassElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<SemicolonClassElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readClassStaticBlockDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ClassStaticBlockDeclaration", finish: (value: SyntaxValue<ClassStaticBlockDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Block<TypedPhase>>, Root>(cursor, fields, "body", (next, done) => readSyntaxReference(next, ports.Block, done), bodyValue =>
    fieldText<TypedStaticBlock, Root>(cursor, fields, "tsonic", readTypedStaticBlockText, tsonicValue =>
    finishSyntaxRecord<ClassStaticBlockDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(bodyValue, bodyResolved => ({ ...header, kind, modifiers: modifiersResolved, body: bodyResolved, tsonic: tsonicValue }))),
    }, finish)))));
}
