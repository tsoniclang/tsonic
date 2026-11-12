import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, entriesReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup9 } from "./text-read-model.js";
export function createReadGroup9(readers: () => HirTextReaders): HirReadGroup9 {
  const record_270 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; }>("CheckedKeyword", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_271 = recordReader<Hir.HirCoreCarrier & { readonly role: "type-literal"; readonly type: Hir.CapturedFact<Ids.TyId>; readonly literal: Types.LiteralTypeValue; }>("CheckedKeyword", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_103);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_literal = read("literal", unionReader<Types.LiteralTypeValue>(() => [readers().record_61, readers().record_203, readers().record_195, readers().record_196, readers().record_197, readers().record_198]));
      return { fields: [field_core, field_role, field_type, field_literal], value: () => ({ core: field_core.value(), role: field_role.value(), type: field_type.value(), literal: field_literal.value() }) };
    });
  const record_272 = recordReader<Hir.CheckedNamespace>("CheckedNamespace", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_members = read("members", sequenceReader(readers().identity_def));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_members], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), members: field_members.value() }) };
    });
  const record_273 = recordReader<Hir.NodeList<Hir.ExportSpecifier<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_60));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_274 = recordReader<Hir.NodeList<Hir.ImportSpecifier<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_61));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_275 = recordReader<Hir.NodeList<Hir.ObjectLiteralElementLike<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_62));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_276 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; }>("CheckedUnary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_277 = recordReader<Hir.HirCoreCarrier & { readonly role: "update"; readonly value: Hir.CheckedValue; readonly target: Hir.CapturedFact<Hir.HirStoragePlace>; }>("CheckedUnary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_128);
      const field_value = read("value", readers().record_140);
      const field_target = read("target", unionReader<Hir.CapturedFact<Hir.HirStoragePlace>>(() => [readers().record_213, readers().record_10]));
      return { fields: [field_core, field_role, field_value, field_target], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value(), target: field_target.value() }) };
    });
  const record_278 = recordReader<Hir.HirCoreCarrier & { readonly role: "type-literal"; readonly type: Hir.CapturedFact<Ids.TyId>; readonly literal: Types.LiteralTypeValue; }>("CheckedUnary", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_103);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_literal = read("literal", unionReader<Types.LiteralTypeValue>(() => [readers().record_61, readers().record_203, readers().record_195, readers().record_196, readers().record_197, readers().record_198]));
      return { fields: [field_core, field_role, field_type, field_literal], value: () => ({ core: field_core.value(), role: field_role.value(), type: field_type.value(), literal: field_literal.value() }) };
    });
  const record_279 = recordReader<Hir.CommentDirective>("Unknown", read => {
      const field_loc = read("loc", readers().record_81);
      return { fields: [field_loc], value: () => ({ loc: field_loc.value(), kind: "Unknown" }) };
    });
  const record_280 = recordReader<Hir.CommentDirective>("ExpectError", read => {
      const field_loc = read("loc", readers().record_81);
      return { fields: [field_loc], value: () => ({ loc: field_loc.value(), kind: "ExpectError" }) };
    });
  const record_281 = recordReader<Hir.CommentDirective>("Ignore", read => {
      const field_loc = read("loc", readers().record_81);
      return { fields: [field_loc], value: () => ({ loc: field_loc.value(), kind: "Ignore" }) };
    });
  const record_282 = recordReader<Hir.Pragma>("SingleLineCommentTrivia", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      const field_hasTrailingNewLine = read("hasTrailingNewLine", readers().scalar_boolean);
      const field_name = read("name", readers().scalar_string);
      const field_args = read("args", entriesReader(readers().record_283));
      return { fields: [field_pos, field_end, field_hasTrailingNewLine, field_name, field_args], value: () => ({ pos: field_pos.value(), end: field_end.value(), kind: "SingleLineCommentTrivia", hasTrailingNewLine: field_hasTrailingNewLine.value(), name: field_name.value(), args: field_args.value() }) };
    });
  const record_283 = recordReader<Hir.PragmaArgument>("PragmaArgument", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      const field_name = read("name", readers().scalar_string);
      const field_value = read("value", readers().scalar_string);
      return { fields: [field_pos, field_end, field_name, field_value], value: () => ({ pos: field_pos.value(), end: field_end.value(), name: field_name.value(), value: field_value.value() }) };
    });
  const record_284 = recordReader<Hir.Pragma>("MultiLineCommentTrivia", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      const field_hasTrailingNewLine = read("hasTrailingNewLine", readers().scalar_boolean);
      const field_name = read("name", readers().scalar_string);
      const field_args = read("args", entriesReader(readers().record_283));
      return { fields: [field_pos, field_end, field_hasTrailingNewLine, field_name, field_args], value: () => ({ pos: field_pos.value(), end: field_end.value(), kind: "MultiLineCommentTrivia", hasTrailingNewLine: field_hasTrailingNewLine.value(), name: field_name.value(), args: field_args.value() }) };
    });
  const record_285 = recordReader<Hir.CheckJsDirective>("CheckJsDirective", read => {
      const field_enabled = read("enabled", readers().scalar_boolean);
      const field_range = read("range", unionReader<Hir.CommentRange>(() => [readers().record_286, readers().record_287]));
      return { fields: [field_enabled, field_range], value: () => ({ enabled: field_enabled.value(), range: field_range.value() }) };
    });
  const record_286 = recordReader<Hir.CommentRange>("SingleLineCommentTrivia", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      const field_hasTrailingNewLine = read("hasTrailingNewLine", readers().scalar_boolean);
      return { fields: [field_pos, field_end, field_hasTrailingNewLine], value: () => ({ pos: field_pos.value(), end: field_end.value(), kind: "SingleLineCommentTrivia", hasTrailingNewLine: field_hasTrailingNewLine.value() }) };
    });
  const record_287 = recordReader<Hir.CommentRange>("MultiLineCommentTrivia", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      const field_hasTrailingNewLine = read("hasTrailingNewLine", readers().scalar_boolean);
      return { fields: [field_pos, field_end, field_hasTrailingNewLine], value: () => ({ pos: field_pos.value(), end: field_end.value(), kind: "MultiLineCommentTrivia", hasTrailingNewLine: field_hasTrailingNewLine.value() }) };
    });
  const record_288 = recordReader<Hir.CheckedModule>("CheckedModule", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_body = read("body", readers().identity_body);
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_body], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), body: field_body.value() }) };
    });
  const record_289 = recordReader<Hir.NodeList<Hir.TemplateSpan<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_69));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_290 = recordReader<Hir.NodeList<Hir.TemplateLiteralTypeSpan<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_70));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_291 = recordReader<Hir.CheckedTypeAlias>("CheckedTypeAlias", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_parameters = read("parameters", sequenceReader(readers().record_230));
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_parameters, field_type], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), parameters: field_parameters.value(), type: field_type.value() }) };
    });
  const record_292 = recordReader<Hir.CheckedTypeParameter>("CheckedTypeParameter", read => {
      const field_core = read("core", readers().record_84);
      const field_parent = read("parent", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      const field_attributes = read("attributes", sequenceReader(readers().record_13));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_definition = read("definition", readers().identity_def);
      const field_parameter = read("parameter", readers().record_230);
      return { fields: [field_core, field_parent, field_attributes, field_memory, field_definition, field_parameter], value: () => ({ core: field_core.value(), parent: field_parent.value(), attributes: field_attributes.value(), memory: field_memory.value(), definition: field_definition.value(), parameter: field_parameter.value() }) };
    });
  const record_293 = recordReader<Hir.NodeList<Hir.VariableDeclaration<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_19));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_294 = recordReader<Hir.CheckedBindingList>("CheckedBindingList", read => {
      const field_core = read("core", readers().record_84);
      const field_disposal = read("disposal", sequenceReader(unionReader<Hir.CapturedFact<Hir.HirProtocolFact>>(() => [readers().record_185, readers().record_10])));
      return { fields: [field_core, field_disposal], value: () => ({ core: field_core.value(), disposal: field_disposal.value() }) };
    });
  return { record_270, record_271, record_272, record_273, record_274, record_275, record_276, record_277, record_278, record_279, record_280, record_281, record_282, record_283, record_284, record_285, record_286, record_287, record_288, record_289, record_290, record_291, record_292, record_293, record_294 };
}
