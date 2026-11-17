import type * as Hir from "../ir-hir/contract.js";

export function sameVector<Value>(left: readonly Value[], right: readonly Value[], same: (left: Value, right: Value) => boolean): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const given = left[index];
    const expected = right[index];
    if (given === undefined || expected === undefined || !same(given, expected)) return false;
  }
  return true;
}

export const sameNodeKind = (left: Hir.SyntaxNode<Hir.Phase>, right: Hir.SyntaxNode<Hir.Phase>): boolean => left.kind === right.kind;

export function samePragmaArguments(left: Hir.PragmaArguments, right: Hir.PragmaArguments): boolean {
  if (left.length !== right.length) return false;
  const expected = new Map<string, Hir.PragmaArgument>();
  for (const entry of right) {
    if (entry === undefined || expected.has(entry.name)) return false;
    expected.set(entry.name, entry.value);
  }
  const names = new Set<string>();
  for (const entry of left) {
    if (entry === undefined) return false;
    const value = expected.get(entry.name);
    if (names.has(entry.name) || value === undefined || !samePragmaArgument29(entry.value, value)) return false;
    names.add(entry.name);
  }
  return true;
}

export function sameNodeList(left: Hir.NodeList<Hir.SyntaxNode<Hir.Phase>>, right: Hir.NodeList<Hir.SyntaxNode<Hir.Phase>>): boolean {
  return sameTextRange1(left.loc, right.loc) && sameVector(left.nodes, right.nodes, sameNodeKind);
}

export function sameTextRange1(left: Hir.TextRange, right: Hir.TextRange): boolean {
  return Object.is(left.pos, right.pos) &&
    Object.is(left.end, right.end);
}

export function sameCommentDirective22(left: Hir.CommentDirective, right: Hir.CommentDirective): boolean {
  return sameTextRange1(left.loc, right.loc) &&
    Object.is(left.kind, right.kind);
}

export function samePragma23(left: Hir.Pragma, right: Hir.Pragma): boolean {
  return Object.is(left.name, right.name) &&
    samePragmaArguments(left.args, right.args) &&
    Object.is(left.pos, right.pos) &&
    Object.is(left.end, right.end) &&
    Object.is(left.kind, right.kind) &&
    Object.is(left.hasTrailingNewLine, right.hasTrailingNewLine);
}

export function sameCheckJsDirective24(left: Hir.CheckJsDirective, right: Hir.CheckJsDirective): boolean {
  return Object.is(left.enabled, right.enabled) &&
    sameCommentRange25(left.range, right.range);
}

export function sameCommentRange25(left: Hir.CommentRange, right: Hir.CommentRange): boolean {
  return Object.is(left.kind, right.kind) &&
    Object.is(left.hasTrailingNewLine, right.hasTrailingNewLine) &&
    Object.is(left.pos, right.pos) &&
    Object.is(left.end, right.end);
}

export function samePragmaArgument29(left: Hir.PragmaArgument, right: Hir.PragmaArgument): boolean {
  return Object.is(left.name, right.name) &&
    Object.is(left.value, right.value) &&
    Object.is(left.pos, right.pos) &&
    Object.is(left.end, right.end);
}
