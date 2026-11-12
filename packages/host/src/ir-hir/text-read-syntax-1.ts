import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup1(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["ConstructorType", accept => syntaxRecord<Hir.ConstructorTypeNode<Hir.CheckedPhase>>(read => {
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
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "ConstructorType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConstructorType", value }), accept)],
    ["ContinueStatement", accept => syntaxRecord<Hir.ContinueStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_label = read("label", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_tsonic], value: () => ({ kind: "ContinueStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), label: field_label.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ContinueStatement", value }), accept)],
    ["DebuggerStatement", accept => syntaxRecord<Hir.DebuggerStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DebuggerStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DebuggerStatement", value }), accept)],
    ["Decorator", accept => syntaxRecord<Hir.Decorator<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_25);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "Decorator", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "Decorator", value }), accept)],
    ["DefaultClause", accept => syntaxRecord<Hir.DefaultClause<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().scalar_null);
      const field_statements = read("statements", readers().record_216);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statements, field_tsonic], value: () => ({ kind: "DefaultClause", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), statements: field_statements.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DefaultClause", value }), accept)],
    ["DeleteExpression", accept => syntaxRecord<Hir.DeleteExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_183);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "DeleteExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DeleteExpression", value }), accept)],
    ["DoStatement", accept => syntaxRecord<Hir.DoStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statement = read("statement", readers().syntax_15);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_expression, field_tsonic], value: () => ({ kind: "DoStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statement: field_statement.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DoStatement", value }), accept)],
    ["ElementAccessExpression", accept => syntaxRecord<Hir.ElementAccessExpression<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_questionDotToken = read("questionDotToken", unionReader<Hir.QuestionDotToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_17]));
      const field_argumentExpression = read("argumentExpression", readers().syntax_2);
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedMember>(() => [readers().record_240, readers().record_242]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_questionDotToken, field_argumentExpression, field_tsonic], value: () => ({ kind: "ElementAccessExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), questionDotToken: field_questionDotToken.value(), argumentExpression: field_argumentExpression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ElementAccessExpression", value }), accept)],
    ["EmptyStatement", accept => syntaxRecord<Hir.EmptyStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EmptyStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EmptyStatement", value }), accept)],
    ["EnumDeclaration", accept => syntaxRecord<Hir.EnumDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_16);
      const field_members = read("members", readers().record_243);
      const field_tsonic = read("tsonic", readers().record_244);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_members, field_tsonic], value: () => ({ kind: "EnumDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), members: field_members.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EnumDeclaration", value }), accept)],
    ["EnumMember", accept => syntaxRecord<Hir.EnumMember<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_name = read("name", readers().syntax_12);
      const field_postfixToken = read("postfixToken", unionReader<Hir.ExclamationToken<Hir.CheckedPhase> | Hir.QuestionToken<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_27]));
      const field_initializer = read("initializer", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().record_245);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_initializer, field_tsonic], value: () => ({ kind: "EnumMember", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), initializer: field_initializer.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EnumMember", value }), accept)],
    ["ExportAssignment", accept => syntaxRecord<Hir.ExportAssignment<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_isExportEquals = read("isExportEquals", readers().scalar_boolean);
      const field_type = read("type", unionReader<Hir.TypeNode<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_3]));
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().record_246);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isExportEquals, field_type, field_expression, field_tsonic], value: () => ({ kind: "ExportAssignment", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), isExportEquals: field_isExportEquals.value(), type: field_type.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExportAssignment", value }), accept)],
    ["ExportDeclaration", accept => syntaxRecord<Hir.ExportDeclaration<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_modifiers = read("modifiers", unionReader<Hir.ModifierList<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().record_179]));
      const field_isTypeOnly = read("isTypeOnly", readers().scalar_boolean);
      const field_exportClause = read("exportClause", unionReader<Hir.NamedExportBindings<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_28]));
      const field_moduleSpecifier = read("moduleSpecifier", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_attributes = read("attributes", unionReader<Hir.ImportAttributes<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_29]));
      const field_tsonic = read("tsonic", readers().record_246);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isTypeOnly, field_exportClause, field_moduleSpecifier, field_attributes, field_tsonic], value: () => ({ kind: "ExportDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), isTypeOnly: field_isTypeOnly.value(), exportClause: field_exportClause.value(), moduleSpecifier: field_moduleSpecifier.value(), attributes: field_attributes.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExportDeclaration", value }), accept)],
    ["ExportSpecifier", accept => syntaxRecord<Hir.ExportSpecifier<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_isTypeOnly = read("isTypeOnly", readers().scalar_boolean);
      const field_propertyName = read("propertyName", unionReader<Hir.ModuleExportName<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_30]));
      const field_name = read("name", readers().syntax_30);
      const field_tsonic = read("tsonic", readers().record_246);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_isTypeOnly, field_propertyName, field_name, field_tsonic], value: () => ({ kind: "ExportSpecifier", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), isTypeOnly: field_isTypeOnly.value(), propertyName: field_propertyName.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExportSpecifier", value }), accept)],
    ["ExpressionStatement", accept => syntaxRecord<Hir.ExpressionStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ExpressionStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExpressionStatement", value }), accept)],
    ["ExpressionWithTypeArguments", accept => syntaxRecord<Hir.ExpressionWithTypeArguments<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_typeArguments = read("typeArguments", unionReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>> | null>(() => [readers().scalar_null, readers().record_217]));
      const field_tsonic = read("tsonic", unionReader<Hir.CheckedInstantiation>(() => [readers().record_249, readers().record_250]));
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_typeArguments, field_tsonic], value: () => ({ kind: "ExpressionWithTypeArguments", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), typeArguments: field_typeArguments.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExpressionWithTypeArguments", value }), accept)],
    ["ExternalModuleReference", accept => syntaxRecord<Hir.ExternalModuleReference<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_expression = read("expression", readers().syntax_2);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic], value: () => ({ kind: "ExternalModuleReference", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), expression: field_expression.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExternalModuleReference", value }), accept)],
    ["ForInStatement", accept => syntaxRecord<Hir.ForInStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_awaitModifier = read("awaitModifier", readers().scalar_null);
      const field_initializer = read("initializer", readers().syntax_31);
      const field_expression = read("expression", readers().syntax_2);
      const field_statement = read("statement", readers().syntax_15);
      const field_tsonic = read("tsonic", readers().record_251);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_awaitModifier, field_initializer, field_expression, field_statement, field_tsonic], value: () => ({ kind: "ForInStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), awaitModifier: field_awaitModifier.value(), initializer: field_initializer.value(), expression: field_expression.value(), statement: field_statement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ForInStatement", value }), accept)],
    ["ForOfStatement", accept => syntaxRecord<Hir.ForOfStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_awaitModifier = read("awaitModifier", unionReader<Hir.AwaitKeyword<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_32]));
      const field_initializer = read("initializer", readers().syntax_31);
      const field_expression = read("expression", readers().syntax_2);
      const field_statement = read("statement", readers().syntax_15);
      const field_tsonic = read("tsonic", readers().record_251);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_awaitModifier, field_initializer, field_expression, field_statement, field_tsonic], value: () => ({ kind: "ForOfStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), awaitModifier: field_awaitModifier.value(), initializer: field_initializer.value(), expression: field_expression.value(), statement: field_statement.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ForOfStatement", value }), accept)],
    ["ForStatement", accept => syntaxRecord<Hir.ForStatement<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_statement = read("statement", readers().syntax_15);
      const field_initializer = read("initializer", unionReader<Hir.ForInitializer<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_31]));
      const field_condition = read("condition", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_incrementor = read("incrementor", unionReader<Hir.Expression<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_2]));
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_initializer, field_condition, field_incrementor, field_tsonic], value: () => ({ kind: "ForStatement", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), statement: field_statement.value(), initializer: field_initializer.value(), condition: field_condition.value(), incrementor: field_incrementor.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ForStatement", value }), accept)],
    ["FunctionDeclaration", accept => syntaxRecord<Hir.FunctionDeclaration<Hir.CheckedPhase>>(read => {
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
      const field_name = read("name", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_tsonic = read("tsonic", readers().record_229);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_name, field_tsonic], value: () => ({ kind: "FunctionDeclaration", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "FunctionDeclaration", value }), accept)],
    ["FunctionExpression", accept => syntaxRecord<Hir.FunctionExpression<Hir.CheckedPhase>>(read => {
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
      const field_name = read("name", unionReader<Hir.Identifier<Hir.CheckedPhase> | null>(() => [readers().scalar_null, readers().syntax_16]));
      const field_tsonic = read("tsonic", readers().record_182);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_name, field_tsonic], value: () => ({ kind: "FunctionExpression", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), name: field_name.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "FunctionExpression", value }), accept)],
    ["FunctionType", accept => syntaxRecord<Hir.FunctionTypeNode<Hir.CheckedPhase>>(read => {
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
      const field_tsonic = read("tsonic", readers().record_178);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic], value: () => ({ kind: "FunctionType", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "FunctionType", value }), accept)],
    ["GetAccessor", accept => syntaxRecord<Hir.GetAccessorDeclaration<Hir.CheckedPhase>>(read => {
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
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic], value: () => ({ kind: "GetAccessor", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), modifiers: field_modifiers.value(), name: field_name.value(), postfixToken: field_postfixToken.value(), typeParameters: field_typeParameters.value(), parameters: field_parameters.value(), type: field_type.value(), fullSignature: field_fullSignature.value(), asteriskToken: field_asteriskToken.value(), body: field_body.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "GetAccessor", value }), accept)],
    ["HeritageClause", accept => syntaxRecord<Hir.HeritageClause<Hir.CheckedPhase>>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_token = read("token", readers().literal_117);
      const field_types = read("types", readers().record_253);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_token, field_types, field_tsonic], value: () => ({ kind: "HeritageClause", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), token: field_token.value(), types: field_types.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "HeritageClause", value }), accept)],
  ]);
}
