import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup6(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["NotEmittedStatement", accept => syntaxRecord<Hir.NotEmittedStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "NotEmittedStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NotEmittedStatement", value }), accept)],
    ["NotEmittedTypeElement", accept => syntaxRecord<Hir.NotEmittedTypeElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "NotEmittedTypeElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NotEmittedTypeElement", value }), accept)],
    ["NumericLiteral", accept => syntaxRecord<Hir.NumericLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedLiteral>(() => [readers().record_192, readers().record_199, readers().record_200, readers().record_202, readers().record_204, readers().record_206, readers().record_207]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic], value: () => ({ kind: "NumericLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "NumericLiteral", value }), accept)],
    ["ObjectLiteralExpression", accept => syntaxRecord<Hir.ObjectLiteralExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_properties = read("properties", readers().record_275);
      const field_multiLine = read("multiLine", readers().scalar_boolean);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedAggregate>(() => [readers().record_83, readers().record_177]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_properties, field_multiLine, field_tsonic], value: () => ({ kind: "ObjectLiteralExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), properties: field_properties.value(), multiLine: field_multiLine.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ObjectLiteralExpression", value }), accept)],
    ["OmittedExpression", accept => syntaxRecord<Hir.OmittedExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "OmittedExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "OmittedExpression", value }), accept)],
    ["OptionalType", accept => syntaxRecord<Hir.OptionalTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "OptionalType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "OptionalType", value }), accept)],
    ["Parameter", accept => syntaxRecord<Hir.ParameterDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_dotDotDotToken = read("dotDotDotToken", unionReader<Hir.DotDotDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_11]));
      const field_name = read("name", readers().syntax_13);
      const field_questionToken = read("questionToken", unionReader<Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_23]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_245);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_dotDotDotToken, field_name, field_questionToken, field_type, field_initializer, field_tsonic], value: () => ({ kind: "Parameter", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), dotDotDotToken: field_dotDotDotToken.value(), name: field_name.value(), questionToken: field_questionToken.value(), type: field_type.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "Parameter", value }), accept)],
    ["ParenthesizedExpression", accept => syntaxRecord<Hir.ParenthesizedExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ParenthesizedExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ParenthesizedExpression", value }), accept)],
    ["ParenthesizedType", accept => syntaxRecord<Hir.ParenthesizedTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "ParenthesizedType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ParenthesizedType", value }), accept)],
    ["PartiallyEmittedExpression", accept => syntaxRecord<Hir.PartiallyEmittedExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "PartiallyEmittedExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PartiallyEmittedExpression", value }), accept)],
    ["PostfixUnaryExpression", accept => syntaxRecord<Hir.PostfixUnaryExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_operand = read("operand", readers().syntax_2);
      const field_operator = read("operator", readers().literal_127);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedUnary>(() => [readers().record_276, readers().record_277, readers().record_278]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_operand, field_operator, field_tsonic], value: () => ({ kind: "PostfixUnaryExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), operand: field_operand.value(), operator: field_operator.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PostfixUnaryExpression", value }), accept)],
    ["PrefixUnaryExpression", accept => syntaxRecord<Hir.PrefixUnaryExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_operator = read("operator", readers().literal_129);
      const field_operand = read("operand", readers().syntax_2);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedUnary>(() => [readers().record_276, readers().record_277, readers().record_278]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_operator, field_operand, field_tsonic], value: () => ({ kind: "PrefixUnaryExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), operator: field_operator.value(), operand: field_operand.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PrefixUnaryExpression", value }), accept)],
    ["PrivateIdentifier", accept => syntaxRecord<Hir.PrivateIdentifier<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedName>(() => [readers().record_254, readers().record_255, readers().record_256, readers().record_257, readers().record_258, readers().record_259, readers().record_260, readers().record_261, readers().bindingName]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic], value: () => ({ kind: "PrivateIdentifier", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PrivateIdentifier", value }), accept)],
    ["PropertyAccessExpression", accept => syntaxRecord<Hir.PropertyAccessExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_questionDotToken = read("questionDotToken", unionReader<Hir.QuestionDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_17]));
      const field_name = read("name", readers().syntax_63);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedMember>(() => [readers().record_240, readers().record_242]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_name, field_tsonic], value: () => ({ kind: "PropertyAccessExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), questionDotToken: field_questionDotToken.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PropertyAccessExpression", value }), accept)],
    ["PropertyAssignment", accept => syntaxRecord<Hir.PropertyAssignment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_initializer = read("initializer", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_239);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic], value: () => ({ kind: "PropertyAssignment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), type: field_type.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PropertyAssignment", value }), accept)],
    ["PropertyDeclaration", accept => syntaxRecord<Hir.PropertyDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_245);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic], value: () => ({ kind: "PropertyDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), type: field_type.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PropertyDeclaration", value }), accept)],
    ["PropertySignature", accept => syntaxRecord<Hir.PropertySignatureDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_245);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic], value: () => ({ kind: "PropertySignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), type: field_type.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "PropertySignature", value }), accept)],
    ["QualifiedName", accept => syntaxRecord<Hir.QualifiedName<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_left = read("left", readers().syntax_39);
      const field_right = read("right", readers().syntax_16);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedName>(() => [readers().record_254, readers().record_255, readers().record_256, readers().record_257, readers().record_258, readers().record_259, readers().record_260, readers().record_261, readers().bindingName]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_left, field_right, field_tsonic], value: () => ({ kind: "QualifiedName", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), left: field_left.value(), right: field_right.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "QualifiedName", value }), accept)],
    ["RegularExpressionLiteral", accept => syntaxRecord<Hir.RegularExpressionLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic], value: () => ({ kind: "RegularExpressionLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "RegularExpressionLiteral", value }), accept)],
    ["RestType", accept => syntaxRecord<Hir.RestTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic], value: () => ({ kind: "RestType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "RestType", value }), accept)],
    ["ReturnStatement", accept => syntaxRecord<Hir.ReturnStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ReturnStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ReturnStatement", value }), accept)],
    ["SatisfiesExpression", accept => syntaxRecord<Hir.SatisfiesExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_type, field_tsonic], value: () => ({ kind: "SatisfiesExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SatisfiesExpression", value }), accept)],
    ["SemicolonClassElement", accept => syntaxRecord<Hir.SemicolonClassElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "SemicolonClassElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SemicolonClassElement", value }), accept)],
    ["SetAccessor", accept => syntaxRecord<Hir.SetAccessorDeclaration<Hir.CheckedPhase>>(read => {
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
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic], value: () => ({ kind: "SetAccessor", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "SetAccessor", value }), accept)],
    ["ShorthandPropertyAssignment", accept => syntaxRecord<Hir.ShorthandPropertyAssignment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_equalsToken = read("equalsToken", unionReader<Hir.EqualsToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_64]));
      const field_objectAssignmentInitializer = read("objectAssignmentInitializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_239);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_equalsToken, field_objectAssignmentInitializer, field_tsonic], value: () => ({ kind: "ShorthandPropertyAssignment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), type: field_type.value(), equalsToken: field_equalsToken.value(), objectAssignmentInitializer: field_objectAssignmentInitializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ShorthandPropertyAssignment", value }), accept)],
  ]);
}
