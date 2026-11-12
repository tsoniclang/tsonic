import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup5 } from "./text-read-model.js";
export function createReadGroup5(readers: () => HirTextReaders): HirReadGroup5 {
  const record_150 = recordReader<{ readonly target: "library"; readonly module: Ids.LibraryModuleIdentity; }>("ImportTarget", read => {
      const field_target = read("target", readers().literal_95);
      const field_module = read("module", readers().record_151);
      return { fields: [field_target, field_module], value: () => ({ target: field_target.value(), module: field_module.value() }) };
    });
  const record_151 = recordReader<Ids.LibraryModuleIdentity>("LibraryModuleIdentity", read => {
      const field_providerId = read("providerId", readers().scalar_string);
      const field_providerVersion = read("providerVersion", readers().scalar_string);
      const field_packageName = read("packageName", unionReader<string | null>(() => [readers().scalar_null, readers().scalar_string]));
      const field_moduleSpecifier = read("moduleSpecifier", readers().scalar_string);
      const field_providerModuleId = read("providerModuleId", readers().scalar_string);
      return { fields: [field_providerId, field_providerVersion, field_packageName, field_moduleSpecifier, field_providerModuleId], value: () => ({ providerId: field_providerId.value(), providerVersion: field_providerVersion.value(), packageName: field_packageName.value(), moduleSpecifier: field_moduleSpecifier.value(), providerModuleId: field_providerModuleId.value() }) };
    });
  const record_152 = recordReader<{ readonly kind: "unresolved"; readonly checkerDiagnostic: number | null; }>("unresolved", read => {
      const field_checkerDiagnostic = read("checkerDiagnostic", unionReader<number | null>(() => [readers().scalar_null, readers().scalar_number]));
      return { fields: [field_checkerDiagnostic], value: () => ({ kind: "unresolved", checkerDiagnostic: field_checkerDiagnostic.value() }) };
    });
  const record_153 = recordReader<{ readonly kind: "place"; readonly node: Ids.NodeId; }>("place", read => {
      const field_node = read("node", readers().identity_n);
      return { fields: [field_node], value: () => ({ kind: "place", node: field_node.value() }) };
    });
  const record_154 = recordReader<{ readonly kind: "member"; readonly key: Types.MemberKey; readonly origins: readonly Types.MemberOrigin[]; }>("member", read => {
      const field_key = read("key", unionReader<Types.MemberKey>(() => [readers().record_35, readers().record_61, readers().record_63]));
      const field_origins = read("origins", sequenceReader(unionReader<Types.MemberOrigin>(() => [readers().record_58, readers().record_59, readers().record_60])));
      return { fields: [field_key, field_origins], value: () => ({ kind: "member", key: field_key.value(), origins: field_origins.value() }) };
    });
  const record_155 = recordReader<{ readonly kind: "index"; readonly expression: Ids.NodeId; }>("index", read => {
      const field_expression = read("expression", readers().identity_n);
      return { fields: [field_expression], value: () => ({ kind: "index", expression: field_expression.value() }) };
    });
  const record_156 = recordReader<{ readonly kind: "deref"; }>("deref", () => {

      return { fields: [], value: () => ({ kind: "deref" }) };
    });
  const record_157 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirMemoryFieldCapture | Hir.HirMemoryLayoutCapture | null>(() => [readers().scalar_null, readers().record_158, readers().record_164, readers().record_169, readers().record_172]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_158 = recordReader<Hir.HirMemoryFieldCapture>("field", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_source = read("source", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_selector = read("selector", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_selection = read("selection", unionReader<Hir.CapturedFact<Ids.SourceNodeRef>>(() => [readers().record_159, readers().record_10]));
      const field_key = read("key", unionReader<Hir.CapturedFact<Types.MemberKey>>(() => [readers().record_160, readers().record_10]));
      const field_origins = read("origins", unionReader<Hir.CapturedFact<readonly Types.MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
      const field_selectedDeclarations = read("selectedDeclarations", unionReader<Hir.CapturedFact<readonly Ids.DefId[]>>(() => [readers().record_162, readers().record_10]));
      const field_primary = read("primary", unionReader<Hir.CapturedFact<Ids.DefId | null>>(() => [readers().record_85, readers().record_10]));
      const field_value = read("value", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_fieldLayoutExpression = read("fieldLayoutExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_fieldLayout = read("fieldLayout", unionReader<Hir.CapturedFact<Ids.SourceNodeRef>>(() => [readers().record_159, readers().record_10]));
      const field_byteOffsetExpression = read("byteOffsetExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_byteOffset = read("byteOffset", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      const field_byteAlignmentExpression = read("byteAlignmentExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_byteAlignment = read("byteAlignment", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      return { fields: [field_occurrence, field_bindings, field_source, field_selector, field_selection, field_key, field_origins, field_selectedDeclarations, field_primary, field_value, field_fieldLayoutExpression, field_fieldLayout, field_byteOffsetExpression, field_byteOffset, field_byteAlignmentExpression, field_byteAlignment], value: () => ({ kind: "field", occurrence: field_occurrence.value(), bindings: field_bindings.value(), source: field_source.value(), selector: field_selector.value(), selection: field_selection.value(), key: field_key.value(), origins: field_origins.value(), selectedDeclarations: field_selectedDeclarations.value(), primary: field_primary.value(), value: field_value.value(), fieldLayoutExpression: field_fieldLayoutExpression.value(), fieldLayout: field_fieldLayout.value(), byteOffsetExpression: field_byteOffsetExpression.value(), byteOffset: field_byteOffset.value(), byteAlignmentExpression: field_byteAlignmentExpression.value(), byteAlignment: field_byteAlignment.value() }) };
    });
  const record_159 = recordReader<{ readonly kind: "available"; readonly value: Ids.SourceNodeRef; }>("available", read => {
      const field_value = read("value", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_160 = recordReader<{ readonly kind: "available"; readonly value: Types.MemberKey; }>("available", read => {
      const field_value = read("value", unionReader<Types.MemberKey>(() => [readers().record_35, readers().record_61, readers().record_63]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_161 = recordReader<{ readonly kind: "available"; readonly value: readonly Types.MemberOrigin[]; }>("available", read => {
      const field_value = read("value", sequenceReader(unionReader<Types.MemberOrigin>(() => [readers().record_58, readers().record_59, readers().record_60])));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_162 = recordReader<{ readonly kind: "available"; readonly value: readonly Ids.DefId[]; }>("available", read => {
      const field_value = read("value", sequenceReader(readers().identity_def));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_163 = recordReader<{ readonly kind: "available"; readonly value: bigint; }>("available", read => {
      const field_value = read("value", readers().scalar_bigint);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_164 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly bindings: Hir.CapturedFact<Types.BindingVector>; readonly kind: "data-layout"; readonly declaration: Hir.CapturedFact<Ids.DefId>; readonly fingerprint: Hir.CapturedFact<string>; readonly byteOrder: Hir.CapturedFact<"big" | "little">; readonly addressWidth: Hir.CapturedFact<32 | 64> }>("data-layout", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_declaration = read("declaration", unionReader<Hir.CapturedFact<Ids.DefId>>(() => [readers().record_165, readers().record_10]));
      const field_fingerprint = read("fingerprint", unionReader<Hir.CapturedFact<string>>(() => [readers().record_166, readers().record_10]));
      const field_byteOrder = read("byteOrder", unionReader<Hir.CapturedFact<"big" | "little">>(() => [readers().record_167, readers().record_10]));
      const field_addressWidth = read("addressWidth", unionReader<Hir.CapturedFact<32 | 64>>(() => [readers().record_168, readers().record_10]));
      return { fields: [field_occurrence, field_bindings, field_declaration, field_fingerprint, field_byteOrder, field_addressWidth], value: () => ({ occurrence: field_occurrence.value(), bindings: field_bindings.value(), kind: "data-layout", declaration: field_declaration.value(), fingerprint: field_fingerprint.value(), byteOrder: field_byteOrder.value(), addressWidth: field_addressWidth.value() }) };
    });
  const record_165 = recordReader<{ readonly kind: "available"; readonly value: Ids.DefId; }>("available", read => {
      const field_value = read("value", readers().identity_def);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_166 = recordReader<{ readonly kind: "available"; readonly value: string; }>("available", read => {
      const field_value = read("value", readers().scalar_string);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_167 = recordReader<{ readonly kind: "available"; readonly value: "big" | "little"; }>("available", read => {
      const field_value = read("value", readers().literal_96);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_168 = recordReader<{ readonly kind: "available"; readonly value: 32 | 64; }>("available", read => {
      const field_value = read("value", readers().literal_97);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_169 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly bindings: Hir.CapturedFact<Types.BindingVector>; readonly kind: "value"; readonly geometry: Hir.HirMemoryGeometryCapture; readonly fieldsExpression: Ids.SourceNodeRef | null; readonly fields: Hir.CapturedFact<readonly Ids.SourceNodeRef[]> }>("value", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_geometry = read("geometry", readers().record_170);
      const field_fieldsExpression = read("fieldsExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_fields = read("fields", unionReader<Hir.CapturedFact<readonly Ids.SourceNodeRef[]>>(() => [readers().record_171, readers().record_10]));
      return { fields: [field_occurrence, field_bindings, field_geometry, field_fieldsExpression, field_fields], value: () => ({ occurrence: field_occurrence.value(), bindings: field_bindings.value(), kind: "value", geometry: field_geometry.value(), fieldsExpression: field_fieldsExpression.value(), fields: field_fields.value() }) };
    });
  const record_170 = recordReader<Hir.HirMemoryGeometryCapture>("HirMemoryGeometryCapture", read => {
      const field_source = read("source", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_dataLayoutExpression = read("dataLayoutExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_dataLayout = read("dataLayout", unionReader<Hir.CapturedFact<Ids.DefId>>(() => [readers().record_165, readers().record_10]));
      const field_byteSizeExpression = read("byteSizeExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_byteSize = read("byteSize", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      const field_byteAlignmentExpression = read("byteAlignmentExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_byteAlignment = read("byteAlignment", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      const field_strideExpression = read("strideExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_stride = read("stride", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      return { fields: [field_source, field_dataLayoutExpression, field_dataLayout, field_byteSizeExpression, field_byteSize, field_byteAlignmentExpression, field_byteAlignment, field_strideExpression, field_stride], value: () => ({ source: field_source.value(), dataLayoutExpression: field_dataLayoutExpression.value(), dataLayout: field_dataLayout.value(), byteSizeExpression: field_byteSizeExpression.value(), byteSize: field_byteSize.value(), byteAlignmentExpression: field_byteAlignmentExpression.value(), byteAlignment: field_byteAlignment.value(), strideExpression: field_strideExpression.value(), stride: field_stride.value() }) };
    });
  const record_171 = recordReader<{ readonly kind: "available"; readonly value: readonly Ids.SourceNodeRef[]; }>("available", read => {
      const field_value = read("value", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_172 = recordReader<{ readonly occurrence: Ids.SourceNodeRef; readonly bindings: Hir.CapturedFact<Types.BindingVector>; readonly kind: "array"; readonly geometry: Hir.HirMemoryGeometryCapture; readonly extentExpression: Ids.SourceNodeRef | null; readonly length: Hir.CapturedFact<bigint>; readonly runtimeBase: Hir.CapturedFact<"bigint" | "number">; readonly elementExpression: Ids.SourceNodeRef | null; readonly element: Hir.CapturedFact<Ids.SourceNodeRef> }>("array", read => {
      const field_occurrence = read("occurrence", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_geometry = read("geometry", readers().record_170);
      const field_extentExpression = read("extentExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_length = read("length", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      const field_runtimeBase = read("runtimeBase", unionReader<Hir.CapturedFact<"bigint" | "number">>(() => [readers().record_173, readers().record_10]));
      const field_elementExpression = read("elementExpression", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_element = read("element", unionReader<Hir.CapturedFact<Ids.SourceNodeRef>>(() => [readers().record_159, readers().record_10]));
      return { fields: [field_occurrence, field_bindings, field_geometry, field_extentExpression, field_length, field_runtimeBase, field_elementExpression, field_element], value: () => ({ occurrence: field_occurrence.value(), bindings: field_bindings.value(), kind: "array", geometry: field_geometry.value(), extentExpression: field_extentExpression.value(), length: field_length.value(), runtimeBase: field_runtimeBase.value(), elementExpression: field_elementExpression.value(), element: field_element.value() }) };
    });
  const record_173 = recordReader<{ readonly kind: "available"; readonly value: "bigint" | "number"; }>("available", read => {
      const field_value = read("value", readers().literal_61);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_174 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirObservationCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirObservationCapture | null>(() => [readers().scalar_null, readers().record_175]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_175 = recordReader<Hir.HirObservationCapture>("HirObservationCapture", read => {
      const field_occurrence = read("occurrence", readers().record_6);
      const field_operation = read("operation", readers().literal_98);
      const field_bindings = read("bindings", unionReader<Hir.CapturedFact<Types.BindingVector>>(() => [readers().record_17, readers().record_10]));
      const field_operand = read("operand", readers().record_6);
      const field_layout = read("layout", unionReader<Hir.CapturedFact<Ids.SourceNodeRef>>(() => [readers().record_159, readers().record_10]));
      const field_selector = read("selector", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      const field_field = read("field", unionReader<Hir.CapturedFact<Ids.SourceNodeRef | null>>(() => [readers().record_176, readers().record_10]));
      const field_result = read("result", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_value = read("value", unionReader<Hir.CapturedFact<bigint>>(() => [readers().record_163, readers().record_10]));
      return { fields: [field_occurrence, field_operation, field_bindings, field_operand, field_layout, field_selector, field_field, field_result, field_value], value: () => ({ occurrence: field_occurrence.value(), operation: field_operation.value(), bindings: field_bindings.value(), operand: field_operand.value(), layout: field_layout.value(), selector: field_selector.value(), field: field_field.value(), result: field_result.value(), value: field_value.value() }) };
    });
  const record_176 = recordReader<{ readonly kind: "available"; readonly value: Ids.SourceNodeRef | null; }>("available", read => {
      const field_value = read("value", unionReader<Ids.SourceNodeRef | null>(() => [readers().scalar_null, readers().record_5, readers().record_7]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_177 = recordReader<Hir.HirCoreCarrier & { readonly role: "assignment-pattern"; readonly views: Hir.HirCheckerViews; }>("CheckedAggregate", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_99);
      const field_views = read("views", readers().record_141);
      return { fields: [field_core, field_role, field_views], value: () => ({ core: field_core.value(), role: field_role.value(), views: field_views.value() }) };
    });
  const record_178 = recordReader<Hir.CheckedType>("CheckedType", read => {
      const field_core = read("core", readers().record_84);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_referencedDefinitions = read("referencedDefinitions", sequenceReader(readers().identity_def));
      return { fields: [field_core, field_type, field_referencedDefinitions], value: () => ({ core: field_core.value(), type: field_type.value(), referencedDefinitions: field_referencedDefinitions.value() }) };
    });
  const record_179 = recordReader<Hir.ModifierList<Hir.CheckedPhase>>("ModifierList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_4));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  return { record_150, record_151, record_152, record_153, record_154, record_155, record_156, record_157, record_158, record_159, record_160, record_161, record_162, record_163, record_164, record_165, record_166, record_167, record_168, record_169, record_170, record_171, record_172, record_173, record_174, record_175, record_176, record_177, record_178, record_179 };
}
