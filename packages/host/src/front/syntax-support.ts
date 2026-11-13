import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type * as Hir from "../ir-hir/contract.js";
import type { ModuleId, NodeId, Origin } from "../ids/contract.js";

/** A node of the checker's tree. */
export type SyntaxNodeOf = Node;

/** A list of the checker's tree: its range and its nodes. */
export interface SdkNodeList {
  readonly Loc: { readonly pos: number; readonly end: number };
  readonly Nodes: readonly (SyntaxNodeOf | undefined)[];
}

/**
 * What the conversion of one module's tree reads: the checker's reader, the module's checked file, the module's
 * identity, the displacement between the checker's text and the captured text (K-3238 item 4: the original's length
 * minus the delivered length, applied once), and the next preorder identity, which also records the checker's node
 * that the identity stands for.
 */
export interface SyntaxCaptureContext {
  readonly ast: AstReader;
  readonly file: SourceFile;
  readonly module: ModuleId;
  readonly displacement: number;
  readonly next: (node: SyntaxNodeOf) => NodeId;
}

/** A condition that the checker and HIR's schema cannot both be right about: a compiler defect, never a diagnostic. */
export function defect(message: string): never {
  throw new TypeError(`front: ${message}`);
}

function originalRange(context: SyntaxCaptureContext, startByte: number, endByte: number): Hir.TextRange {
  const range = context.ast.sourceRange(context.file, startByte, endByte);
  if (range.kind !== "source") return defect("the checker gave no source range for a node of a checked file");
  return { pos: range.start + context.displacement, end: range.end + context.displacement };
}

/** A list's or a comment's range: the checker's byte range, as UTF-16 offsets of the captured text. */
export function rangeOf(context: SyntaxCaptureContext, loc: { readonly pos: number; readonly end: number }): Hir.TextRange {
  return originalRange(context, loc.pos, loc.end);
}

function originOf(context: SyntaxCaptureContext, node: SyntaxNodeOf): Origin {
  const authored = context.ast.authoredRange(node);
  if (authored.kind !== "authored") return defect(`a ${context.ast.kindName(node)} node of a checked file has no authored range`);
  return { module: context.module, start: authored.start + context.displacement, length: authored.end - authored.start, derived: [] };
}

/** The header every HIR syntax node has. Node flags are not yet readable by name from the checker (an SDK need). */
export function headerOf(context: SyntaxCaptureContext, node: SyntaxNodeOf, id: NodeId, parent: NodeId | null): Hir.NodeHeader {
  return {
    id, origin: originOf(context, node), parent, flags: unnamedFlags(node.Flags, "node flags"),
    loc: originalRange(context, context.ast.pos(node), context.ast.end(node)),
  };
}

/**
 * A flag set the checker states as a number whose names it does not export. An empty set is the empty list; a
 * non-empty one cannot be named here and is a defect until the checker exports the names.
 */
export function unnamedFlags(value: number, what: string): readonly never[] {
  return value === 0 ? [] : defect(`${what} ${value} cannot be named: the checker does not export their names`);
}

/**
 * The keyword token of a heritage clause, import attributes, a meta property or a module declaration. The checker
 * states it as a kind number whose name is public only from the SDK's kind names, which this vendored SDK does not
 * export: refused until it is vendored (W3's export, K-3297). Never read from the source words.
 */
function keywordNotReadable(context: SyntaxCaptureContext, node: SyntaxNodeOf): never {
  return defect(`the keyword of a ${context.ast.kindName(node)} node needs the SDK's public kind names (W3's export, not yet vendored)`);
}

export function heritageToken(context: SyntaxCaptureContext, node: SyntaxNodeOf): "ExtendsKeyword" | "ImplementsKeyword" {
  return keywordNotReadable(context, node);
}

export function attributesToken(context: SyntaxCaptureContext, node: SyntaxNodeOf): "WithKeyword" | "AssertKeyword" {
  return keywordNotReadable(context, node);
}

export function metaKeyword(context: SyntaxCaptureContext, node: SyntaxNodeOf): "ImportKeyword" | "NewKeyword" {
  return keywordNotReadable(context, node);
}

export function moduleKeyword(context: SyntaxCaptureContext, node: SyntaxNodeOf): "ModuleKeyword" | "NamespaceKeyword" {
  return keywordNotReadable(context, node);
}

function operatorName(context: SyntaxCaptureContext, node: SyntaxNodeOf): string {
  const name = context.ast.operatorKindName(node);
  return name === undefined ? defect(`the checker names no operator of a ${context.ast.kindName(node)} node`) : name.replace(/^Kind/u, "");
}

export function prefixOperator(context: SyntaxCaptureContext, node: SyntaxNodeOf): Hir.PrefixUnaryExpression<Hir.SyntaxPhase>["operator"] {
  const name = operatorName(context, node);
  switch (name) {
    case "PlusToken": case "MinusToken": case "TildeToken": case "ExclamationToken": case "PlusPlusToken": case "MinusMinusToken": return name;
    default: return defect(`prefix operator ${name}`);
  }
}

export function postfixOperator(context: SyntaxCaptureContext, node: SyntaxNodeOf): Hir.PostfixUnaryExpression<Hir.SyntaxPhase>["operator"] {
  const name = operatorName(context, node);
  switch (name) {
    case "PlusPlusToken": case "MinusMinusToken": return name;
    default: return defect(`postfix operator ${name}`);
  }
}

export function typeOperator(context: SyntaxCaptureContext, node: SyntaxNodeOf): Hir.TypeOperatorNode<Hir.SyntaxPhase>["operator"] {
  const name = operatorName(context, node);
  switch (name) {
    case "KeyOfKeyword": case "ReadonlyKeyword": case "UniqueKeyword": return name;
    default: return defect(`type operator ${name}`);
  }
}

/** The import phase modifier: the checker states it as a kind number; none is the only value read here. */
export function phaseModifier(value: number): null {
  return value === 0 ? null : defect("an import phase modifier cannot be named: the checker does not export kind names by number");
}

/**
 * A source file's language variant, script kind and comment directive kinds: the checker states them as numbers
 * whose names its public entry exports only from W3's export (ScriptKind, LanguageVariant, CommentDirectiveKind and
 * their names), not yet vendored. No copied table: refused until it is vendored (K-3297, K-3302).
 */
export function languageVariant(value: number): Hir.SourceFile<Hir.SyntaxPhase>["languageVariant"] {
  return defect(`the language variant ${value} needs the SDK's public LanguageVariant names (W3's export, not yet vendored)`);
}

export function scriptKind(value: number): Hir.SourceFile<Hir.SyntaxPhase>["scriptKind"] {
  return defect(`the script kind ${value} needs the SDK's public ScriptKind names (W3's export, not yet vendored)`);
}

export function commentDirectives(context: SyntaxCaptureContext,
  directives: readonly { readonly Loc: { readonly pos: number; readonly end: number }; readonly Kind: number }[]): readonly Hir.CommentDirective[] {
  return directives.length === 0 ? []
    : defect(`a comment directive at ${rangeOf(context, directives[0]?.Loc ?? { pos: 0, end: 0 }).pos} needs the SDK's public CommentDirectiveKind names (W3's export, not yet vendored)`);
}

/** Pragmas of a file: none is the only form read here so far. */
export function pragmas(value: readonly unknown[]): readonly Hir.Pragma[] {
  return value.length === 0 ? [] : defect("the pragmas of a file are not yet converted");
}

/** A `@ts-check` or `@ts-nocheck` directive: none is the only form read here so far. */
export function checkJsDirective(value: object | undefined): null {
  return value === undefined ? null : defect("a check-JS directive is not yet converted");
}

export function jsDocText(value: readonly string[]): readonly string[] {
  return value;
}
