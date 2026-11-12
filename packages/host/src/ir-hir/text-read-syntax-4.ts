import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup4(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["JSDocVariadicType", accept => syntaxRecord<Hir.JSDocVariadicType<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "JSDocVariadicType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocVariadicType", value }), accept)],
    ["JsxAttribute", accept => syntaxRecord<Hir.JsxAttribute<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_45);
      const field_initializer = read("initializer", unionReader<Hir.JsxAttributeValue<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_46]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_initializer, field_tsonic], value: () => ({ kind: "JsxAttribute", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxAttribute", value }), accept)],
    ["JsxAttributes", accept => syntaxRecord<Hir.JsxAttributes<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_properties = read("properties", readers().record_268);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_properties, field_tsonic], value: () => ({ kind: "JsxAttributes", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), properties: field_properties.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxAttributes", value }), accept)],
    ["JsxClosingElement", accept => syntaxRecord<Hir.JsxClosingElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_48);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_tsonic], value: () => ({ kind: "JsxClosingElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxClosingElement", value }), accept)],
    ["JsxClosingFragment", accept => syntaxRecord<Hir.JsxClosingFragment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "JsxClosingFragment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxClosingFragment", value }), accept)],
    ["JsxElement", accept => syntaxRecord<Hir.JsxElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_openingElement = read("openingElement", readers().syntax_49);
      const field_children = read("children", readers().record_269);
      const field_closingElement = read("closingElement", readers().syntax_51);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_openingElement, field_children, field_closingElement, field_tsonic], value: () => ({ kind: "JsxElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), openingElement: field_openingElement.value(), children: field_children.value(), closingElement: field_closingElement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxElement", value }), accept)],
    ["JsxExpression", accept => syntaxRecord<Hir.JsxExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_dotDotDotToken = read("dotDotDotToken", unionReader<Hir.DotDotDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_11]));
      const field_expression = read("expression", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_expression, field_tsonic], value: () => ({ kind: "JsxExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), dotDotDotToken: field_dotDotDotToken.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxExpression", value }), accept)],
    ["JsxFragment", accept => syntaxRecord<Hir.JsxFragment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_openingFragment = read("openingFragment", readers().syntax_52);
      const field_children = read("children", readers().record_269);
      const field_closingFragment = read("closingFragment", readers().syntax_53);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_openingFragment, field_children, field_closingFragment, field_tsonic], value: () => ({ kind: "JsxFragment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), openingFragment: field_openingFragment.value(), children: field_children.value(), closingFragment: field_closingFragment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxFragment", value }), accept)],
    ["JsxNamespacedName", accept => syntaxRecord<Hir.JsxNamespacedName<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_namespace = read("namespace", readers().syntax_16);
      const field_name = read("name", readers().syntax_16);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_namespace, field_name, field_tsonic], value: () => ({ kind: "JsxNamespacedName", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), namespace: field_namespace.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxNamespacedName", value }), accept)],
    ["JsxOpeningElement", accept => syntaxRecord<Hir.JsxOpeningElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_48);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_attributes = read("attributes", readers().syntax_54);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_typeArguments, field_attributes, field_tsonic], value: () => ({ kind: "JsxOpeningElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), typeArguments: field_typeArguments.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxOpeningElement", value }), accept)],
    ["JsxOpeningFragment", accept => syntaxRecord<Hir.JsxOpeningFragment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "JsxOpeningFragment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxOpeningFragment", value }), accept)],
    ["JsxSelfClosingElement", accept => syntaxRecord<Hir.JsxSelfClosingElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_48);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_attributes = read("attributes", readers().syntax_54);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_typeArguments, field_attributes, field_tsonic], value: () => ({ kind: "JsxSelfClosingElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), typeArguments: field_typeArguments.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxSelfClosingElement", value }), accept)],
    ["JsxSpreadAttribute", accept => syntaxRecord<Hir.JsxSpreadAttribute<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "JsxSpreadAttribute", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxSpreadAttribute", value }), accept)],
    ["JsxText", accept => syntaxRecord<Hir.JsxText<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_containsOnlyTriviaWhiteSpaces = read("containsOnlyTriviaWhiteSpaces", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_containsOnlyTriviaWhiteSpaces, field_tsonic], value: () => ({ kind: "JsxText", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), containsOnlyTriviaWhiteSpaces: field_containsOnlyTriviaWhiteSpaces.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JsxText", value }), accept)],
    ["FalseKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "FalseKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "FalseKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "FalseKeyword", value }), accept)],
    ["ImportKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "ImportKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ImportKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportKeyword", value }), accept)],
    ["NullKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "NullKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "NullKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NullKeyword", value }), accept)],
    ["SuperKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "SuperKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "SuperKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SuperKeyword", value }), accept)],
    ["ThisKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "ThisKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ThisKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ThisKeyword", value }), accept)],
    ["TrueKeyword", accept => syntaxRecord<Hir.KeywordExpression<Hir.CheckedPhase, Hir.KeywordExpressionSyntaxKind> & { readonly kind: "TrueKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedKeyword>(() => [readers().record_270, readers().record_271]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "TrueKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TrueKeyword", value }), accept)],
    ["AnyKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "AnyKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AnyKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AnyKeyword", value }), accept)],
    ["BigIntKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "BigIntKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "BigIntKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BigIntKeyword", value }), accept)],
    ["BooleanKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "BooleanKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "BooleanKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BooleanKeyword", value }), accept)],
    ["IntrinsicKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "IntrinsicKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "IntrinsicKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "IntrinsicKeyword", value }), accept)],
    ["NeverKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "NeverKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "NeverKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NeverKeyword", value }), accept)],
  ]);
}
