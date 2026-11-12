import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import type * as Diag from "../diag/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup0 } from "./text-read-model.js";
export function createReadGroup0(readers: () => HirTextReaders): HirReadGroup0 {
  const record_0 = recordReader<Hir.HirModule>("HirModule", read => {
      const field_module = read("module", readers().identity_mod);
      const field_tree = read("tree", readers().syntax_0);
      const field_items = read("items", sequenceReader(readers().record_1));
      const field_bodies = read("bodies", sequenceReader(readers().record_2));
      const field_checkerDiagnostics = read("checkerDiagnostics", sequenceReader(readers().record_25));
      const field_obligations = read("obligations", sequenceReader(readers().record_77));
      return { fields: [field_module, field_tree, field_items, field_bodies, field_checkerDiagnostics, field_obligations], value: () => ({ module: field_module.value(), tree: field_tree.value(), items: field_items.value(), bodies: field_bodies.value(), checkerDiagnostics: field_checkerDiagnostics.value(), obligations: field_obligations.value() }) };
    });
  const record_1 = recordReader<Hir.HirDeclarationEntry>("HirDeclarationEntry", read => {
      const field_definition = read("definition", readers().identity_def);
      const field_node = read("node", readers().identity_n);
      return { fields: [field_definition, field_node], value: () => ({ definition: field_definition.value(), node: field_node.value() }) };
    });
  const record_2 = recordReader<Hir.HirBody>("HirBody", read => {
      const field_body = read("body", readers().identity_body);
      const field_owner = read("owner", readers().identity_def);
      const field_params = read("params", sequenceReader(readers().record_3));
      const field_locals = read("locals", sequenceReader(readers().record_4));
      const field_root = read("root", readers().syntax_1);
      const field_captures = read("captures", sequenceReader(readers().record_11));
      const field_scopes = read("scopes", sequenceReader(readers().record_12));
      const field_asynchronous = read("asynchronous", readers().scalar_boolean);
      const field_generator = read("generator", readers().scalar_boolean);
      const field_candidateLists = read("candidateLists", sequenceReader(readers().record_14));
      const field_nestedBodies = read("nestedBodies", sequenceReader(readers().identity_body));
      return { fields: [field_body, field_owner, field_params, field_locals, field_root, field_captures, field_scopes, field_asynchronous, field_generator, field_candidateLists, field_nestedBodies], value: () => ({ body: field_body.value(), owner: field_owner.value(), params: field_params.value(), locals: field_locals.value(), root: field_root.value(), captures: field_captures.value(), scopes: field_scopes.value(), asynchronous: field_asynchronous.value(), generator: field_generator.value(), candidateLists: field_candidateLists.value(), nestedBodies: field_nestedBodies.value() }) };
    });
  const record_3 = recordReader<Hir.HirParam>("HirParam", read => {
      const field_local = read("local", readers().identity_l);
      const field_declaration = read("declaration", readers().identity_def);
      const field_role = read("role", readers().literal_0);
      const field_passing = read("passing", readers().literal_1);
      const field_initializer = read("initializer", unionReader<Ids.BodyId | null>(() => [readers().scalar_null, readers().identity_body]));
      return { fields: [field_local, field_declaration, field_role, field_passing, field_initializer], value: () => ({ local: field_local.value(), declaration: field_declaration.value(), role: field_role.value(), passing: field_passing.value(), initializer: field_initializer.value() }) };
    });
  const record_4 = recordReader<Hir.HirLocal>("HirLocal", read => {
      const field_id = read("id", readers().identity_l);
      const field_declaration = read("declaration", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_name = read("name", readers().scalar_string);
      const field_role = read("role", readers().literal_2);
      const field_checkerSlot = read("checkerSlot", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_capturedFrom = read("capturedFrom", unionReader<Ids.LocalRef | null>(() => [readers().scalar_null, readers().record_11]));
      const field_mutable = read("mutable", readers().scalar_boolean);
      return { fields: [field_id, field_declaration, field_name, field_role, field_checkerSlot, field_capturedFrom, field_mutable], value: () => ({ id: field_id.value(), declaration: field_declaration.value(), name: field_name.value(), role: field_role.value(), checkerSlot: field_checkerSlot.value(), capturedFrom: field_capturedFrom.value(), mutable: field_mutable.value() }) };
    });
  const record_5 = recordReader<{ readonly kind: "body"; readonly value: Ids.NodeRef; }>("body", read => {
      const field_value = read("value", readers().record_6);
      return { fields: [field_value], value: () => ({ kind: "body", value: field_value.value() }) };
    });
  const record_6 = recordReader<Ids.NodeRef>("NodeRef", read => {
      const field_body = read("body", readers().identity_body);
      const field_node = read("node", readers().identity_n);
      return { fields: [field_body, field_node], value: () => ({ body: field_body.value(), node: field_node.value() }) };
    });
  const record_7 = recordReader<{ readonly kind: "item"; readonly value: Ids.ItemNodeRef; }>("item", read => {
      const field_value = read("value", readers().record_8);
      return { fields: [field_value], value: () => ({ kind: "item", value: field_value.value() }) };
    });
  const record_8 = recordReader<Ids.ItemNodeRef>("ItemNodeRef", read => {
      const field_owner = read("owner", readers().identity_def);
      const field_node = read("node", readers().identity_n);
      return { fields: [field_owner, field_node], value: () => ({ owner: field_owner.value(), node: field_node.value() }) };
    });
  const record_9 = recordReader<{ readonly kind: "available"; readonly value: Ids.TyId; }>("available", read => {
      const field_value = read("value", readers().identity_t);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_10 = recordReader<{ readonly kind: "unavailable"; readonly reason: "checker-error" | "not-provided" | "parameter-dependent"; }>("unavailable", read => {
      const field_reason = read("reason", readers().literal_3);
      return { fields: [field_reason], value: () => ({ kind: "unavailable", reason: field_reason.value() }) };
    });
  const record_11 = recordReader<Ids.LocalRef>("LocalRef", read => {
      const field_body = read("body", readers().identity_body);
      const field_local = read("local", readers().identity_l);
      return { fields: [field_body, field_local], value: () => ({ body: field_body.value(), local: field_local.value() }) };
    });
  const record_12 = recordReader<Hir.HirLexicalScope>("HirLexicalScope", read => {
      const field_node = read("node", readers().identity_n);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      return { fields: [field_node, field_parent, field_attributes], value: () => ({ node: field_node.value(), parent: field_parent.value(), attributes: field_attributes.value() }) };
    });
  const record_13 = recordReader<Hir.HirAttribute>("HirAttribute", read => {
      const field_declaration = read("declaration", readers().identity_def);
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      return { fields: [field_declaration, field_occurrence, field_arguments], value: () => ({ declaration: field_declaration.value(), occurrence: field_occurrence.value(), arguments: field_arguments.value() }) };
    });
  const record_14 = recordReader<Hir.HirCandidateList>("HirCandidateList", read => {
      const field_id = read("id", readers().identity_cand);
      const field_candidates = read("candidates", sequenceReader(readers().record_15));
      return { fields: [field_id, field_candidates], value: () => ({ id: field_id.value(), candidates: field_candidates.value() }) };
    });
  const record_15 = recordReader<Hir.HirCandidate>("HirCandidate", read => {
      const field_ordinal = read("ordinal", readers().scalar_number);
      const field_declaration = read("declaration", readers().identity_def);
      const field_appliedSignature = read("appliedSignature", unionReader<Hir.CapturedFact<Ids.SigId>>(() => [readers().record_16, readers().record_10]));
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_conditionalFailure = read("conditionalFailure", unionReader<Hir.CapturedFact<Diag.Diagnostic | null>>(() => [readers().record_24, readers().record_10]));
      const field_contributions = read("contributions", sequenceReader(readers().record_42));
      return { fields: [field_ordinal, field_declaration, field_appliedSignature, field_bindings, field_conditionalFailure, field_contributions], value: () => ({ ordinal: field_ordinal.value(), declaration: field_declaration.value(), appliedSignature: field_appliedSignature.value(), bindings: field_bindings.value(), conditionalFailure: field_conditionalFailure.value(), contributions: field_contributions.value() }) };
    });
  const record_16 = recordReader<{ readonly kind: "available"; readonly value: Ids.SigId; }>("available", read => {
      const field_value = read("value", readers().identity_sig);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_17 = recordReader<{ readonly kind: "available"; readonly value: Types.BindingVector; }>("available", read => {
      const field_value = read("value", readers().record_18);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_18 = recordReader<Types.BindingVector>("BindingVector", read => {
      const field_classBindings = read("classBindings", sequenceReader(unionReader<Types.TypeBinding>(() => [readers().record_19, readers().record_21])));
      const field_methodBindings = read("methodBindings", sequenceReader(unionReader<Types.TypeBinding>(() => [readers().record_19, readers().record_21])));
      const field_capturedBindings = read("capturedBindings", sequenceReader(unionReader<Types.TypeBinding>(() => [readers().record_19, readers().record_21])));
      const field_selfBindings = read("selfBindings", sequenceReader(unionReader<Types.SelfBinding>(() => [readers().record_22, readers().record_23])));
      return { fields: [field_classBindings, field_methodBindings, field_capturedBindings, field_selfBindings], value: () => ({ classBindings: field_classBindings.value(), methodBindings: field_methodBindings.value(), capturedBindings: field_capturedBindings.value(), selfBindings: field_selfBindings.value() }) };
    });
  const record_19 = recordReader<{ readonly kind: "bound"; readonly parameter: Types.TypeParameterIdentity; readonly type: Ids.TyId; }>("bound", read => {
      const field_parameter = read("parameter", readers().record_20);
      const field_type = read("type", readers().identity_t);
      return { fields: [field_parameter, field_type], value: () => ({ kind: "bound", parameter: field_parameter.value(), type: field_type.value() }) };
    });
  const record_20 = recordReader<Types.TypeParameterIdentity>("TypeParameterIdentity", read => {
      const field_owner = read("owner", readers().identity_def);
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_owner, field_index], value: () => ({ owner: field_owner.value(), index: field_index.value() }) };
    });
  const record_21 = recordReader<{ readonly kind: "rigid"; readonly parameter: Types.TypeParameterIdentity; }>("rigid", read => {
      const field_parameter = read("parameter", readers().record_20);
      return { fields: [field_parameter], value: () => ({ kind: "rigid", parameter: field_parameter.value() }) };
    });
  const record_22 = recordReader<{ readonly kind: "bound"; readonly owner: Ids.DefId; readonly type: Ids.TyId; }>("bound", read => {
      const field_owner = read("owner", readers().identity_def);
      const field_type = read("type", readers().identity_t);
      return { fields: [field_owner, field_type], value: () => ({ kind: "bound", owner: field_owner.value(), type: field_type.value() }) };
    });
  const record_23 = recordReader<{ readonly kind: "rigid"; readonly owner: Ids.DefId; }>("rigid", read => {
      const field_owner = read("owner", readers().identity_def);
      return { fields: [field_owner], value: () => ({ kind: "rigid", owner: field_owner.value() }) };
    });
  const record_24 = recordReader<{ readonly kind: "available"; readonly value: Diag.Diagnostic | null; }>("available", read => {
      const field_value = read("value", unionReader<Diag.Diagnostic | null>(() => [readers().scalar_null, readers().record_25]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_25 = recordReader<Diag.Diagnostic>("Diagnostic", read => {
      const field_code = read("code", unionReader<Diag.DiagnosticCode>(() => [readers().record_26, readers().record_27, readers().record_28]));
      const field_severity = read("severity", readers().literal_4);
      const field_site = read("site", unionReader<Diag.DiagnosticSite>(() => [readers().record_29, readers().record_33, readers().record_34]));
      const field_source = read("source", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      const field_evidence = read("evidence", sequenceReader(readers().scalar_string));
      const field_message = read("message", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Diag.MessageArgument>(() => [readers().record_35, readers().record_36, readers().record_37, readers().record_38])));
      const field_related = read("related", sequenceReader(readers().record_39));
      const field_fix = read("fix", unionReader<Diag.DiagnosticFix | null>(() => [readers().scalar_null, readers().record_40]));
      return { fields: [field_code, field_severity, field_site, field_source, field_evidence, field_message, field_arguments, field_related, field_fix], value: () => ({ code: field_code.value(), severity: field_severity.value(), site: field_site.value(), source: field_source.value(), evidence: field_evidence.value(), message: field_message.value(), arguments: field_arguments.value(), related: field_related.value(), fix: field_fix.value() }) };
    });
  const record_26 = recordReader<{ readonly kind: "host"; readonly name: Diag.HostDiagnosticCode; readonly rendered: string; }>("host", read => {
      const field_name = read("name", readers().scalar_diagnostic);
      const field_rendered = read("rendered", readers().scalar_string);
      return { fields: [field_name, field_rendered], value: () => ({ kind: "host", name: field_name.value(), rendered: field_rendered.value() }) };
    });
  const record_27 = recordReader<{ readonly kind: "checker"; readonly number: number; readonly rendered: string; }>("checker", read => {
      const field_number = read("number", readers().scalar_number);
      const field_rendered = read("rendered", readers().scalar_string);
      return { fields: [field_number, field_rendered], value: () => ({ kind: "checker", number: field_number.value(), rendered: field_rendered.value() }) };
    });
  const record_28 = recordReader<{ readonly kind: "extension"; readonly number: number; readonly extensionCode: string; readonly rendered: string; }>("extension", read => {
      const field_number = read("number", readers().scalar_number);
      const field_extensionCode = read("extensionCode", readers().scalar_string);
      const field_rendered = read("rendered", readers().scalar_string);
      return { fields: [field_number, field_extensionCode, field_rendered], value: () => ({ kind: "extension", number: field_number.value(), extensionCode: field_extensionCode.value(), rendered: field_rendered.value() }) };
    });
  const record_29 = recordReader<{ readonly kind: "source"; readonly origin: Ids.Origin; }>("source", read => {
      const field_origin = read("origin", readers().record_30);
      return { fields: [field_origin], value: () => ({ kind: "source", origin: field_origin.value() }) };
    });
  return { record_0, record_1, record_2, record_3, record_4, record_5, record_6, record_7, record_8, record_9, record_10, record_11, record_12, record_13, record_14, record_15, record_16, record_17, record_18, record_19, record_20, record_21, record_22, record_23, record_24, record_25, record_26, record_27, record_28, record_29 };
}
