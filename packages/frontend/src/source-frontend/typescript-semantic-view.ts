import * as ts from "typescript";
import type {
  SourceSemanticFactKey,
  SourceSemanticFactStore,
  SourceSemanticView,
} from "./semantic-view.js";
import { createSourceSemanticFactStore } from "./semantic-view.js";

export type TypeScriptCallLikeExpression = ts.CallExpression | ts.NewExpression;

export type TypeScriptSemanticView = SourceSemanticView<
  ts.Node,
  ts.Expression,
  TypeScriptCallLikeExpression,
  ts.Type,
  ts.Symbol,
  ts.Signature
>;

export const createTypeScriptSemanticView = (
  checker: ts.TypeChecker,
  facts: SourceSemanticFactStore<ts.Node> = createSourceSemanticFactStore()
): TypeScriptSemanticView => ({
  engine: "typescript",
  getExpressionType: (expression: ts.Expression): ts.Type =>
    checker.getTypeAtLocation(expression),
  getSymbol: (node: ts.Node): ts.Symbol | undefined =>
    checker.getSymbolAtLocation(node),
  getDeclaredType: (symbol: ts.Symbol): ts.Type =>
    checker.getDeclaredTypeOfSymbol(symbol),
  getResolvedSignature: (
    callExpression: TypeScriptCallLikeExpression
  ): ts.Signature | undefined => checker.getResolvedSignature(callExpression),
  getFact: <T>(node: ts.Node, key: SourceSemanticFactKey<T>): T | undefined =>
    facts.get(node, key),
});
