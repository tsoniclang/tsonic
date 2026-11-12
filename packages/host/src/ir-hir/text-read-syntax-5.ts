import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup5(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["NumberKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "NumberKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "NumberKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NumberKeyword", value }), accept)],
    ["ObjectKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "ObjectKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ObjectKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ObjectKeyword", value }), accept)],
    ["StringKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "StringKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "StringKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "StringKeyword", value }), accept)],
    ["SymbolKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "SymbolKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "SymbolKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SymbolKeyword", value }), accept)],
    ["UndefinedKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "UndefinedKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "UndefinedKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "UndefinedKeyword", value }), accept)],
    ["UnknownKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "UnknownKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "UnknownKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "UnknownKeyword", value }), accept)],
    ["VoidKeyword", accept => syntaxRecord<Hir.KeywordTypeNode<Hir.CheckedPhase, Hir.KeywordTypeSyntaxKind> & { readonly kind: "VoidKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "VoidKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VoidKeyword", value }), accept)],
    ["LabeledStatement", accept => syntaxRecord<Hir.LabeledStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_label = read("label", readers().syntax_16);
      const field_statement = read("statement", readers().syntax_15);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_statement, field_tsonic], value: () => ({ kind: "LabeledStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), label: field_label.value(), statement: field_statement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "LabeledStatement", value }), accept)],
    ["LiteralType", accept => syntaxRecord<Hir.LiteralTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_literal = read("literal", readers().syntax_55);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_literal, field_tsonic], value: () => ({ kind: "LiteralType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), literal: field_literal.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "LiteralType", value }), accept)],
    ["MappedType", accept => syntaxRecord<Hir.MappedTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_readonlyToken = read("readonlyToken", unionReader<Hir.MinusToken<Hir.CheckedPhase> | Hir.PlusToken<Hir.CheckedPhase> | Hir.ReadonlyKeyword<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_56]));
      const field_typeParameter = read("typeParameter", readers().syntax_5);
      const field_nameType = read("nameType", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_questionToken = read("questionToken", unionReader<Hir.MinusToken<Hir.CheckedPhase> | Hir.PlusToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_57]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_members = read("members", unionReader<Hir.NodeList<Hir.TypeElement<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_265]));
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_readonlyToken, field_typeParameter, field_nameType, field_questionToken, field_type, field_members, field_tsonic], value: () => ({ kind: "MappedType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), readonlyToken: field_readonlyToken.value(), typeParameter: field_typeParameter.value(), nameType: field_nameType.value(), questionToken: field_questionToken.value(), type: field_type.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "MappedType", value }), accept)],
    ["MetaProperty", accept => syntaxRecord<Hir.MetaProperty<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_keywordToken = read("keywordToken", readers().literal_125);
      const field_name = read("name", readers().syntax_16);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_keywordToken, field_name, field_tsonic], value: () => ({ kind: "MetaProperty", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), keywordToken: field_keywordToken.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "MetaProperty", value }), accept)],
    ["MethodDeclaration", accept => syntaxRecord<Hir.MethodDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_asteriskToken = read("asteriskToken", unionReader<Hir.AsteriskToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_7]));
      const field_body = read("body", unionReader<Hir.BlockOrExpression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_8]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic], value: () => ({ kind: "MethodDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "MethodDeclaration", value }), accept)],
    ["MethodSignature", accept => syntaxRecord<Hir.MethodSignatureDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "MethodSignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "MethodSignature", value }), accept)],
    ["MissingDeclaration", accept => syntaxRecord<Hir.MissingDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_tsonic], value: () => ({ kind: "MissingDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "MissingDeclaration", value }), accept)],
    ["ModuleBlock", accept => syntaxRecord<Hir.ModuleBlock<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statements = read("statements", readers().record_216);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_tsonic], value: () => ({ kind: "ModuleBlock", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statements: field_statements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ModuleBlock", value }), accept)],
    ["ModuleDeclaration", accept => syntaxRecord<Hir.ModuleDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_asteriskToken = read("asteriskToken", unionReader<Hir.AsteriskToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_7]));
      const field_body = read("body", unionReader<Hir.NodeBody<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_58]));
      const field_keyword = read("keyword", readers().literal_126);
      const field_name = read("name", readers().syntax_59);
      const field_tsonic = read("tsonic", readers().record_272);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_asteriskToken, field_body, field_keyword, field_name, field_tsonic], value: () => ({ kind: "ModuleDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), keyword: field_keyword.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ModuleDeclaration", value }), accept)],
    ["NamedExports", accept => syntaxRecord<Hir.NamedExports<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_273);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic], value: () => ({ kind: "NamedExports", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamedExports", value }), accept)],
    ["NamedImports", accept => syntaxRecord<Hir.NamedImports<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_274);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic], value: () => ({ kind: "NamedImports", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamedImports", value }), accept)],
    ["NamedTupleMember", accept => syntaxRecord<Hir.NamedTupleMember<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_dotDotDotToken = read("dotDotDotToken", unionReader<Hir.DotDotDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_11]));
      const field_name = read("name", readers().syntax_16);
      const field_questionToken = read("questionToken", unionReader<Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_23]));
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_name, field_questionToken, field_type, field_tsonic], value: () => ({ kind: "NamedTupleMember", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), dotDotDotToken: field_dotDotDotToken.value(), name: field_name.value(), questionToken: field_questionToken.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamedTupleMember", value }), accept)],
    ["NamespaceExport", accept => syntaxRecord<Hir.NamespaceExport<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_30);
      const field_tsonic = read("tsonic", readers().record_246);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic], value: () => ({ kind: "NamespaceExport", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamespaceExport", value }), accept)],
    ["NamespaceExportDeclaration", accept => syntaxRecord<Hir.NamespaceExportDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_tsonic = read("tsonic", readers().record_246);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_tsonic], value: () => ({ kind: "NamespaceExportDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamespaceExportDeclaration", value }), accept)],
    ["NamespaceImport", accept => syntaxRecord<Hir.NamespaceImport<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_16);
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic], value: () => ({ kind: "NamespaceImport", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NamespaceImport", value }), accept)],
    ["NewExpression", accept => syntaxRecord<Hir.NewExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_arguments = read("arguments", unionReader<Hir.NodeList<Hir.Expression<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_82]));
      const field_tsonic = read("tsonic", readers().record_218);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_typeArguments, field_arguments, field_tsonic], value: () => ({ kind: "NewExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), typeArguments: field_typeArguments.value(), arguments: field_arguments.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NewExpression", value }), accept)],
    ["NoSubstitutionTemplateLiteral", accept => syntaxRecord<Hir.NoSubstitutionTemplateLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_rawText = read("rawText", readers().scalar_string);
      const field_templateFlags = read("templateFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedLiteral>(() => [readers().record_192, readers().record_199, readers().record_200, readers().record_202, readers().record_204, readers().record_206, readers().record_207]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_rawText, field_templateFlags, field_tsonic], value: () => ({ kind: "NoSubstitutionTemplateLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), rawText: field_rawText.value(), templateFlags: field_templateFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NoSubstitutionTemplateLiteral", value }), accept)],
    ["NonNullExpression", accept => syntaxRecord<Hir.NonNullExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "NonNullExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NonNullExpression", value }), accept)],
  ]);
}
