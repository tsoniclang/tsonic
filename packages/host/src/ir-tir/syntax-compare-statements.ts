import type * as Hir from "../ir-hir/contract.js";
import { sameNodeKind, sameNodeList } from "./syntax-compare-common.js";

export function sameBindingElement(left: Hir.BindingElement<Hir.Phase>, right: Hir.BindingElement<Hir.Phase>): boolean {
  return ((left.dotDotDotToken === null) === (right.dotDotDotToken === null)) &&
    (left.propertyName === null ? right.propertyName === null : right.propertyName !== null && sameNodeKind(left.propertyName, right.propertyName)) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameBindingPattern(left: Hir.BindingPattern<Hir.Phase, "ArrayBindingPattern" | "ObjectBindingPattern">, right: Hir.BindingPattern<Hir.Phase, "ArrayBindingPattern" | "ObjectBindingPattern">): boolean {
  return sameNodeList(left.elements, right.elements);
}

export function sameBreakStatement(left: Hir.BreakStatement<Hir.Phase>, right: Hir.BreakStatement<Hir.Phase>): boolean {
  return ((left.label === null) === (right.label === null));
}

export function sameCaseBlock(left: Hir.CaseBlock<Hir.Phase>, right: Hir.CaseBlock<Hir.Phase>): boolean {
  return sameNodeList(left.clauses, right.clauses);
}

export function sameCaseClause(left: Hir.CaseClause<Hir.Phase>, right: Hir.CaseClause<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeList(left.statements, right.statements);
}

export function sameCatchClause(left: Hir.CatchClause<Hir.Phase>, right: Hir.CatchClause<Hir.Phase>): boolean {
  return ((left.variableDeclaration === null) === (right.variableDeclaration === null));
}

export function sameContinueStatement(left: Hir.ContinueStatement<Hir.Phase>, right: Hir.ContinueStatement<Hir.Phase>): boolean {
  return ((left.label === null) === (right.label === null));
}

export function sameDefaultClause(left: Hir.DefaultClause<Hir.Phase>, right: Hir.DefaultClause<Hir.Phase>): boolean {
  return sameNodeList(left.statements, right.statements);
}

export function sameDoStatement(left: Hir.DoStatement<Hir.Phase>, right: Hir.DoStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.statement, right.statement) &&
    sameNodeKind(left.expression, right.expression);
}

export function sameExportAssignment(left: Hir.ExportAssignment<Hir.Phase>, right: Hir.ExportAssignment<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    Object.is(left.isExportEquals, right.isExportEquals) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    sameNodeKind(left.expression, right.expression);
}

export function sameExportDeclaration(left: Hir.ExportDeclaration<Hir.Phase>, right: Hir.ExportDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    Object.is(left.isTypeOnly, right.isTypeOnly) &&
    (left.exportClause === null ? right.exportClause === null : right.exportClause !== null && sameNodeKind(left.exportClause, right.exportClause)) &&
    (left.moduleSpecifier === null ? right.moduleSpecifier === null : right.moduleSpecifier !== null && sameNodeKind(left.moduleSpecifier, right.moduleSpecifier)) &&
    ((left.attributes === null) === (right.attributes === null));
}

export function sameExportSpecifier(left: Hir.ExportSpecifier<Hir.Phase>, right: Hir.ExportSpecifier<Hir.Phase>): boolean {
  return Object.is(left.isTypeOnly, right.isTypeOnly) &&
    (left.propertyName === null ? right.propertyName === null : right.propertyName !== null && sameNodeKind(left.propertyName, right.propertyName)) &&
    sameNodeKind(left.name, right.name);
}

export function sameExpressionStatement(left: Hir.ExpressionStatement<Hir.Phase>, right: Hir.ExpressionStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameForInStatement(left: Hir.ForInStatement<Hir.Phase>, right: Hir.ForInStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.initializer, right.initializer) &&
    sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.statement, right.statement);
}

export function sameForOfStatement(left: Hir.ForOfStatement<Hir.Phase>, right: Hir.ForOfStatement<Hir.Phase>): boolean {
  return ((left.awaitModifier === null) === (right.awaitModifier === null)) &&
    sameNodeKind(left.initializer, right.initializer) &&
    sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.statement, right.statement);
}

export function sameForStatement(left: Hir.ForStatement<Hir.Phase>, right: Hir.ForStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.statement, right.statement) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer)) &&
    (left.condition === null ? right.condition === null : right.condition !== null && sameNodeKind(left.condition, right.condition)) &&
    (left.incrementor === null ? right.incrementor === null : right.incrementor !== null && sameNodeKind(left.incrementor, right.incrementor));
}

export function sameIfStatement(left: Hir.IfStatement<Hir.Phase>, right: Hir.IfStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.thenStatement, right.thenStatement) &&
    (left.elseStatement === null ? right.elseStatement === null : right.elseStatement !== null && sameNodeKind(left.elseStatement, right.elseStatement));
}

export function sameImportAttribute(left: Hir.ImportAttribute<Hir.Phase>, right: Hir.ImportAttribute<Hir.Phase>): boolean {
  return sameNodeKind(left.name, right.name) &&
    sameNodeKind(left.value, right.value);
}

export function sameImportAttributes(left: Hir.ImportAttributes<Hir.Phase>, right: Hir.ImportAttributes<Hir.Phase>): boolean {
  return Object.is(left.token, right.token) &&
    sameNodeList(left.attributes, right.attributes) &&
    Object.is(left.multiLine, right.multiLine);
}

export function sameImportClause(left: Hir.ImportClause<Hir.Phase>, right: Hir.ImportClause<Hir.Phase>): boolean {
  return Object.is(left.phaseModifier, right.phaseModifier) &&
    ((left.name === null) === (right.name === null)) &&
    (left.namedBindings === null ? right.namedBindings === null : right.namedBindings !== null && sameNodeKind(left.namedBindings, right.namedBindings));
}

export function sameImportDeclaration(left: Hir.ImportDeclaration<Hir.Phase, "ImportDeclaration" | "JSImportDeclaration">, right: Hir.ImportDeclaration<Hir.Phase, "ImportDeclaration" | "JSImportDeclaration">): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    ((left.importClause === null) === (right.importClause === null)) &&
    sameNodeKind(left.moduleSpecifier, right.moduleSpecifier) &&
    ((left.attributes === null) === (right.attributes === null));
}

export function sameImportEqualsDeclaration(left: Hir.ImportEqualsDeclaration<Hir.Phase>, right: Hir.ImportEqualsDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    Object.is(left.isTypeOnly, right.isTypeOnly) &&
    sameNodeKind(left.moduleReference, right.moduleReference);
}

export function sameImportSpecifier(left: Hir.ImportSpecifier<Hir.Phase>, right: Hir.ImportSpecifier<Hir.Phase>): boolean {
  return Object.is(left.isTypeOnly, right.isTypeOnly) &&
    (left.propertyName === null ? right.propertyName === null : right.propertyName !== null && sameNodeKind(left.propertyName, right.propertyName));
}

export function sameLabeledStatement(left: Hir.LabeledStatement<Hir.Phase>, right: Hir.LabeledStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.statement, right.statement);
}

export function sameMissingDeclaration(left: Hir.MissingDeclaration<Hir.Phase>, right: Hir.MissingDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers));
}

export function sameModuleBlock(left: Hir.ModuleBlock<Hir.Phase>, right: Hir.ModuleBlock<Hir.Phase>): boolean {
  return sameNodeList(left.statements, right.statements);
}

export function sameModuleDeclaration(left: Hir.ModuleDeclaration<Hir.Phase>, right: Hir.ModuleDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body)) &&
    Object.is(left.keyword, right.keyword) &&
    sameNodeKind(left.name, right.name);
}

export function sameNamedExports(left: Hir.NamedExports<Hir.Phase>, right: Hir.NamedExports<Hir.Phase>): boolean {
  return sameNodeList(left.elements, right.elements);
}

export function sameNamedImports(left: Hir.NamedImports<Hir.Phase>, right: Hir.NamedImports<Hir.Phase>): boolean {
  return sameNodeList(left.elements, right.elements);
}

export function sameNamespaceExport(left: Hir.NamespaceExport<Hir.Phase>, right: Hir.NamespaceExport<Hir.Phase>): boolean {
  return sameNodeKind(left.name, right.name);
}

export function sameNamespaceExportDeclaration(left: Hir.NamespaceExportDeclaration<Hir.Phase>, right: Hir.NamespaceExportDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers));
}

export function sameParameterDeclaration(left: Hir.ParameterDeclaration<Hir.Phase>, right: Hir.ParameterDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    ((left.dotDotDotToken === null) === (right.dotDotDotToken === null)) &&
    sameNodeKind(left.name, right.name) &&
    ((left.questionToken === null) === (right.questionToken === null)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function samePropertyDeclaration(left: Hir.PropertyDeclaration<Hir.Phase>, right: Hir.PropertyDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameReturnStatement(left: Hir.ReturnStatement<Hir.Phase>, right: Hir.ReturnStatement<Hir.Phase>): boolean {
  return (left.expression === null ? right.expression === null : right.expression !== null && sameNodeKind(left.expression, right.expression));
}

export function sameSwitchStatement(left: Hir.SwitchStatement<Hir.Phase>, right: Hir.SwitchStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameThrowStatement(left: Hir.ThrowStatement<Hir.Phase>, right: Hir.ThrowStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameTryStatement(left: Hir.TryStatement<Hir.Phase>, right: Hir.TryStatement<Hir.Phase>): boolean {
  return ((left.catchClause === null) === (right.catchClause === null)) &&
    ((left.finallyBlock === null) === (right.finallyBlock === null));
}

export function sameVariableDeclaration(left: Hir.VariableDeclaration<Hir.Phase>, right: Hir.VariableDeclaration<Hir.Phase>): boolean {
  return sameNodeKind(left.name, right.name) &&
    ((left.exclamationToken === null) === (right.exclamationToken === null)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameVariableDeclarationList(left: Hir.VariableDeclarationList<Hir.Phase>, right: Hir.VariableDeclarationList<Hir.Phase>): boolean {
  return sameNodeList(left.declarations, right.declarations);
}

export function sameVariableStatement(left: Hir.VariableStatement<Hir.Phase>, right: Hir.VariableStatement<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers));
}

export function sameWhileStatement(left: Hir.WhileStatement<Hir.Phase>, right: Hir.WhileStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.statement, right.statement) &&
    sameNodeKind(left.expression, right.expression);
}

export function sameWithStatement(left: Hir.WithStatement<Hir.Phase>, right: Hir.WithStatement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.statement, right.statement);
}
