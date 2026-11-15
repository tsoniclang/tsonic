import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup8 } from "./text-read-model.js";
export function createReadGroup8(readers: () => HirTextReaders): HirReadGroup8 {
  const record_240 = recordReader<{ readonly core: Hir.HirCoreCapture; readonly role: "value"; readonly value: Hir.CheckedValue; readonly origins: Hir.CapturedFact<readonly Types.MemberOrigin[]>; readonly accessor: Hir.CapturedFact<Hir.HirApplication | null> }>("CheckedMember", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      const field_accessor = read("accessor", unionReader<Hir.CapturedFact<Hir.HirApplication | null>>(() => [readers().record_241, readers().record_10]));
      return { fields: [field_core, field_role, field_value, field_origins, field_accessor], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), origins: field_origins.value(), accessor: field_accessor.value() }) };
    });
  const record_241 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirApplication | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirApplication | null>(() => [readers().scalar_null, unionReader<Hir.HirApplication>(() => [readers().record_220, readers().record_226, readers().record_227, readers().record_228])]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_242 = recordReader<{ readonly core: Hir.HirCoreCapture; readonly role: "assignment-target"; readonly views: Hir.HirCheckerViews; readonly place: Hir.CapturedFact<Hir.HirStoragePlace>; readonly access: "read-write" | "write"; readonly origins: Hir.CapturedFact<readonly Types.MemberOrigin[]>; readonly accessor: Hir.CapturedFact<Hir.HirApplication | null> }>("CheckedMember", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_114);
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace>>(() => [readers().record_213, readers().record_10]));
      const field_access = read("access", readers().literal_115);
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      const field_accessor = read("accessor", unionReader<Hir.CapturedFact<Hir.HirApplication | null>>(() => [readers().record_241, readers().record_10]));
      return { fields: [field_core, field_role, field_views, field_place, field_access, field_origins, field_accessor], value: () => ({ core: field_core.value(), role: field_role.value(), views: field_views.value(), place: field_place.value(), access: field_access.value(), origins: field_origins.value(), accessor: field_accessor.value() }) };
    });
  const record_243 = recordReader<Hir.NodeList<Hir.EnumMember<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_26));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_244 = recordReader<Hir.CheckedEnum>("CheckedEnum", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_members = read("members", sequenceReader(readers().identity_def));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_members], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), members: field_members.value() }) };
    });
  const record_245 = recordReader<Hir.CheckedVariable>("CheckedVariable", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_declaration = read("declaration", unionReader<Hir.DeclarationTarget>(() => [readers().record_146, readers().record_201]));
      const field_declaredType = read("declaredType", unionReader<Hir.CapturedFact<Ids.TyId | null>>(() => [readers().record_142, readers().record_10]));
      const field_initializer = read("initializer", unionReader<Ids.BodyId | null>(() => [readers().scalar_null, readers().identity_body]));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_declaration, field_declaredType, field_initializer], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), declaration: field_declaration.value(), declaredType: field_declaredType.value(), initializer: field_initializer.value() }) };
    });
  const record_246 = recordReader<Hir.CheckedExport>("CheckedExport", read => {
      const field_core = read("core", readers().record_84);
      const field_target = read("target", unionReader<Hir.CapturedFact<Hir.ImportTarget | null>>(() => [readers().record_248, readers().record_10]));
      return { fields: [field_core, field_target], value: () => ({ core: field_core.value(), target: field_target.value() }) };
    });
  const record_248 = recordReader<{ readonly kind: "available"; readonly value: Hir.ImportTarget | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.ImportTarget | null>(() => [readers().scalar_null, readers().record_149, readers().record_150]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_249 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; }>("CheckedInstantiation", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_250 = recordReader<Hir.HirCoreCarrier & { readonly role: "heritage"; readonly type: Hir.CapturedFact<Ids.TyId>; readonly definition: Hir.CapturedFact<Ids.DefId>; }>("CheckedInstantiation", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_116);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_definition = read("definition", unionReader<Hir.CapturedFact<Ids.DefId>>(() => [readers().record_165, readers().record_10]));
      return { fields: [field_core, field_role, field_type, field_definition], value: () => ({ core: field_core.value(), role: field_role.value(), type: field_type.value(), definition: field_definition.value() }) };
    });
  const record_251 = recordReader<Hir.CheckedIteration>("CheckedIteration", read => {
      const field_core = read("core", readers().record_84);
      const field_protocol = read("protocol", unionReader<Hir.CapturedFact<Hir.HirProtocolFact | null>>(() => [readers().record_252, readers().record_10]));
      return { fields: [field_core, field_protocol], value: () => ({ core: field_core.value(), protocol: field_protocol.value() }) };
    });
  const record_252 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirProtocolFact | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirProtocolFact | null>(() => [readers().scalar_null, unionReader<{ readonly kind: "iterate" | "spread"; readonly asynchronous: boolean; readonly subject: Ids.NodeId; readonly iterator: Ids.TyId; readonly element: Ids.TyId; readonly completion: Ids.TyId; readonly sent: Ids.TyId; readonly next: Ids.SigId; readonly finish: Ids.SigId | null; readonly fail: Ids.SigId | null; }>(() => [readers().record_186, readers().record_187]), readers().record_188, unionReader<{ readonly kind: "delegate" | "yield"; readonly subject: Ids.NodeId | null; readonly yielded: Ids.TyId; readonly sent: Ids.TyId; readonly completion: Ids.TyId; }>(() => [readers().record_189, readers().record_190]), readers().record_191]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_253 = recordReader<Hir.NodeList<Hir.ExpressionWithTypeArguments<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_33));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_254 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; readonly resolution: Hir.HirResolution; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      const field_resolution = read("resolution", readers().resolution);
      return { fields: [field_core, field_role, field_value, field_resolution], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), resolution: field_resolution.value() }) };
    });
  const record_255 = recordReader<{ readonly core: Hir.HirCoreCapture; readonly role: "assignment-target"; readonly resolution: Hir.HirResolution; readonly views: Hir.HirCheckerViews; readonly place: Hir.CapturedFact<Hir.HirStoragePlace>; readonly access: "read-write" | "write" }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_114);
      const field_resolution = read("resolution", readers().resolution);
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace>>(() => [readers().record_213, readers().record_10]));
      const field_access = read("access", readers().literal_115);
      return { fields: [field_core, field_role, field_resolution, field_views, field_place, field_access], value: () => ({ core: field_core.value(), role: field_role.value(), resolution: field_resolution.value(), views: field_views.value(), place: field_place.value(), access: field_access.value() }) };
    });
  const record_256 = recordReader<Hir.HirCoreCarrier & { readonly role: "declaration-name"; readonly declaration: Hir.DeclarationTarget; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_102);
      const field_declaration = read("declaration", unionReader<Hir.DeclarationTarget>(() => [readers().record_146, readers().record_201]));
      return { fields: [field_core, field_role, field_declaration], value: () => ({ core: field_core.value(), role: field_role.value(), declaration: field_declaration.value() }) };
    });
  const record_257 = recordReader<Hir.HirCoreCarrier & { readonly role: "property-name"; readonly key: Hir.CapturedFact<Types.MemberKey>; readonly origins: Hir.CapturedFact<readonly Types.MemberOrigin[]>; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_101);
      const field_key = read("key", unionReader<Hir.CapturedFact<Types.MemberKey>>(() => [readers().record_160, readers().record_10]));
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      return { fields: [field_core, field_role, field_key, field_origins], value: () => ({ core: field_core.value(), role: field_role.value(), key: field_key.value(), origins: field_origins.value() }) };
    });
  const record_258 = recordReader<Hir.HirCoreCarrier & { readonly role: "type-name"; readonly resolution: Hir.HirResolution; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_118);
      const field_resolution = read("resolution", readers().resolution);
      return { fields: [field_core, field_role, field_resolution], value: () => ({ core: field_core.value(), role: field_role.value(), resolution: field_resolution.value() }) };
    });
  const record_259 = recordReader<Hir.HirCoreCarrier & { readonly role: "label"; readonly target: Ids.NodeRef | null; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_119);
      const field_target = read("target", unionReader<Ids.NodeRef | null>(() => [readers().scalar_null, readers().record_6]));
      return { fields: [field_core, field_role, field_target], value: () => ({ core: field_core.value(), role: field_role.value(), target: field_target.value() }) };
    });
  const record_260 = recordReader<Hir.HirCoreCarrier & { readonly role: "private-name"; readonly declaration: Ids.DefId; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_120);
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_core, field_role, field_declaration], value: () => ({ core: field_core.value(), role: field_role.value(), declaration: field_declaration.value() }) };
    });
  const record_261 = recordReader<Hir.HirCoreCarrier & { readonly role: "shorthand-value"; readonly value: Hir.CheckedValue; readonly resolution: Hir.HirResolution; readonly key: Hir.CapturedFact<Types.MemberKey>; }>("CheckedName", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_121);
      const field_value = read("value", readers().record_140);
      const field_resolution = read("resolution", readers().resolution);
      const field_key = read("key", unionReader<Hir.CapturedFact<Types.MemberKey>>(() => [readers().record_160, readers().record_10]));
      return { fields: [field_core, field_role, field_value, field_resolution, field_key], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), resolution: field_resolution.value(), key: field_key.value() }) };
    });
  const record_262 = recordReader<Hir.NodeList<Hir.ImportAttribute<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_35));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_263 = recordReader<Hir.CheckedImport>("CheckedImport", read => {
      const field_core = read("core", readers().record_84);
      const field_target = read("target", unionReader<Hir.CapturedFact<Hir.ImportTarget>>(() => [readers().record_205, readers().record_10]));
      const field_bindings = read("bindings", sequenceReader(readers().bindingSource));
      return { fields: [field_core, field_target, field_bindings], value: () => ({ core: field_core.value(), target: field_target.value(), bindings: field_bindings.value() }) };
    });
  const record_265 = recordReader<Hir.NodeList<Hir.TypeElement<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_40));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_266 = recordReader<Hir.NodeList<Hir.JSDocComment<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_41));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_267 = recordReader<Hir.NodeList<Hir.JSDocTag<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_42));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_268 = recordReader<Hir.NodeList<Hir.JsxAttributeLike<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_47));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_269 = recordReader<Hir.NodeList<Hir.JsxChild<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_50));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  return { record_240, record_241, record_242, record_243, record_244, record_245, record_246, record_248, record_249, record_250, record_251, record_252, record_253, record_254, record_255, record_256, record_257, record_258, record_259, record_260, record_261, record_262, record_263, record_265, record_266, record_267, record_268, record_269 };
}
