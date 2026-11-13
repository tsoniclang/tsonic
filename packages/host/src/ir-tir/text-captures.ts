import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  BindingVector, TypeComponent
} from "../ir-types/contract.js";
import type {
  DefId, NodeRef, SourceNodeRef, TyId
} from "../ids/contract.js";
import type {
  CapturedFact, HirArgumentPassingCapture, HirAttributeCapture, HirCapturedType, HirCoreCapture, HirFieldBindingCapture, HirFieldMarkerCapture, HirMarkersCapture, HirPointerOperationCapture, HirPointerTypeCapture, HirRecordBindingCapture, HirRecordFieldBindingCapture, HirSafetyCapture, HirSafetySelectionCapture
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, nullableWork, sequenceWork } from "./text-layouts.js";

export interface CapturesTextReads {
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_NodeRef: TirRecordCodec<NodeRef>;
  readonly work_C__HirPointerOperationCapture_: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null>>;
  readonly work_C__HirPointerTypeCapture_: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null>>;
  readonly work_SourceNodeRef: TirRecordCodec<SourceNodeRef>;
  readonly work_TypeComponent: TirRecordCodec<TypeComponent>;
}

export interface CapturesTextModel {
  readonly work_HirCoreCapture: TirRecordCodec<HirCoreCapture>;
  readonly work_HirFieldBindingCapture: TirRecordCodec<HirFieldBindingCapture>;
  readonly work_HirRecordFieldBindingCapture: TirRecordCodec<HirRecordFieldBindingCapture>;
  readonly work_HirRecordBindingCapture: TirRecordCodec<HirRecordBindingCapture>;
  readonly work_C__HirFieldBindingCapture__available: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirFieldBindingCapture__unavailable: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirFieldBindingCapture_: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null>>;
  readonly work_C__HirRecordBindingCapture__available: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirRecordBindingCapture__unavailable: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirRecordBindingCapture_: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null>>;
  readonly work_C_BindingVector__available: TirRecordCodec<CapturedFact<BindingVector> & { readonly kind: "available" }>;
  readonly work_C_BindingVector__unavailable: TirRecordCodec<CapturedFact<BindingVector> & { readonly kind: "unavailable" }>;
  readonly work_C_BindingVector_: TirRecordCodec<CapturedFact<BindingVector>>;
  readonly work_C_SourceNodeRef__available: TirRecordCodec<CapturedFact<SourceNodeRef> & { readonly kind: "available" }>;
  readonly work_C_SourceNodeRef__unavailable: TirRecordCodec<CapturedFact<SourceNodeRef> & { readonly kind: "unavailable" }>;
  readonly work_C_SourceNodeRef_: TirRecordCodec<CapturedFact<SourceNodeRef>>;
  readonly work_HirMarkersCapture: TirRecordCodec<HirMarkersCapture>;
  readonly work_Record_structMarker: TirRecordCodec<NonNullable<HirMarkersCapture["struct"]>>;
  readonly work_Record_defaultValue: TirRecordCodec<NonNullable<HirMarkersCapture["defaultValue"]>>;
  readonly work_HirFieldMarkerCapture: TirRecordCodec<HirFieldMarkerCapture>;
  readonly work_HirCapturedType: TirRecordCodec<HirCapturedType>;
  readonly work_HirAttributeCapture_builder_state: TirRecordCodec<HirAttributeCapture & { readonly kind: "builder-state" }>;
  readonly work_HirAttributeCapture_application: TirRecordCodec<HirAttributeCapture & { readonly kind: "application" }>;
  readonly work_Record_selectedMember: TirRecordCodec<NonNullable<HirAttributeCapture["selectedMember"]>>;
  readonly work_HirSafetySelectionCapture_selected: TirRecordCodec<HirSafetySelectionCapture & { readonly kind: "selected" }>;
  readonly work_HirSafetySelectionCapture_unavailable: TirRecordCodec<HirSafetySelectionCapture & { readonly kind: "unavailable" }>;
  readonly work_HirSafetyCapture_operation_expression: TirRecordCodec<HirSafetyCapture & { readonly operation: "expression" }>;
  readonly work_HirSafetyCapture_operation_remaining_block: TirRecordCodec<HirSafetyCapture & { readonly operation: "remaining-block" }>;
  readonly work_HirSafetyCapture_operation_root: TirRecordCodec<HirSafetyCapture & { readonly operation: "root" }>;
  readonly work_HirSafetyCapture_operation_select_member: TirRecordCodec<HirSafetyCapture & { readonly operation: "select-member" }>;
  readonly work_HirSafetyCapture_operation_placement: TirRecordCodec<HirSafetyCapture & { readonly operation: "placement" }>;
  readonly work_HirSafetyCapture_operation_apply: TirRecordCodec<HirSafetyCapture & { readonly operation: "apply" }>;
  readonly work_HirArgumentPassingCapture_role_declaration: TirRecordCodec<HirArgumentPassingCapture & { readonly role: "declaration" }>;
  readonly work_HirArgumentPassingCapture_role_argument: TirRecordCodec<HirArgumentPassingCapture & { readonly role: "argument" }>;
  readonly work_HirAttributeCapture: TirRecordCodec<HirAttributeCapture>;
  readonly work_HirSafetySelectionCapture: TirRecordCodec<HirSafetySelectionCapture>;
  readonly work_HirSafetyCapture: TirRecordCodec<HirSafetyCapture>;
  readonly work_HirArgumentPassingCapture: TirRecordCodec<HirArgumentPassingCapture>;
  readonly work_C__def__available: TirRecordCodec<CapturedFact<DefId | null> & { readonly kind: "available" }>;
  readonly work_C__def__unavailable: TirRecordCodec<CapturedFact<DefId | null> & { readonly kind: "unavailable" }>;
  readonly work_C__def_: TirRecordCodec<CapturedFact<DefId | null>>;
  readonly work_C_HirMarkersCapture__available: TirRecordCodec<CapturedFact<HirMarkersCapture> & { readonly kind: "available" }>;
  readonly work_C_HirMarkersCapture__unavailable: TirRecordCodec<CapturedFact<HirMarkersCapture> & { readonly kind: "unavailable" }>;
  readonly work_C_HirMarkersCapture_: TirRecordCodec<CapturedFact<HirMarkersCapture>>;
  readonly work_C__HirAttributeCapture__available: TirRecordCodec<CapturedFact<HirAttributeCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirAttributeCapture__unavailable: TirRecordCodec<CapturedFact<HirAttributeCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirAttributeCapture_: TirRecordCodec<CapturedFact<HirAttributeCapture | null>>;
  readonly work_C__HirSafetyCapture__available: TirRecordCodec<CapturedFact<HirSafetyCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirSafetyCapture__unavailable: TirRecordCodec<CapturedFact<HirSafetyCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirSafetyCapture_: TirRecordCodec<CapturedFact<HirSafetyCapture | null>>;
  readonly work_C__HirArgumentPassingCapture__available: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirArgumentPassingCapture__unavailable: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirArgumentPassingCapture_: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null>>;
  readonly work_C__FlowState__available: TirRecordCodec<HirCoreCapture["flowState"] & { readonly kind: "available" }>;
  readonly work_C__FlowState__unavailable: TirRecordCodec<HirCoreCapture["flowState"] & { readonly kind: "unavailable" }>;
  readonly work_C__FlowState_: TirRecordCodec<HirCoreCapture["flowState"]>;
  readonly work_C__HirFieldMarkerCapture___available: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "available" }>;
  readonly work_C__HirFieldMarkerCapture___unavailable: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "unavailable" }>;
  readonly work_C__HirFieldMarkerCapture__: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]>>;
  readonly work_C_t__available: TirRecordCodec<CapturedFact<TyId> & { readonly kind: "available" }>;
  readonly work_C_t__unavailable: TirRecordCodec<CapturedFact<TyId> & { readonly kind: "unavailable" }>;
  readonly work_C_t_: TirRecordCodec<CapturedFact<TyId>>;
}

export const createCapturesText = (kernel: TirTextKernel, read: CapturesTextReads): CapturesTextModel => {
  const { defineRecord, booleanReader, definitionReader, stringReader, typeReader } = kernel;
  const work_HirCoreCapture: TirRecordCodec<HirCoreCapture> = defineRecord<HirCoreCapture>("HirCoreCapture", "HirCoreCapture", null, "HirCoreCapture", null, null, fields => fields
    .field("provider", "C<?def>", value => work_C__def_.write(value.provider), lazyReader(() => work_C__def_.reader))
    .field("markers", "C<HirMarkersCapture>", value => work_C_HirMarkersCapture_.write(value.markers), lazyReader(() => work_C_HirMarkersCapture_.reader))
    .field("pointerType", "C<?HirPointerTypeCapture>", value => read.work_C__HirPointerTypeCapture_.write(value.pointerType), lazyReader(() => read.work_C__HirPointerTypeCapture_.reader))
    .field("pointerOperation", "C<?HirPointerOperationCapture>", value => read.work_C__HirPointerOperationCapture_.write(value.pointerOperation), lazyReader(() => read.work_C__HirPointerOperationCapture_.reader))
    .field("fieldBinding", "C<?HirFieldBindingCapture>", value => work_C__HirFieldBindingCapture_.write(value.fieldBinding), lazyReader(() => work_C__HirFieldBindingCapture_.reader))
    .field("recordBinding", "C<?HirRecordBindingCapture>", value => work_C__HirRecordBindingCapture_.write(value.recordBinding), lazyReader(() => work_C__HirRecordBindingCapture_.reader))
    .field("attribute", "C<?HirAttributeCapture>", value => work_C__HirAttributeCapture_.write(value.attribute), lazyReader(() => work_C__HirAttributeCapture_.reader))
    .field("safety", "C<?HirSafetyCapture>", value => work_C__HirSafetyCapture_.write(value.safety), lazyReader(() => work_C__HirSafetyCapture_.reader))
    .field("argumentPassing", "C<?HirArgumentPassingCapture>", value => work_C__HirArgumentPassingCapture_.write(value.argumentPassing), lazyReader(() => work_C__HirArgumentPassingCapture_.reader))
    .field("flowState", "C<?FlowState>", value => work_C__FlowState_.write(value.flowState), lazyReader(() => work_C__FlowState_.reader))
    .finish((field_provider, field_markers, field_pointerType, field_pointerOperation, field_fieldBinding, field_recordBinding, field_attribute, field_safety, field_argumentPassing, field_flowState) => ({
      provider: field_provider, markers: field_markers, pointerType: field_pointerType, pointerOperation: field_pointerOperation,
      fieldBinding: field_fieldBinding, recordBinding: field_recordBinding,
      attribute: field_attribute, safety: field_safety, argumentPassing: field_argumentPassing, flowState: field_flowState,
    })));
  const work_HirFieldBindingCapture: TirRecordCodec<HirFieldBindingCapture> = defineRecord<HirFieldBindingCapture>("HirFieldBindingCapture", "HirFieldBindingCapture", null, "HirFieldBindingCapture", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("bindings", "C<BindingVector>", value => work_C_BindingVector_.write(value.bindings), lazyReader(() => work_C_BindingVector_.reader))
    .field("owner", "C<t>", value => work_C_t_.write(value.owner), lazyReader(() => work_C_t_.reader))
    .field("pointee", "C<t>", value => work_C_t_.write(value.pointee), lazyReader(() => work_C_t_.reader))
    .field("fieldExpression", "NodeRef", value => read.work_NodeRef.write(value.fieldExpression), lazyReader(() => read.work_NodeRef.reader))
    .field("field", "C<SourceNodeRef>", value => work_C_SourceNodeRef_.write(value.field), lazyReader(() => work_C_SourceNodeRef_.reader))
    .field("pointerExpression", "NodeRef", value => read.work_NodeRef.write(value.pointerExpression), lazyReader(() => read.work_NodeRef.reader))
    .finish((field_occurrence, field_bindings, field_owner, field_pointee, field_fieldExpression, field_field, field_pointerExpression) => ({
      occurrence: field_occurrence, bindings: field_bindings, owner: field_owner, pointee: field_pointee,
      fieldExpression: field_fieldExpression, field: field_field, pointerExpression: field_pointerExpression,
    })));
  const work_HirRecordFieldBindingCapture: TirRecordCodec<HirRecordFieldBindingCapture> = defineRecord<HirRecordFieldBindingCapture>("HirRecordFieldBindingCapture", "HirRecordFieldBindingCapture", null, "HirRecordFieldBindingCapture", null, null, fields => fields
    .field("expression", "NodeRef", value => read.work_NodeRef.write(value.expression), lazyReader(() => read.work_NodeRef.reader))
    .field("binding", "NodeRef", value => read.work_NodeRef.write(value.binding), lazyReader(() => read.work_NodeRef.reader))
    .finish((field_expression, field_binding) => ({ expression: field_expression, binding: field_binding })));
  const work_HirRecordBindingCapture: TirRecordCodec<HirRecordBindingCapture> = defineRecord<HirRecordBindingCapture>("HirRecordBindingCapture", "HirRecordBindingCapture", null, "HirRecordBindingCapture", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("bindings", "C<BindingVector>", value => work_C_BindingVector_.write(value.bindings), lazyReader(() => work_C_BindingVector_.reader))
    .field("source", "C<t>", value => work_C_t_.write(value.source), lazyReader(() => work_C_t_.reader))
    .field("layoutExpression", "NodeRef", value => read.work_NodeRef.write(value.layoutExpression), lazyReader(() => read.work_NodeRef.reader))
    .field("layout", "C<SourceNodeRef>", value => work_C_SourceNodeRef_.write(value.layout), lazyReader(() => work_C_SourceNodeRef_.reader))
    .field("fields", "[HirRecordFieldBindingCapture]", value => sequenceWork("[HirRecordFieldBindingCapture]", value.fields, actual => work_HirRecordFieldBindingCapture.write(actual)), sequenceReader("[HirRecordFieldBindingCapture]", lazyReader(() => work_HirRecordFieldBindingCapture.reader)))
    .finish((field_occurrence, field_bindings, field_source, field_layoutExpression, field_layout, field_fields) => ({
      occurrence: field_occurrence, bindings: field_bindings, source: field_source, layoutExpression: field_layoutExpression,
      layout: field_layout, fields: field_fields,
    })));
  const work_HirMarkersCapture: TirRecordCodec<HirMarkersCapture> = defineRecord<HirMarkersCapture>("HirMarkersCapture", "HirMarkersCapture", null, "HirMarkersCapture", null, null, fields => fields
    .field("struct", "?Record.structMarker", value => nullableWork(value.struct, actual => work_Record_structMarker.write(actual)), nullableReader(lazyReader(() => work_Record_structMarker.reader)))
    .field("field", "?HirFieldMarkerCapture", value => nullableWork(value.field, actual => work_HirFieldMarkerCapture.write(actual)), nullableReader(lazyReader(() => work_HirFieldMarkerCapture.reader)))
    .field("defaultValue", "?Record.defaultValue", value => nullableWork(value.defaultValue, actual => work_Record_defaultValue.write(actual)), nullableReader(lazyReader(() => work_Record_defaultValue.reader)))
    .field("jsString", "boolean", value => scalarWork("boolean", value.jsString), booleanReader)
    .finish((field_struct, field_field, field_defaultValue, field_jsString) => ({ struct: field_struct, field: field_field, defaultValue: field_defaultValue, jsString: field_jsString })));
  const work_Record_structMarker: TirRecordCodec<NonNullable<HirMarkersCapture["struct"]>> = defineRecord<NonNullable<HirMarkersCapture["struct"]>>("Record.structMarker", "Record", null, "Record", null, null, fields => fields
    .field("valueType", "boolean", value => scalarWork("boolean", value.valueType), booleanReader)
    .field("fields", "C<[HirFieldMarkerCapture]>", value => work_C__HirFieldMarkerCapture__.write(value.fields), lazyReader(() => work_C__HirFieldMarkerCapture__.reader))
    .finish((field_valueType, field_fields) => ({ valueType: field_valueType, fields: field_fields })));
  const work_Record_defaultValue: TirRecordCodec<NonNullable<HirMarkersCapture["defaultValue"]>> = defineRecord<NonNullable<HirMarkersCapture["defaultValue"]>>("Record.defaultValue", "Record", null, "Record", null, null, fields => fields
    .field("typeNode", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.typeNode), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("type", "C<t>", value => work_C_t_.write(value.type), lazyReader(() => work_C_t_.reader))
    .finish((field_typeNode, field_type) => ({ typeNode: field_typeNode, type: field_type })));
  const work_HirFieldMarkerCapture: TirRecordCodec<HirFieldMarkerCapture> = defineRecord<HirFieldMarkerCapture>("HirFieldMarkerCapture", "HirFieldMarkerCapture", null, "HirFieldMarkerCapture", null, null, fields => fields
    .field("name", "string", value => scalarWork("string", value.name), stringReader)
    .field("typeNode", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.typeNode), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("type", "C<t>", value => work_C_t_.write(value.type), lazyReader(() => work_C_t_.reader))
    .field("readonly", "boolean", value => scalarWork("boolean", value.readonly), booleanReader)
    .finish((field_name, field_typeNode, field_type, field_readonly) => ({ name: field_name, typeNode: field_typeNode, type: field_type, readonly: field_readonly })));
  const work_HirCapturedType: TirRecordCodec<HirCapturedType> = defineRecord<HirCapturedType>("HirCapturedType", "HirCapturedType", null, "HirCapturedType", null, null, fields => fields
    .field("type", "C<t>", value => work_C_t_.write(value.type), lazyReader(() => work_C_t_.reader))
    .field("component", "TypeComponent", value => read.work_TypeComponent.write(value.component), lazyReader(() => read.work_TypeComponent.reader))
    .finish((field_type, field_component) => ({ type: field_type, component: field_component })));
  const work_HirAttributeCapture_builder_state: TirRecordCodec<HirAttributeCapture & { readonly kind: "builder-state" }> = defineRecord<HirAttributeCapture & { readonly kind: "builder-state" }>("HirAttributeCapture#builder-state", "HirAttributeCapture", { field: "kind", value: "builder-state" }, "builder-state", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("applicationTarget", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.applicationTarget), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("selectedMember", "?Record.selectedMember", value => nullableWork(value.selectedMember, actual => work_Record_selectedMember.write(actual)), nullableReader(lazyReader(() => work_Record_selectedMember.reader)))
    .field("applicationMemberKind", "?AttributeMemberKind", value => nullableWork(value.applicationMemberKind, actual => scalarWork("AttributeMemberKind", actual)), nullableReader(literalReader<NonNullable<(HirAttributeCapture & { readonly kind: "builder-state" })["applicationMemberKind"]>>("AttributeMemberKind", ["property","method"])))
    .field("applicationPlacement", "?AttributePlacement", value => nullableWork(value.applicationPlacement, actual => scalarWork("AttributePlacement", actual)), nullableReader(literalReader<NonNullable<(HirAttributeCapture & { readonly kind: "builder-state" })["applicationPlacement"]>>("AttributePlacement", ["declaration","constructor"])))
    .field("applicationParameterName", "?string", value => nullableWork(value.applicationParameterName, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .field("applicationTargetSpecifier", "?string", value => nullableWork(value.applicationTargetSpecifier, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .finish((field_occurrence, field_applicationTarget, field_selectedMember, field_applicationMemberKind, field_applicationPlacement, field_applicationParameterName, field_applicationTargetSpecifier) => ({
      kind: "builder-state", occurrence: field_occurrence, applicationTarget: field_applicationTarget,
      selectedMember: field_selectedMember, applicationMemberKind: field_applicationMemberKind,
      applicationPlacement: field_applicationPlacement, applicationParameterName: field_applicationParameterName,
      applicationTargetSpecifier: field_applicationTargetSpecifier,
    })));
  const work_HirAttributeCapture_application: TirRecordCodec<HirAttributeCapture & { readonly kind: "application" }> = defineRecord<HirAttributeCapture & { readonly kind: "application" }>("HirAttributeCapture#application", "HirAttributeCapture", { field: "kind", value: "application" }, "application", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("applicationTarget", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.applicationTarget), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("selectedMember", "?Record.selectedMember", value => nullableWork(value.selectedMember, actual => work_Record_selectedMember.write(actual)), nullableReader(lazyReader(() => work_Record_selectedMember.reader)))
    .field("applicationMemberKind", "?AttributeMemberKind", value => nullableWork(value.applicationMemberKind, actual => scalarWork("AttributeMemberKind", actual)), nullableReader(literalReader<NonNullable<(HirAttributeCapture & { readonly kind: "application" })["applicationMemberKind"]>>("AttributeMemberKind", ["property","method"])))
    .field("applicationPlacement", "?AttributePlacement", value => nullableWork(value.applicationPlacement, actual => scalarWork("AttributePlacement", actual)), nullableReader(literalReader<NonNullable<(HirAttributeCapture & { readonly kind: "application" })["applicationPlacement"]>>("AttributePlacement", ["declaration","constructor"])))
    .field("applicationParameterName", "?string", value => nullableWork(value.applicationParameterName, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .field("applicationTargetSpecifier", "?string", value => nullableWork(value.applicationTargetSpecifier, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .field("invocation", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.invocation), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_occurrence, field_applicationTarget, field_selectedMember, field_applicationMemberKind, field_applicationPlacement, field_applicationParameterName, field_applicationTargetSpecifier, field_invocation) => ({
      kind: "application", occurrence: field_occurrence, applicationTarget: field_applicationTarget,
      selectedMember: field_selectedMember, applicationMemberKind: field_applicationMemberKind,
      applicationPlacement: field_applicationPlacement, applicationParameterName: field_applicationParameterName,
      applicationTargetSpecifier: field_applicationTargetSpecifier, invocation: field_invocation,
    })));
  const work_Record_selectedMember: TirRecordCodec<NonNullable<HirAttributeCapture["selectedMember"]>> = defineRecord<NonNullable<HirAttributeCapture["selectedMember"]>>("Record.selectedMember", "Record", null, "Record", null, null, fields => fields
    .field("selectedDeclaration", "?SourceNodeRef", value => nullableWork(value.selectedDeclaration, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("declarations", "[SourceNodeRef]", value => sequenceWork("[SourceNodeRef]", value.declarations, actual => read.work_SourceNodeRef.write(actual)), sequenceReader("[SourceNodeRef]", lazyReader(() => read.work_SourceNodeRef.reader)))
    .finish((field_selectedDeclaration, field_declarations) => ({ selectedDeclaration: field_selectedDeclaration, declarations: field_declarations })));
  const work_HirSafetySelectionCapture_selected: TirRecordCodec<HirSafetySelectionCapture & { readonly kind: "selected" }> = defineRecord<HirSafetySelectionCapture & { readonly kind: "selected" }>("HirSafetySelectionCapture#selected", "HirSafetySelectionCapture", { field: "kind", value: "selected" }, "selected", null, null, fields => fields
    .field("expression", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.expression), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("declaration", "?SourceNodeRef", value => nullableWork(value.declaration, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("declarations", "[SourceNodeRef]", value => sequenceWork("[SourceNodeRef]", value.declarations, actual => read.work_SourceNodeRef.write(actual)), sequenceReader("[SourceNodeRef]", lazyReader(() => read.work_SourceNodeRef.reader)))
    .finish((field_expression, field_declaration, field_declarations) => ({ kind: "selected", expression: field_expression, declaration: field_declaration, declarations: field_declarations })));
  const work_HirSafetySelectionCapture_unavailable: TirRecordCodec<HirSafetySelectionCapture & { readonly kind: "unavailable" }> = defineRecord<HirSafetySelectionCapture & { readonly kind: "unavailable" }>("HirSafetySelectionCapture#unavailable", "HirSafetySelectionCapture", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "SafetySelectionUnavailable", value => scalarWork("SafetySelectionUnavailable", value.reason), literalReader<(HirSafetySelectionCapture & { readonly kind: "unavailable" })["reason"]>("SafetySelectionUnavailable", ["function-shape","receiver","member-evidence"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_HirSafetyCapture_operation_expression: TirRecordCodec<HirSafetyCapture & { readonly operation: "expression" }> = defineRecord<HirSafetyCapture & { readonly operation: "expression" }>("HirSafetyCapture@operation=expression", "HirSafetyCapture", { field: "operation", value: "expression" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'unsafe-context", value => scalarWork("'unsafe-context", value.family), literalReader<(HirSafetyCapture & { readonly operation: "expression" })["family"]>("'unsafe-context", ["unsafe-context"]))
    .field("operation", "'expression", value => scalarWork("'expression", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "expression" })["operation"]>("'expression", ["expression"]))
    .field("expression", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.expression), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_occurrence, field_provider, field_family, field_operation, field_expression) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation,
      expression: field_expression,
    })));
  const work_HirSafetyCapture_operation_remaining_block: TirRecordCodec<HirSafetyCapture & { readonly operation: "remaining-block" }> = defineRecord<HirSafetyCapture & { readonly operation: "remaining-block" }>("HirSafetyCapture@operation=remaining-block", "HirSafetyCapture", { field: "operation", value: "remaining-block" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'unsafe-context", value => scalarWork("'unsafe-context", value.family), literalReader<(HirSafetyCapture & { readonly operation: "remaining-block" })["family"]>("'unsafe-context", ["unsafe-context"]))
    .field("operation", "'remaining-block", value => scalarWork("'remaining-block", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "remaining-block" })["operation"]>("'remaining-block", ["remaining-block"]))
    .field("firstDirectStatement", "boolean", value => scalarWork("boolean", value.firstDirectStatement), booleanReader)
    .finish((field_occurrence, field_provider, field_family, field_operation, field_firstDirectStatement) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation,
      firstDirectStatement: field_firstDirectStatement,
    })));
  const work_HirSafetyCapture_operation_root: TirRecordCodec<HirSafetyCapture & { readonly operation: "root" }> = defineRecord<HirSafetyCapture & { readonly operation: "root" }>("HirSafetyCapture@operation=root", "HirSafetyCapture", { field: "operation", value: "root" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'safety", value => scalarWork("'safety", value.family), literalReader<(HirSafetyCapture & { readonly operation: "root" })["family"]>("'safety", ["safety"]))
    .field("operation", "'root", value => scalarWork("'root", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "root" })["operation"]>("'root", ["root"]))
    .field("form", "SafetyRootForm", value => scalarWork("SafetyRootForm", value.form), literalReader<(HirSafetyCapture & { readonly operation: "root" })["form"]>("SafetyRootForm", ["type","value"]))
    .field("target", "?SourceNodeRef", value => nullableWork(value.target, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .finish((field_occurrence, field_provider, field_family, field_operation, field_form, field_target) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation, form: field_form,
      target: field_target,
    })));
  const work_HirSafetyCapture_operation_select_member: TirRecordCodec<HirSafetyCapture & { readonly operation: "select-member" }> = defineRecord<HirSafetyCapture & { readonly operation: "select-member" }>("HirSafetyCapture@operation=select-member", "HirSafetyCapture", { field: "operation", value: "select-member" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'safety", value => scalarWork("'safety", value.family), literalReader<(HirSafetyCapture & { readonly operation: "select-member" })["family"]>("'safety", ["safety"]))
    .field("operation", "'select-member", value => scalarWork("'select-member", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "select-member" })["operation"]>("'select-member", ["select-member"]))
    .field("predecessor", "?SourceNodeRef", value => nullableWork(value.predecessor, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("memberKind", "SafetyMemberKind", value => scalarWork("SafetyMemberKind", value.memberKind), literalReader<(HirSafetyCapture & { readonly operation: "select-member" })["memberKind"]>("SafetyMemberKind", ["indexer","method","property"]))
    .field("selection", "HirSafetySelectionCapture", value => work_HirSafetySelectionCapture.write(value.selection), lazyReader(() => work_HirSafetySelectionCapture.reader))
    .finish((field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_memberKind, field_selection) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation,
      predecessor: field_predecessor, memberKind: field_memberKind, selection: field_selection,
    })));
  const work_HirSafetyCapture_operation_placement: TirRecordCodec<HirSafetyCapture & { readonly operation: "placement" }> = defineRecord<HirSafetyCapture & { readonly operation: "placement" }>("HirSafetyCapture@operation=placement", "HirSafetyCapture", { field: "operation", value: "placement" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'safety", value => scalarWork("'safety", value.family), literalReader<(HirSafetyCapture & { readonly operation: "placement" })["family"]>("'safety", ["safety"]))
    .field("operation", "'placement", value => scalarWork("'placement", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "placement" })["operation"]>("'placement", ["placement"]))
    .field("predecessor", "?SourceNodeRef", value => nullableWork(value.predecessor, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("placement", "SafetyPlacement", value => scalarWork("SafetyPlacement", value.placement), literalReader<(HirSafetyCapture & { readonly operation: "placement" })["placement"]>("SafetyPlacement", ["declaration","constructor","getter","setter"]))
    .finish((field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_placement) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation,
      predecessor: field_predecessor, placement: field_placement,
    })));
  const work_HirSafetyCapture_operation_apply: TirRecordCodec<HirSafetyCapture & { readonly operation: "apply" }> = defineRecord<HirSafetyCapture & { readonly operation: "apply" }>("HirSafetyCapture@operation=apply", "HirSafetyCapture", { field: "operation", value: "apply" }, "HirSafetyCapture", null, null, fields => fields
    .field("occurrence", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.occurrence), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("provider", "def", value => referenceWork("def", value.provider), definitionReader)
    .field("family", "'safety", value => scalarWork("'safety", value.family), literalReader<(HirSafetyCapture & { readonly operation: "apply" })["family"]>("'safety", ["safety"]))
    .field("operation", "'apply", value => scalarWork("'apply", value.operation), literalReader<(HirSafetyCapture & { readonly operation: "apply" })["operation"]>("'apply", ["apply"]))
    .field("predecessor", "?SourceNodeRef", value => nullableWork(value.predecessor, actual => read.work_SourceNodeRef.write(actual)), nullableReader(lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("contract", "SafetyContract", value => scalarWork("SafetyContract", value.contract), literalReader<(HirSafetyCapture & { readonly operation: "apply" })["contract"]>("SafetyContract", ["requires-unsafe","safe"]))
    .finish((field_occurrence, field_provider, field_family, field_operation, field_predecessor, field_contract) => ({
      occurrence: field_occurrence, provider: field_provider, family: field_family, operation: field_operation,
      predecessor: field_predecessor, contract: field_contract,
    })));
  const work_HirArgumentPassingCapture_role_declaration: TirRecordCodec<HirArgumentPassingCapture & { readonly role: "declaration" }> = defineRecord<HirArgumentPassingCapture & { readonly role: "declaration" }>("HirArgumentPassingCapture@role=declaration", "HirArgumentPassingCapture", { field: "role", value: "declaration" }, "HirArgumentPassingCapture", null, null, fields => fields
    .field("role", "'declaration", value => scalarWork("'declaration", value.role), literalReader<(HirArgumentPassingCapture & { readonly role: "declaration" })["role"]>("'declaration", ["declaration"]))
    .field("mode", "PassingMode", value => scalarWork("PassingMode", value.mode), literalReader<(HirArgumentPassingCapture & { readonly role: "declaration" })["mode"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .finish((field_role, field_mode) => ({ role: field_role, mode: field_mode })));
  const work_HirArgumentPassingCapture_role_argument: TirRecordCodec<HirArgumentPassingCapture & { readonly role: "argument" }> = defineRecord<HirArgumentPassingCapture & { readonly role: "argument" }>("HirArgumentPassingCapture@role=argument", "HirArgumentPassingCapture", { field: "role", value: "argument" }, "HirArgumentPassingCapture", null, null, fields => fields
    .field("role", "'argument", value => scalarWork("'argument", value.role), literalReader<(HirArgumentPassingCapture & { readonly role: "argument" })["role"]>("'argument", ["argument"]))
    .field("mode", "PassingMode", value => scalarWork("PassingMode", value.mode), literalReader<(HirArgumentPassingCapture & { readonly role: "argument" })["mode"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .field("storageExpression", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.storageExpression), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_role, field_mode, field_storageExpression) => ({ role: field_role, mode: field_mode, storageExpression: field_storageExpression })));
  const work_HirAttributeCapture: TirRecordCodec<HirAttributeCapture> = unionRecord<HirAttributeCapture>("HirAttributeCapture", (value: HirAttributeCapture): TirTypedRecordWork => {
    switch (value.kind) {
      case "builder-state": return work_HirAttributeCapture_builder_state.write(value);
      case "application": return work_HirAttributeCapture_application.write(value);
    }
  }, () => [work_HirAttributeCapture_builder_state.reader, work_HirAttributeCapture_application.reader]);
  const work_HirSafetySelectionCapture: TirRecordCodec<HirSafetySelectionCapture> = unionRecord<HirSafetySelectionCapture>("HirSafetySelectionCapture", (value: HirSafetySelectionCapture): TirTypedRecordWork => {
    switch (value.kind) {
      case "selected": return work_HirSafetySelectionCapture_selected.write(value);
      case "unavailable": return work_HirSafetySelectionCapture_unavailable.write(value);
    }
  }, () => [work_HirSafetySelectionCapture_selected.reader, work_HirSafetySelectionCapture_unavailable.reader]);
  const work_HirSafetyCapture: TirRecordCodec<HirSafetyCapture> = unionRecord<HirSafetyCapture>("HirSafetyCapture", (value: HirSafetyCapture): TirTypedRecordWork => {
    switch (value.operation) {
      case "expression": return work_HirSafetyCapture_operation_expression.write(value);
      case "remaining-block": return work_HirSafetyCapture_operation_remaining_block.write(value);
      case "root": return work_HirSafetyCapture_operation_root.write(value);
      case "select-member": return work_HirSafetyCapture_operation_select_member.write(value);
      case "placement": return work_HirSafetyCapture_operation_placement.write(value);
      case "apply": return work_HirSafetyCapture_operation_apply.write(value);
    }
  }, () => [work_HirSafetyCapture_operation_expression.reader, work_HirSafetyCapture_operation_remaining_block.reader, work_HirSafetyCapture_operation_root.reader, work_HirSafetyCapture_operation_select_member.reader, work_HirSafetyCapture_operation_placement.reader, work_HirSafetyCapture_operation_apply.reader]);
  const work_HirArgumentPassingCapture: TirRecordCodec<HirArgumentPassingCapture> = unionRecord<HirArgumentPassingCapture>("HirArgumentPassingCapture", (value: HirArgumentPassingCapture): TirTypedRecordWork => {
    switch (value.role) {
      case "declaration": return work_HirArgumentPassingCapture_role_declaration.write(value);
      case "argument": return work_HirArgumentPassingCapture_role_argument.write(value);
    }
  }, () => [work_HirArgumentPassingCapture_role_declaration.reader, work_HirArgumentPassingCapture_role_argument.reader]);
  const work_C__def__available: TirRecordCodec<CapturedFact<DefId | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<DefId | null> & { readonly kind: "available" }>("C<?def>#available", "C<?def>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?def", value => nullableWork(value.value, actual => referenceWork("def", actual)), nullableReader(definitionReader))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__def__unavailable: TirRecordCodec<CapturedFact<DefId | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<DefId | null> & { readonly kind: "unavailable" }>("C<?def>#unavailable", "C<?def>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<DefId | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__def_: TirRecordCodec<CapturedFact<DefId | null>> = unionRecord<CapturedFact<DefId | null>>("C<?def>", (value: CapturedFact<DefId | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__def__available.write(value);
      case "unavailable": return work_C__def__unavailable.write(value);
    }
  }, () => [work_C__def__available.reader, work_C__def__unavailable.reader]);
  const work_C_HirMarkersCapture__available: TirRecordCodec<CapturedFact<HirMarkersCapture> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirMarkersCapture> & { readonly kind: "available" }>("C<HirMarkersCapture>#available", "C<HirMarkersCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "HirMarkersCapture", value => work_HirMarkersCapture.write(value.value), lazyReader(() => work_HirMarkersCapture.reader))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C_HirMarkersCapture__unavailable: TirRecordCodec<CapturedFact<HirMarkersCapture> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirMarkersCapture> & { readonly kind: "unavailable" }>("C<HirMarkersCapture>#unavailable", "C<HirMarkersCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirMarkersCapture> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C_HirMarkersCapture_: TirRecordCodec<CapturedFact<HirMarkersCapture>> = unionRecord<CapturedFact<HirMarkersCapture>>("C<HirMarkersCapture>", (value: CapturedFact<HirMarkersCapture>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C_HirMarkersCapture__available.write(value);
      case "unavailable": return work_C_HirMarkersCapture__unavailable.write(value);
    }
  }, () => [work_C_HirMarkersCapture__available.reader, work_C_HirMarkersCapture__unavailable.reader]);
  const work_C__HirAttributeCapture__available: TirRecordCodec<CapturedFact<HirAttributeCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirAttributeCapture | null> & { readonly kind: "available" }>("C<?HirAttributeCapture>#available", "C<?HirAttributeCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirAttributeCapture", value => nullableWork(value.value, actual => work_HirAttributeCapture.write(actual)), nullableReader(lazyReader(() => work_HirAttributeCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirAttributeCapture__unavailable: TirRecordCodec<CapturedFact<HirAttributeCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirAttributeCapture | null> & { readonly kind: "unavailable" }>("C<?HirAttributeCapture>#unavailable", "C<?HirAttributeCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirAttributeCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirAttributeCapture_: TirRecordCodec<CapturedFact<HirAttributeCapture | null>> = unionRecord<CapturedFact<HirAttributeCapture | null>>("C<?HirAttributeCapture>", (value: CapturedFact<HirAttributeCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirAttributeCapture__available.write(value);
      case "unavailable": return work_C__HirAttributeCapture__unavailable.write(value);
    }
  }, () => [work_C__HirAttributeCapture__available.reader, work_C__HirAttributeCapture__unavailable.reader]);
  const work_C__HirSafetyCapture__available: TirRecordCodec<CapturedFact<HirSafetyCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirSafetyCapture | null> & { readonly kind: "available" }>("C<?HirSafetyCapture>#available", "C<?HirSafetyCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirSafetyCapture", value => nullableWork(value.value, actual => work_HirSafetyCapture.write(actual)), nullableReader(lazyReader(() => work_HirSafetyCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirSafetyCapture__unavailable: TirRecordCodec<CapturedFact<HirSafetyCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirSafetyCapture | null> & { readonly kind: "unavailable" }>("C<?HirSafetyCapture>#unavailable", "C<?HirSafetyCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirSafetyCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirSafetyCapture_: TirRecordCodec<CapturedFact<HirSafetyCapture | null>> = unionRecord<CapturedFact<HirSafetyCapture | null>>("C<?HirSafetyCapture>", (value: CapturedFact<HirSafetyCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirSafetyCapture__available.write(value);
      case "unavailable": return work_C__HirSafetyCapture__unavailable.write(value);
    }
  }, () => [work_C__HirSafetyCapture__available.reader, work_C__HirSafetyCapture__unavailable.reader]);
  const work_C__HirArgumentPassingCapture__available: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "available" }>("C<?HirArgumentPassingCapture>#available", "C<?HirArgumentPassingCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirArgumentPassingCapture", value => nullableWork(value.value, actual => work_HirArgumentPassingCapture.write(actual)), nullableReader(lazyReader(() => work_HirArgumentPassingCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirArgumentPassingCapture__unavailable: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "unavailable" }>("C<?HirArgumentPassingCapture>#unavailable", "C<?HirArgumentPassingCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirArgumentPassingCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirArgumentPassingCapture_: TirRecordCodec<CapturedFact<HirArgumentPassingCapture | null>> = unionRecord<CapturedFact<HirArgumentPassingCapture | null>>("C<?HirArgumentPassingCapture>", (value: CapturedFact<HirArgumentPassingCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirArgumentPassingCapture__available.write(value);
      case "unavailable": return work_C__HirArgumentPassingCapture__unavailable.write(value);
    }
  }, () => [work_C__HirArgumentPassingCapture__available.reader, work_C__HirArgumentPassingCapture__unavailable.reader]);
  const work_C__FlowState__available: TirRecordCodec<HirCoreCapture["flowState"] & { readonly kind: "available" }> = defineRecord<HirCoreCapture["flowState"] & { readonly kind: "available" }>("C<?FlowState>#available", "C<?FlowState>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?FlowState", value => nullableWork(value.value, actual => scalarWork("FlowState", actual)), nullableReader(literalReader<NonNullable<(HirCoreCapture["flowState"] & { readonly kind: "available" })["value"]>>("FlowState", ["moved","borrowed-shared","borrowed-mut"])))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__FlowState__unavailable: TirRecordCodec<HirCoreCapture["flowState"] & { readonly kind: "unavailable" }> = defineRecord<HirCoreCapture["flowState"] & { readonly kind: "unavailable" }>("C<?FlowState>#unavailable", "C<?FlowState>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(HirCoreCapture["flowState"] & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__FlowState_: TirRecordCodec<HirCoreCapture["flowState"]> = unionRecord<HirCoreCapture["flowState"]>("C<?FlowState>", (value: HirCoreCapture["flowState"]): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__FlowState__available.write(value);
      case "unavailable": return work_C__FlowState__unavailable.write(value);
    }
  }, () => [work_C__FlowState__available.reader, work_C__FlowState__unavailable.reader]);
  const work_C__HirFieldMarkerCapture___available: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "available" }> = defineRecord<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "available" }>("C<[HirFieldMarkerCapture]>#available", "C<[HirFieldMarkerCapture]>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "[HirFieldMarkerCapture]", value => sequenceWork("[HirFieldMarkerCapture]", value.value, actual => work_HirFieldMarkerCapture.write(actual)), sequenceReader("[HirFieldMarkerCapture]", lazyReader(() => work_HirFieldMarkerCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirFieldMarkerCapture___unavailable: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "unavailable" }>("C<[HirFieldMarkerCapture]>#unavailable", "C<[HirFieldMarkerCapture]>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<readonly (HirFieldMarkerCapture)[]> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirFieldMarkerCapture__: TirRecordCodec<CapturedFact<readonly (HirFieldMarkerCapture)[]>> = unionRecord<CapturedFact<readonly (HirFieldMarkerCapture)[]>>("C<[HirFieldMarkerCapture]>", (value: CapturedFact<readonly (HirFieldMarkerCapture)[]>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirFieldMarkerCapture___available.write(value);
      case "unavailable": return work_C__HirFieldMarkerCapture___unavailable.write(value);
    }
  }, () => [work_C__HirFieldMarkerCapture___available.reader, work_C__HirFieldMarkerCapture___unavailable.reader]);
  const work_C_t__available: TirRecordCodec<CapturedFact<TyId> & { readonly kind: "available" }> = defineRecord<CapturedFact<TyId> & { readonly kind: "available" }>("C<t>#available", "C<t>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "t", value => referenceWork("t", value.value), typeReader)
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C_t__unavailable: TirRecordCodec<CapturedFact<TyId> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<TyId> & { readonly kind: "unavailable" }>("C<t>#unavailable", "C<t>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<TyId> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C_t_: TirRecordCodec<CapturedFact<TyId>> = unionRecord<CapturedFact<TyId>>("C<t>", (value: CapturedFact<TyId>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C_t__available.write(value);
      case "unavailable": return work_C_t__unavailable.write(value);
    }
  }, () => [work_C_t__available.reader, work_C_t__unavailable.reader]);
  const work_C__HirFieldBindingCapture__available: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "available" }>("C<?HirFieldBindingCapture>#available", "C<?HirFieldBindingCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirFieldBindingCapture", value => nullableWork(value.value, actual => work_HirFieldBindingCapture.write(actual)), nullableReader(lazyReader(() => work_HirFieldBindingCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirFieldBindingCapture__unavailable: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "unavailable" }>("C<?HirFieldBindingCapture>#unavailable", "C<?HirFieldBindingCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirFieldBindingCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirFieldBindingCapture_: TirRecordCodec<CapturedFact<HirFieldBindingCapture | null>> = unionRecord<CapturedFact<HirFieldBindingCapture | null>>("C<?HirFieldBindingCapture>", (value: CapturedFact<HirFieldBindingCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirFieldBindingCapture__available.write(value);
      case "unavailable": return work_C__HirFieldBindingCapture__unavailable.write(value);
    }
  }, () => [work_C__HirFieldBindingCapture__available.reader, work_C__HirFieldBindingCapture__unavailable.reader]);
  const work_C__HirRecordBindingCapture__available: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "available" }>("C<?HirRecordBindingCapture>#available", "C<?HirRecordBindingCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirRecordBindingCapture", value => nullableWork(value.value, actual => work_HirRecordBindingCapture.write(actual)), nullableReader(lazyReader(() => work_HirRecordBindingCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirRecordBindingCapture__unavailable: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "unavailable" }>("C<?HirRecordBindingCapture>#unavailable", "C<?HirRecordBindingCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirRecordBindingCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirRecordBindingCapture_: TirRecordCodec<CapturedFact<HirRecordBindingCapture | null>> = unionRecord<CapturedFact<HirRecordBindingCapture | null>>("C<?HirRecordBindingCapture>", (value: CapturedFact<HirRecordBindingCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirRecordBindingCapture__available.write(value);
      case "unavailable": return work_C__HirRecordBindingCapture__unavailable.write(value);
    }
  }, () => [work_C__HirRecordBindingCapture__available.reader, work_C__HirRecordBindingCapture__unavailable.reader]);
  const work_C_BindingVector__available: TirRecordCodec<CapturedFact<BindingVector> & { readonly kind: "available" }> = defineRecord<CapturedFact<BindingVector> & { readonly kind: "available" }>("C<BindingVector>#available", "C<BindingVector>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "BindingVector", value => read.work_BindingVector.write(value.value), lazyReader(() => read.work_BindingVector.reader))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C_BindingVector__unavailable: TirRecordCodec<CapturedFact<BindingVector> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<BindingVector> & { readonly kind: "unavailable" }>("C<BindingVector>#unavailable", "C<BindingVector>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<BindingVector> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C_BindingVector_: TirRecordCodec<CapturedFact<BindingVector>> = unionRecord<CapturedFact<BindingVector>>("C<BindingVector>", (value: CapturedFact<BindingVector>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C_BindingVector__available.write(value);
      case "unavailable": return work_C_BindingVector__unavailable.write(value);
    }
  }, () => [work_C_BindingVector__available.reader, work_C_BindingVector__unavailable.reader]);
  const work_C_SourceNodeRef__available: TirRecordCodec<CapturedFact<SourceNodeRef> & { readonly kind: "available" }> = defineRecord<CapturedFact<SourceNodeRef> & { readonly kind: "available" }>("C<SourceNodeRef>#available", "C<SourceNodeRef>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.value), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C_SourceNodeRef__unavailable: TirRecordCodec<CapturedFact<SourceNodeRef> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<SourceNodeRef> & { readonly kind: "unavailable" }>("C<SourceNodeRef>#unavailable", "C<SourceNodeRef>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<SourceNodeRef> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C_SourceNodeRef_: TirRecordCodec<CapturedFact<SourceNodeRef>> = unionRecord<CapturedFact<SourceNodeRef>>("C<SourceNodeRef>", (value: CapturedFact<SourceNodeRef>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C_SourceNodeRef__available.write(value);
      case "unavailable": return work_C_SourceNodeRef__unavailable.write(value);
    }
  }, () => [work_C_SourceNodeRef__available.reader, work_C_SourceNodeRef__unavailable.reader]);
  return { work_HirCoreCapture, work_HirFieldBindingCapture, work_HirRecordFieldBindingCapture, work_HirRecordBindingCapture, work_C__HirFieldBindingCapture__available, work_C__HirFieldBindingCapture__unavailable, work_C__HirFieldBindingCapture_, work_C__HirRecordBindingCapture__available, work_C__HirRecordBindingCapture__unavailable, work_C__HirRecordBindingCapture_, work_C_BindingVector__available, work_C_BindingVector__unavailable, work_C_BindingVector_, work_C_SourceNodeRef__available, work_C_SourceNodeRef__unavailable, work_C_SourceNodeRef_, work_HirMarkersCapture, work_Record_structMarker, work_Record_defaultValue, work_HirFieldMarkerCapture, work_HirCapturedType, work_HirAttributeCapture_builder_state, work_HirAttributeCapture_application, work_Record_selectedMember, work_HirSafetySelectionCapture_selected, work_HirSafetySelectionCapture_unavailable, work_HirSafetyCapture_operation_expression, work_HirSafetyCapture_operation_remaining_block, work_HirSafetyCapture_operation_root, work_HirSafetyCapture_operation_select_member, work_HirSafetyCapture_operation_placement, work_HirSafetyCapture_operation_apply, work_HirArgumentPassingCapture_role_declaration, work_HirArgumentPassingCapture_role_argument, work_HirAttributeCapture, work_HirSafetySelectionCapture, work_HirSafetyCapture, work_HirArgumentPassingCapture, work_C__def__available, work_C__def__unavailable, work_C__def_, work_C_HirMarkersCapture__available, work_C_HirMarkersCapture__unavailable, work_C_HirMarkersCapture_, work_C__HirAttributeCapture__available, work_C__HirAttributeCapture__unavailable, work_C__HirAttributeCapture_, work_C__HirSafetyCapture__available, work_C__HirSafetyCapture__unavailable, work_C__HirSafetyCapture_, work_C__HirArgumentPassingCapture__available, work_C__HirArgumentPassingCapture__unavailable, work_C__HirArgumentPassingCapture_, work_C__FlowState__available, work_C__FlowState__unavailable, work_C__FlowState_, work_C__HirFieldMarkerCapture___available, work_C__HirFieldMarkerCapture___unavailable, work_C__HirFieldMarkerCapture__, work_C_t__available, work_C_t__unavailable, work_C_t_ };
};
