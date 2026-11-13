import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup2 } from "./text-read-model.js";
export function createReadGroup2(readers: () => HirTextReaders): HirReadGroup2 {
  const record_60 = recordReader<{ readonly kind: "mapped"; readonly owner: Ids.SourceNodeRef; readonly key: Types.MemberKey; }>("mapped", read => {
      const field_owner = read("owner", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_key = read("key", unionReader<Types.MemberKey>(() => [readers().record_35, readers().record_61, readers().record_63]));
      return { fields: [field_owner, field_key], value: () => ({ kind: "mapped", owner: field_owner.value(), key: field_key.value() }) };
    });
  const record_61 = recordReader<{ readonly kind: "number"; readonly value: Types.ExactRational; }>("number", read => {
      const field_value = read("value", readers().record_62);
      return { fields: [field_value], value: () => ({ kind: "number", value: field_value.value() }) };
    });
  const record_62 = recordReader<Types.ExactRational>("ExactRational", read => {
      const field_numerator = read("numerator", readers().scalar_bigint);
      const field_denominator = read("denominator", readers().scalar_bigint);
      const field_negativeZero = read("negativeZero", readers().scalar_boolean);
      return { fields: [field_numerator, field_denominator, field_negativeZero], value: () => ({ numerator: field_numerator.value(), denominator: field_denominator.value(), negativeZero: field_negativeZero.value() }) };
    });
  const record_63 = recordReader<{ readonly kind: "symbol"; readonly declaration: Ids.DefId; }>("symbol", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "symbol", declaration: field_declaration.value() }) };
    });
  const record_64 = recordReader<{ readonly kind: "index-key" | "index-value"; readonly declaration: Ids.DefId; }>("index-key", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "index-key", declaration: field_declaration.value() }) };
    });
  const record_65 = recordReader<{ readonly kind: "index-key" | "index-value"; readonly declaration: Ids.DefId; }>("index-value", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "index-value", declaration: field_declaration.value() }) };
    });
  const record_66 = recordReader<{ readonly kind: "projection-source"; }>("projection-source", () => {

      return { fields: [], value: () => ({ kind: "projection-source" }) };
    });
  const record_67 = recordReader<{ readonly kind: "parameter"; readonly signature: Ids.SigId; readonly index: number; }>("parameter", read => {
      const field_signature = read("signature", readers().identity_sig);
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_signature, field_index], value: () => ({ kind: "parameter", signature: field_signature.value(), index: field_index.value() }) };
    });
  const record_68 = recordReader<{ readonly kind: "receiver"; readonly signature: Ids.SigId; }>("receiver", read => {
      const field_signature = read("signature", readers().identity_sig);
      return { fields: [field_signature], value: () => ({ kind: "receiver", signature: field_signature.value() }) };
    });
  const record_69 = recordReader<{ readonly kind: "signature-tail"; readonly signature: Ids.SigId; readonly start: number; readonly readonly: boolean; }>("signature-tail", read => {
      const field_signature = read("signature", readers().identity_sig);
      const field_start = read("start", readers().scalar_number);
      const field_readonly = read("readonly", readers().scalar_boolean);
      return { fields: [field_signature, field_start, field_readonly], value: () => ({ kind: "signature-tail", signature: field_signature.value(), start: field_start.value(), readonly: field_readonly.value() }) };
    });
  const record_70 = recordReader<{ readonly kind: "tuple-slice"; readonly start: number; readonly endCount: number; readonly readonly: boolean; }>("tuple-slice", read => {
      const field_start = read("start", readers().scalar_number);
      const field_endCount = read("endCount", readers().scalar_number);
      const field_readonly = read("readonly", readers().scalar_boolean);
      return { fields: [field_start, field_endCount, field_readonly], value: () => ({ kind: "tuple-slice", start: field_start.value(), endCount: field_endCount.value(), readonly: field_readonly.value() }) };
    });
  const record_71 = recordReader<{ readonly kind: "result"; readonly signature: Ids.SigId; }>("result", read => {
      const field_signature = read("signature", readers().identity_sig);
      return { fields: [field_signature], value: () => ({ kind: "result", signature: field_signature.value() }) };
    });
  const record_72 = recordReader<{ readonly kind: "type-argument"; readonly declaration: Ids.DefId; readonly index: number; }>("type-argument", read => {
      const field_declaration = read("declaration", readers().identity_def);
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_declaration, field_index], value: () => ({ kind: "type-argument", declaration: field_declaration.value(), index: field_index.value() }) };
    });
  const record_73 = recordReader<{ readonly kind: "sum-arm"; readonly family: Types.SumFamily; readonly index: number; }>("sum-arm", read => {
      const field_family = read("family", readers().record_74);
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_family, field_index], value: () => ({ kind: "sum-arm", family: field_family.value(), index: field_index.value() }) };
    });
  const record_74 = recordReader<Types.SumFamily>("SumFamily", read => {
      const field_origin = read("origin", readers().literal_7);
      const field_component = read("component", readers().record_43);
      const field_parameters = read("parameters", sequenceReader(readers().record_20));
      const field_roles = read("roles", sequenceReader(readers().record_75));
      return { fields: [field_origin, field_component, field_parameters, field_roles], value: () => ({ origin: field_origin.value(), component: field_component.value(), parameters: field_parameters.value(), roles: field_roles.value() }) };
    });
  const record_75 = recordReader<Types.SumArmRole>("SumArmRole", read => {
      const field_authoredIndex = read("authoredIndex", readers().scalar_number);
      const field_component = read("component", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_member = read("member", readers().identity_t);
      return { fields: [field_authoredIndex, field_component, field_member], value: () => ({ authoredIndex: field_authoredIndex.value(), component: field_component.value(), member: field_member.value() }) };
    });
  const record_76 = recordReader<{ readonly kind: "awaited"; }>("awaited", () => {

      return { fields: [], value: () => ({ kind: "awaited" }) };
    });
  const record_77 = recordReader<Hir.HirDiagnosticRoot>("HirDiagnosticRoot", read => {
      const field_diagnostic = read("diagnostic", readers().scalar_number);
      const field_owner = read("owner", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_obligations = read("obligations", sequenceReader(unionReader<Hir.ProofObligation>(() => [readers().record_78, readers().record_79, readers().record_80])));
      return { fields: [field_diagnostic, field_owner, field_obligations], value: () => ({ diagnostic: field_diagnostic.value(), owner: field_owner.value(), obligations: field_obligations.value() }) };
    });
  const record_78 = recordReader<{ readonly kind: "write-fit"; readonly ordinal: number; readonly occurrence: Ids.NodeRef; readonly value: Ids.NodeRef; readonly destination: Ids.SourceNodeRef; readonly destinationType: Ids.TyId; }>("write-fit", read => {
      const field_ordinal = read("ordinal", readers().scalar_number);
      const field_occurrence = read("occurrence", readers().record_6);
      const field_value = read("value", readers().record_6);
      const field_destination = read("destination", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_destinationType = read("destinationType", readers().identity_t);
      return { fields: [field_ordinal, field_occurrence, field_value, field_destination, field_destinationType], value: () => ({ kind: "write-fit", ordinal: field_ordinal.value(), occurrence: field_occurrence.value(), value: field_value.value(), destination: field_destination.value(), destinationType: field_destinationType.value() }) };
    });
  const record_79 = recordReader<{ readonly kind: "operator"; readonly ordinal: number; readonly occurrence: Ids.NodeRef; readonly operator: "!" | "!=" | "!==" | "%" | "&" | "*" | "**" | "+" | "-" | "/" | "<" | "<<" | "<=" | "==" | "===" | ">" | ">=" | ">>" | ">>>" | "^" | "delete" | "in" | "instanceof" | "typeof" | "void" | "|" | "~"; readonly operands: readonly Ids.NodeRef[] }>("operator", read => {
      const field_ordinal = read("ordinal", readers().scalar_number);
      const field_occurrence = read("occurrence", readers().record_6);
      const field_operator = read("operator", unionReader<"!" | "!=" | "!==" | "%" | "&" | "*" | "**" | "+" | "-" | "/" | "<" | "<<" | "<=" | "==" | "===" | ">" | ">=" | ">>" | ">>>" | "^" | "delete" | "in" | "instanceof" | "typeof" | "void" | "|" | "~">(() => [readers().literal_8, readers().literal_9, readers().literal_10, readers().literal_11, readers().literal_12, readers().literal_13, readers().literal_14, readers().literal_15, readers().literal_16, readers().literal_17, readers().literal_18, readers().literal_19, readers().literal_20, readers().literal_21, readers().literal_22, readers().literal_23, readers().literal_24, readers().literal_25, readers().literal_26, readers().literal_27, readers().literal_28, readers().literal_29, readers().literal_30, readers().literal_31, readers().literal_32, readers().literal_33, readers().literal_34]));
      const field_operands = read("operands", sequenceReader(readers().record_6));
      return { fields: [field_ordinal, field_occurrence, field_operator, field_operands], value: () => ({ kind: "operator", ordinal: field_ordinal.value(), occurrence: field_occurrence.value(), operator: field_operator.value(), operands: field_operands.value() }) };
    });
  const record_80 = recordReader<{ readonly kind: "index"; readonly ordinal: number; readonly occurrence: Ids.NodeRef; readonly receiver: Ids.NodeRef; readonly key: Ids.NodeRef; }>("index", read => {
      const field_ordinal = read("ordinal", readers().scalar_number);
      const field_occurrence = read("occurrence", readers().record_6);
      const field_receiver = read("receiver", readers().record_6);
      const field_key = read("key", readers().record_6);
      return { fields: [field_ordinal, field_occurrence, field_receiver, field_key], value: () => ({ kind: "index", ordinal: field_ordinal.value(), occurrence: field_occurrence.value(), receiver: field_receiver.value(), key: field_key.value() }) };
    });
  const record_81 = recordReader<Hir.TextRange>("TextRange", read => {
      const field_pos = read("pos", readers().scalar_number);
      const field_end = read("end", readers().scalar_number);
      return { fields: [field_pos, field_end], value: () => ({ pos: field_pos.value(), end: field_end.value() }) };
    });
  const record_82 = recordReader<Hir.NodeList<Hir.Expression<Hir.CheckedPhase>>>("NodeList", read => {
      const field_loc = read("loc", readers().record_81);
      const field_nodes = read("nodes", sequenceReader(readers().syntax_2));
      return { fields: [field_loc, field_nodes], value: () => ({ loc: field_loc.value(), nodes: field_nodes.value() }) };
    });
  const record_83 = recordReader<Hir.HirCoreCarrier & { readonly role: "value"; readonly value: Hir.CheckedValue; }>("CheckedAggregate", read => {
      const field_core = read("core", readers().record_84);
      const field_role = read("role", readers().literal_93);
      const field_value = read("value", readers().record_140);
      return { fields: [field_core, field_role, field_value], value: () => ({ core: field_core.value(), role: field_role.value(), value: field_value.value() }) };
    });
  const record_84 = recordReader<Hir.HirCoreCapture>("HirCoreCapture", read => {
      const field_provider = read("provider", unionReader<Hir.CapturedFact<Ids.DefId | null>>(() => [readers().record_85, readers().record_10]));
      const field_markers = read("markers", unionReader<Hir.CapturedFact<Hir.HirMarkersCapture>>(() => [readers().record_86, readers().record_10]));
      const field_pointerType = read("pointerType", unionReader<Hir.CapturedFact<Hir.HirPointerTypeCapture | null>>(() => [readers().record_92, readers().record_10]));
      const field_pointerOperation = read("pointerOperation", unionReader<Hir.CapturedFact<Hir.HirPointerOperationCapture | null>>(() => [readers().record_98, readers().record_10]));
      const field_fieldBinding = read("fieldBinding", unionReader<Hir.CapturedFact<Hir.HirFieldBindingCapture | null>>(() => [readers().record_296, readers().record_10]));
      const field_recordBinding = read("recordBinding", unionReader<Hir.CapturedFact<Hir.HirRecordBindingCapture | null>>(() => [readers().record_299, readers().record_10]));
      const field_attribute = read("attribute", unionReader<Hir.CapturedFact<Hir.HirAttributeCapture | null>>(() => [readers().record_123, readers().record_10]));
      const field_safety = read("safety", unionReader<Hir.CapturedFact<Hir.HirSafetyCapture | null>>(() => [readers().record_127, readers().record_10]));
      const field_argumentPassing = read("argumentPassing", unionReader<Hir.CapturedFact<Hir.HirArgumentPassingCapture | null>>(() => [readers().record_136, readers().record_10]));
      const field_flowState = read("flowState", unionReader<Hir.CapturedFact<"borrowed-mut" | "borrowed-shared" | "moved" | null>>(() => [readers().record_139, readers().record_10]));
      return { fields: [field_provider, field_markers, field_pointerType, field_pointerOperation, field_fieldBinding, field_recordBinding, field_attribute, field_safety, field_argumentPassing, field_flowState], value: () => ({ provider: field_provider.value(), markers: field_markers.value(), pointerType: field_pointerType.value(), pointerOperation: field_pointerOperation.value(), fieldBinding: field_fieldBinding.value(), recordBinding: field_recordBinding.value(), attribute: field_attribute.value(), safety: field_safety.value(), argumentPassing: field_argumentPassing.value(), flowState: field_flowState.value() }) };
    });
  const record_85 = recordReader<{ readonly kind: "available"; readonly value: Ids.DefId | null; }>("available", read => {
      const field_value = read("value", unionReader<Ids.DefId | null>(() => [readers().scalar_null, readers().identity_def]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_86 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirMarkersCapture; }>("available", read => {
      const field_value = read("value", readers().record_87);
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_87 = recordReader<Hir.HirMarkersCapture>("HirMarkersCapture", read => {
      const field_struct = read("struct", unionReader<{ readonly valueType: boolean; readonly fields: Hir.CapturedFact<readonly Hir.HirFieldMarkerCapture[]>; } | null>(() => [readers().scalar_null, readers().record_88]));
      const field_field = read("field", unionReader<Hir.HirFieldMarkerCapture | null>(() => [readers().scalar_null, readers().record_90]));
      const field_defaultValue = read("defaultValue", unionReader<{ readonly typeNode: Ids.SourceNodeRef; readonly type: Hir.CapturedFact<Ids.TyId>; } | null>(() => [readers().scalar_null, readers().record_91]));
      const field_jsString = read("jsString", readers().scalar_boolean);
      return { fields: [field_struct, field_field, field_defaultValue, field_jsString], value: () => ({ struct: field_struct.value(), field: field_field.value(), defaultValue: field_defaultValue.value(), jsString: field_jsString.value() }) };
    });
  const record_88 = recordReader<{ readonly valueType: boolean; readonly fields: Hir.CapturedFact<readonly Hir.HirFieldMarkerCapture[]>; }>("Record", read => {
      const field_valueType = read("valueType", readers().scalar_boolean);
      const field_fields = read("fields", unionReader<Hir.CapturedFact<readonly Hir.HirFieldMarkerCapture[]>>(() => [readers().record_89, readers().record_10]));
      return { fields: [field_valueType, field_fields], value: () => ({ valueType: field_valueType.value(), fields: field_fields.value() }) };
    });
  const record_89 = recordReader<{ readonly kind: "available"; readonly value: readonly Hir.HirFieldMarkerCapture[]; }>("available", read => {
      const field_value = read("value", sequenceReader(readers().record_90));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  return { record_60, record_61, record_62, record_63, record_64, record_65, record_66, record_67, record_68, record_69, record_70, record_71, record_72, record_73, record_74, record_75, record_76, record_77, record_78, record_79, record_80, record_81, record_82, record_83, record_84, record_85, record_86, record_87, record_88, record_89 };
}
