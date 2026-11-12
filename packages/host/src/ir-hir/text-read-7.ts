import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup7 } from "./text-read-model.js";
export function createReadGroup7(readers: () => HirTextReaders): HirReadGroup7 {
  const record_210 = recordReader<Hir.HirCoreCarrier & { readonly role: "arithmetic" | "comparison" | "sequence" | "short-circuit"; readonly value: Hir.CheckedValue; }>("CheckedBinary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_109);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_211 = recordReader<Hir.HirCoreCarrier & { readonly role: "arithmetic" | "comparison" | "sequence" | "short-circuit"; readonly value: Hir.CheckedValue; }>("CheckedBinary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_110);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_212 = recordReader<Hir.HirCoreCarrier & { readonly role: "assignment"; readonly value: Hir.CheckedValue; readonly target: Hir.CapturedFact<Hir.HirStoragePlace>; }>("CheckedBinary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_111);
      const field_value = read("value", readers().record_140);
      const field_target = read("target", unionReader<Hir.CapturedFact<Hir.HirStoragePlace>>(() => [readers().record_213, readers().record_10]));
      return { fields: [field_core, field_role, field_value, field_target], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), target: field_target.value() }) };
    });
  const record_213 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirStoragePlace; }>("available", read => {
      const field_value = read("value", readers().record_144);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_214 = recordReader<Hir.CheckedBinding>("CheckedBinding", read => {
      const field_core = read("core", readers().record_84);
      const field_declaration = read("declaration", unionReader<Hir.DeclarationTarget | null>(() => [readers().scalar_null, readers().record_146, readers().record_201]));
      const field_declaredType = read("declaredType", unionReader<Hir.CapturedFact<Ids.TyId | null>>(() => [readers().record_142, readers().record_10]));
      return { fields: [field_core, field_declaration, field_declaredType], value: () => ({ core: field_core.value(), declaration: field_declaration.value(), declaredType: field_declaredType.value() }) };
    });
  const record_215 = recordReader<Hir.NodeList<Hir.BindingElement<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_14));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_216 = recordReader<Hir.NodeList<Hir.Statement<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_15));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_217 = recordReader<Hir.NodeList<Hir.TypeNode<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_3));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_218 = recordReader<Hir.CheckedApplication>("CheckedApplication", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      const field_core = read("core", readers().record_84);
      const field_application = read("application", unionReader<Hir.CapturedFact<Hir.HirApplication>>(() => [readers().record_219, readers().record_10]));
      return { fields: [field_views, field_place, field_memory, field_observation, field_core, field_application], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value(), core: field_core.value(), application: field_application.value() }) };
    });
  const record_219 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirApplication; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirApplication>(() => [readers().record_220, readers().record_226, readers().record_227, readers().record_228]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_220 = recordReader<Hir.HirApplication>("call", read => {
      const field_receiver = read("receiver", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_arguments = read("arguments", sequenceReader(unionReader<Hir.HirArgument>(() => [readers().record_221, readers().record_222])));
      const field_typeArguments = read("typeArguments", sequenceReader(readers().identity_t));
      const field_candidates = read("candidates", unionReader<Hir.CapturedFact<Ids.CandidateListId>>(() => [readers().record_224, readers().record_10]));
      const field_resolvedSignature = read("resolvedSignature", unionReader<Hir.CapturedFact<Ids.SigId | null>>(() => [readers().record_225, readers().record_10]));
      return { fields: [field_receiver, field_arguments, field_typeArguments, field_candidates, field_resolvedSignature], value: () => ({ kind: "call", receiver: field_receiver.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), candidates: field_candidates.value(), resolvedSignature: field_resolvedSignature.value() }) };
    });
  const record_221 = recordReader<{ readonly kind: "value"; readonly expression: Ids.NodeId; }>("value", read => {
      const field_expression = read("expression", readers().identity_n);
      return { fields: [field_expression], value: () => ({ kind: "value", expression: field_expression.value() }) };
    });
  const record_222 = recordReader<{ readonly kind: "spread"; readonly expression: Ids.NodeId; readonly tuple: Hir.CapturedFact<readonly Ids.TyId[] | null>; }>("spread", read => {
      const field_expression = read("expression", readers().identity_n);
      const field_tuple = read("tuple", unionReader<Hir.CapturedFact<readonly Ids.TyId[] | null>>(() => [readers().record_223, readers().record_10]));
      return { fields: [field_expression, field_tuple], value: () => ({ kind: "spread", expression: field_expression.value(), tuple: field_tuple.value() }) };
    });
  const record_223 = recordReader<{ readonly kind: "available"; readonly value: readonly Ids.TyId[] | null; }>("available", read => {
      const field_value = read("value", unionReader<readonly Ids.TyId[] | null>(() => [readers().scalar_null, sequenceReader(readers().identity_t)]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_224 = recordReader<{ readonly kind: "available"; readonly value: Ids.CandidateListId; }>("available", read => {
      const field_value = read("value", readers().identity_cand);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_225 = recordReader<{ readonly kind: "available"; readonly value: Ids.SigId | null; }>("available", read => {
      const field_value = read("value", unionReader<Ids.SigId | null>(() => [readers().scalar_null, readers().identity_sig]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_226 = recordReader<Hir.HirApplication>("construct", read => {
      const field_receiver = read("receiver", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_arguments = read("arguments", sequenceReader(unionReader<Hir.HirArgument>(() => [readers().record_221, readers().record_222])));
      const field_typeArguments = read("typeArguments", sequenceReader(readers().identity_t));
      const field_candidates = read("candidates", unionReader<Hir.CapturedFact<Ids.CandidateListId>>(() => [readers().record_224, readers().record_10]));
      const field_resolvedSignature = read("resolvedSignature", unionReader<Hir.CapturedFact<Ids.SigId | null>>(() => [readers().record_225, readers().record_10]));
      return { fields: [field_receiver, field_arguments, field_typeArguments, field_candidates, field_resolvedSignature], value: () => ({ kind: "construct", receiver: field_receiver.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), candidates: field_candidates.value(), resolvedSignature: field_resolvedSignature.value() }) };
    });
  const record_227 = recordReader<Hir.HirApplication>("accessor-get", read => {
      const field_receiver = read("receiver", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_arguments = read("arguments", sequenceReader(unionReader<Hir.HirArgument>(() => [readers().record_221, readers().record_222])));
      const field_typeArguments = read("typeArguments", sequenceReader(readers().identity_t));
      const field_candidates = read("candidates", unionReader<Hir.CapturedFact<Ids.CandidateListId>>(() => [readers().record_224, readers().record_10]));
      const field_resolvedSignature = read("resolvedSignature", unionReader<Hir.CapturedFact<Ids.SigId | null>>(() => [readers().record_225, readers().record_10]));
      return { fields: [field_receiver, field_arguments, field_typeArguments, field_candidates, field_resolvedSignature], value: () => ({ kind: "accessor-get", receiver: field_receiver.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), candidates: field_candidates.value(), resolvedSignature: field_resolvedSignature.value() }) };
    });
  const record_228 = recordReader<Hir.HirApplication>("accessor-set", read => {
      const field_receiver = read("receiver", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_arguments = read("arguments", sequenceReader(unionReader<Hir.HirArgument>(() => [readers().record_221, readers().record_222])));
      const field_typeArguments = read("typeArguments", sequenceReader(readers().identity_t));
      const field_candidates = read("candidates", unionReader<Hir.CapturedFact<Ids.CandidateListId>>(() => [readers().record_224, readers().record_10]));
      const field_resolvedSignature = read("resolvedSignature", unionReader<Hir.CapturedFact<Ids.SigId | null>>(() => [readers().record_225, readers().record_10]));
      return { fields: [field_receiver, field_arguments, field_typeArguments, field_candidates, field_resolvedSignature], value: () => ({ kind: "accessor-set", receiver: field_receiver.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), candidates: field_candidates.value(), resolvedSignature: field_resolvedSignature.value() }) };
    });
  const record_229 = recordReader<Hir.CheckedCallable>("CheckedCallable", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_parameters = read("parameters", sequenceReader(readers().record_230));
      const field_signatures = read("signatures", sequenceReader(readers().record_231));
      const field_body = read("body", unionReader<Ids.BodyId | null>(() => [readers().scalar_null, readers().identity_body]));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_parameters, field_signatures, field_body], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), parameters: field_parameters.value(), signatures: field_signatures.value(), body: field_body.value() }) };
    });
  const record_230 = recordReader<Types.TypeParameter>("TypeParameter", read => {
      const field_identity = read("identity", readers().record_20);
      const field_declaration = read("declaration", readers().identity_def);
      const field_constraint = read("constraint", unionReader<Ids.TyId | null>(() => [readers().scalar_null, readers().identity_t]));
      const field_default = read("default", unionReader<Ids.TyId | null>(() => [readers().scalar_null, readers().identity_t]));
      return { fields: [field_identity, field_declaration, field_constraint, field_default], value: () => ({ identity: field_identity.value(), declaration: field_declaration.value(), constraint: field_constraint.value(), default: field_default.value() }) };
    });
  const record_231 = recordReader<Hir.HirCallableEndpoint>("HirCallableEndpoint", read => {
      const field_declaration = read("declaration", readers().identity_def);
      const field_role = read("role", readers().literal_112);
      const field_signature = read("signature", readers().identity_sig);
      const field_body = read("body", unionReader<Ids.BodyId | null>(() => [readers().scalar_null, readers().identity_body]));
      return { fields: [field_declaration, field_role, field_signature, field_body], value: () => ({ declaration: field_declaration.value(), role: field_role.value(), signature: field_signature.value(), body: field_body.value() }) };
    });
  const record_232 = recordReader<Hir.NodeList<Hir.CaseOrDefaultClause<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_18));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_233 = recordReader<Hir.NodeList<Hir.HeritageClause<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_21));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_234 = recordReader<Hir.NodeList<Hir.ClassElement<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_22));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_235 = recordReader<Hir.CheckedClass>("CheckedClass", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_parameters = read("parameters", sequenceReader(readers().record_230));
      const field_heritage = read("heritage", sequenceReader(readers().record_236));
      const field_members = read("members", sequenceReader(readers().identity_def));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_parameters, field_heritage, field_members], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), parameters: field_parameters.value(), heritage: field_heritage.value(), members: field_members.value() }) };
    });
  const record_236 = recordReader<Hir.HirHeritage>("HirHeritage", read => {
      const field_role = read("role", readers().literal_113);
      const field_type = read("type", readers().identity_t);
      return { fields: [field_role, field_type], value: () => ({ role: field_role.value(), type: field_type.value() }) };
    });
  const record_237 = recordReader<Hir.CheckedClassExpression>("CheckedClassExpression", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_definition = read("definition", readers().identity_def);
      const field_parameters = read("parameters", sequenceReader(readers().record_230));
      const field_heritage = read("heritage", sequenceReader(readers().record_236));
      const field_members = read("members", sequenceReader(readers().identity_def));
      return { fields: [field_views, field_place, field_memory, field_observation, field_core, field_parent, field_attributes, field_definition, field_parameters, field_heritage, field_members], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value(), core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), definition: field_definition.value(), parameters: field_parameters.value(), heritage: field_heritage.value(), members: field_members.value() }) };
    });
  const record_238 = recordReader<Hir.CheckedStaticBlock>("CheckedStaticBlock", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_body = read("body", readers().identity_body);
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_body], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), body: field_body.value() }) };
    });
  const record_239 = recordReader<Hir.CheckedProperty>("CheckedProperty", read => {
      const field_core = read("core", readers().record_84);
      const field_key = read("key", unionReader<Hir.CapturedFact<Types.MemberKey>>(() => [readers().record_160, readers().record_10]));
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      return { fields: [field_core, field_key, field_origins], value: () => ({ core: field_core.value(), key: field_key.value(), origins: field_origins.value() }) };
    });
  return { record_210, record_211, record_212, record_213, record_214, record_215, record_216, record_217, record_218, record_219, record_220, record_221, record_222, record_223, record_224, record_225, record_226, record_227, record_228, record_229, record_230, record_231, record_232, record_233, record_234, record_235, record_236, record_237, record_238, record_239 };
}
