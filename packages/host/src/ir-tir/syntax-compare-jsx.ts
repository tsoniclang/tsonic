import type * as Hir from "../ir-hir/contract.js";
import { sameVector, sameNodeKind, sameNodeList } from "./syntax-compare-common.js";

export function sameJsxAttribute(left: Hir.JsxAttribute<Hir.Phase>, right: Hir.JsxAttribute<Hir.Phase>): boolean {
  return sameNodeKind(left.name, right.name) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameJsxAttributes(left: Hir.JsxAttributes<Hir.Phase>, right: Hir.JsxAttributes<Hir.Phase>): boolean {
  return sameNodeList(left.properties, right.properties);
}

export function sameJsxClosingElement(left: Hir.JsxClosingElement<Hir.Phase>, right: Hir.JsxClosingElement<Hir.Phase>): boolean {
  return sameNodeKind(left.tagName, right.tagName);
}

export function sameJsxElement(left: Hir.JsxElement<Hir.Phase>, right: Hir.JsxElement<Hir.Phase>): boolean {
  return sameNodeList(left.children, right.children);
}

export function sameJsxExpression(left: Hir.JsxExpression<Hir.Phase>, right: Hir.JsxExpression<Hir.Phase>): boolean {
  return ((left.dotDotDotToken === null) === (right.dotDotDotToken === null)) &&
    (left.expression === null ? right.expression === null : right.expression !== null && sameNodeKind(left.expression, right.expression));
}

export function sameJsxFragment(left: Hir.JsxFragment<Hir.Phase>, right: Hir.JsxFragment<Hir.Phase>): boolean {
  return sameNodeList(left.children, right.children);
}

export function sameJsxOpeningElement(left: Hir.JsxOpeningElement<Hir.Phase>, right: Hir.JsxOpeningElement<Hir.Phase>): boolean {
  return sameNodeKind(left.tagName, right.tagName) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments));
}

export function sameJsxSelfClosingElement(left: Hir.JsxSelfClosingElement<Hir.Phase>, right: Hir.JsxSelfClosingElement<Hir.Phase>): boolean {
  return sameNodeKind(left.tagName, right.tagName) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments));
}

export function sameJsxSpreadAttribute(left: Hir.JsxSpreadAttribute<Hir.Phase>, right: Hir.JsxSpreadAttribute<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameJsxText(left: Hir.JsxText<Hir.Phase>, right: Hir.JsxText<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is) &&
    Object.is(left.containsOnlyTriviaWhiteSpaces, right.containsOnlyTriviaWhiteSpaces);
}
