import type { BodyId, CandidateListId, DefId, ExpansionId, LocalId, ModuleId, NodeId, SigId, TyId } from "../ids/contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type * as Hir from "./contract.js";

export type HirConstructionStep =
  | { readonly kind: "next"; readonly next: () => HirConstructionStep }
  | { readonly kind: "complete"; readonly value: Hir.HirModule };

export interface HirConstruction<Value> {
  readonly run: (next: (value: Value) => HirConstructionStep) => HirConstructionStep;
}

const constructionFailure: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "Validated HIR text must provide every typed construction field." };

export const constructionValue = <Value>(value: Value): HirConstruction<Value> =>
  ({ run: next => ({ kind: "next", next: () => next(value) }) });

export const mapConstruction = <Input, Output>(input: HirConstruction<Input>, make: (value: Input) => Output): HirConstruction<Output> =>
  ({ run: next => ({ kind: "next", next: () => input.run(value => next(make(value))) }) });

export const sequenceConstruction = <Value>(values: readonly HirConstruction<Value>[]): HirConstruction<readonly Value[]> =>
  ({ run: next => {
    const output: Value[] = [];
    const advance = (position: number): HirConstructionStep => ({ kind: "next", next: () => {
      const value = values[position];
      return value === undefined ? next(output) : value.run(actual => {
        output.push(actual);
        return advance(position + 1);
      });
    } });
    return advance(0);
  } });

export const memoSyntaxConstruction = <Value extends Hir.HirNode>(input: HirConstruction<Value>): HirConstruction<Value> => {
  let saved: Value | undefined;
  return { run: next => ({ kind: "next", next: () => {
    if (saved !== undefined) return next(saved);
    return input.run(value => {
      saved = value;
      return next(value);
    });
  } }) };
};

export type HirSyntaxConstruction =
  | { readonly kind: "AbstractKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AbstractKeyword" }> }
  | { readonly kind: "AccessorKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AccessorKeyword" }> }
  | { readonly kind: "AmpersandAmpersandEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandAmpersandEqualsToken" }> }
  | { readonly kind: "AmpersandAmpersandToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandAmpersandToken" }> }
  | { readonly kind: "AmpersandEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandEqualsToken" }> }
  | { readonly kind: "AmpersandToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandToken" }> }
  | { readonly kind: "AnyKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "AnyKeyword" }> }
  | { readonly kind: "ArrayBindingPattern"; readonly value: HirConstruction<Hir.BindingPattern<Hir.CheckedPhase, "ArrayBindingPattern" | "ObjectBindingPattern"> & { readonly kind: "ArrayBindingPattern" }> }
  | { readonly kind: "ArrayLiteralExpression"; readonly value: HirConstruction<Hir.ArrayLiteralExpression<Hir.CheckedPhase>> }
  | { readonly kind: "ArrayType"; readonly value: HirConstruction<Hir.ArrayTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "ArrowFunction"; readonly value: HirConstruction<Hir.ArrowFunction<Hir.CheckedPhase>> }
  | { readonly kind: "AsExpression"; readonly value: HirConstruction<Hir.AsExpression<Hir.CheckedPhase>> }
  | { readonly kind: "AsKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsKeyword" }> }
  | { readonly kind: "AssertKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AssertKeyword" }> }
  | { readonly kind: "AssertsKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AssertsKeyword" }> }
  | { readonly kind: "AsteriskAsteriskEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsteriskAsteriskEqualsToken" }> }
  | { readonly kind: "AsteriskAsteriskToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsteriskAsteriskToken" }> }
  | { readonly kind: "AsteriskEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsteriskEqualsToken" }> }
  | { readonly kind: "AsteriskToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsteriskToken" }> }
  | { readonly kind: "AsyncKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsyncKeyword" }> }
  | { readonly kind: "AtToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AtToken" }> }
  | { readonly kind: "AwaitExpression"; readonly value: HirConstruction<Hir.AwaitExpression<Hir.CheckedPhase>> }
  | { readonly kind: "AwaitKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AwaitKeyword" }> }
  | { readonly kind: "BacktickToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BacktickToken" }> }
  | { readonly kind: "BarBarEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BarBarEqualsToken" }> }
  | { readonly kind: "BarBarToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BarBarToken" }> }
  | { readonly kind: "BarEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BarEqualsToken" }> }
  | { readonly kind: "BarToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BarToken" }> }
  | { readonly kind: "BigIntKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "BigIntKeyword" }> }
  | { readonly kind: "BigIntLiteral"; readonly value: HirConstruction<Hir.BigIntLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "BinaryExpression"; readonly value: HirConstruction<Hir.BinaryExpression<Hir.CheckedPhase>> }
  | { readonly kind: "BindingElement"; readonly value: HirConstruction<Hir.BindingElement<Hir.CheckedPhase>> }
  | { readonly kind: "Block"; readonly value: HirConstruction<Hir.Block<Hir.CheckedPhase>> }
  | { readonly kind: "BooleanKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "BooleanKeyword" }> }
  | { readonly kind: "BreakKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "BreakKeyword" }> }
  | { readonly kind: "BreakStatement"; readonly value: HirConstruction<Hir.BreakStatement<Hir.CheckedPhase>> }
  | { readonly kind: "CallExpression"; readonly value: HirConstruction<Hir.CallExpression<Hir.CheckedPhase>> }
  | { readonly kind: "CallSignature"; readonly value: HirConstruction<Hir.CallSignatureDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "CaretEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CaretEqualsToken" }> }
  | { readonly kind: "CaretToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CaretToken" }> }
  | { readonly kind: "CaseBlock"; readonly value: HirConstruction<Hir.CaseBlock<Hir.CheckedPhase>> }
  | { readonly kind: "CaseClause"; readonly value: HirConstruction<Hir.CaseClause<Hir.CheckedPhase>> }
  | { readonly kind: "CaseKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CaseKeyword" }> }
  | { readonly kind: "CatchClause"; readonly value: HirConstruction<Hir.CatchClause<Hir.CheckedPhase>> }
  | { readonly kind: "CatchKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CatchKeyword" }> }
  | { readonly kind: "ClassDeclaration"; readonly value: HirConstruction<Hir.ClassDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ClassExpression"; readonly value: HirConstruction<Hir.ClassExpression<Hir.CheckedPhase>> }
  | { readonly kind: "ClassKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ClassKeyword" }> }
  | { readonly kind: "ClassStaticBlockDeclaration"; readonly value: HirConstruction<Hir.ClassStaticBlockDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "CloseBraceToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CloseBraceToken" }> }
  | { readonly kind: "CloseBracketToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CloseBracketToken" }> }
  | { readonly kind: "CloseParenToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CloseParenToken" }> }
  | { readonly kind: "ColonToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ColonToken" }> }
  | { readonly kind: "CommaToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "CommaToken" }> }
  | { readonly kind: "ComputedPropertyName"; readonly value: HirConstruction<Hir.ComputedPropertyName<Hir.CheckedPhase>> }
  | { readonly kind: "ConditionalExpression"; readonly value: HirConstruction<Hir.ConditionalExpression<Hir.CheckedPhase>> }
  | { readonly kind: "ConditionalType"; readonly value: HirConstruction<Hir.ConditionalTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "ConflictMarkerTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ConflictMarkerTrivia" }> }
  | { readonly kind: "ConstKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ConstKeyword" }> }
  | { readonly kind: "ConstructSignature"; readonly value: HirConstruction<Hir.ConstructSignatureDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "Constructor"; readonly value: HirConstruction<Hir.ConstructorDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ConstructorKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ConstructorKeyword" }> }
  | { readonly kind: "ConstructorType"; readonly value: HirConstruction<Hir.ConstructorTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "ContinueKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ContinueKeyword" }> }
  | { readonly kind: "ContinueStatement"; readonly value: HirConstruction<Hir.ContinueStatement<Hir.CheckedPhase>> }
  | { readonly kind: "DebuggerKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DebuggerKeyword" }> }
  | { readonly kind: "DebuggerStatement"; readonly value: HirConstruction<Hir.DebuggerStatement<Hir.CheckedPhase>> }
  | { readonly kind: "DeclareKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeclareKeyword" }> }
  | { readonly kind: "Decorator"; readonly value: HirConstruction<Hir.Decorator<Hir.CheckedPhase>> }
  | { readonly kind: "DefaultClause"; readonly value: HirConstruction<Hir.DefaultClause<Hir.CheckedPhase>> }
  | { readonly kind: "DefaultKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DefaultKeyword" }> }
  | { readonly kind: "DeferKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeferKeyword" }> }
  | { readonly kind: "DeleteExpression"; readonly value: HirConstruction<Hir.DeleteExpression<Hir.CheckedPhase>> }
  | { readonly kind: "DeleteKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeleteKeyword" }> }
  | { readonly kind: "DoKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DoKeyword" }> }
  | { readonly kind: "DoStatement"; readonly value: HirConstruction<Hir.DoStatement<Hir.CheckedPhase>> }
  | { readonly kind: "DotDotDotToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DotDotDotToken" }> }
  | { readonly kind: "DotToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DotToken" }> }
  | { readonly kind: "ElementAccessExpression"; readonly value: HirConstruction<Hir.ElementAccessExpression<Hir.CheckedPhase>> }
  | { readonly kind: "ElseKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ElseKeyword" }> }
  | { readonly kind: "EmptyStatement"; readonly value: HirConstruction<Hir.EmptyStatement<Hir.CheckedPhase>> }
  | { readonly kind: "EndOfFile"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EndOfFile" }> }
  | { readonly kind: "EnumDeclaration"; readonly value: HirConstruction<Hir.EnumDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "EnumKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EnumKeyword" }> }
  | { readonly kind: "EnumMember"; readonly value: HirConstruction<Hir.EnumMember<Hir.CheckedPhase>> }
  | { readonly kind: "EqualsEqualsEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsEqualsEqualsToken" }> }
  | { readonly kind: "EqualsEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsEqualsToken" }> }
  | { readonly kind: "EqualsGreaterThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsGreaterThanToken" }> }
  | { readonly kind: "EqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsToken" }> }
  | { readonly kind: "ExclamationEqualsEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationEqualsEqualsToken" }> }
  | { readonly kind: "ExclamationEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationEqualsToken" }> }
  | { readonly kind: "ExclamationToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationToken" }> }
  | { readonly kind: "ExportAssignment"; readonly value: HirConstruction<Hir.ExportAssignment<Hir.CheckedPhase>> }
  | { readonly kind: "ExportDeclaration"; readonly value: HirConstruction<Hir.ExportDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ExportKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExportKeyword" }> }
  | { readonly kind: "ExportSpecifier"; readonly value: HirConstruction<Hir.ExportSpecifier<Hir.CheckedPhase>> }
  | { readonly kind: "ExpressionStatement"; readonly value: HirConstruction<Hir.ExpressionStatement<Hir.CheckedPhase>> }
  | { readonly kind: "ExpressionWithTypeArguments"; readonly value: HirConstruction<Hir.ExpressionWithTypeArguments<Hir.CheckedPhase>> }
  | { readonly kind: "ExtendsKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExtendsKeyword" }> }
  | { readonly kind: "ExternalModuleReference"; readonly value: HirConstruction<Hir.ExternalModuleReference<Hir.CheckedPhase>> }
  | { readonly kind: "FalseKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "FalseKeyword" }> }
  | { readonly kind: "FinallyKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "FinallyKeyword" }> }
  | { readonly kind: "ForInStatement"; readonly value: HirConstruction<Hir.ForInStatement<Hir.CheckedPhase>> }
  | { readonly kind: "ForKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ForKeyword" }> }
  | { readonly kind: "ForOfStatement"; readonly value: HirConstruction<Hir.ForOfStatement<Hir.CheckedPhase>> }
  | { readonly kind: "ForStatement"; readonly value: HirConstruction<Hir.ForStatement<Hir.CheckedPhase>> }
  | { readonly kind: "FromKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "FromKeyword" }> }
  | { readonly kind: "FunctionDeclaration"; readonly value: HirConstruction<Hir.FunctionDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "FunctionExpression"; readonly value: HirConstruction<Hir.FunctionExpression<Hir.CheckedPhase>> }
  | { readonly kind: "FunctionKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "FunctionKeyword" }> }
  | { readonly kind: "FunctionType"; readonly value: HirConstruction<Hir.FunctionTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "GetAccessor"; readonly value: HirConstruction<Hir.GetAccessorDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "GetKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GetKeyword" }> }
  | { readonly kind: "GlobalKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GlobalKeyword" }> }
  | { readonly kind: "GreaterThanEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanEqualsToken" }> }
  | { readonly kind: "GreaterThanGreaterThanEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanGreaterThanEqualsToken" }> }
  | { readonly kind: "GreaterThanGreaterThanGreaterThanEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanGreaterThanGreaterThanEqualsToken" }> }
  | { readonly kind: "GreaterThanGreaterThanGreaterThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanGreaterThanGreaterThanToken" }> }
  | { readonly kind: "GreaterThanGreaterThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanGreaterThanToken" }> }
  | { readonly kind: "GreaterThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "GreaterThanToken" }> }
  | { readonly kind: "HashToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "HashToken" }> }
  | { readonly kind: "HeritageClause"; readonly value: HirConstruction<Hir.HeritageClause<Hir.CheckedPhase>> }
  | { readonly kind: "Identifier"; readonly value: HirConstruction<Hir.Identifier<Hir.CheckedPhase>> }
  | { readonly kind: "IfKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "IfKeyword" }> }
  | { readonly kind: "IfStatement"; readonly value: HirConstruction<Hir.IfStatement<Hir.CheckedPhase>> }
  | { readonly kind: "ImmediateKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ImmediateKeyword" }> }
  | { readonly kind: "ImplementsKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ImplementsKeyword" }> }
  | { readonly kind: "ImportAttribute"; readonly value: HirConstruction<Hir.ImportAttribute<Hir.CheckedPhase>> }
  | { readonly kind: "ImportAttributes"; readonly value: HirConstruction<Hir.ImportAttributes<Hir.CheckedPhase>> }
  | { readonly kind: "ImportClause"; readonly value: HirConstruction<Hir.ImportClause<Hir.CheckedPhase>> }
  | { readonly kind: "ImportDeclaration"; readonly value: HirConstruction<Hir.ImportDeclaration<Hir.CheckedPhase, "ImportDeclaration" | "JSImportDeclaration"> & { readonly kind: "ImportDeclaration" }> }
  | { readonly kind: "ImportEqualsDeclaration"; readonly value: HirConstruction<Hir.ImportEqualsDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ImportKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "ImportKeyword" }> }
  | { readonly kind: "ImportSpecifier"; readonly value: HirConstruction<Hir.ImportSpecifier<Hir.CheckedPhase>> }
  | { readonly kind: "ImportType"; readonly value: HirConstruction<Hir.ImportTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "InKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "InKeyword" }> }
  | { readonly kind: "IndexSignature"; readonly value: HirConstruction<Hir.IndexSignatureDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "IndexedAccessType"; readonly value: HirConstruction<Hir.IndexedAccessTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "InferKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "InferKeyword" }> }
  | { readonly kind: "InferType"; readonly value: HirConstruction<Hir.InferTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "InstanceOfKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "InstanceOfKeyword" }> }
  | { readonly kind: "InterfaceDeclaration"; readonly value: HirConstruction<Hir.InterfaceDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "InterfaceKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "InterfaceKeyword" }> }
  | { readonly kind: "IntersectionType"; readonly value: HirConstruction<Hir.IntersectionTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "IntrinsicKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "IntrinsicKeyword" }> }
  | { readonly kind: "IsKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "IsKeyword" }> }
  | { readonly kind: "JSDoc"; readonly value: HirConstruction<Hir.JSDoc<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocAllType"; readonly value: HirConstruction<Hir.JSDocAllType<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocAugmentsTag"; readonly value: HirConstruction<Hir.JSDocAugmentsTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocCallbackTag"; readonly value: HirConstruction<Hir.JSDocCallbackTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocCommentTextToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "JSDocCommentTextToken" }> }
  | { readonly kind: "JSDocDeprecatedTag"; readonly value: HirConstruction<Hir.JSDocDeprecatedTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocImplementsTag"; readonly value: HirConstruction<Hir.JSDocImplementsTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocImportTag"; readonly value: HirConstruction<Hir.JSDocImportTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocLink"; readonly value: HirConstruction<Hir.JSDocLink<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocLinkCode"; readonly value: HirConstruction<Hir.JSDocLinkCode<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocLinkPlain"; readonly value: HirConstruction<Hir.JSDocLinkPlain<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocNameReference"; readonly value: HirConstruction<Hir.JSDocNameReference<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocNonNullableType"; readonly value: HirConstruction<Hir.JSDocNonNullableType<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocNullableType"; readonly value: HirConstruction<Hir.JSDocNullableType<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocOptionalType"; readonly value: HirConstruction<Hir.JSDocOptionalType<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocOverloadTag"; readonly value: HirConstruction<Hir.JSDocOverloadTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocOverrideTag"; readonly value: HirConstruction<Hir.JSDocOverrideTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocParameterTag"; readonly value: HirConstruction<Hir.JSDocParameterOrPropertyTag<Hir.CheckedPhase, "JSDocParameterTag" | "JSDocPropertyTag"> & { readonly kind: "JSDocParameterTag" }> }
  | { readonly kind: "JSDocPrivateTag"; readonly value: HirConstruction<Hir.JSDocPrivateTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocPropertyTag"; readonly value: HirConstruction<Hir.JSDocParameterOrPropertyTag<Hir.CheckedPhase, "JSDocParameterTag" | "JSDocPropertyTag"> & { readonly kind: "JSDocPropertyTag" }> }
  | { readonly kind: "JSDocProtectedTag"; readonly value: HirConstruction<Hir.JSDocProtectedTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocPublicTag"; readonly value: HirConstruction<Hir.JSDocPublicTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocReadonlyTag"; readonly value: HirConstruction<Hir.JSDocReadonlyTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocReturnTag"; readonly value: HirConstruction<Hir.JSDocReturnTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocSatisfiesTag"; readonly value: HirConstruction<Hir.JSDocSatisfiesTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocSeeTag"; readonly value: HirConstruction<Hir.JSDocSeeTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocSignature"; readonly value: HirConstruction<Hir.JSDocSignature<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocTemplateTag"; readonly value: HirConstruction<Hir.JSDocTemplateTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocText"; readonly value: HirConstruction<Hir.JSDocText<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocThisTag"; readonly value: HirConstruction<Hir.JSDocThisTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocThrowsTag"; readonly value: HirConstruction<Hir.JSDocThrowsTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocTypeExpression"; readonly value: HirConstruction<Hir.JSDocTypeExpression<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocTypeLiteral"; readonly value: HirConstruction<Hir.JSDocTypeLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocTypeTag"; readonly value: HirConstruction<Hir.JSDocTypeTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocTypedefTag"; readonly value: HirConstruction<Hir.JSDocTypedefTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocUnknownTag"; readonly value: HirConstruction<Hir.JSDocUnknownTag<Hir.CheckedPhase>> }
  | { readonly kind: "JSDocVariadicType"; readonly value: HirConstruction<Hir.JSDocVariadicType<Hir.CheckedPhase>> }
  | { readonly kind: "JSImportDeclaration"; readonly value: HirConstruction<Hir.ImportDeclaration<Hir.CheckedPhase, "ImportDeclaration" | "JSImportDeclaration"> & { readonly kind: "JSImportDeclaration" }> }
  | { readonly kind: "JSTypeAliasDeclaration"; readonly value: HirConstruction<Hir.TypeAliasDeclaration<Hir.CheckedPhase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration"> & { readonly kind: "JSTypeAliasDeclaration" }> }
  | { readonly kind: "JsxAttribute"; readonly value: HirConstruction<Hir.JsxAttribute<Hir.CheckedPhase>> }
  | { readonly kind: "JsxAttributes"; readonly value: HirConstruction<Hir.JsxAttributes<Hir.CheckedPhase>> }
  | { readonly kind: "JsxClosingElement"; readonly value: HirConstruction<Hir.JsxClosingElement<Hir.CheckedPhase>> }
  | { readonly kind: "JsxClosingFragment"; readonly value: HirConstruction<Hir.JsxClosingFragment<Hir.CheckedPhase>> }
  | { readonly kind: "JsxElement"; readonly value: HirConstruction<Hir.JsxElement<Hir.CheckedPhase>> }
  | { readonly kind: "JsxExpression"; readonly value: HirConstruction<Hir.JsxExpression<Hir.CheckedPhase>> }
  | { readonly kind: "JsxFragment"; readonly value: HirConstruction<Hir.JsxFragment<Hir.CheckedPhase>> }
  | { readonly kind: "JsxNamespacedName"; readonly value: HirConstruction<Hir.JsxNamespacedName<Hir.CheckedPhase>> }
  | { readonly kind: "JsxOpeningElement"; readonly value: HirConstruction<Hir.JsxOpeningElement<Hir.CheckedPhase>> }
  | { readonly kind: "JsxOpeningFragment"; readonly value: HirConstruction<Hir.JsxOpeningFragment<Hir.CheckedPhase>> }
  | { readonly kind: "JsxSelfClosingElement"; readonly value: HirConstruction<Hir.JsxSelfClosingElement<Hir.CheckedPhase>> }
  | { readonly kind: "JsxSpreadAttribute"; readonly value: HirConstruction<Hir.JsxSpreadAttribute<Hir.CheckedPhase>> }
  | { readonly kind: "JsxText"; readonly value: HirConstruction<Hir.JsxText<Hir.CheckedPhase>> }
  | { readonly kind: "JsxTextAllWhiteSpaces"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "JsxTextAllWhiteSpaces" }> }
  | { readonly kind: "KeyOfKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "KeyOfKeyword" }> }
  | { readonly kind: "LabeledStatement"; readonly value: HirConstruction<Hir.LabeledStatement<Hir.CheckedPhase>> }
  | { readonly kind: "LessThanEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LessThanEqualsToken" }> }
  | { readonly kind: "LessThanLessThanEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LessThanLessThanEqualsToken" }> }
  | { readonly kind: "LessThanLessThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LessThanLessThanToken" }> }
  | { readonly kind: "LessThanSlashToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LessThanSlashToken" }> }
  | { readonly kind: "LessThanToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LessThanToken" }> }
  | { readonly kind: "LetKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "LetKeyword" }> }
  | { readonly kind: "LiteralType"; readonly value: HirConstruction<Hir.LiteralTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "MappedType"; readonly value: HirConstruction<Hir.MappedTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "MetaProperty"; readonly value: HirConstruction<Hir.MetaProperty<Hir.CheckedPhase>> }
  | { readonly kind: "MethodDeclaration"; readonly value: HirConstruction<Hir.MethodDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "MethodSignature"; readonly value: HirConstruction<Hir.MethodSignatureDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "MinusEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "MinusEqualsToken" }> }
  | { readonly kind: "MinusMinusToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "MinusMinusToken" }> }
  | { readonly kind: "MinusToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "MinusToken" }> }
  | { readonly kind: "MissingDeclaration"; readonly value: HirConstruction<Hir.MissingDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ModuleBlock"; readonly value: HirConstruction<Hir.ModuleBlock<Hir.CheckedPhase>> }
  | { readonly kind: "ModuleDeclaration"; readonly value: HirConstruction<Hir.ModuleDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ModuleKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ModuleKeyword" }> }
  | { readonly kind: "MultiLineCommentTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "MultiLineCommentTrivia" }> }
  | { readonly kind: "NamedExports"; readonly value: HirConstruction<Hir.NamedExports<Hir.CheckedPhase>> }
  | { readonly kind: "NamedImports"; readonly value: HirConstruction<Hir.NamedImports<Hir.CheckedPhase>> }
  | { readonly kind: "NamedTupleMember"; readonly value: HirConstruction<Hir.NamedTupleMember<Hir.CheckedPhase>> }
  | { readonly kind: "NamespaceExport"; readonly value: HirConstruction<Hir.NamespaceExport<Hir.CheckedPhase>> }
  | { readonly kind: "NamespaceExportDeclaration"; readonly value: HirConstruction<Hir.NamespaceExportDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "NamespaceImport"; readonly value: HirConstruction<Hir.NamespaceImport<Hir.CheckedPhase>> }
  | { readonly kind: "NamespaceKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "NamespaceKeyword" }> }
  | { readonly kind: "NeverKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "NeverKeyword" }> }
  | { readonly kind: "NewExpression"; readonly value: HirConstruction<Hir.NewExpression<Hir.CheckedPhase>> }
  | { readonly kind: "NewKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "NewKeyword" }> }
  | { readonly kind: "NewLineTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "NewLineTrivia" }> }
  | { readonly kind: "NoSubstitutionTemplateLiteral"; readonly value: HirConstruction<Hir.NoSubstitutionTemplateLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "NonNullExpression"; readonly value: HirConstruction<Hir.NonNullExpression<Hir.CheckedPhase>> }
  | { readonly kind: "NonTextFileMarkerTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "NonTextFileMarkerTrivia" }> }
  | { readonly kind: "NotEmittedStatement"; readonly value: HirConstruction<Hir.NotEmittedStatement<Hir.CheckedPhase>> }
  | { readonly kind: "NotEmittedTypeElement"; readonly value: HirConstruction<Hir.NotEmittedTypeElement<Hir.CheckedPhase>> }
  | { readonly kind: "NullKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "NullKeyword" }> }
  | { readonly kind: "NumberKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "NumberKeyword" }> }
  | { readonly kind: "NumericLiteral"; readonly value: HirConstruction<Hir.NumericLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "ObjectBindingPattern"; readonly value: HirConstruction<Hir.BindingPattern<Hir.CheckedPhase, "ArrayBindingPattern" | "ObjectBindingPattern"> & { readonly kind: "ObjectBindingPattern" }> }
  | { readonly kind: "ObjectKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "ObjectKeyword" }> }
  | { readonly kind: "ObjectLiteralExpression"; readonly value: HirConstruction<Hir.ObjectLiteralExpression<Hir.CheckedPhase>> }
  | { readonly kind: "OfKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OfKeyword" }> }
  | { readonly kind: "OmittedExpression"; readonly value: HirConstruction<Hir.OmittedExpression<Hir.CheckedPhase>> }
  | { readonly kind: "OpenBraceToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OpenBraceToken" }> }
  | { readonly kind: "OpenBracketToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OpenBracketToken" }> }
  | { readonly kind: "OpenParenToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OpenParenToken" }> }
  | { readonly kind: "OptionalType"; readonly value: HirConstruction<Hir.OptionalTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "OutKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OutKeyword" }> }
  | { readonly kind: "OverrideKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "OverrideKeyword" }> }
  | { readonly kind: "PackageKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PackageKeyword" }> }
  | { readonly kind: "Parameter"; readonly value: HirConstruction<Hir.ParameterDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ParenthesizedExpression"; readonly value: HirConstruction<Hir.ParenthesizedExpression<Hir.CheckedPhase>> }
  | { readonly kind: "ParenthesizedType"; readonly value: HirConstruction<Hir.ParenthesizedTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "PartiallyEmittedExpression"; readonly value: HirConstruction<Hir.PartiallyEmittedExpression<Hir.CheckedPhase>> }
  | { readonly kind: "PercentEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PercentEqualsToken" }> }
  | { readonly kind: "PercentToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PercentToken" }> }
  | { readonly kind: "PlusEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PlusEqualsToken" }> }
  | { readonly kind: "PlusPlusToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PlusPlusToken" }> }
  | { readonly kind: "PlusToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PlusToken" }> }
  | { readonly kind: "PostfixUnaryExpression"; readonly value: HirConstruction<Hir.PostfixUnaryExpression<Hir.CheckedPhase>> }
  | { readonly kind: "PrefixUnaryExpression"; readonly value: HirConstruction<Hir.PrefixUnaryExpression<Hir.CheckedPhase>> }
  | { readonly kind: "PrivateIdentifier"; readonly value: HirConstruction<Hir.PrivateIdentifier<Hir.CheckedPhase>> }
  | { readonly kind: "PrivateKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PrivateKeyword" }> }
  | { readonly kind: "PropertyAccessExpression"; readonly value: HirConstruction<Hir.PropertyAccessExpression<Hir.CheckedPhase>> }
  | { readonly kind: "PropertyAssignment"; readonly value: HirConstruction<Hir.PropertyAssignment<Hir.CheckedPhase>> }
  | { readonly kind: "PropertyDeclaration"; readonly value: HirConstruction<Hir.PropertyDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "PropertySignature"; readonly value: HirConstruction<Hir.PropertySignatureDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "ProtectedKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ProtectedKeyword" }> }
  | { readonly kind: "PublicKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "PublicKeyword" }> }
  | { readonly kind: "QualifiedName"; readonly value: HirConstruction<Hir.QualifiedName<Hir.CheckedPhase>> }
  | { readonly kind: "QuestionDotToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "QuestionDotToken" }> }
  | { readonly kind: "QuestionQuestionEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "QuestionQuestionEqualsToken" }> }
  | { readonly kind: "QuestionQuestionToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "QuestionQuestionToken" }> }
  | { readonly kind: "QuestionToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "QuestionToken" }> }
  | { readonly kind: "ReadonlyKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ReadonlyKeyword" }> }
  | { readonly kind: "RegularExpressionLiteral"; readonly value: HirConstruction<Hir.RegularExpressionLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "RequireKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "RequireKeyword" }> }
  | { readonly kind: "RestType"; readonly value: HirConstruction<Hir.RestTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "ReturnKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ReturnKeyword" }> }
  | { readonly kind: "ReturnStatement"; readonly value: HirConstruction<Hir.ReturnStatement<Hir.CheckedPhase>> }
  | { readonly kind: "SatisfiesExpression"; readonly value: HirConstruction<Hir.SatisfiesExpression<Hir.CheckedPhase>> }
  | { readonly kind: "SatisfiesKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SatisfiesKeyword" }> }
  | { readonly kind: "SemicolonClassElement"; readonly value: HirConstruction<Hir.SemicolonClassElement<Hir.CheckedPhase>> }
  | { readonly kind: "SemicolonToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SemicolonToken" }> }
  | { readonly kind: "SetAccessor"; readonly value: HirConstruction<Hir.SetAccessorDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "SetKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SetKeyword" }> }
  | { readonly kind: "ShorthandPropertyAssignment"; readonly value: HirConstruction<Hir.ShorthandPropertyAssignment<Hir.CheckedPhase>> }
  | { readonly kind: "SingleLineCommentTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SingleLineCommentTrivia" }> }
  | { readonly kind: "SlashEqualsToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SlashEqualsToken" }> }
  | { readonly kind: "SlashToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SlashToken" }> }
  | { readonly kind: "SourceFile"; readonly value: HirConstruction<Hir.SourceFile<Hir.CheckedPhase>> }
  | { readonly kind: "SpreadAssignment"; readonly value: HirConstruction<Hir.SpreadAssignment<Hir.CheckedPhase>> }
  | { readonly kind: "SpreadElement"; readonly value: HirConstruction<Hir.SpreadElement<Hir.CheckedPhase>> }
  | { readonly kind: "StaticKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "StaticKeyword" }> }
  | { readonly kind: "StringKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "StringKeyword" }> }
  | { readonly kind: "StringLiteral"; readonly value: HirConstruction<Hir.StringLiteral<Hir.CheckedPhase>> }
  | { readonly kind: "SuperKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "SuperKeyword" }> }
  | { readonly kind: "SwitchKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "SwitchKeyword" }> }
  | { readonly kind: "SwitchStatement"; readonly value: HirConstruction<Hir.SwitchStatement<Hir.CheckedPhase>> }
  | { readonly kind: "SymbolKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "SymbolKeyword" }> }
  | { readonly kind: "SyntaxList"; readonly value: HirConstruction<Hir.SyntaxList<Hir.CheckedPhase>> }
  | { readonly kind: "SyntheticReferenceExpression"; readonly value: HirConstruction<Hir.SyntheticReferenceExpression<Hir.CheckedPhase>> }
  | { readonly kind: "TaggedTemplateExpression"; readonly value: HirConstruction<Hir.TaggedTemplateExpression<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateExpression"; readonly value: HirConstruction<Hir.TemplateExpression<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateHead"; readonly value: HirConstruction<Hir.TemplateHead<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateLiteralType"; readonly value: HirConstruction<Hir.TemplateLiteralTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateLiteralTypeSpan"; readonly value: HirConstruction<Hir.TemplateLiteralTypeSpan<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateMiddle"; readonly value: HirConstruction<Hir.TemplateMiddle<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateSpan"; readonly value: HirConstruction<Hir.TemplateSpan<Hir.CheckedPhase>> }
  | { readonly kind: "TemplateTail"; readonly value: HirConstruction<Hir.TemplateTail<Hir.CheckedPhase>> }
  | { readonly kind: "ThisKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "ThisKeyword" }> }
  | { readonly kind: "ThisType"; readonly value: HirConstruction<Hir.ThisTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "ThrowKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ThrowKeyword" }> }
  | { readonly kind: "ThrowStatement"; readonly value: HirConstruction<Hir.ThrowStatement<Hir.CheckedPhase>> }
  | { readonly kind: "TildeToken"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "TildeToken" }> }
  | { readonly kind: "TrueKeyword"; readonly value: HirConstruction<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "TrueKeyword" }> }
  | { readonly kind: "TryKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "TryKeyword" }> }
  | { readonly kind: "TryStatement"; readonly value: HirConstruction<Hir.TryStatement<Hir.CheckedPhase>> }
  | { readonly kind: "TupleType"; readonly value: HirConstruction<Hir.TupleTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "TypeAliasDeclaration"; readonly value: HirConstruction<Hir.TypeAliasDeclaration<Hir.CheckedPhase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration"> & { readonly kind: "TypeAliasDeclaration" }> }
  | { readonly kind: "TypeAssertionExpression"; readonly value: HirConstruction<Hir.TypeAssertion<Hir.CheckedPhase>> }
  | { readonly kind: "TypeKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "TypeKeyword" }> }
  | { readonly kind: "TypeLiteral"; readonly value: HirConstruction<Hir.TypeLiteralNode<Hir.CheckedPhase>> }
  | { readonly kind: "TypeOfExpression"; readonly value: HirConstruction<Hir.TypeOfExpression<Hir.CheckedPhase>> }
  | { readonly kind: "TypeOfKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "TypeOfKeyword" }> }
  | { readonly kind: "TypeOperator"; readonly value: HirConstruction<Hir.TypeOperatorNode<Hir.CheckedPhase>> }
  | { readonly kind: "TypeParameter"; readonly value: HirConstruction<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "TypePredicate"; readonly value: HirConstruction<Hir.TypePredicateNode<Hir.CheckedPhase>> }
  | { readonly kind: "TypeQuery"; readonly value: HirConstruction<Hir.TypeQueryNode<Hir.CheckedPhase>> }
  | { readonly kind: "TypeReference"; readonly value: HirConstruction<Hir.TypeReferenceNode<Hir.CheckedPhase>> }
  | { readonly kind: "UndefinedKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "UndefinedKeyword" }> }
  | { readonly kind: "UnionType"; readonly value: HirConstruction<Hir.UnionTypeNode<Hir.CheckedPhase>> }
  | { readonly kind: "UniqueKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "UniqueKeyword" }> }
  | { readonly kind: "Unknown"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "Unknown" }> }
  | { readonly kind: "UnknownKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "UnknownKeyword" }> }
  | { readonly kind: "UsingKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "UsingKeyword" }> }
  | { readonly kind: "VarKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "VarKeyword" }> }
  | { readonly kind: "VariableDeclaration"; readonly value: HirConstruction<Hir.VariableDeclaration<Hir.CheckedPhase>> }
  | { readonly kind: "VariableDeclarationList"; readonly value: HirConstruction<Hir.VariableDeclarationList<Hir.CheckedPhase>> }
  | { readonly kind: "VariableStatement"; readonly value: HirConstruction<Hir.VariableStatement<Hir.CheckedPhase>> }
  | { readonly kind: "VoidExpression"; readonly value: HirConstruction<Hir.VoidExpression<Hir.CheckedPhase>> }
  | { readonly kind: "VoidKeyword"; readonly value: HirConstruction<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "VoidKeyword" }> }
  | { readonly kind: "WhileKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WhileKeyword" }> }
  | { readonly kind: "WhileStatement"; readonly value: HirConstruction<Hir.WhileStatement<Hir.CheckedPhase>> }
  | { readonly kind: "WhitespaceTrivia"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WhitespaceTrivia" }> }
  | { readonly kind: "WithKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WithKeyword" }> }
  | { readonly kind: "WithStatement"; readonly value: HirConstruction<Hir.WithStatement<Hir.CheckedPhase>> }
  | { readonly kind: "YieldExpression"; readonly value: HirConstruction<Hir.YieldExpression<Hir.CheckedPhase>> }
  | { readonly kind: "YieldKeyword"; readonly value: HirConstruction<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "YieldKeyword" }> };

export type HirIdentityInput =
  | { readonly kind: "mod"; readonly value: ModuleId }
  | { readonly kind: "def"; readonly value: DefId }
  | { readonly kind: "body"; readonly value: BodyId }
  | { readonly kind: "exp"; readonly value: ExpansionId }
  | { readonly kind: "n"; readonly value: NodeId }
  | { readonly kind: "l"; readonly value: LocalId }
  | { readonly kind: "t"; readonly value: TyId }
  | { readonly kind: "sig"; readonly value: SigId }
  | { readonly kind: "cand"; readonly value: CandidateListId };

type HirIdentityRequest =
  | { readonly kind: "mod"; readonly read: (value: ModuleId) => void }
  | { readonly kind: "def"; readonly read: (value: DefId) => void }
  | { readonly kind: "body"; readonly read: (value: BodyId) => void }
  | { readonly kind: "exp"; readonly read: (value: ExpansionId) => void }
  | { readonly kind: "n"; readonly read: (value: NodeId) => void }
  | { readonly kind: "l"; readonly read: (value: LocalId) => void }
  | { readonly kind: "t"; readonly read: (value: TyId) => void }
  | { readonly kind: "sig"; readonly read: (value: SigId) => void }
  | { readonly kind: "cand"; readonly read: (value: CandidateListId) => void };

export type HirPlainScalar = string | number | bigint | boolean | null;
export type HirValueRequest = HirIdentityRequest
  | { readonly kind: "scalar"; readonly read: (input: HirPlainScalar) => boolean }
  | { readonly kind: "string"; readonly read: (value: string) => void }
  | { readonly kind: "number"; readonly read: (value: number) => void }
  | { readonly kind: "bigint"; readonly read: (value: bigint) => void }
  | { readonly kind: "boolean"; readonly read: (value: boolean) => void }
  | { readonly kind: "null"; readonly read: () => void }
  | { readonly kind: "record"; readonly records: (label: string) => readonly HirRecordConstruction[] }
  | { readonly kind: "sequence"; readonly sequence: () => HirSequenceConstruction }
  | { readonly kind: "syntax"; readonly reference: () => (value: HirSyntaxConstruction) => boolean };

export interface HirReader<Value> {
  readonly requests: (accept: (value: HirConstruction<Value>) => void) => readonly HirValueRequest[];
}

export interface HirSequenceConstruction {
  readonly requests: () => readonly HirValueRequest[];
  readonly complete: () => boolean;
  readonly publish: () => void;
}

export interface HirConstructionField {
  readonly name: string;
  readonly requests: () => readonly HirValueRequest[];
  readonly run: (next: () => HirConstructionStep) => HirConstructionStep;
  readonly ready: () => boolean;
}

export interface HirRecordConstruction {
  readonly requests: (position: number, name: string) => readonly HirValueRequest[];
  readonly complete: (position: number) => boolean;
  readonly publish: () => void;
}

interface HirFieldSlot<Value> extends HirConstructionField { readonly value: () => Value }
type ReadField = <Value>(name: string, reader: HirReader<Value>) => HirFieldSlot<Value>;
interface HirRecordBuild<Value> { readonly fields: readonly HirConstructionField[]; readonly value: () => Value }

export function scalarReader<Value>(select: (input: HirPlainScalar) => { readonly value: Value } | null): HirReader<Value> {
  return { requests: accept => [{ kind: "scalar", read: input => {
    const selected = select(input);
    if (selected === null) return false;
    accept(constructionValue(selected.value));
    return true;
  } }] };
}

export function literalReader<Value extends string | number | boolean | null>(values: readonly Value[]): HirReader<Value> {
  return scalarReader(input => {
    const value = values.find(candidate => Object.is(candidate, input));
    return value === undefined ? null : { value };
  });
}

export const stringReader = <Value>(make: (value: string) => Value): HirReader<Value> =>
  ({ requests: accept => [{ kind: "string", read: value => accept(constructionValue(make(value))) }] });

export const numberReader = (): HirReader<number> =>
  ({ requests: accept => [{ kind: "number", read: value => accept(constructionValue(value)) }] });

export const bigintReader = (): HirReader<bigint> =>
  ({ requests: accept => [{ kind: "bigint", read: value => accept(constructionValue(value)) }] });

export const booleanReader = (): HirReader<boolean> =>
  ({ requests: accept => [{ kind: "boolean", read: value => accept(constructionValue(value)) }] });

export const nullReader = (): HirReader<null> =>
  ({ requests: accept => [{ kind: "null", read: () => accept(constructionValue(null)) }] });

export const sequenceReader = <Value>(read: HirReader<Value>): HirReader<readonly Value[]> =>
  ({ requests: accept => [{ kind: "sequence", sequence: () => {
    const values: HirConstruction<Value>[] = [];
    return { requests: () => read.requests(value => { values.push(value); }),
      complete: () => true,
      publish: () => accept(sequenceConstruction(values)) };
  } }] });

export const nonemptySequenceReader = <Value>(read: HirReader<Value>): HirReader<readonly [Value, ...Value[]]> =>
  ({ requests: accept => [{ kind: "sequence", sequence: () => {
    const values: HirConstruction<Value>[] = [];
    return { requests: () => read.requests(value => { values.push(value); }), complete: () => values.length > 0,
      publish: () => accept(mapConstruction(sequenceConstruction(values), actual => {
        const first = requirePresent(actual[0], constructionFailure);
        return [first, ...actual.slice(1)];
      })) };
  } }] });

export const unionReader = <Value>(reads: () => readonly HirReader<Value>[]): HirReader<Value> =>
  ({ requests: accept => reads().flatMap(read => read.requests(accept)) });

export const syntaxReader = <Value extends Hir.HirNode>(kinds: readonly Value["kind"][]): HirReader<Value> => {
  const admitted: ReadonlySet<Hir.HirNode["kind"]> = new Set(kinds);
  const selects = (value: HirSyntaxConstruction): value is HirSyntaxConstruction & { readonly value: HirConstruction<Value> } =>
    admitted.has(value.kind);
  return { requests: accept => [{ kind: "syntax", reference: () => {
    let resolved: HirConstruction<Value> | undefined;
    accept({ run: next => ({ kind: "next", next: () => requirePresent(resolved, constructionFailure).run(next) }) });
    return value => {
      if (!selects(value)) return false;
      resolved = value.value;
      return true;
    };
  } }] };
};

function recordBuild<Value>(configure: (read: ReadField) => HirRecordBuild<Value>,
  accept: (value: HirConstruction<Value>) => void): HirRecordConstruction {
  const read: ReadField = <Child>(name: string, reader: HirReader<Child>): HirFieldSlot<Child> => {
    let input: HirConstruction<Child> | undefined;
    let value: Child | undefined;
    return { name, requests: () => reader.requests(actual => { input = actual; }),
      ready: () => input !== undefined,
      run: next => requirePresent(input, constructionFailure).run(actual => {
        value = actual;
        return next();
      }), value: () => requirePresent(value, constructionFailure) };
  };
  const build = configure(read);
  return { requests: (position, name) => {
    const field = build.fields[position];
    return field !== undefined && field.name === name ? field.requests() : [];
  }, complete: position => position === build.fields.length && build.fields.every(field => field.ready()), publish: () => accept({ run: next => {
    const advance = (position: number): HirConstructionStep => ({ kind: "next", next: () => {
      const field = build.fields[position];
      return field === undefined ? next(build.value()) : field.run(() => advance(position + 1));
    } });
    return advance(0);
  } }) };
}

export const recordReader = <Value>(label: string, configure: (read: ReadField) => HirRecordBuild<Value>): HirReader<Value> =>
  ({ requests: accept => [{ kind: "record", records: selected => selected === label ? [recordBuild(configure, accept)] : [] }] });

export const syntaxRecord = <Value extends Hir.HirNode>(configure: (read: ReadField) => HirRecordBuild<Value>,
  publish: (value: HirConstruction<Value>) => HirSyntaxConstruction,
  accept: (value: HirSyntaxConstruction) => void): HirRecordConstruction =>
  recordBuild(configure, value => accept(publish(memoSyntaxConstruction(value))));

export const entriesReader = <Value>(reader: HirReader<Value>): HirReader<readonly { readonly name: string; readonly value: Value }[]> =>
  ({ requests: accept => [{ kind: "record", records: () => {
    const entries: HirConstruction<{ readonly name: string; readonly value: Value }>[] = [];
    return [{ requests: (position, name) => reader.requests(value => {
      entries[position] = mapConstruction(value, actual => ({ name, value: actual }));
    }), complete: position => position === entries.length,
    publish: () => accept(sequenceConstruction(entries)) }];
  } }] });
