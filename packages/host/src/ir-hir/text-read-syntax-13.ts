import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup13(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["VarKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "VarKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "VarKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VarKeyword", value }), accept)],
    ["WhileKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WhileKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "WhileKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "WhileKeyword", value }), accept)],
    ["WhitespaceTrivia", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WhitespaceTrivia" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "WhitespaceTrivia", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "WhitespaceTrivia", value }), accept)],
    ["WithKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "WithKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "WithKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "WithKeyword", value }), accept)],
    ["YieldKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "YieldKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "YieldKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "YieldKeyword", value }), accept)],
    ["TryStatement", accept => syntaxRecord<Hir.TryStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tryBlock = read("tryBlock", readers().syntax_20);
      const field_catchClause = read("catchClause", unionReader<Hir.CatchClause<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_72]));
      const field_finallyBlock = read("finallyBlock", unionReader<Hir.Block<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_20]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tryBlock, field_catchClause, field_finallyBlock, field_tsonic], value: () => ({ kind: "TryStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tryBlock: field_tryBlock.value(), catchClause: field_catchClause.value(), finallyBlock: field_finallyBlock.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TryStatement", value }), accept)],
    ["TupleType", accept => syntaxRecord<Hir.TupleTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_elements = read("elements", readers().record_217);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic], value: () => ({ kind: "TupleType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), elements: field_elements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TupleType", value }), accept)],
    ["JSTypeAliasDeclaration", accept => syntaxRecord<Hir.TypeAliasDeclaration<Hir.CheckedPhase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration"> & { readonly kind: "JSTypeAliasDeclaration" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_291);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_type, field_tsonic], value: () => ({ kind: "JSTypeAliasDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), typeParameters: field_typeParameters.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "JSTypeAliasDeclaration", value }), accept)],
    ["TypeAliasDeclaration", accept => syntaxRecord<Hir.TypeAliasDeclaration<Hir.CheckedPhase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration"> & { readonly kind: "TypeAliasDeclaration" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_typeParameters = read("typeParameters", unionReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_180]));
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_291);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_type, field_tsonic], value: () => ({ kind: "TypeAliasDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), typeParameters: field_typeParameters.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeAliasDeclaration", value }), accept)],
    ["TypeAssertionExpression", accept => syntaxRecord<Hir.TypeAssertion<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_type = read("type", readers().syntax_3);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_expression, field_tsonic], value: () => ({ kind: "TypeAssertionExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), type: field_type.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeAssertionExpression", value }), accept)],
    ["TypeLiteral", accept => syntaxRecord<Hir.TypeLiteralNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_members = read("members", readers().record_265);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_members, field_tsonic], value: () => ({ kind: "TypeLiteral", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeLiteral", value }), accept)],
    ["TypeOfExpression", accept => syntaxRecord<Hir.TypeOfExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "TypeOfExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeOfExpression", value }), accept)],
    ["TypeOperator", accept => syntaxRecord<Hir.TypeOperatorNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_operator = read("operator", readers().literal_132);
      const field_type = read("type", readers().syntax_3);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_operator, field_type, field_tsonic], value: () => ({ kind: "TypeOperator", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), operator: field_operator.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeOperator", value }), accept)],
    ["TypeParameter", accept => syntaxRecord<Hir.TypeParameterDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_constraint = read("constraint", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_expression = read("expression", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_defaultType = read("defaultType", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_292);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_constraint, field_expression, field_defaultType, field_tsonic], value: () => ({ kind: "TypeParameter", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), constraint: field_constraint.value(), expression: field_expression.value(), defaultType: field_defaultType.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeParameter", value }), accept)],
    ["TypePredicate", accept => syntaxRecord<Hir.TypePredicateNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_assertsModifier = read("assertsModifier", unionReader<Hir.AssertsKeyword<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_73]));
      const field_parameterName = read("parameterName", readers().syntax_74);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_assertsModifier, field_parameterName, field_type, field_tsonic], value: () => ({ kind: "TypePredicate", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), assertsModifier: field_assertsModifier.value(), parameterName: field_parameterName.value(), type: field_type.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypePredicate", value }), accept)],
    ["TypeQuery", accept => syntaxRecord<Hir.TypeQueryNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_exprName = read("exprName", readers().syntax_39);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_exprName, field_tsonic], value: () => ({ kind: "TypeQuery", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeArguments: field_typeArguments.value(), exprName: field_exprName.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeQuery", value }), accept)],
    ["TypeReference", accept => syntaxRecord<Hir.TypeReferenceNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_typeName = read("typeName", readers().syntax_39);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_typeArguments, field_typeName, field_tsonic], value: () => ({ kind: "TypeReference", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), typeArguments: field_typeArguments.value(), typeName: field_typeName.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "TypeReference", value }), accept)],
    ["UnionType", accept => syntaxRecord<Hir.UnionTypeNode<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_types = read("types", readers().record_217);
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_types, field_tsonic], value: () => ({ kind: "UnionType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), types: field_types.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "UnionType", value }), accept)],
    ["VariableDeclaration", accept => syntaxRecord<Hir.VariableDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_name = read("name", readers().syntax_13);
      const field_exclamationToken = read("exclamationToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_75]));
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_245);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_exclamationToken, field_type, field_initializer, field_tsonic], value: () => ({ kind: "VariableDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), name: field_name.value(), exclamationToken: field_exclamationToken.value(), type: field_type.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VariableDeclaration", value }), accept)],
    ["VariableDeclarationList", accept => syntaxRecord<Hir.VariableDeclarationList<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_declarations = read("declarations", readers().record_293);
      const field_tsonic = read("tsonic", readers().record_294);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_declarations, field_tsonic], value: () => ({ kind: "VariableDeclarationList", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), declarations: field_declarations.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VariableDeclarationList", value }), accept)],
    ["VariableStatement", accept => syntaxRecord<Hir.VariableStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_declarationList = read("declarationList", readers().syntax_76);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_declarationList, field_tsonic], value: () => ({ kind: "VariableStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), declarationList: field_declarationList.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VariableStatement", value }), accept)],
    ["VoidExpression", accept => syntaxRecord<Hir.VoidExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "VoidExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "VoidExpression", value }), accept)],
    ["WhileStatement", accept => syntaxRecord<Hir.WhileStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statement = read("statement", readers().syntax_15);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_expression, field_tsonic], value: () => ({ kind: "WhileStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statement: field_statement.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "WhileStatement", value }), accept)],
    ["WithStatement", accept => syntaxRecord<Hir.WithStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_statement = read("statement", readers().syntax_15);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statement, field_tsonic], value: () => ({ kind: "WithStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), statement: field_statement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "WithStatement", value }), accept)],
    ["YieldExpression", accept => syntaxRecord<Hir.YieldExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_asteriskToken = read("asteriskToken", unionReader<Hir.AsteriskToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_7]));
      const field_expression = read("expression", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_184);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_asteriskToken, field_expression, field_tsonic], value: () => ({ kind: "YieldExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), asteriskToken: field_asteriskToken.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "YieldExpression", value }), accept)],
  ]);
}
