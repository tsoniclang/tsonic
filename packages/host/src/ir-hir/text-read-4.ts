import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup4 } from "./text-read-model.js";
export function createReadGroup4(readers: () => HirTextReaders): HirReadGroup4 {
  const record_120 = recordReader<{ readonly width: 64; readonly runtimeBase: "bigint"; readonly signedness: "unsigned"; }>("HirAddressIntegerCapture", read => {
      const field_width = read("width", readers().literal_68);
      const field_runtimeBase = read("runtimeBase", readers().literal_69);
      const field_signedness = read("signedness", readers().literal_67);
      return { fields: [field_width, field_runtimeBase, field_signedness], value: () => ({ width: field_width.value(), runtimeBase: field_runtimeBase.value(), signedness: field_signedness.value() }) };
    });
  const record_121 = recordReader<{ readonly family: "raw-memory"; readonly operation: "address-integer-to-raw"; readonly address: Ids.SourceNodeRef; readonly integer: Hir.HirAddressIntegerCapture; readonly dataLayout: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_57);
      const field_operation = read("operation", readers().literal_70);
      const field_address = read("address", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_integer = read("integer", unionReader<Hir.HirAddressIntegerCapture>(() => [readers().record_119, readers().record_120]));
      const field_dataLayout = read("dataLayout", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_address, field_integer, field_dataLayout], value: () => ({ family: field_family.value(), operation: field_operation.value(), address: field_address.value(), integer: field_integer.value(), dataLayout: field_dataLayout.value() }) };
    });
  const record_122 = recordReader<{ readonly family: "keep-alive"; readonly operation: "keep-alive"; readonly value: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_71);
      const field_operation = read("operation", readers().literal_71);
      const field_value = read("value", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_value], value: () => ({ family: field_family.value(), operation: field_operation.value(), value: field_value.value() }) };
    });
  const record_123 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirAttributeCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirAttributeCapture | null>(() => [readers().scalar_null, readers().record_124, readers().record_126]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_124 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly applicationTarget: Ids.SourceNodeRef; readonly selectedMember: { readonly selectedDeclaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; } | null; readonly applicationMemberKind: "method" | "property" | null; readonly applicationPlacement: "constructor" | "declaration" | null; readonly applicationParameterName: string | null; readonly applicationTargetSpecifier: string | null; readonly kind: "builder-state" }>("builder-state", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_applicationTarget = read("applicationTarget", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_selectedMember = read("selectedMember", unionReader<{ readonly selectedDeclaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; } | null>(() => [readers().scalar_null, readers().record_125]));
      const field_applicationMemberKind = read("applicationMemberKind", unionReader<"method" | "property" | null>(() => [readers().scalar_null, readers().literal_72, readers().literal_73]));
      const field_applicationPlacement = read("applicationPlacement", unionReader<"constructor" | "declaration" | null>(() => [readers().scalar_null, readers().literal_74, readers().literal_75]));
      const field_applicationParameterName = read("applicationParameterName", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      const field_applicationTargetSpecifier = read("applicationTargetSpecifier", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      return { fields: [field_occurrence, field_applicationTarget, field_selectedMember, field_applicationMemberKind, field_applicationPlacement, field_applicationParameterName, field_applicationTargetSpecifier], value: () => ({ occurrence: field_occurrence.value(), applicationTarget: field_applicationTarget.value(), selectedMember: field_selectedMember.value(), applicationMemberKind: field_applicationMemberKind.value(), applicationPlacement: field_applicationPlacement.value(), applicationParameterName: field_applicationParameterName.value(), applicationTargetSpecifier: field_applicationTargetSpecifier.value(), kind: "builder-state" }) };
    });
  const record_125 = recordReader<{ readonly selectedDeclaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; }>("Record", read => {
      const field_selectedDeclaration = read("selectedDeclaration", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_declarations = read("declarations", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      return { fields: [field_selectedDeclaration, field_declarations], value: () => ({ selectedDeclaration: field_selectedDeclaration.value(), declarations: field_declarations.value() }) };
    });
  const record_126 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly applicationTarget: Ids.SourceNodeRef; readonly selectedMember: { readonly selectedDeclaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; } | null; readonly applicationMemberKind: "method" | "property" | null; readonly applicationPlacement: "constructor" | "declaration" | null; readonly applicationParameterName: string | null; readonly applicationTargetSpecifier: string | null; readonly kind: "application"; readonly invocation: Ids.SourceNodeRef }>("application", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_applicationTarget = read("applicationTarget", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_selectedMember = read("selectedMember", unionReader<{ readonly selectedDeclaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; } | null>(() => [readers().scalar_null, readers().record_125]));
      const field_applicationMemberKind = read("applicationMemberKind", unionReader<"method" | "property" | null>(() => [readers().scalar_null, readers().literal_72, readers().literal_73]));
      const field_applicationPlacement = read("applicationPlacement", unionReader<"constructor" | "declaration" | null>(() => [readers().scalar_null, readers().literal_74, readers().literal_75]));
      const field_applicationParameterName = read("applicationParameterName", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      const field_applicationTargetSpecifier = read("applicationTargetSpecifier", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      const field_invocation = read("invocation", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_occurrence, field_applicationTarget, field_selectedMember, field_applicationMemberKind, field_applicationPlacement, field_applicationParameterName, field_applicationTargetSpecifier, field_invocation], value: () => ({ occurrence: field_occurrence.value(), applicationTarget: field_applicationTarget.value(), selectedMember: field_selectedMember.value(), applicationMemberKind: field_applicationMemberKind.value(), applicationPlacement: field_applicationPlacement.value(), applicationParameterName: field_applicationParameterName.value(), applicationTargetSpecifier: field_applicationTargetSpecifier.value(), kind: "application", invocation: field_invocation.value() }) };
    });
  const record_127 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirSafetyCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirSafetyCapture | null>(() => [readers().scalar_null, readers().record_128, readers().record_129, readers().record_130, readers().record_131, readers().record_134, readers().record_135]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_128 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; } & { readonly family: "unsafe-context"; readonly operation: "expression"; readonly expression: Ids.SourceNodeRef; }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_76);
      const field_operation = read("operation", readers().literal_77);
      const field_expression = read("expression", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_expression], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), expression: field_expression.value() }) };
    });
  const record_129 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; } & { readonly family: "unsafe-context"; readonly operation: "remaining-block"; readonly firstDirectStatement: boolean; }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_76);
      const field_operation = read("operation", readers().literal_78);
      const field_firstDirectStatement = read("firstDirectStatement", readers().scalar_boolean);
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_firstDirectStatement], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), firstDirectStatement: field_firstDirectStatement.value() }) };
    });
  const record_130 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; } & { readonly family: "safety"; readonly operation: "root"; readonly form: "type" | "value"; readonly target: Ids.SourceNodeRef | null; }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_79);
      const field_operation = read("operation", readers().literal_80);
      const field_form = read("form", readers().literal_81);
      const field_target = read("target", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_form, field_target], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), form: field_form.value(), target: field_target.value() }) };
    });
  const record_131 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; readonly family: "safety"; readonly operation: "select-member"; readonly predecessor: Ids.SourceNodeRef | null; readonly memberKind: "indexer" | "method" | "property"; readonly selection: Hir.HirSafetySelectionCapture }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_79);
      const field_operation = read("operation", readers().literal_82);
      const field_predecessor = read("predecessor", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_memberKind = read("memberKind", readers().literal_83);
      const field_selection = read("selection", unionReader<Hir.HirSafetySelectionCapture>(() => [readers().record_132, readers().record_133]));
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_memberKind, field_selection], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), predecessor: field_predecessor.value(), memberKind: field_memberKind.value(), selection: field_selection.value() }) };
    });
  const record_132 = recordReader<{ readonly kind: "selected"; readonly expression: Ids.SourceNodeRef; readonly declaration: Ids.SourceNodeRef | null; readonly declarations: readonly Ids.SourceNodeRef[]; }>("selected", read => {
      const field_expression = read("expression", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_declaration = read("declaration", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_declarations = read("declarations", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      return { fields: [field_expression, field_declaration, field_declarations], value: () => ({ kind: "selected", expression: field_expression.value(), declaration: field_declaration.value(), declarations: field_declarations.value() }) };
    });
  const record_133 = recordReader<{ readonly kind: "unavailable"; readonly reason: "function-shape" | "member-evidence" | "receiver"; }>("unavailable", read => {
      const field_reason = read("reason", readers().literal_84);
      return { fields: [field_reason], value: () => ({ kind: "unavailable", reason: field_reason.value() }) };
    });
  const record_134 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; readonly family: "safety"; readonly operation: "placement"; readonly predecessor: Ids.SourceNodeRef | null; readonly placement: "constructor" | "declaration" | "getter" | "setter" }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_79);
      const field_operation = read("operation", readers().literal_85);
      const field_predecessor = read("predecessor", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_placement = read("placement", readers().literal_86);
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_placement], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), predecessor: field_predecessor.value(), placement: field_placement.value() }) };
    });
  const record_135 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly provider: Ids.DefId; } & { readonly family: "safety"; readonly operation: "apply"; readonly predecessor: Ids.SourceNodeRef | null; readonly contract: "requires-unsafe" | "safe"; }>("HirSafetyCapture", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_provider = read("provider", readers().identity_def);
      const field_family = read("family", readers().literal_79);
      const field_operation = read("operation", readers().literal_87);
      const field_predecessor = read("predecessor", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_contract = read("contract", readers().literal_88);
      return { fields: [field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_contract], value: () => ({ occurrence: field_occurrence.value(), provider: field_provider.value(), family: field_family.value(), operation: field_operation.value(), predecessor: field_predecessor.value(), contract: field_contract.value() }) };
    });
  const record_136 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirArgumentPassingCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirArgumentPassingCapture | null>(() => [readers().scalar_null, readers().record_137, readers().record_138]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_137 = recordReader<{ readonly role: "declaration"; readonly mode: Types.PassingMode; }>("HirArgumentPassingCapture", read => {
      const field_role = read("role", readers().literal_75);
      const field_mode = read("mode", readers().literal_1);
      return { fields: [field_role, field_mode], value: () => ({ role: field_role.value(), mode: field_mode.value() }) };
    });
  const record_138 = recordReader<{ readonly role: "argument"; readonly mode: Types.PassingMode; readonly storageExpression: Ids.SourceNodeRef; }>("HirArgumentPassingCapture", read => {
      const field_role = read("role", readers().literal_89);
      const field_mode = read("mode", readers().literal_1);
      const field_storageExpression = read("storageExpression", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_role, field_mode, field_storageExpression], value: () => ({ role: field_role.value(), mode: field_mode.value(), storageExpression: field_storageExpression.value() }) };
    });
  const record_139 = recordReader<{ readonly kind: "available"; readonly value: "borrowed-mut" | "borrowed-shared" | "moved" | null; }>("available", read => {
      const field_value = read("value", unionReader<"borrowed-mut" | "borrowed-shared" | "moved" | null>(() => [readers().scalar_null, readers().literal_90, readers().literal_91, readers().literal_92]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_140 = recordReader<Hir.CheckedValue>("CheckedValue", read => {
      const field_views = read("views", readers().record_141);
      const field_place = read("place", unionReader<Hir.CapturedFact<Hir.HirStoragePlace | null>>(() => [readers().record_143, readers().record_10]));
      const field_memory = read("memory", unionReader<Hir.CapturedFact<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
      const field_observation = read("observation", unionReader<Hir.CapturedFact<Hir.HirObservationCapture | null>>(() => [readers().record_174, readers().record_10]));
      return { fields: [field_views, field_place, field_memory, field_observation], value: () => ({ views: field_views.value(), place: field_place.value(), memory: field_memory.value(), observation: field_observation.value() }) };
    });
  const record_141 = recordReader<Hir.HirCheckerViews>("HirCheckerViews", read => {
      const field_read = read("read", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_declared = read("declared", unionReader<Hir.CapturedFact<Ids.TyId | null>>(() => [readers().record_142, readers().record_10]));
      const field_contextual = read("contextual", unionReader<Hir.CapturedFact<Ids.TyId | null>>(() => [readers().record_142, readers().record_10]));
      return { fields: [field_read, field_declared, field_contextual], value: () => ({ read: field_read.value(), declared: field_declared.value(), contextual: field_contextual.value() }) };
    });
  const record_142 = recordReader<{ readonly kind: "available"; readonly value: Ids.TyId | null; }>("available", read => {
      const field_value = read("value", unionReader<Ids.TyId | null>(() => [readers().scalar_null, readers().identity_t]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_143 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirStoragePlace | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirStoragePlace | null>(() => [readers().scalar_null, readers().record_144]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_144 = recordReader<Hir.HirStoragePlace>("HirStoragePlace", read => {
      const field_base = read("base", unionReader<{ readonly kind: "root"; readonly resolution: Hir.HirResolution; } | { readonly kind: "place"; readonly node: Ids.NodeId; }>(() => [readers().record_145, readers().record_153]));
      const field_step = read("step", unionReader<null | { readonly kind: "member"; readonly key: Types.MemberKey; readonly origins: readonly Types.MemberOrigin[]; } | { readonly kind: "index"; readonly expression: Ids.NodeId; } | { readonly kind: "deref"; }>(() => [readers().scalar_null, readers().record_154, readers().record_155, readers().record_156]));
      const field_read = read("read", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_write = read("write", unionReader<Hir.CapturedFact<Ids.TyId | null>>(() => [readers().record_142, readers().record_10]));
      return { fields: [field_base, field_step, field_read, field_write], value: () => ({ base: field_base.value(), step: field_step.value(), read: field_read.value(), write: field_write.value() }) };
    });
  const record_145 = recordReader<{ readonly kind: "root"; readonly resolution: Hir.HirResolution; }>("root", read => {
      const field_resolution = read("resolution", unionReader<Hir.HirResolution>(() => [readers().record_146, readers().record_147, readers().record_148, readers().record_152]));
      return { fields: [field_resolution], value: () => ({ kind: "root", resolution: field_resolution.value() }) };
    });
  const record_146 = recordReader<{ readonly kind: "local"; readonly local: Ids.LocalRef; }>("local", read => {
      const field_local = read("local", readers().record_11);
      return { fields: [field_local], value: () => ({ kind: "local", local: field_local.value() }) };
    });
  const record_147 = recordReader<{ readonly kind: "definition"; readonly definition: Ids.DefId; readonly aliases: readonly Ids.DefId[]; }>("definition", read => {
      const field_definition = read("definition", readers().identity_def);
      const field_aliases = read("aliases", sequenceReader(readers().identity_def));
      return { fields: [field_definition, field_aliases], value: () => ({ kind: "definition", definition: field_definition.value(), aliases: field_aliases.value() }) };
    });
  const record_148 = recordReader<{ readonly kind: "module"; readonly target: Hir.ImportTarget; }>("module", read => {
      const field_target = read("target", unionReader<Hir.ImportTarget>(() => [readers().record_149, readers().record_150]));
      return { fields: [field_target], value: () => ({ kind: "module", target: field_target.value() }) };
    });
  const record_149 = recordReader<{ readonly target: "project"; readonly module: Ids.ModuleId; }>("ImportTarget", read => {
      const field_target = read("target", readers().literal_94);
      const field_module = read("module", readers().identity_mod);
      return { fields: [field_target, field_module], value: () => ({ target: field_target.value(), module: field_module.value() }) };
    });
  return { record_120, record_121, record_122, record_123, record_124, record_125, record_126, record_127, record_128, record_129, record_130, record_131, record_132, record_133, record_134, record_135, record_136, record_137, record_138, record_139, record_140, record_141, record_142, record_143, record_144, record_145, record_146, record_147, record_148, record_149 };
}
