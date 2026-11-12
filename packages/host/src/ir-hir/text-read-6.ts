import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup6 } from "./text-read-model.js";
export function createReadGroup6(readers: () => HirTextReaders): HirReadGroup6 {
  const record_180 = recordReader<Hir.NodeList<Hir.TypeParameterDeclaration<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_5));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_181 = recordReader<Hir.NodeList<Hir.ParameterDeclaration<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_6));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_182 = recordReader<Hir.CheckedClosure>("CheckedClosure", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      const field_core = read("core", readers().record_84);
      const field_body = read("body", readers().identity_body);
      const field_captures = read("captures", sequenceReader(readers().record_11));
      return { fields: [field_views, field_place, field_memory, field_observation, field_core, field_body, field_captures], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value(), core: field_core.value(), body: field_body.value(), captures: field_captures.value() }) };
    });
  const record_183 = recordReader<Hir.CheckedExpression>("CheckedExpression", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      const field_core = read("core", readers().record_84);
      return { fields: [field_views, field_place, field_memory, field_observation, field_core], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value(), core: field_core.value() }) };
    });
  const record_184 = recordReader<Hir.CheckedProtocol>("CheckedProtocol", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      const field_core = read("core", readers().record_84);
      const field_protocol = read("protocol", unionReader<Hir.CapturedFact<Hir.HirProtocolFact>>(() => [readers().record_185, readers().record_10]));
      return { fields: [field_views, field_place, field_memory, field_observation, field_core, field_protocol], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value(), core: field_core.value(), protocol: field_protocol.value() }) };
    });
  const record_185 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirProtocolFact; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirProtocolFact>(() => [readers().record_186, readers().record_187, readers().record_188, readers().record_189, readers().record_190, readers().record_191]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_186 = recordReader<{ readonly kind: "iterate" | "spread"; readonly asynchronous: boolean; readonly subject: Ids.NodeId; readonly iterator: Ids.TyId; readonly element: Ids.TyId; readonly completion: Ids.TyId; readonly sent: Ids.TyId; readonly next: Ids.SigId; readonly finish: Ids.SigId | null; readonly fail: Ids.SigId | null; }>("iterate", read => {
      const field_asynchronous = read("asynchronous", readers().scalar_boolean);
      const field_subject = read("subject", readers().identity_n);
      const field_iterator = read("iterator", readers().identity_t);
      const field_element = read("element", readers().identity_t);
      const field_completion = read("completion", readers().identity_t);
      const field_sent = read("sent", readers().identity_t);
      const field_next = read("next", readers().identity_sig);
      const field_finish = read("finish", unionReader<Ids.SigId | null>(() => [readers().scalar_null, readers().identity_sig]));
      const field_fail = read("fail", unionReader<Ids.SigId | null>(() => [readers().scalar_null, readers().identity_sig]));
      return { fields: [field_asynchronous, field_subject, field_iterator, field_element, field_completion, field_sent, field_next, field_finish, field_fail], value: () => ({ kind: "iterate", asynchronous: field_asynchronous.value(), subject: field_subject.value(), iterator: field_iterator.value(), element: field_element.value(), completion: field_completion.value(), sent: field_sent.value(), next: field_next.value(), finish: field_finish.value(), fail: field_fail.value() }) };
    });
  const record_187 = recordReader<{ readonly kind: "iterate" | "spread"; readonly asynchronous: boolean; readonly subject: Ids.NodeId; readonly iterator: Ids.TyId; readonly element: Ids.TyId; readonly completion: Ids.TyId; readonly sent: Ids.TyId; readonly next: Ids.SigId; readonly finish: Ids.SigId | null; readonly fail: Ids.SigId | null; }>("spread", read => {
      const field_asynchronous = read("asynchronous", readers().scalar_boolean);
      const field_subject = read("subject", readers().identity_n);
      const field_iterator = read("iterator", readers().identity_t);
      const field_element = read("element", readers().identity_t);
      const field_completion = read("completion", readers().identity_t);
      const field_sent = read("sent", readers().identity_t);
      const field_next = read("next", readers().identity_sig);
      const field_finish = read("finish", unionReader<Ids.SigId | null>(() => [readers().scalar_null, readers().identity_sig]));
      const field_fail = read("fail", unionReader<Ids.SigId | null>(() => [readers().scalar_null, readers().identity_sig]));
      return { fields: [field_asynchronous, field_subject, field_iterator, field_element, field_completion, field_sent, field_next, field_finish, field_fail], value: () => ({ kind: "spread", asynchronous: field_asynchronous.value(), subject: field_subject.value(), iterator: field_iterator.value(), element: field_element.value(), completion: field_completion.value(), sent: field_sent.value(), next: field_next.value(), finish: field_finish.value(), fail: field_fail.value() }) };
    });
  const record_188 = recordReader<{ readonly kind: "await"; readonly subject: Ids.NodeId; readonly completion: Ids.TyId; }>("await", read => {
      const field_subject = read("subject", readers().identity_n);
      const field_completion = read("completion", readers().identity_t);
      return { fields: [field_subject, field_completion], value: () => ({ kind: "await", subject: field_subject.value(), completion: field_completion.value() }) };
    });
  const record_189 = recordReader<{ readonly kind: "delegate" | "yield"; readonly subject: Ids.NodeId | null; readonly yielded: Ids.TyId; readonly sent: Ids.TyId; readonly completion: Ids.TyId; }>("yield", read => {
      const field_subject = read("subject", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_yielded = read("yielded", readers().identity_t);
      const field_sent = read("sent", readers().identity_t);
      const field_completion = read("completion", readers().identity_t);
      return { fields: [field_subject, field_yielded, field_sent, field_completion], value: () => ({ kind: "yield", subject: field_subject.value(), yielded: field_yielded.value(), sent: field_sent.value(), completion: field_completion.value() }) };
    });
  const record_190 = recordReader<{ readonly kind: "delegate" | "yield"; readonly subject: Ids.NodeId | null; readonly yielded: Ids.TyId; readonly sent: Ids.TyId; readonly completion: Ids.TyId; }>("delegate", read => {
      const field_subject = read("subject", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_yielded = read("yielded", readers().identity_t);
      const field_sent = read("sent", readers().identity_t);
      const field_completion = read("completion", readers().identity_t);
      return { fields: [field_subject, field_yielded, field_sent, field_completion], value: () => ({ kind: "delegate", subject: field_subject.value(), yielded: field_yielded.value(), sent: field_sent.value(), completion: field_completion.value() }) };
    });
  const record_191 = recordReader<{ readonly kind: "dispose"; readonly subject: Ids.NodeId; readonly asynchronous: boolean; readonly signature: Ids.SigId; }>("dispose", read => {
      const field_subject = read("subject", readers().identity_n);
      const field_asynchronous = read("asynchronous", readers().scalar_boolean);
      const field_signature = read("signature", readers().identity_sig);
      return { fields: [field_subject, field_asynchronous, field_signature], value: () => ({ kind: "dispose", subject: field_subject.value(), asynchronous: field_asynchronous.value(), signature: field_signature.value() }) };
    });
  const record_192 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; readonly literal: Types.LiteralValue; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      const field_literal = read("literal", unionReader<Types.LiteralValue>(() => [readers().record_193, readers().record_194, readers().record_195, readers().record_196, readers().record_197, readers().record_198]));
      return { fields: [field_core, field_role, field_value, field_literal], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), literal: field_literal.value() }) };
    });
  const record_193 = recordReader<{ readonly kind: "number"; readonly token: string; readonly value: Types.ExactRational; }>("number", read => {
      const field_token = read("token", readers().scalar_string);
      const field_value = read("value", readers().record_62);
      return { fields: [field_token, field_value], value: () => ({ kind: "number", token: field_token.value(), value: field_value.value() }) };
    });
  const record_194 = recordReader<{ readonly kind: "bigint"; readonly token: string; readonly value: bigint; }>("bigint", read => {
      const field_token = read("token", readers().scalar_string);
      const field_value = read("value", readers().scalar_bigint);
      return { fields: [field_token, field_value], value: () => ({ kind: "bigint", token: field_token.value(), value: field_value.value() }) };
    });
  const record_195 = recordReader<{ readonly kind: "string"; readonly value: string; }>("string", read => {
      const field_value = read("value", readers().scalar_string);
      return { fields: [field_value], value: () => ({ kind: "string", value: field_value.value() }) };
    });
  const record_196 = recordReader<{ readonly kind: "boolean"; readonly value: boolean; }>("boolean", read => {
      const field_value = read("value", readers().scalar_boolean);
      return { fields: [field_value], value: () => ({ kind: "boolean", value: field_value.value() }) };
    });
  const record_197 = recordReader<{ readonly kind: "absence"; }>("absence", () => {

      return { fields: [], value: () => ({ kind: "absence" }) };
    });
  const record_198 = recordReader<{ readonly kind: "unique-symbol"; readonly declaration: Ids.DefId; }>("unique-symbol", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "unique-symbol", declaration: field_declaration.value() }) };
    });
  const record_199 = recordReader<Hir.HirCoreCarrier & { readonly role: "property-name"; readonly key: Hir.CapturedFact<Types.MemberKey>; readonly origins: Hir.CapturedFact<readonly Types.MemberOrigin[]>; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_101);
      const field_key = read("key", unionReader<Hir.CapturedFact<Types.MemberKey>>(() => [readers().record_160, readers().record_10]));
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      return { fields: [field_core, field_role, field_key, field_origins], value: () => ({ core: field_core.value(), role: field_role.value(), key: field_key.value(), origins: field_origins.value() }) };
    });
  const record_200 = recordReader<Hir.HirCoreCarrier & { readonly role: "declaration-name"; readonly declaration: Hir.DeclarationTarget; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_102);
      const field_declaration = read("declaration", unionReader<Hir.DeclarationTarget>(() => [readers().record_146, readers().record_201]));
      return { fields: [field_core, field_role, field_declaration], value: () => ({ core: field_core.value(), role: field_role.value(), declaration: field_declaration.value() }) };
    });
  const record_201 = recordReader<{ readonly kind: "definition"; readonly definition: Ids.DefId; }>("definition", read => {
      const field_definition = read("definition", readers().identity_def);
      return { fields: [field_definition], value: () => ({ kind: "definition", definition: field_definition.value() }) };
    });
  const record_202 = recordReader<Hir.HirCoreCarrier & { readonly role: "type-literal"; readonly type: Hir.CapturedFact<Ids.TyId>; readonly literal: Types.LiteralTypeValue; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_103);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_literal = read("literal", unionReader<Types.LiteralTypeValue>(() => [readers().record_61, readers().record_203, readers().record_195, readers().record_196, readers().record_197, readers().record_198]));
      return { fields: [field_core, field_role, field_type, field_literal], value: () => ({ core: field_core.value(), role: field_role.value(), type: field_type.value(), literal: field_literal.value() }) };
    });
  const record_203 = recordReader<{ readonly kind: "bigint"; readonly value: bigint; }>("bigint", read => {
      const field_value = read("value", readers().scalar_bigint);
      return { fields: [field_value], value: () => ({ kind: "bigint", value: field_value.value() }) };
    });
  const record_204 = recordReader<Hir.HirCoreCarrier & { readonly role: "module-specifier"; readonly target: Hir.CapturedFact<Hir.ImportTarget>; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_104);
      const field_target = read("target", unionReader<Hir.CapturedFact<Hir.ImportTarget>>(() => [readers().record_205, readers().record_10]));
      return { fields: [field_core, field_role, field_target], value: () => ({ core: field_core.value(), role: field_role.value(), target: field_target.value() }) };
    });
  const record_205 = recordReader<{ readonly kind: "available"; readonly value: Hir.ImportTarget; }>("available", read => {
      const field_value = read("value", unionReader<Hir.ImportTarget>(() => [readers().record_149, readers().record_150]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_206 = recordReader<Hir.HirCoreCarrier & { readonly role: "export-name"; readonly definition: Hir.CapturedFact<Ids.DefId>; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_105);
      const field_definition = read("definition", unionReader<Hir.CapturedFact<Ids.DefId>>(() => [readers().record_165, readers().record_10]));
      return { fields: [field_core, field_role, field_definition], value: () => ({ core: field_core.value(), role: field_role.value(), definition: field_definition.value() }) };
    });
  const record_207 = recordReader<Hir.HirCoreCarrier & { readonly role: "attribute-value"; readonly literal: Types.LiteralValue; }>("CheckedLiteral", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_106);
      const field_literal = read("literal", unionReader<Types.LiteralValue>(() => [readers().record_193, readers().record_194, readers().record_195, readers().record_196, readers().record_197, readers().record_198]));
      return { fields: [field_core, field_role, field_literal], value: () => ({ core: field_core.value(), role: field_role.value(), literal: field_literal.value() }) };
    });
  const record_208 = recordReader<Hir.HirCoreCarrier & { readonly role: "arithmetic" | "comparison" | "sequence" | "short-circuit"; readonly value: Hir.CheckedValue; }>("CheckedBinary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_107);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_209 = recordReader<Hir.HirCoreCarrier & { readonly role: "arithmetic" | "comparison" | "sequence" | "short-circuit"; readonly value: Hir.CheckedValue; }>("CheckedBinary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_108);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  return { record_180, record_181, record_182, record_183, record_184, record_185, record_186, record_187, record_188, record_189, record_190, record_191, record_192, record_193, record_194, record_195, record_196, record_197, record_198, record_199, record_200, record_201, record_202, record_203, record_204, record_205, record_206, record_207, record_208, record_209 };
}
