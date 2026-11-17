import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup7(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["SourceFile", accept => syntaxRecord<Hir.SourceFile<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statements = read("statements", readers().record_216);
      const field_endOfFileToken = read("endOfFileToken", readers().syntax_65);
      const field_languageVariant = read("languageVariant", readers().literal_130);
      const field_scriptKind = read("scriptKind", readers().literal_131);
      const field_commentDirectives = read("commentDirectives", sequenceReader(unionReader<Hir.CommentDirective>(() => [readers().record_279, readers().record_280, readers().record_281])));
      const field_pragmas = read("pragmas", sequenceReader(unionReader<Hir.Pragma>(() => [readers().record_282, readers().record_284])));
      const field_checkJsDirective = read("checkJsDirective", unionReader<Hir.CheckJsDirective | null>(() => [readers().scalar_null, readers().record_285]));
      const field_tsonic = read("tsonic", readers().record_288);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_endOfFileToken, field_languageVariant, field_scriptKind, field_commentDirectives, field_pragmas, field_checkJsDirective, field_tsonic], value: () => ({ kind: "SourceFile", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statements: field_statements.value(), endOfFileToken: field_endOfFileToken.value(), languageVariant: field_languageVariant.value(), scriptKind: field_scriptKind.value(), commentDirectives: field_commentDirectives.value(), pragmas: field_pragmas.value(), checkJsDirective: field_checkJsDirective.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SourceFile", value }), accept)],
    ["SpreadAssignment", accept => syntaxRecord<Hir.SpreadAssignment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "SpreadAssignment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SpreadAssignment", value }), accept)],
    ["SpreadElement", accept => syntaxRecord<Hir.SpreadElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_184);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "SpreadElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SpreadElement", value }), accept)],
    ["StringLiteral", accept => syntaxRecord<Hir.StringLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedLiteral>(() => [readers().record_192, readers().record_199, readers().record_200, readers().record_202, readers().record_204, readers().record_206, readers().record_207]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic], value: () => ({ kind: "StringLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "StringLiteral", value }), accept)],
    ["SwitchStatement", accept => syntaxRecord<Hir.SwitchStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_caseBlock = read("caseBlock", readers().syntax_66);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_caseBlock, field_tsonic], value: () => ({ kind: "SwitchStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), caseBlock: field_caseBlock.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SwitchStatement", value }), accept)],
    ["SyntaxList", accept => syntaxRecord<Hir.SyntaxList<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_children = read("children", sequenceReader(readers().syntax_44));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_children, field_tsonic], value: () => ({ kind: "SyntaxList", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), children: field_children.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SyntaxList", value }), accept)],
    ["SyntheticReferenceExpression", accept => syntaxRecord<Hir.SyntheticReferenceExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_thisArg = read("thisArg", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_thisArg, field_tsonic], value: () => ({ kind: "SyntheticReferenceExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), thisArg: field_thisArg.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SyntheticReferenceExpression", value }), accept)],
    ["TaggedTemplateExpression", accept => syntaxRecord<Hir.TaggedTemplateExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tag = read("tag", readers().syntax_2);
      const field_questionDotToken = read("questionDotToken", unionReader<Hir.QuestionDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_17]));
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_template = read("template", readers().syntax_67);
      const field_tsonic = read("tsonic", readers().record_218);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tag, field_questionDotToken, field_typeArguments, field_template, field_tsonic], value: () => ({ kind: "TaggedTemplateExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tag: field_tag.value(), questionDotToken: field_questionDotToken.value(), typeArguments: field_typeArguments.value(), template: field_template.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TaggedTemplateExpression", value }), accept)],
    ["TemplateExpression", accept => syntaxRecord<Hir.TemplateExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_head = read("head", readers().syntax_68);
      const field_templateSpans = read("templateSpans", readers().record_289);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_head, field_templateSpans, field_tsonic], value: () => ({ kind: "TemplateExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), head: field_head.value(), templateSpans: field_templateSpans.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateExpression", value }), accept)],
    ["TemplateHead", accept => syntaxRecord<Hir.TemplateHead<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_rawText = read("rawText", readers().scalar_string);
      const field_templateFlags = read("templateFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic], value: () => ({ kind: "TemplateHead", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), rawText: field_rawText.value(), templateFlags: field_templateFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateHead", value }), accept)],
    ["TemplateLiteralType", accept => syntaxRecord<Hir.TemplateLiteralTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_head = read("head", readers().syntax_68);
      const field_templateSpans = read("templateSpans", readers().record_290);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_head, field_templateSpans, field_tsonic], value: () => ({ kind: "TemplateLiteralType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), head: field_head.value(), templateSpans: field_templateSpans.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateLiteralType", value }), accept)],
    ["TemplateLiteralTypeSpan", accept => syntaxRecord<Hir.TemplateLiteralTypeSpan<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_literal = read("literal", readers().syntax_71);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_literal, field_tsonic], value: () => ({ kind: "TemplateLiteralTypeSpan", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), literal: field_literal.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateLiteralTypeSpan", value }), accept)],
    ["TemplateMiddle", accept => syntaxRecord<Hir.TemplateMiddle<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_rawText = read("rawText", readers().scalar_string);
      const field_templateFlags = read("templateFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic], value: () => ({ kind: "TemplateMiddle", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), rawText: field_rawText.value(), templateFlags: field_templateFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateMiddle", value }), accept)],
    ["TemplateSpan", accept => syntaxRecord<Hir.TemplateSpan<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_literal = read("literal", readers().syntax_71);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_literal, field_tsonic], value: () => ({ kind: "TemplateSpan", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), literal: field_literal.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateSpan", value }), accept)],
    ["TemplateTail", accept => syntaxRecord<Hir.TemplateTail<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_rawText = read("rawText", readers().scalar_string);
      const field_templateFlags = read("templateFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic], value: () => ({ kind: "TemplateTail", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), rawText: field_rawText.value(), templateFlags: field_templateFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TemplateTail", value }), accept)],
    ["ThisType", accept => syntaxRecord<Hir.ThisTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ThisType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ThisType", value }), accept)],
    ["ThrowStatement", accept => syntaxRecord<Hir.ThrowStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ThrowStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ThrowStatement", value }), accept)],
    ["AbstractKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AbstractKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AbstractKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AbstractKeyword", value }), accept)],
    ["AccessorKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AccessorKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AccessorKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AccessorKeyword", value }), accept)],
    ["AmpersandAmpersandEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandAmpersandEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AmpersandAmpersandEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AmpersandAmpersandEqualsToken", value }), accept)],
    ["AmpersandAmpersandToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandAmpersandToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AmpersandAmpersandToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AmpersandAmpersandToken", value }), accept)],
    ["AmpersandEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AmpersandEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AmpersandEqualsToken", value }), accept)],
    ["AmpersandToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AmpersandToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AmpersandToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AmpersandToken", value }), accept)],
    ["AsKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AsKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AsKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AsKeyword", value }), accept)],
    ["AssertKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "AssertKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "AssertKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AssertKeyword", value }), accept)],
  ]);
}
