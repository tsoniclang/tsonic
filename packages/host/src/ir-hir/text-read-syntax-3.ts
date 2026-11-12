import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup3(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["JSDocNameReference", accept => syntaxRecord<Hir.JSDocNameReference<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_39);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic], value: () => ({ kind: "JSDocNameReference", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocNameReference", value }), accept)],
    ["JSDocNonNullableType", accept => syntaxRecord<Hir.JSDocNonNullableType<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "JSDocNonNullableType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocNonNullableType", value }), accept)],
    ["JSDocNullableType", accept => syntaxRecord<Hir.JSDocNullableType<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "JSDocNullableType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocNullableType", value }), accept)],
    ["JSDocOptionalType", accept => syntaxRecord<Hir.JSDocOptionalType<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "JSDocOptionalType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocOptionalType", value }), accept)],
    ["JSDocOverloadTag", accept => syntaxRecord<Hir.JSDocOverloadTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocOverloadTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocOverloadTag", value }), accept)],
    ["JSDocOverrideTag", accept => syntaxRecord<Hir.JSDocOverrideTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocOverrideTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocOverrideTag", value }), accept)],
    ["JSDocParameterTag", accept => syntaxRecord<Hir.JSDocParameterOrPropertyTag<Hir.CheckedPhase, "JSDocParameterTag" | "JSDocPropertyTag"> & { readonly kind: "JSDocParameterTag" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_name = read("name", readers().syntax_39);
      const field_isBracketed = read("isBracketed", readers().scalar_boolean);
      const field_typeExpression = read("typeExpression", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_isNameFirst = read("isNameFirst", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_name, field_isBracketed, field_typeExpression, field_isNameFirst, field_tsonic], value: () => ({ kind: "JSDocParameterTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), name: field_name.value(), isBracketed: field_isBracketed.value(), typeExpression: field_typeExpression.value(), isNameFirst: field_isNameFirst.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocParameterTag", value }), accept)],
    ["JSDocPropertyTag", accept => syntaxRecord<Hir.JSDocParameterOrPropertyTag<Hir.CheckedPhase, "JSDocParameterTag" | "JSDocPropertyTag"> & { readonly kind: "JSDocPropertyTag" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_name = read("name", readers().syntax_39);
      const field_isBracketed = read("isBracketed", readers().scalar_boolean);
      const field_typeExpression = read("typeExpression", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_isNameFirst = read("isNameFirst", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_name, field_isBracketed, field_typeExpression, field_isNameFirst, field_tsonic], value: () => ({ kind: "JSDocPropertyTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), name: field_name.value(), isBracketed: field_isBracketed.value(), typeExpression: field_typeExpression.value(), isNameFirst: field_isNameFirst.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocPropertyTag", value }), accept)],
    ["JSDocPrivateTag", accept => syntaxRecord<Hir.JSDocPrivateTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocPrivateTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocPrivateTag", value }), accept)],
    ["JSDocProtectedTag", accept => syntaxRecord<Hir.JSDocProtectedTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocProtectedTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocProtectedTag", value }), accept)],
    ["JSDocPublicTag", accept => syntaxRecord<Hir.JSDocPublicTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocPublicTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocPublicTag", value }), accept)],
    ["JSDocReadonlyTag", accept => syntaxRecord<Hir.JSDocReadonlyTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocReadonlyTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocReadonlyTag", value }), accept)],
    ["JSDocReturnTag", accept => syntaxRecord<Hir.JSDocReturnTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocReturnTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocReturnTag", value }), accept)],
    ["JSDocSatisfiesTag", accept => syntaxRecord<Hir.JSDocSatisfiesTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocSatisfiesTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocSatisfiesTag", value }), accept)],
    ["JSDocSeeTag", accept => syntaxRecord<Hir.JSDocSeeTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_nameExpression = read("nameExpression", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_nameExpression, field_tsonic], value: () => ({ kind: "JSDocSeeTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), nameExpression: field_nameExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocSeeTag", value }), accept)],
    ["JSDocSignature", accept => syntaxRecord<Hir.JSDocSignature<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "JSDocSignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocSignature", value }), accept)],
    ["JSDocTemplateTag", accept => syntaxRecord<Hir.JSDocTemplateTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_constraint = read("constraint", readers().syntax_44);
      const field_typeParameters = read("typeParameters", readers().record_180);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_constraint, field_typeParameters, field_tsonic], value: () => ({ kind: "JSDocTemplateTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), constraint: field_constraint.value(), typeParameters: field_typeParameters.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocTemplateTag", value }), accept)],
    ["JSDocText", accept => syntaxRecord<Hir.JSDocText<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", sequenceReader(readers().scalar_string));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic], value: () => ({ kind: "JSDocText", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocText", value }), accept)],
    ["JSDocThisTag", accept => syntaxRecord<Hir.JSDocThisTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocThisTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocThisTag", value }), accept)],
    ["JSDocThrowsTag", accept => syntaxRecord<Hir.JSDocThrowsTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocThrowsTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocThrowsTag", value }), accept)],
    ["JSDocTypeExpression", accept => syntaxRecord<Hir.JSDocTypeExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "JSDocTypeExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocTypeExpression", value }), accept)],
    ["JSDocTypeLiteral", accept => syntaxRecord<Hir.JSDocTypeLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_jsDocPropertyTags = read("jsDocPropertyTags", unionReader<readonly Hir.JSDocTag<Hir.CheckedPhase>[] | null>(() => [readers().scalar_null, sequenceReader(readers().syntax_42)]));
      const field_isArrayType = read("isArrayType", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_jsDocPropertyTags, field_isArrayType, field_tsonic], value: () => ({ kind: "JSDocTypeLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), jsDocPropertyTags: field_jsDocPropertyTags.value(), isArrayType: field_isArrayType.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocTypeLiteral", value }), accept)],
    ["JSDocTypeTag", accept => syntaxRecord<Hir.JSDocTypeTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", readers().syntax_44);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic], value: () => ({ kind: "JSDocTypeTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocTypeTag", value }), accept)],
    ["JSDocTypedefTag", accept => syntaxRecord<Hir.JSDocTypedefTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_typeExpression = read("typeExpression", unionReader<Hir.SyntaxNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_44]));
      const field_name = read("name", unionReader<Hir.JSDocFullName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_43]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_name, field_tsonic], value: () => ({ kind: "JSDocTypedefTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), typeExpression: field_typeExpression.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocTypedefTag", value }), accept)],
    ["JSDocUnknownTag", accept => syntaxRecord<Hir.JSDocUnknownTag<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tagName = read("tagName", readers().syntax_16);
      const field_comment = read("comment", unionReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_266]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic], value: () => ({ kind: "JSDocUnknownTag", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tagName: field_tagName.value(), comment: field_comment.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSDocUnknownTag", value }), accept)],
  ]);
}
