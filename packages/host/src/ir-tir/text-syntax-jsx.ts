import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedPhase
} from "./contract.js";
import type {
  Origin
} from "../ids/contract.js";
import type {
  JsxAttribute, JsxAttributeLike, JsxAttributes, JsxChild, JsxClosingElement, JsxClosingFragment, JsxElement, JsxExpression, JsxFragment, JsxNamespacedName, JsxOpeningElement, JsxOpeningFragment, JsxSelfClosingElement, JsxSpreadAttribute, JsxText, NodeList, TextRange, TypeNode
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface SyntaxJsxTextReads {
  readonly work_L_TypeNode_: TirRecordCodec<NodeList<TypeNode<TypedPhase>>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
}

export interface SyntaxJsxTextModel {
  readonly work_JsxElement: (value: JsxElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxAttributes: (value: JsxAttributes<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxNamespacedName: (value: JsxNamespacedName<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxOpeningElement: (value: JsxOpeningElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxSelfClosingElement: (value: JsxSelfClosingElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxFragment: (value: JsxFragment<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxOpeningFragment: (value: JsxOpeningFragment<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxClosingFragment: (value: JsxClosingFragment<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxAttribute: (value: JsxAttribute<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxSpreadAttribute: (value: JsxSpreadAttribute<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxClosingElement: (value: JsxClosingElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxExpression: (value: JsxExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_JsxText: (value: JsxText<TypedPhase>) => TirTypedRecordWork;
  readonly work_L_JsxChild_: TirRecordCodec<NodeList<JsxChild<TypedPhase>>>;
  readonly work_L_JsxAttributeLike_: TirRecordCodec<NodeList<JsxAttributeLike<TypedPhase>>>;
}

export const createSyntaxJsxText = (kernel: TirTextKernel, read: SyntaxJsxTextReads): SyntaxJsxTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, booleanReader, nullReader, stringReader } = kernel;
  const work_JsxElement: (value: JsxElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxElement<TypedPhase>>("JsxElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxElement", literalReader<(JsxElement<TypedPhase>)["kind"]>("'JsxElement", ["JsxElement"]))
    .field("openingElement", "$JsxOpeningElement", value => syntaxReference("$JsxOpeningElement", value.openingElement), syntaxReads.JsxOpeningElement)
    .field("children", "L<JsxChild>", value => work_L_JsxChild_.write(value.children), lazyReader(() => work_L_JsxChild_.reader))
    .field("closingElement", "$JsxClosingElement", value => syntaxReference("$JsxClosingElement", value.closingElement), syntaxReads.JsxClosingElement)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_openingElement, field_children, field_closingElement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, openingElement: field_openingElement, children: field_children, closingElement: field_closingElement,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JsxAttributes: (value: JsxAttributes<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxAttributes<TypedPhase>>("JsxAttributes", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxAttributes", literalReader<(JsxAttributes<TypedPhase>)["kind"]>("'JsxAttributes", ["JsxAttributes"]))
    .field("properties", "L<JsxAttributeLike>", value => work_L_JsxAttributeLike_.write(value.properties), lazyReader(() => work_L_JsxAttributeLike_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_properties, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, properties: field_properties, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JsxNamespacedName: (value: JsxNamespacedName<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxNamespacedName<TypedPhase>>("JsxNamespacedName", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxNamespacedName", literalReader<(JsxNamespacedName<TypedPhase>)["kind"]>("'JsxNamespacedName", ["JsxNamespacedName"]))
    .field("namespace", "$Identifier", value => syntaxReference("$Identifier", value.namespace), syntaxReads.Identifier)
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_namespace, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, namespace: field_namespace, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JsxOpeningElement: (value: JsxOpeningElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxOpeningElement<TypedPhase>>("JsxOpeningElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxOpeningElement", literalReader<(JsxOpeningElement<TypedPhase>)["kind"]>("'JsxOpeningElement", ["JsxOpeningElement"]))
    .field("tagName", "$JsxTagNameExpression", value => syntaxReference("$JsxTagNameExpression", value.tagName), syntaxReads.JsxTagNameExpression)
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("attributes", "$JsxAttributes", value => syntaxReference("$JsxAttributes", value.attributes), syntaxReads.JsxAttributes)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_typeArguments, field_attributes, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, typeArguments: field_typeArguments, attributes: field_attributes,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JsxSelfClosingElement: (value: JsxSelfClosingElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxSelfClosingElement<TypedPhase>>("JsxSelfClosingElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxSelfClosingElement", literalReader<(JsxSelfClosingElement<TypedPhase>)["kind"]>("'JsxSelfClosingElement", ["JsxSelfClosingElement"]))
    .field("tagName", "$JsxTagNameExpression", value => syntaxReference("$JsxTagNameExpression", value.tagName), syntaxReads.JsxTagNameExpression)
    .field("typeArguments", "?L<TypeNode>", value => nullableWork(value.typeArguments, actual => read.work_L_TypeNode_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeNode_.reader)))
    .field("attributes", "$JsxAttributes", value => syntaxReference("$JsxAttributes", value.attributes), syntaxReads.JsxAttributes)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_typeArguments, field_attributes, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, typeArguments: field_typeArguments, attributes: field_attributes,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JsxFragment: (value: JsxFragment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxFragment<TypedPhase>>("JsxFragment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxFragment", literalReader<(JsxFragment<TypedPhase>)["kind"]>("'JsxFragment", ["JsxFragment"]))
    .field("openingFragment", "$JsxOpeningFragment", value => syntaxReference("$JsxOpeningFragment", value.openingFragment), syntaxReads.JsxOpeningFragment)
    .field("children", "L<JsxChild>", value => work_L_JsxChild_.write(value.children), lazyReader(() => work_L_JsxChild_.reader))
    .field("closingFragment", "$JsxClosingFragment", value => syntaxReference("$JsxClosingFragment", value.closingFragment), syntaxReads.JsxClosingFragment)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_openingFragment, field_children, field_closingFragment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, openingFragment: field_openingFragment, children: field_children,
      closingFragment: field_closingFragment, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JsxOpeningFragment: (value: JsxOpeningFragment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxOpeningFragment<TypedPhase>>("JsxOpeningFragment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxOpeningFragment", literalReader<(JsxOpeningFragment<TypedPhase>)["kind"]>("'JsxOpeningFragment", ["JsxOpeningFragment"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JsxClosingFragment: (value: JsxClosingFragment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxClosingFragment<TypedPhase>>("JsxClosingFragment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxClosingFragment", literalReader<(JsxClosingFragment<TypedPhase>)["kind"]>("'JsxClosingFragment", ["JsxClosingFragment"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JsxAttribute: (value: JsxAttribute<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxAttribute<TypedPhase>>("JsxAttribute", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxAttribute", literalReader<(JsxAttribute<TypedPhase>)["kind"]>("'JsxAttribute", ["JsxAttribute"]))
    .field("name", "$JsxAttributeName", value => syntaxReference("$JsxAttributeName", value.name), syntaxReads.JsxAttributeName)
    .field("initializer", "?$JsxAttributeValue", value => nullableWork(value.initializer, actual => syntaxReference("$JsxAttributeValue", actual)), nullableReader(syntaxReads.JsxAttributeValue))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JsxSpreadAttribute: (value: JsxSpreadAttribute<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxSpreadAttribute<TypedPhase>>("JsxSpreadAttribute", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxSpreadAttribute", literalReader<(JsxSpreadAttribute<TypedPhase>)["kind"]>("'JsxSpreadAttribute", ["JsxSpreadAttribute"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JsxClosingElement: (value: JsxClosingElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxClosingElement<TypedPhase>>("JsxClosingElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxClosingElement", literalReader<(JsxClosingElement<TypedPhase>)["kind"]>("'JsxClosingElement", ["JsxClosingElement"]))
    .field("tagName", "$JsxTagNameExpression", value => syntaxReference("$JsxTagNameExpression", value.tagName), syntaxReads.JsxTagNameExpression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JsxExpression: (value: JsxExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxExpression<TypedPhase>>("JsxExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxExpression", literalReader<(JsxExpression<TypedPhase>)["kind"]>("'JsxExpression", ["JsxExpression"]))
    .field("dotDotDotToken", "?$DotDotDotToken", value => nullableWork(value.dotDotDotToken, actual => syntaxReference("$DotDotDotToken", actual)), nullableReader(syntaxReads.DotDotDotToken))
    .field("expression", "?$Expression", value => nullableWork(value.expression, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, dotDotDotToken: field_dotDotDotToken, expression: field_expression, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_JsxText: (value: JsxText<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JsxText<TypedPhase>>("JsxText", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JsxText", literalReader<(JsxText<TypedPhase>)["kind"]>("'JsxText", ["JsxText"]))
    .field("text", "string", value => scalarWork("string", value.text), stringReader)
    .field("tokenFlags", "[TokenFlag]", value => sequenceWork("[TokenFlag]", value.tokenFlags, actual => scalarWork("TokenFlag", actual)), sequenceReader("[TokenFlag]", literalReader<((JsxText<TypedPhase>)["tokenFlags"])[number]>("TokenFlag", ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"])))
    .field("containsOnlyTriviaWhiteSpaces", "boolean", value => scalarWork("boolean", value.containsOnlyTriviaWhiteSpaces), booleanReader)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_containsOnlyTriviaWhiteSpaces, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tokenFlags: field_tokenFlags,
      containsOnlyTriviaWhiteSpaces: field_containsOnlyTriviaWhiteSpaces, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_L_JsxChild_: TirRecordCodec<NodeList<JsxChild<TypedPhase>>> = defineRecord<NodeList<JsxChild<TypedPhase>>>("L<JsxChild>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$JsxChild]", value => sequenceWork("[$JsxChild]", value.nodes, actual => syntaxReference("$JsxChild", actual)), sequenceReader("[$JsxChild]", syntaxReads.JsxChild))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_JsxAttributeLike_: TirRecordCodec<NodeList<JsxAttributeLike<TypedPhase>>> = defineRecord<NodeList<JsxAttributeLike<TypedPhase>>>("L<JsxAttributeLike>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$JsxAttributeLike]", value => sequenceWork("[$JsxAttributeLike]", value.nodes, actual => syntaxReference("$JsxAttributeLike", actual)), sequenceReader("[$JsxAttributeLike]", syntaxReads.JsxAttributeLike))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  return { work_JsxElement, work_JsxAttributes, work_JsxNamespacedName, work_JsxOpeningElement, work_JsxSelfClosingElement, work_JsxFragment, work_JsxOpeningFragment, work_JsxClosingFragment, work_JsxAttribute, work_JsxSpreadAttribute, work_JsxClosingElement, work_JsxExpression, work_JsxText, work_L_JsxChild_, work_L_JsxAttributeLike_ };
};
