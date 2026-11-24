import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { FileNumbering } from "./handles.js";
import {
  CommentDirectiveKindExpectError, CommentDirectiveKindIgnore, CommentDirectiveKindUnknown, LanguageVariantJSX, LanguageVariantStandard,
  NodeFlagsLet, NodeFlagsConst, NodeFlagsUsing, NodeFlagsOptionalChain, NodeFlagsDisallowInContext, NodeFlagsYieldContext, NodeFlagsDecoratorContext, NodeFlagsAwaitContext, NodeFlagsDisallowConditionalTypesContext, NodeFlagsThisNodeHasError, NodeFlagsJavaScriptFile, NodeFlagsThisNodeOrAnySubNodesHasError, NodeFlagsHasJSDoc, NodeFlagsJSDoc, NodeFlagsAmbient, NodeFlagsInWithStatement, NodeFlagsJsonFile, NodeFlagsIdentifierHasExtendedUnicodeEscape, NodeFlagsIdentifierIsInJSDocNamespace, NodeFlagsNestedNamespace, NodeFlagsAwaitUsing,
  ScriptKindDeferred, ScriptKindExternal, ScriptKindJS, ScriptKindJSON, ScriptKindJSX, ScriptKindTS, ScriptKindTSX, ScriptKindUnknown,
  TokenFlagsPrecedingLineBreak, TokenFlagsPrecedingJSDocComment, TokenFlagsUnterminated, TokenFlagsExtendedUnicodeEscape, TokenFlagsScientific, TokenFlagsOctal, TokenFlagsHexSpecifier, TokenFlagsBinarySpecifier, TokenFlagsOctalSpecifier, TokenFlagsContainsSeparator, TokenFlagsUnicodeEscape, TokenFlagsContainsInvalidEscape, TokenFlagsHexEscape, TokenFlagsContainsLeadingZero, TokenFlagsContainsInvalidSeparator, TokenFlagsPrecedingJSDocLeadingAsterisks, TokenFlagsSingleQuote, TokenFlagsPrecedingJSDocWithDeprecated, TokenFlagsPrecedingJSDocWithSeeOrLink,
} from "@tsonic/tsts";
import type * as Hir from "../ir-hir/contract.js";
import { orderPragmaArguments } from "../ir-hir/index.js";
import type { ModuleId, NodeId, Origin } from "../ids/contract.js";
import type { RawNumericLiteral } from "./contract.js";

export const writtenCompoundAssignmentKinds: readonly string[] = [
  "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "CaretEqualsToken",
  "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken",
  "SlashEqualsToken", "PercentEqualsToken",
  "AmpersandAmpersandEqualsToken", "BarBarEqualsToken", "QuestionQuestionEqualsToken",
];

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
interface SyntaxLocationContext {
  readonly ast: AstReader;
  readonly file: SourceFile;
  readonly displacement: number;
}

interface CapturedPragmas {
  readonly pragmas: readonly Hir.Pragma[];
  readonly checkJsDirective: Hir.CheckJsDirective | null;
}

export interface SyntaxCaptureContext extends SyntaxLocationContext, CapturedPragmas {
  readonly module: ModuleId;
  readonly sourceText: string;
  readonly numericLiterals: Map<Node, RawNumericLiteral>;
  readonly numbering: FileNumbering;
}

function numericTokenAt(sourceText: string, origin: Origin): string {
  const token = sourceText.slice(origin.start, origin.start + origin.length);
  if (origin.length === 0 || token.length !== origin.length) return defect("a numeric literal has no exact authored token");
  return token;
}

export function numericSyntaxText(context: SyntaxCaptureContext, node: Node, origin: Origin): string {
  const token = numericTokenAt(context.sourceText, origin);
  context.numericLiterals.set(node, { token, origin });
  return token;
}

type AuthoredTypeContext = Pick<SyntaxCaptureContext, "ast" | "module" | "sourceText" | "displacement">;

export function authoredNumericType(context: AuthoredTypeContext, node: Node): RawNumericLiteral | null {
  const ast = context.ast;
  if (ast.kindName(node) !== "KindLiteralType") return null;
  const literal = ast.as.AsLiteralTypeNode(node)?.Literal;
  if (literal === undefined) return defect("a literal annotation has no actual child");
  const kind = ast.kindName(literal);
  if (kind === "KindNumericLiteral" || kind === "KindBigIntLiteral") {
    const origin = originOf(context, literal);
    return { token: numericTokenAt(context.sourceText, origin), origin };
  }
  if (kind !== "KindPrefixUnaryExpression" || ast.operatorKindName(literal) !== "KindMinusToken") return null;
  const operand = ast.as.AsPrefixUnaryExpression(literal)?.Operand;
  if (operand === undefined) return null;
  const operandKind = ast.kindName(operand);
  if (operandKind !== "KindNumericLiteral" && operandKind !== "KindBigIntLiteral") return null;
  const origin = originOf(context, literal);
  return { token: "-" + numericTokenAt(context.sourceText, originOf(context, operand)), origin };
}

export function numericTypeSpelling(literal: Hir.LiteralTypeChild<Hir.SyntaxPhase>): RawNumericLiteral | null {
  if (literal.kind === "NumericLiteral" || literal.kind === "BigIntLiteral") return { token: literal.text, origin: literal.origin };
  if (literal.kind === "PrefixUnaryExpression" && literal.operator === "MinusToken" &&
    (literal.operand.kind === "NumericLiteral" || literal.operand.kind === "BigIntLiteral"))
    return { token: "-" + literal.operand.text, origin: literal.origin };
  return null;
}

/** A condition that the checker and HIR's schema cannot both be right about: a compiler defect, never a diagnostic. */
export function defect(message: string): never {
  throw new TypeError(`front: ${message}`);
}

function originalRange(context: SyntaxLocationContext, startByte: number, endByte: number): Hir.TextRange {
  const range = context.ast.sourceRange(context.file, startByte, endByte);
  if (range.kind !== "source") return defect("the checker gave no source range for a node of a checked file");
  return { pos: range.start + context.displacement, end: range.end + context.displacement };
}

/** A list's or a comment's range: the checker's byte range, as UTF-16 offsets of the captured text. */
export function rangeOf(context: SyntaxLocationContext, loc: { readonly pos: number; readonly end: number }): Hir.TextRange {
  return originalRange(context, loc.pos, loc.end);
}

export function originOf(context: Pick<AuthoredTypeContext, "ast" | "module" | "displacement">, node: SyntaxNodeOf): Origin {
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

type StoredSyntaxKind = Parameters<AstReader["syntaxKindName"]>[0];

export function heritageToken(context: SyntaxCaptureContext, token: StoredSyntaxKind): "ExtendsKeyword" | "ImplementsKeyword" {
  const name = context.ast.syntaxKindName(token);
  if (name === "KindExtendsKeyword") return "ExtendsKeyword";
  if (name === "KindImplementsKeyword") return "ImplementsKeyword";
  return defect(`the checker states an unknown heritage token ${name}`);
}

export function attributesToken(context: SyntaxCaptureContext, token: StoredSyntaxKind): "WithKeyword" | "AssertKeyword" {
  const name = context.ast.syntaxKindName(token);
  if (name === "KindWithKeyword") return "WithKeyword";
  if (name === "KindAssertKeyword") return "AssertKeyword";
  return defect(`the checker states an unknown import attributes token ${name}`);
}

export function metaKeyword(context: SyntaxCaptureContext, token: StoredSyntaxKind): "ImportKeyword" | "NewKeyword" {
  const name = context.ast.syntaxKindName(token);
  if (name === "KindImportKeyword") return "ImportKeyword";
  if (name === "KindNewKeyword") return "NewKeyword";
  return defect(`the checker states an unknown meta property keyword ${name}`);
}

export function moduleKeyword(context: SyntaxCaptureContext, node: SyntaxNodeOf): Hir.ModuleDeclaration<Hir.SyntaxPhase>["keyword"] {
  const keyword = context.ast.moduleKeywordKindName(node);
  if (keyword === "KindModuleKeyword") return "ModuleKeyword";
  if (keyword === "KindNamespaceKeyword") return "NamespaceKeyword";
  if (keyword === "KindGlobalKeyword") return "GlobalKeyword";
  return defect(`the checker names no admitted module keyword of a ${context.ast.kindName(node)} node`);
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

function commentRange(context: SyntaxLocationContext, value: NonNullable<SourceFile["CheckJsDirective"]>["Range"]): Hir.CommentRange {
  const name = context.ast.syntaxKindName(value.Kind);
  const kind = name === "KindSingleLineCommentTrivia" ? "SingleLineCommentTrivia"
    : name === "KindMultiLineCommentTrivia" ? "MultiLineCommentTrivia" : defect(`the checker states an unknown comment kind ${name}`);
  return { ...rangeOf(context, value), kind, hasTrailingNewLine: value.HasTrailingNewLine };
}

export function capturePragmas(context: SyntaxLocationContext, admit: () => boolean): CapturedPragmas | null {
  const pragmas: Hir.Pragma[] = [];
  const captured = context.file.Pragmas;
  for (let index = 0; index < captured.length; index += 1) {
    if (!admit()) return null;
    const pragma = captured[index];
    if (pragma === undefined) return defect("the checker's pragma inventory is not dense");
    const args: Hir.PragmaArgumentEntry[] = [];
    const entries = pragma.Args;
    if (entries !== undefined) {
      const iterator = entries.entries();
      for (let index = 0; index < entries.size; index += 1) {
        if (!admit()) return null;
        const entry = iterator.next();
        if (entry.done) return defect("the checker's pragma arguments ended before their actual extent");
        const [name, argument] = entry.value;
        args.push({ name, value: { ...rangeOf(context, argument), name: argument.Name, value: argument.Value } });
      }
    }
    pragmas.push({ ...commentRange(context, pragma), name: pragma.Name, args: orderPragmaArguments(args) });
  }
  const selected = context.file.CheckJsDirective;
  if (selected === undefined) return { pragmas, checkJsDirective: null };
  if (!admit()) return null;
  return { pragmas, checkJsDirective: { enabled: selected.Enabled, range: commentRange(context, selected.Range) } };
}

export function jsDocText(value: readonly string[]): readonly string[] {
  return value;
}
