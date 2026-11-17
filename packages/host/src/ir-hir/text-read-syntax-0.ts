import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup0(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["ArrayLiteralExpression", accept => syntaxRecord<Hir.ArrayLiteralExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_82);
      const field_multiLine = read("multiLine", readers().scalar_boolean);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedAggregate>(() => [readers().record_83, readers().record_177]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_multiLine, field_tsonic], value: () => ({ kind: "ArrayLiteralExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), multiLine: field_multiLine.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ArrayLiteralExpression", value }), accept)],
    ["ArrayType", accept => syntaxRecord<Hir.ArrayTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elementType = read("elementType", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elementType, field_tsonic], value: () => ({ kind: "ArrayType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elementType: field_elementType.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ArrayType", value }), accept)],
    ["ArrowFunction", accept => syntaxRecord<Hir.ArrowFunction<Hir.CheckedPhase>>(read => {
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
      const field_asteriskToken = read("asteriskToken", unionReader<Hir.AsteriskToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_7]));
      const field_body = read("body", unionReader<Hir.BlockOrExpression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_8]));
      const field_equalsGreaterThanToken = read("equalsGreaterThanToken", readers().syntax_9);
      const field_tsonic = read("tsonic", readers().record_182);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_equalsGreaterThanToken, field_tsonic], value: () => ({ kind: "ArrowFunction", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), equalsGreaterThanToken: field_equalsGreaterThanToken.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ArrowFunction", value }), accept)],
    ["AsExpression", accept => syntaxRecord<Hir.AsExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_type, field_tsonic], value: () => ({ kind: "AsExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AsExpression", value }), accept)],
    ["AwaitExpression", accept => syntaxRecord<Hir.AwaitExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_184);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "AwaitExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "AwaitExpression", value }), accept)],
    ["BigIntLiteral", accept => syntaxRecord<Hir.BigIntLiteral<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_text = read("text", readers().scalar_string);
      const field_tokenFlags = read("tokenFlags", sequenceReader(readers().literal_100));
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedLiteral>(() => [readers().record_192, readers().record_199, readers().record_200, readers().record_202, readers().record_204, readers().record_206, readers().record_207]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tokenFlags, field_tsonic], value: () => ({ kind: "BigIntLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), text: field_text.value(), tokenFlags: field_tokenFlags.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BigIntLiteral", value }), accept)],
    ["BinaryExpression", accept => syntaxRecord<Hir.BinaryExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_left = read("left", readers().syntax_2);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_operatorToken = read("operatorToken", readers().syntax_10);
      const field_right = read("right", readers().syntax_2);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedBinary>(() => [readers().record_208, readers().record_209, readers().record_210, readers().record_211, readers().record_212]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_left, field_type, field_operatorToken, field_right, field_tsonic], value: () => ({ kind: "BinaryExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), left: field_left.value(), type: field_type.value(), operatorToken: field_operatorToken.value(), right: field_right.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BinaryExpression", value }), accept)],
    ["BindingElement", accept => syntaxRecord<Hir.BindingElement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_dotDotDotToken = read("dotDotDotToken", unionReader<Hir.DotDotDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_11]));
      const field_propertyName = read("propertyName", unionReader<Hir.PropertyName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_12]));
      const field_name = read("name", unionReader<Hir.BindingName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_13]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_214);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_propertyName, field_name, field_initializer, field_tsonic], value: () => ({ kind: "BindingElement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), dotDotDotToken: field_dotDotDotToken.value(), propertyName: field_propertyName.value(), name: field_name.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BindingElement", value }), accept)],
    ["ArrayBindingPattern", accept => syntaxRecord<Hir.BindingPattern<Hir.CheckedPhase, "ArrayBindingPattern" | "ObjectBindingPattern"> & { readonly kind: "ArrayBindingPattern" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_215);
      const field_tsonic = read("tsonic", readers().record_214);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic], value: () => ({ kind: "ArrayBindingPattern", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ArrayBindingPattern", value }), accept)],
    ["ObjectBindingPattern", accept => syntaxRecord<Hir.BindingPattern<Hir.CheckedPhase, "ArrayBindingPattern" | "ObjectBindingPattern"> & { readonly kind: "ObjectBindingPattern" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_215);
      const field_tsonic = read("tsonic", readers().record_214);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic], value: () => ({ kind: "ObjectBindingPattern", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ObjectBindingPattern", value }), accept)],
    ["Block", accept => syntaxRecord<Hir.Block<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statements = read("statements", readers().record_216);
      const field_multiLine = read("multiLine", readers().scalar_boolean);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_multiLine, field_tsonic], value: () => ({ kind: "Block", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statements: field_statements.value(), multiLine: field_multiLine.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "Block", value }), accept)],
    ["BreakStatement", accept => syntaxRecord<Hir.BreakStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_label = read("label", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_tsonic], value: () => ({ kind: "BreakStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), label: field_label.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "BreakStatement", value }), accept)],
    ["CallExpression", accept => syntaxRecord<Hir.CallExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_questionDotToken = read("questionDotToken", unionReader<Hir.QuestionDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_17]));
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_arguments = read("arguments", readers().record_82);
      const field_tsonic = read("tsonic", readers().record_218);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_typeArguments, field_arguments, field_tsonic], value: () => ({ kind: "CallExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), questionDotToken: field_questionDotToken.value(), typeArguments: field_typeArguments.value(), arguments: field_arguments.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "CallExpression", value }), accept)],
    ["CallSignature", accept => syntaxRecord<Hir.CallSignatureDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "CallSignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "CallSignature", value }), accept)],
    ["CaseBlock", accept => syntaxRecord<Hir.CaseBlock<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_clauses = read("clauses", readers().record_232);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_clauses, field_tsonic], value: () => ({ kind: "CaseBlock", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), clauses: field_clauses.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "CaseBlock", value }), accept)],
    ["CaseClause", accept => syntaxRecord<Hir.CaseClause<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_statements = read("statements", readers().record_216);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statements, field_tsonic], value: () => ({ kind: "CaseClause", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), statements: field_statements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "CaseClause", value }), accept)],
    ["CatchClause", accept => syntaxRecord<Hir.CatchClause<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_variableDeclaration = read("variableDeclaration", unionReader<Hir.VariableDeclaration<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_19]));
      const field_block = read("block", readers().syntax_20);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_variableDeclaration, field_block, field_tsonic], value: () => ({ kind: "CatchClause", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), variableDeclaration: field_variableDeclaration.value(), block: field_block.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "CatchClause", value }), accept)],
    ["ClassDeclaration", accept => syntaxRecord<Hir.ClassDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_heritageClauses = read("heritageClauses", unionReader<Hir.NodeList<Hir.HeritageClause<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_233]));
      const field_members = read("members", readers().record_234);
      const field_tsonic = read("tsonic", readers().record_235);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic], value: () => ({ kind: "ClassDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), typeParameters: field_typeParameters.value(), heritageClauses: field_heritageClauses.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ClassDeclaration", value }), accept)],
    ["ClassExpression", accept => syntaxRecord<Hir.ClassExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_heritageClauses = read("heritageClauses", unionReader<Hir.NodeList<Hir.HeritageClause<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_233]));
      const field_members = read("members", readers().record_234);
      const field_tsonic = read("tsonic", readers().record_237);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic], value: () => ({ kind: "ClassExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), typeParameters: field_typeParameters.value(), heritageClauses: field_heritageClauses.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ClassExpression", value }), accept)],
    ["ClassStaticBlockDeclaration", accept => syntaxRecord<Hir.ClassStaticBlockDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_body = read("body", readers().syntax_20);
      const field_tsonic = read("tsonic", readers().record_238);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_body, field_tsonic], value: () => ({ kind: "ClassStaticBlockDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), body: field_body.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ClassStaticBlockDeclaration", value }), accept)],
    ["ComputedPropertyName", accept => syntaxRecord<Hir.ComputedPropertyName<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_239);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ComputedPropertyName", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ComputedPropertyName", value }), accept)],
    ["ConditionalExpression", accept => syntaxRecord<Hir.ConditionalExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_condition = read("condition", readers().syntax_2);
      const field_questionToken = read("questionToken", readers().syntax_23);
      const field_whenTrue = read("whenTrue", readers().syntax_2);
      const field_colonToken = read("colonToken", readers().syntax_24);
      const field_whenFalse = read("whenFalse", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_condition, field_questionToken, field_whenTrue, field_colonToken, field_whenFalse, field_tsonic], value: () => ({ kind: "ConditionalExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), condition: field_condition.value(), questionToken: field_questionToken.value(), whenTrue: field_whenTrue.value(), colonToken: field_colonToken.value(), whenFalse: field_whenFalse.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConditionalExpression", value }), accept)],
    ["ConditionalType", accept => syntaxRecord<Hir.ConditionalTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_checkType = read("checkType", readers().syntax_3);
      const field_extendsType = read("extendsType", readers().syntax_3);
      const field_trueType = read("trueType", readers().syntax_3);
      const field_falseType = read("falseType", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_checkType, field_extendsType, field_trueType, field_falseType, field_tsonic], value: () => ({ kind: "ConditionalType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), checkType: field_checkType.value(), extendsType: field_extendsType.value(), trueType: field_trueType.value(), falseType: field_falseType.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConditionalType", value }), accept)],
    ["ConstructSignature", accept => syntaxRecord<Hir.ConstructSignatureDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_parameters = read("parameters", readers().record_181);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_fullSignature = read("fullSignature", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "ConstructSignature", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConstructSignature", value }), accept)],
    ["Constructor", accept => syntaxRecord<Hir.ConstructorDeclaration<Hir.CheckedPhase>>(read => {
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
      const field_asteriskToken = read("asteriskToken", unionReader<Hir.AsteriskToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_7]));
      const field_body = read("body", unionReader<Hir.BlockOrExpression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_8]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic], value: () => ({ kind: "Constructor", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "Constructor", value }), accept)],
  ]);
}
