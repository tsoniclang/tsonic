import type { Identifier, CaseBlock, CatchClause, Block, VariableDeclaration, VariableDeclarationList, ParameterDeclaration, BindingElement, HeritageClause, EnumMember, ExportSpecifier, TemplateSpan, ExpressionWithTypeArguments, ImportAttribute, ImportAttributes, TemplateHead, TemplateLiteralTypeSpan, JsxAttributes, JsxOpeningElement, JsxOpeningFragment, JsxClosingFragment, JsxClosingElement, SourceFile, ImportClause, ImportSpecifier, TypeParameterDeclaration, EntityName, Expression, LeftHandSideExpression, Statement, ForInitializer, CaseOrDefaultClause, BindingName, TypeNode, PropertyName, BlockOrExpression, ClassElement, TypeElement, ModuleExportName, MemberName, TemplateMiddleOrTail, TemplateLiteral, ObjectLiteralElementLike, LiteralTypeChild, TypePredicateParameterName, ImportAttributeName, JsxChild, JsxAttributeLike, JsxTagNameExpression, JsxAttributeName, JsxAttributeValue, JSDocComment, JSDocTag, JSDocFullName, NodeBody, ModuleName, ModuleReference, NamedExportBindings, NamedImportBindings, ModifierLike, BodyRoot, AwaitKeyword, ExclamationToken, DotDotDotToken, QuestionToken, AsteriskToken, BinaryOperatorToken, EqualsGreaterThanToken, ColonToken, QuestionDotToken, EqualsToken, AssertsKeyword, ReadonlyKeyword, PlusToken, MinusToken, EndOfFile, SyntaxNode, NodeHeader, NodeList, SyntaxFlag, TextRange } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TextParseResult } from "../diag/contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { NodeId, Origin } from "../ids/contract.js";
import type { CheckJsDirective, CommentDirective, CommentRange, Pragma, PragmaArgument, PragmaArguments } from "../ir-hir/contract.js";
import type { SyntaxKind } from "../ir-hir/contract.js";
import type { Cursor, RecordFields, TextReader, TextStep } from "./parse-values.js";
import type { DecodedName } from "./parse-values.js";
import { acceptText, arrayText, atomicText, closeRecord, delimiter, fieldText, invalid, nullable, nullableText, openRecord, readField, readNodeId, readNumber, readStringChoice, whitespace } from "./parse-values.js";
import { readOrigin } from "./parse-diagnostics.js";
import { choice, namePart, nameStart, quoted, readBoolean, readString } from "./parse-values.js";

export interface SyntaxWire {
  readonly position: number;
  readonly offset: number;
}

export interface SyntaxValue<Value> {
  readonly resolve: () => Value;
}

export interface SyntaxDependency extends SyntaxWire {
  readonly kinds: readonly SyntaxKind[];
  readonly expected: readonly string[];
}

export interface SyntaxPort<Value> {
  readonly kinds: readonly SyntaxKind[];
  readonly expected: readonly string[];
  readonly track: (dependency: SyntaxDependency) => void;
  readonly read: (wire: SyntaxWire) => Value | undefined;
}

export interface SyntaxReadPorts {
  readonly Identifier: SyntaxPort<Identifier<TypedPhase>>;
  readonly CaseBlock: SyntaxPort<CaseBlock<TypedPhase>>;
  readonly CatchClause: SyntaxPort<CatchClause<TypedPhase>>;
  readonly Block: SyntaxPort<Block<TypedPhase>>;
  readonly VariableDeclaration: SyntaxPort<VariableDeclaration<TypedPhase>>;
  readonly VariableDeclarationList: SyntaxPort<VariableDeclarationList<TypedPhase>>;
  readonly ParameterDeclaration: SyntaxPort<ParameterDeclaration<TypedPhase>>;
  readonly BindingElement: SyntaxPort<BindingElement<TypedPhase>>;
  readonly HeritageClause: SyntaxPort<HeritageClause<TypedPhase>>;
  readonly EnumMember: SyntaxPort<EnumMember<TypedPhase>>;
  readonly ExportSpecifier: SyntaxPort<ExportSpecifier<TypedPhase>>;
  readonly TemplateSpan: SyntaxPort<TemplateSpan<TypedPhase>>;
  readonly ExpressionWithTypeArguments: SyntaxPort<ExpressionWithTypeArguments<TypedPhase>>;
  readonly ImportAttribute: SyntaxPort<ImportAttribute<TypedPhase>>;
  readonly ImportAttributes: SyntaxPort<ImportAttributes<TypedPhase>>;
  readonly TemplateHead: SyntaxPort<TemplateHead<TypedPhase>>;
  readonly TemplateLiteralTypeSpan: SyntaxPort<TemplateLiteralTypeSpan<TypedPhase>>;
  readonly JsxAttributes: SyntaxPort<JsxAttributes<TypedPhase>>;
  readonly JsxOpeningElement: SyntaxPort<JsxOpeningElement<TypedPhase>>;
  readonly JsxOpeningFragment: SyntaxPort<JsxOpeningFragment<TypedPhase>>;
  readonly JsxClosingFragment: SyntaxPort<JsxClosingFragment<TypedPhase>>;
  readonly JsxClosingElement: SyntaxPort<JsxClosingElement<TypedPhase>>;
  readonly SourceFile: SyntaxPort<SourceFile<TypedPhase>>;
  readonly ImportClause: SyntaxPort<ImportClause<TypedPhase>>;
  readonly ImportSpecifier: SyntaxPort<ImportSpecifier<TypedPhase>>;
  readonly TypeParameterDeclaration: SyntaxPort<TypeParameterDeclaration<TypedPhase>>;
  readonly EntityName: SyntaxPort<EntityName<TypedPhase>>;
  readonly Expression: SyntaxPort<Expression<TypedPhase>>;
  readonly LeftHandSideExpression: SyntaxPort<LeftHandSideExpression<TypedPhase>>;
  readonly Statement: SyntaxPort<Statement<TypedPhase>>;
  readonly ForInitializer: SyntaxPort<ForInitializer<TypedPhase>>;
  readonly CaseOrDefaultClause: SyntaxPort<CaseOrDefaultClause<TypedPhase>>;
  readonly BindingName: SyntaxPort<BindingName<TypedPhase>>;
  readonly TypeNode: SyntaxPort<TypeNode<TypedPhase>>;
  readonly PropertyName: SyntaxPort<PropertyName<TypedPhase>>;
  readonly BlockOrExpression: SyntaxPort<BlockOrExpression<TypedPhase>>;
  readonly ClassElement: SyntaxPort<ClassElement<TypedPhase>>;
  readonly TypeElement: SyntaxPort<TypeElement<TypedPhase>>;
  readonly ModuleExportName: SyntaxPort<ModuleExportName<TypedPhase>>;
  readonly MemberName: SyntaxPort<MemberName<TypedPhase>>;
  readonly TemplateMiddleOrTail: SyntaxPort<TemplateMiddleOrTail<TypedPhase>>;
  readonly TemplateLiteral: SyntaxPort<TemplateLiteral<TypedPhase>>;
  readonly ObjectLiteralElementLike: SyntaxPort<ObjectLiteralElementLike<TypedPhase>>;
  readonly LiteralTypeChild: SyntaxPort<LiteralTypeChild<TypedPhase>>;
  readonly TypePredicateParameterName: SyntaxPort<TypePredicateParameterName<TypedPhase>>;
  readonly ImportAttributeName: SyntaxPort<ImportAttributeName<TypedPhase>>;
  readonly JsxChild: SyntaxPort<JsxChild<TypedPhase>>;
  readonly JsxAttributeLike: SyntaxPort<JsxAttributeLike<TypedPhase>>;
  readonly JsxTagNameExpression: SyntaxPort<JsxTagNameExpression<TypedPhase>>;
  readonly JsxAttributeName: SyntaxPort<JsxAttributeName<TypedPhase>>;
  readonly JsxAttributeValue: SyntaxPort<JsxAttributeValue<TypedPhase>>;
  readonly JSDocComment: SyntaxPort<JSDocComment<TypedPhase>>;
  readonly JSDocTag: SyntaxPort<JSDocTag<TypedPhase>>;
  readonly JSDocFullName: SyntaxPort<JSDocFullName<TypedPhase>>;
  readonly NodeBody: SyntaxPort<NodeBody<TypedPhase>>;
  readonly ModuleName: SyntaxPort<ModuleName<TypedPhase>>;
  readonly ModuleReference: SyntaxPort<ModuleReference<TypedPhase>>;
  readonly NamedExportBindings: SyntaxPort<NamedExportBindings<TypedPhase>>;
  readonly NamedImportBindings: SyntaxPort<NamedImportBindings<TypedPhase>>;
  readonly ModifierLike: SyntaxPort<ModifierLike<TypedPhase>>;
  readonly BodyRoot: SyntaxPort<BodyRoot<TypedPhase>>;
  readonly AwaitKeyword: SyntaxPort<AwaitKeyword<TypedPhase>>;
  readonly ExclamationToken: SyntaxPort<ExclamationToken<TypedPhase>>;
  readonly DotDotDotToken: SyntaxPort<DotDotDotToken<TypedPhase>>;
  readonly QuestionToken: SyntaxPort<QuestionToken<TypedPhase>>;
  readonly AsteriskToken: SyntaxPort<AsteriskToken<TypedPhase>>;
  readonly BinaryOperatorToken: SyntaxPort<BinaryOperatorToken<TypedPhase>>;
  readonly EqualsGreaterThanToken: SyntaxPort<EqualsGreaterThanToken<TypedPhase>>;
  readonly ColonToken: SyntaxPort<ColonToken<TypedPhase>>;
  readonly QuestionDotToken: SyntaxPort<QuestionDotToken<TypedPhase>>;
  readonly EqualsToken: SyntaxPort<EqualsToken<TypedPhase>>;
  readonly AssertsKeyword: SyntaxPort<AssertsKeyword<TypedPhase>>;
  readonly ReadonlyKeyword: SyntaxPort<ReadonlyKeyword<TypedPhase>>;
  readonly PlusToken: SyntaxPort<PlusToken<TypedPhase>>;
  readonly MinusToken: SyntaxPort<MinusToken<TypedPhase>>;
  readonly EndOfFile: SyntaxPort<EndOfFile<TypedPhase>>;
  readonly SyntaxNode: SyntaxPort<SyntaxNode<TypedPhase>>;
}

export function syntaxValue<Value>(value: Value): SyntaxValue<Value> {
  return { resolve: () => value };
}

export function mapSyntaxValue<Value, Output>(value: SyntaxValue<Value>, project: (value: Value) => Output): SyntaxValue<Output> {
  return {
    resolve: () => project(value.resolve()),
  };
}

export function resolveSyntaxValue<Value, Output>(value: SyntaxValue<Value>, finish: (value: Value) => Output): Output {
  return finish(value.resolve());
}

export function resolveSyntaxAlternatives<Value>(
  ports: readonly [SyntaxPort<Value>, ...SyntaxPort<Value>[]],
  wire: SyntaxWire,
): Value | undefined {
  let value = ports[0].read(wire);
  for (const port of ports.slice(1)) {
    if (value !== undefined) break;
    value = port.read(wire);
  }
  return value;
}

export function syntaxAlternatives<Value>(ports: readonly [SyntaxPort<Value>, ...SyntaxPort<Value>[]]): SyntaxPort<Value> {
  const kinds: SyntaxKind[] = [];
  const expected: string[] = [];
  for (const port of ports) {
    for (const kind of port.kinds) if (!kinds.includes(kind)) kinds.push(kind);
    for (const item of port.expected) if (!expected.includes(item)) expected.push(item);
  }
  return { kinds, expected, track: ports[0].track, read: wire => resolveSyntaxAlternatives(ports, wire) };
}

export function readSyntaxRecord<Root>(cursor: Cursor, finish: (fields: RecordFields, header: NodeHeader) => TextStep<Root>): TextStep<Root> {
  const fields: RecordFields = { given: new Set<string>() };
  return atomicText(cursor, next => delimiter(next, "("), () =>
    readSyntaxHeader(cursor, fields, header => finish(fields, header)));
}

export function finishSyntaxRecord<Value, Root>(
  cursor: Cursor,
  fields: RecordFields,
  value: SyntaxValue<Value>,
  finish: (value: SyntaxValue<Value>) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => closeRecord(next, fields), () => acceptText(value, finish));
}

export function syntaxArray<Value>(values: readonly SyntaxValue<Value>[]): SyntaxValue<readonly Value[]> {
  return {
    resolve: () => {
      const result: Value[] = [];
      for (const value of values) result.push(value.resolve());
      return result;
    },
  };
}

export function readSyntaxWire(cursor: Cursor): TextParseResult<SyntaxWire> {
  whitespace(cursor);
  const offset = cursor.offset;
  const prefix = delimiter(cursor, "n:");
  if (prefix.kind === "invalid-text") return prefix;
  const positionOffset = cursor.offset;
  const position = readNumber(cursor);
  if (position.kind === "invalid-text") return position;
  if (!Number.isSafeInteger(position.value) || position.value < 0 || Object.is(position.value, -0)) {
    return invalid(cursor, positionOffset, ["wire position"]);
  }
  return { kind: "parsed", value: { position: position.value, offset } };
}

const missingSyntaxReference = Object.freeze<InvariantFailure>({
  owner: "ir-program", query: null, origin: null,
  message: "Validated syntax reference has no matching materialized value",
});

export function readSyntaxReference<Value, Root>(
  cursor: Cursor,
  port: SyntaxPort<Value>,
  finish: (value: SyntaxValue<Value>) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, readSyntaxWire, wire => {
    const dependency: SyntaxDependency = { ...wire, kinds: port.kinds, expected: port.expected };
    port.track(dependency);
    return acceptText({ resolve: () => requirePresent(port.read(wire), missingSyntaxReference) }, finish);
  });
}

export function readSyntaxArray<Value, Root>(
  cursor: Cursor,
  readValue: TextReader<SyntaxValue<Value>>,
  finish: (value: SyntaxValue<readonly Value[]>) => TextStep<Root>,
): TextStep<Root> {
  return arrayText(cursor, readValue, values => acceptText(syntaxArray(values), finish));
}

export function readNullableSyntax<Value, Root>(
  cursor: Cursor,
  readValue: TextReader<SyntaxValue<Value>>,
  finish: (value: SyntaxValue<Value | null>) => TextStep<Root>,
): TextStep<Root> {
  return nullableText(cursor, readValue, value =>
    acceptText(value === null ? syntaxValue<Value | null>(null) : value, finish));
}

export function readSyntaxList<Value extends SyntaxNode<TypedPhase>, Root>(
  cursor: Cursor,
  readValue: TextReader<SyntaxValue<Value>>,
  label: "NodeList" | "ModifierList",
  finish: (value: SyntaxValue<NodeList<Value>>) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, label), fields =>
    fieldText<TextRange, Root>(cursor, fields, "loc", (next, done) => atomicText(next, readTextRange, done), loc =>
      fieldText<SyntaxValue<readonly Value[]>, Root>(cursor, fields, "nodes", (next, done) => readSyntaxArray(next, readValue, done), nodes =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText(mapSyntaxValue(nodes, values => ({ loc, nodes: values })), finish)))));
}

export function readTextRange(cursor: Cursor): TextParseResult<TextRange> {
  const opened = openRecord(cursor, "TextRange");
  if (opened.kind === "invalid-text") return opened;
  const pos = readField(cursor, opened.value, "pos", readNumber);
  if (pos.kind === "invalid-text") return pos;
  const end = readField(cursor, opened.value, "end", readNumber);
  if (end.kind === "invalid-text") return end;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { pos: pos.value, end: end.value } };
}

export function readCommentRange(cursor: Cursor): TextParseResult<CommentRange> {
  const kind = choice(cursor, ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]);
  if (kind.kind === "invalid-text") return kind;
  const opening = delimiter(cursor, "(");
  if (opening.kind === "invalid-text") return opening;
  const fields: RecordFields = { given: new Set<string>() };
  const pos = readField(cursor, fields, "pos", readNumber);
  if (pos.kind === "invalid-text") return pos;
  const end = readField(cursor, fields, "end", readNumber);
  if (end.kind === "invalid-text") return end;
  const hasTrailingNewLine = readField(cursor, fields, "hasTrailingNewLine", readBoolean);
  if (hasTrailingNewLine.kind === "invalid-text") return hasTrailingNewLine;
  const closing = closeRecord(cursor, fields);
  return closing.kind === "invalid-text" ? closing : {
    kind: "parsed", value: { kind: kind.value, pos: pos.value, end: end.value, hasTrailingNewLine: hasTrailingNewLine.value },
  };
}

export function readCommentDirective(cursor: Cursor): TextParseResult<CommentDirective> {
  const kind = choice(cursor, ["Unknown", "ExpectError", "Ignore"]);
  if (kind.kind === "invalid-text") return kind;
  const opening = delimiter(cursor, "(");
  if (opening.kind === "invalid-text") return opening;
  const fields: RecordFields = { given: new Set<string>() };
  const loc = readField(cursor, fields, "loc", readTextRange);
  if (loc.kind === "invalid-text") return loc;
  const closing = closeRecord(cursor, fields);
  return closing.kind === "invalid-text" ? closing : { kind: "parsed", value: { kind: kind.value, loc: loc.value } };
}

export function readPragmaArgument(cursor: Cursor): TextParseResult<PragmaArgument> {
  const opening = openRecord(cursor, "PragmaArgument");
  if (opening.kind === "invalid-text") return opening;
  const pos = readField(cursor, opening.value, "pos", readNumber);
  if (pos.kind === "invalid-text") return pos;
  const end = readField(cursor, opening.value, "end", readNumber);
  if (end.kind === "invalid-text") return end;
  const name = readField(cursor, opening.value, "name", readString);
  if (name.kind === "invalid-text") return name;
  const value = readField(cursor, opening.value, "value", readString);
  if (value.kind === "invalid-text") return value;
  const closing = closeRecord(cursor, opening.value);
  return closing.kind === "invalid-text" ? closing : {
    kind: "parsed", value: { pos: pos.value, end: end.value, name: name.value, value: value.value },
  };
}

export function readPragmaArguments(cursor: Cursor): TextParseResult<PragmaArguments> {
  const opening = openRecord(cursor, "PragmaArguments");
  if (opening.kind === "invalid-text") return opening;
  const result: { [name: string]: PragmaArgument } = {};
  let previous: string | null = null;
  while (true) {
    whitespace(cursor);
    if (cursor.text[cursor.offset] === ")") {
      cursor.offset += 1;
      return { kind: "parsed", value: result };
    }
    if (previous !== null) {
      const comma = delimiter(cursor, ",");
      if (comma.kind === "invalid-text") return comma;
    }
    whitespace(cursor);
    const offset = cursor.offset;
    let decoded: DecodedName;
    if (cursor.text[offset] === '"') decoded = quoted(cursor);
    else {
      if (!nameStart(cursor.text.charCodeAt(offset))) return invalid(cursor, offset, ["pragma key"]);
      const positions: number[] = [];
      while (namePart(cursor.text.charCodeAt(cursor.offset))) { positions.push(cursor.offset); cursor.offset += 1; }
      decoded = { value: cursor.text.substring(offset, cursor.offset), positions, end: cursor.offset, fault: null };
    }
    if (previous !== null) {
      let common = 0;
      while (common < previous.length && common < decoded.value.length && previous[common] === decoded.value[common]) common += 1;
      const position = decoded.positions[common] ?? decoded.end;
      const provedLess = common < previous.length && common < decoded.value.length
        && decoded.value.charCodeAt(common) < previous.charCodeAt(common);
      if ((decoded.fault === null && decoded.value <= previous) || (provedLess && decoded.fault !== null && position < decoded.fault.offset)) {
        return invalid(cursor, position, [decoded.fault === null && decoded.value === previous ? "unique pragma key" : "pragma key in UTF-16 order"]);
      }
    }
    if (decoded.fault !== null) return invalid(cursor, decoded.fault.offset, decoded.fault.expected);
    const equals = delimiter(cursor, "=");
    if (equals.kind === "invalid-text") return equals;
    const argument = readPragmaArgument(cursor);
    if (argument.kind === "invalid-text") return argument;
    Object.defineProperty(result, decoded.value, { value: argument.value, enumerable: true, configurable: true, writable: true });
    previous = decoded.value;
  }
}

export function readPragma(cursor: Cursor): TextParseResult<Pragma> {
  const kind = choice(cursor, ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]);
  if (kind.kind === "invalid-text") return kind;
  const opening = delimiter(cursor, "(");
  if (opening.kind === "invalid-text") return opening;
  const fields: RecordFields = { given: new Set<string>() };
  const pos = readField(cursor, fields, "pos", readNumber);
  if (pos.kind === "invalid-text") return pos;
  const end = readField(cursor, fields, "end", readNumber);
  if (end.kind === "invalid-text") return end;
  const hasTrailingNewLine = readField(cursor, fields, "hasTrailingNewLine", readBoolean);
  if (hasTrailingNewLine.kind === "invalid-text") return hasTrailingNewLine;
  const name = readField(cursor, fields, "name", readString);
  if (name.kind === "invalid-text") return name;
  const args = readField(cursor, fields, "args", readPragmaArguments);
  if (args.kind === "invalid-text") return args;
  const closing = closeRecord(cursor, fields);
  return closing.kind === "invalid-text" ? closing : { kind: "parsed", value: {
    kind: kind.value, pos: pos.value, end: end.value, hasTrailingNewLine: hasTrailingNewLine.value, name: name.value, args: args.value,
  } };
}

export function readCheckJsDirective(cursor: Cursor): TextParseResult<CheckJsDirective> {
  const opening = openRecord(cursor, "CheckJsDirective");
  if (opening.kind === "invalid-text") return opening;
  const enabled = readField(cursor, opening.value, "enabled", readBoolean);
  if (enabled.kind === "invalid-text") return enabled;
  const range = readField(cursor, opening.value, "range", readCommentRange);
  if (range.kind === "invalid-text") return range;
  const closing = closeRecord(cursor, opening.value);
  return closing.kind === "invalid-text" ? closing : { kind: "parsed", value: { enabled: enabled.value, range: range.value } };
}

export function readSyntaxHeader<Root>(
  cursor: Cursor,
  fields: RecordFields,
  finish: (value: NodeHeader) => TextStep<Root>,
): TextStep<Root> {
  return fieldText<NodeId, Root>(cursor, fields, "id", (next, done) => atomicText(next, readNodeId, done), id =>
    fieldText<Origin, Root>(cursor, fields, "origin", (next, done) => atomicText(next, readOrigin, done), origin =>
      fieldText<NodeId | null, Root>(cursor, fields, "parent", (next, done) => atomicText(next, cursor => nullable(cursor, readNodeId), done), parent =>
        fieldText<readonly SyntaxFlag[], Root>(cursor, fields, "flags", (next, done) => arrayText(next,
          (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["Let","Const","Using","OptionalChain","DisallowInContext","YieldContext","DecoratorContext","AwaitContext","DisallowConditionalTypesContext","ThisNodeHasError","JavaScriptFile","ThisNodeOrAnySubNodesHasError","HasJSDoc","JSDoc","Ambient","InWithStatement","JsonFile","IdentifierHasExtendedUnicodeEscape","IdentifierIsInJSDocNamespace","NestedNamespace","AwaitUsing"]), done), done), flags =>
          fieldText<TextRange, Root>(cursor, fields, "loc", (next, done) => atomicText(next, readTextRange, done), loc =>
            acceptText({ id, origin, parent, flags, loc }, finish))))));
}
