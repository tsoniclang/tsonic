import * as ts from "typescript";
import type { SourceSemanticView } from "./semantic-view.js";

export type FrontendSourceCallLikeExpression =
  | ts.CallExpression
  | ts.NewExpression;

export type FrontendSourceSemanticView = SourceSemanticView<
  ts.Node,
  ts.Expression,
  FrontendSourceCallLikeExpression,
  ts.Type,
  ts.Symbol,
  ts.Signature,
  ts.Declaration
>;
