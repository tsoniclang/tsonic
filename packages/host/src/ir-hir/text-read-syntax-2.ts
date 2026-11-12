import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup2(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["Identifier", accept => syntaxRecord<Hir.Identifier<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedName>(() => [readers().record_254, readers().record_255, readers().record_256, readers().record_257, readers().record_258, readers().record_259, readers().record_260, readers().record_261]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic], value: () => ({ kind: "Identifier", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "Identifier", value }), accept)],
    ["IfStatement", accept => syntaxRecord<Hir.IfStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_thenStatement = read("thenStatement", readers().syntax_15);
      const field_elseStatement = read("elseStatement", unionReader<Hir.Statement<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_15]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_thenStatement, field_elseStatement, field_tsonic], value: () => ({ kind: "IfStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), thenStatement: field_thenStatement.value(), elseStatement: field_elseStatement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "IfStatement", value }), accept)],
    ["ImportAttribute", accept => syntaxRecord<Hir.ImportAttribute<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_34);
      const field_value = read("value", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_239);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_value, field_tsonic], value: () => ({ kind: "ImportAttribute", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), value: field_value.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportAttribute", value }), accept)],
    ["ImportAttributes", accept => syntaxRecord<Hir.ImportAttributes<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_token = read("token", readers().literal_122);
      const field_attributes = read("attributes", readers().record_262);
      const field_multiLine = read("multiLine", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_token, field_attributes, field_multiLine, field_tsonic], value: () => ({ kind: "ImportAttributes", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), token: field_token.value(), attributes: field_attributes.value(), multiLine: field_multiLine.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportAttributes", value }), accept)],
    ["ImportClause", accept => syntaxRecord<Hir.ImportClause<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_phaseModifier = read("phaseModifier", unionReader<Hir.ImportPhaseModifierSyntaxKind | null>(() => [readers().scalar_null, readers().literal_123, readers().literal_124]));
      const field_name = read("name", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_namedBindings = read("namedBindings", unionReader<Hir.NamedImportBindings<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_36]));
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_phaseModifier, field_name, field_namedBindings, field_tsonic], value: () => ({ kind: "ImportClause", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), phaseModifier: field_phaseModifier.value(), name: field_name.value(), namedBindings: field_namedBindings.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportClause", value }), accept)],
    ["ImportDeclaration", accept => syntaxRecord<Hir.ImportDeclaration<Hir.CheckedPhase, "ImportDeclaration" | "JSImportDeclaration"> & { readonly kind: "ImportDeclaration" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_importClause = read("importClause", unionReader<Hir.ImportClause<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_37]));
      const field_moduleSpecifier = read("moduleSpecifier", readers().syntax_2);
      const field_attributes = read("attributes", unionReader<Hir.ImportAttributes<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_29]));
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_importClause, field_moduleSpecifier, field_attributes, field_tsonic], value: () => ({ kind: "ImportDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), importClause: field_importClause.value(), moduleSpecifier: field_moduleSpecifier.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportDeclaration", value }), accept)],
    ["JSImportDeclaration", accept => syntaxRecord<Hir.ImportDeclaration<Hir.CheckedPhase, "ImportDeclaration" | "JSImportDeclaration"> & { readonly kind: "JSImportDeclaration" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_importClause = read("importClause", unionReader<Hir.ImportClause<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_37]));
      const field_moduleSpecifier = read("moduleSpecifier", readers().syntax_2);
      const field_attributes = read("attributes", unionReader<Hir.ImportAttributes<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_29]));
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_importClause, field_moduleSpecifier, field_attributes, field_tsonic], value: () => ({ kind: "JSImportDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), importClause: field_importClause.value(), moduleSpecifier: field_moduleSpecifier.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSImportDeclaration", value }), accept)],
    ["ImportEqualsDeclaration", accept => syntaxRecord<Hir.ImportEqualsDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_isTypeOnly = read("isTypeOnly", readers().scalar_boolean);
      const field_name = read("name", readers().syntax_16);
      const field_moduleReference = read("moduleReference", readers().syntax_38);
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isTypeOnly, field_name, field_moduleReference, field_tsonic], value: () => ({ kind: "ImportEqualsDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), isTypeOnly: field_isTypeOnly.value(), name: field_name.value(), moduleReference: field_moduleReference.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportEqualsDeclaration", value }), accept)],
    ["ImportSpecifier", accept => syntaxRecord<Hir.ImportSpecifier<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_isTypeOnly = read("isTypeOnly", readers().scalar_boolean);
      const field_propertyName = read("propertyName", unionReader<Hir.ModuleExportName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_30]));
      const field_name = read("name", readers().syntax_16);
      const field_tsonic = read("tsonic", readers().record_263);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_isTypeOnly, field_propertyName, field_name, field_tsonic], value: () => ({ kind: "ImportSpecifier", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), isTypeOnly: field_isTypeOnly.value(), propertyName: field_propertyName.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportSpecifier", value }), accept)],
    ["ImportType", accept => syntaxRecord<Hir.ImportTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_isTypeOf = read("isTypeOf", readers().scalar_boolean);
      const field_argument = read("argument", readers().syntax_3);
      const field_attributes = read("attributes", unionReader<Hir.ImportAttributes<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_29]));
      const field_qualifier = read("qualifier", unionReader<Hir.EntityName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_39]));
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_isTypeOf, field_argument, field_attributes, field_qualifier, field_tsonic], value: () => ({ kind: "ImportType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeArguments: field_typeArguments.value(), isTypeOf: field_isTypeOf.value(), argument: field_argument.value(), attributes: field_attributes.value(), qualifier: field_qualifier.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ImportType", value }), accept)],
    ["IndexSignature", accept => syntaxRecord<Hir.IndexSignatureDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "IndexSignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "IndexSignature", value }), accept)],
    ["IndexedAccessType", accept => syntaxRecord<Hir.IndexedAccessTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_objectType = read("objectType", readers().syntax_3);
      const field_indexType = read("indexType", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_objectType, field_indexType, field_tsonic], value: () => ({ kind: "IndexedAccessType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), objectType: field_objectType.value(), indexType: field_indexType.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "IndexedAccessType", value }), accept)],
    ["InferType", accept => syntaxRecord<Hir.InferTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeParameter = read("typeParameter", readers().syntax_5);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameter, field_tsonic], value: () => ({ kind: "InferType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeParameter: field_typeParameter.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "InferType", value }), accept)],
    ["InterfaceDeclaration", accept => syntaxRecord<Hir.InterfaceDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_heritageClauses = read("heritageClauses", unionReader<Hir.NodeList<Hir.HeritageClause<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_233]));
      const field_members = read("members", readers().record_265);
      const field_tsonic = read("tsonic", readers().record_235);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic], value: () => ({ kind: "InterfaceDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), typeParameters: field_typeParameters.value(), heritageClauses: field_heritageClauses.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "InterfaceDeclaration", value }), accept)],
    ["IntersectionType", accept => syntaxRecord<Hir.IntersectionTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_types = read("types", readers().record_217);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_types, field_tsonic], value: () => ({ kind: "IntersectionType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), types: field_types.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "IntersectionType", value }), accept)],
    ["JSDoc", accept => syntaxRecord<Hir.JSDoc<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_comment = read("comment", readers().record_266);
      const field_tags = read("tags", unionReader<Hir.NodeList<Hir.JSDocTag<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_267]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_comment, field_tags, field_tsonic], value: () => ({ kind: "JSDoc", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), comment: field_comment.value(), tags: field_tags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDoc", value }), accept)],
    ["JSDocAllType", accept => syntaxRecord<Hir.JSDocAllType<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "JSDocAllType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocAllType", value }), accept)],
    ["JSDocAugmentsTag", accept => syntaxRecord<Hir.JSDocAugmentsTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_className = read("className", readers().syntax_33);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_className, field_tsonic], value: () => ({ kind: "JSDocAugmentsTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), className: field_className.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocAugmentsTag", value }), accept)],
    ["JSDocCallbackTag", accept => syntaxRecord<Hir.JSDocCallbackTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", readers().syntax_3);
      const field_name = read("name", unionReader<Hir.JSDocFullName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_43]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_name, field_tsonic], value: () => ({ kind: "JSDocCallbackTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocCallbackTag", value }), accept)],
    ["JSDocDeprecatedTag", accept => syntaxRecord<Hir.JSDocDeprecatedTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocDeprecatedTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocDeprecatedTag", value }), accept)],
    ["JSDocImplementsTag", accept => syntaxRecord<Hir.JSDocImplementsTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_className = read("className", readers().syntax_33);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_className, field_tsonic], value: () => ({ kind: "JSDocImplementsTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), className: field_className.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocImplementsTag", value }), accept)],
    ["JSDocImportTag", accept => syntaxRecord<Hir.JSDocImportTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_importClause = read("importClause", unionReader<Hir.ImportClause<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_37]));
      const field_moduleSpecifier = read("moduleSpecifier", readers().syntax_2);
      const field_attributes = read("attributes", unionReader<Hir.ImportAttributes<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_29]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_importClause, field_moduleSpecifier, field_attributes, field_tsonic], value: () => ({ kind: "JSDocImportTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), importClause: field_importClause.value(), moduleSpecifier: field_moduleSpecifier.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocImportTag", value }), accept)],
    ["JSDocLink", accept => syntaxRecord<Hir.JSDocLink<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", sequenceReader(readers().scalar_string));
      const field_name = read("name", unionReader<Hir.EntityName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_39]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic], value: () => ({ kind: "JSDocLink", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocLink", value }), accept)],
    ["JSDocLinkCode", accept => syntaxRecord<Hir.JSDocLinkCode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", sequenceReader(readers().scalar_string));
      const field_name = read("name", unionReader<Hir.EntityName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_39]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic], value: () => ({ kind: "JSDocLinkCode", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocLinkCode", value }), accept)],
    ["JSDocLinkPlain", accept => syntaxRecord<Hir.JSDocLinkPlain<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", sequenceReader(readers().scalar_string));
      const field_name = read("name", unionReader<Hir.EntityName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_39]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic], value: () => ({ kind: "JSDocLinkPlain", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocLinkPlain", value }), accept)],
  ]);
}
