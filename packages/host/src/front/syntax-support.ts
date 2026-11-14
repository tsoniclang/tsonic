import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import {
  CommentDirectiveKindExpectError, CommentDirectiveKindIgnore, CommentDirectiveKindUnknown, LanguageVariantJSX, LanguageVariantStandard,
  NodeFlagsLet, NodeFlagsConst, NodeFlagsUsing, NodeFlagsOptionalChain, NodeFlagsDisallowInContext, NodeFlagsYieldContext, NodeFlagsDecoratorContext, NodeFlagsAwaitContext, NodeFlagsDisallowConditionalTypesContext, NodeFlagsThisNodeHasError, NodeFlagsJavaScriptFile, NodeFlagsThisNodeOrAnySubNodesHasError, NodeFlagsHasJSDoc, NodeFlagsJSDoc, NodeFlagsAmbient, NodeFlagsInWithStatement, NodeFlagsJsonFile, NodeFlagsIdentifierHasExtendedUnicodeEscape, NodeFlagsIdentifierIsInJSDocNamespace, NodeFlagsNestedNamespace, NodeFlagsAwaitUsing,
  ScriptKindDeferred, ScriptKindExternal, ScriptKindJS, ScriptKindJSON, ScriptKindJSX, ScriptKindTS, ScriptKindTSX, ScriptKindUnknown,
  TokenFlagsPrecedingLineBreak, TokenFlagsPrecedingJSDocComment, TokenFlagsUnterminated, TokenFlagsExtendedUnicodeEscape, TokenFlagsScientific, TokenFlagsOctal, TokenFlagsHexSpecifier, TokenFlagsBinarySpecifier, TokenFlagsOctalSpecifier, TokenFlagsContainsSeparator, TokenFlagsUnicodeEscape, TokenFlagsContainsInvalidEscape, TokenFlagsHexEscape, TokenFlagsContainsLeadingZero, TokenFlagsContainsInvalidSeparator, TokenFlagsPrecedingJSDocLeadingAsterisks, TokenFlagsSingleQuote, TokenFlagsPrecedingJSDocWithDeprecated, TokenFlagsPrecedingJSDocWithSeeOrLink,
} from "@tsonic/tsts";
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

/** The header every HIR syntax node has. */
export function headerOf(context: SyntaxCaptureContext, node: SyntaxNodeOf, id: NodeId, parent: NodeId | null): Hir.NodeHeader {
  return {
    id, origin: originOf(context, node), parent, flags: syntaxFlags(node.Flags),
    loc: originalRange(context, context.ast.pos(node), context.ast.end(node)),
  };
}

/**
 * A node's flags in HIR's vocabulary, read with the checker's own exported flag constants. `await using` is the
 * checker's combination of the const and using flags and is HIR's one flag `AwaitUsing`. The checker's other
 * flags (reparsing, synthesis, reachability and the like) are not in HIR's vocabulary and are not carried.
 */
export function syntaxFlags(value: number): readonly Hir.SyntaxFlag[] {
  const flags: Hir.SyntaxFlag[] = [];
  const awaitUsing = (value & NodeFlagsAwaitUsing) === NodeFlagsAwaitUsing;
  const single: readonly (readonly [Hir.SyntaxFlag, number])[] = [
    ["Let", NodeFlagsLet], ["Const", NodeFlagsConst], ["Using", NodeFlagsUsing], ["OptionalChain", NodeFlagsOptionalChain], ["DisallowInContext", NodeFlagsDisallowInContext], ["YieldContext", NodeFlagsYieldContext], ["DecoratorContext", NodeFlagsDecoratorContext], ["AwaitContext", NodeFlagsAwaitContext], ["DisallowConditionalTypesContext", NodeFlagsDisallowConditionalTypesContext], ["ThisNodeHasError", NodeFlagsThisNodeHasError], ["JavaScriptFile", NodeFlagsJavaScriptFile], ["ThisNodeOrAnySubNodesHasError", NodeFlagsThisNodeOrAnySubNodesHasError], ["HasJSDoc", NodeFlagsHasJSDoc], ["JSDoc", NodeFlagsJSDoc], ["Ambient", NodeFlagsAmbient], ["InWithStatement", NodeFlagsInWithStatement], ["JsonFile", NodeFlagsJsonFile], ["IdentifierHasExtendedUnicodeEscape", NodeFlagsIdentifierHasExtendedUnicodeEscape], ["IdentifierIsInJSDocNamespace", NodeFlagsIdentifierIsInJSDocNamespace], ["NestedNamespace", NodeFlagsNestedNamespace]];
  for (const [name, bit] of single) {
    if ((name === "Const" || name === "Using") && awaitUsing) continue;
    if ((value & bit) !== 0) flags.push(name);
  }
  if (awaitUsing) flags.push("AwaitUsing");
  return flags;
}

/** A literal's token or template flags in HIR's vocabulary, read with the checker's own exported constants. */
export function tokenFlags(value: number): readonly Hir.TokenFlag[] {
  const named: readonly (readonly [Hir.TokenFlag, number])[] = [
    ["PrecedingLineBreak", TokenFlagsPrecedingLineBreak], ["PrecedingJSDocComment", TokenFlagsPrecedingJSDocComment], ["Unterminated", TokenFlagsUnterminated], ["ExtendedUnicodeEscape", TokenFlagsExtendedUnicodeEscape], ["Scientific", TokenFlagsScientific], ["Octal", TokenFlagsOctal], ["HexSpecifier", TokenFlagsHexSpecifier], ["BinarySpecifier", TokenFlagsBinarySpecifier], ["OctalSpecifier", TokenFlagsOctalSpecifier], ["ContainsSeparator", TokenFlagsContainsSeparator], ["UnicodeEscape", TokenFlagsUnicodeEscape], ["ContainsInvalidEscape", TokenFlagsContainsInvalidEscape], ["HexEscape", TokenFlagsHexEscape], ["ContainsLeadingZero", TokenFlagsContainsLeadingZero], ["ContainsInvalidSeparator", TokenFlagsContainsInvalidSeparator], ["PrecedingJSDocLeadingAsterisks", TokenFlagsPrecedingJSDocLeadingAsterisks], ["SingleQuote", TokenFlagsSingleQuote], ["PrecedingJSDocWithDeprecated", TokenFlagsPrecedingJSDocWithDeprecated], ["PrecedingJSDocWithSeeOrLink", TokenFlagsPrecedingJSDocWithSeeOrLink]];
  return named.filter(([, bit]) => (value & bit) !== 0).map(([name]) => name);
}

/**
 * The keyword token of a heritage clause, import attributes, a meta property or a module declaration. The checker
 * states it as a kind number; the SDK exports kind names only for nodes (AstReader.kindName), not for kind numbers:
 * refused until it does (K-3297). Never read from the source words.
 */
function keywordNotReadable(context: SyntaxCaptureContext, node: SyntaxNodeOf): never {
  return defect(`the keyword of a ${context.ast.kindName(node)} node needs a public name of the checker's kind numbers, which the SDK does not export`);
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

export function phaseModifier(context: SyntaxCaptureContext, node: SyntaxNodeOf, value: number): Hir.ImportPhaseModifierSyntaxKind | null {
  if (value === 0) return null;
  if (context.ast.isTypeOnlyImportDeclaration(node)) return "TypeKeyword";
  return defect("a deferred import phase modifier cannot be named: the checker does not export kind names by number");
}

/** A source file's language variant, read with the checker's own exported constants. */
export function languageVariant(value: number): Hir.SourceFile<Hir.SyntaxPhase>["languageVariant"] {
  return value === LanguageVariantStandard ? "Standard" : value === LanguageVariantJSX ? "JSX" : defect(`the checker states an unknown language variant ${value}`);
}

/** A source file's script kind, read with the checker's own exported constants. */
export function scriptKind(value: number): Hir.SourceFile<Hir.SyntaxPhase>["scriptKind"] {
  const kinds: readonly (readonly [Hir.SourceFile<Hir.SyntaxPhase>["scriptKind"], number])[] = [["Unknown", ScriptKindUnknown], ["JS", ScriptKindJS],
    ["JSX", ScriptKindJSX], ["TS", ScriptKindTS], ["TSX", ScriptKindTSX], ["External", ScriptKindExternal], ["JSON", ScriptKindJSON], ["Deferred", ScriptKindDeferred]];
  const found = kinds.find(([, kind]) => kind === value);
  return found === undefined ? defect(`the checker states an unknown script kind ${value}`) : found[0];
}

/** A source file's comment directives, their kinds read with the checker's own exported constants. */
export function commentDirectives(context: SyntaxCaptureContext,
  directives: readonly { readonly Loc: { readonly pos: number; readonly end: number }; readonly Kind: number }[]): readonly Hir.CommentDirective[] {
  return directives.map(directive => ({ loc: rangeOf(context, directive.Loc),
    kind: directive.Kind === CommentDirectiveKindExpectError ? "ExpectError" : directive.Kind === CommentDirectiveKindIgnore ? "Ignore"
      : directive.Kind === CommentDirectiveKindUnknown ? "Unknown" : defect(`the checker states an unknown comment directive kind ${directive.Kind}`) }));
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
