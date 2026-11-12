import type { CaptureValuesSchemas } from "./text-capture-values.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { PointersSchemas } from "./text-pointers.js";
import type { DefId, SourceNodeRef } from "../ids/contract.js";
import type { HirArgumentPassingCapture, HirAttributeCapture, HirCoreCapture, HirFieldMarkerCapture, HirMarkersCapture, HirPointerOperationCapture, HirPointerTypeCapture, HirSafetyCapture, HirSafetySelectionCapture } from "../ir-hir/contract.js";
import type { AvailableTypeRecord, UnavailableRecord } from "./text-capture-values.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface AvailableProviderRecord {
  readonly kind: "available";
  readonly value: DefId | null;
}

export interface AvailableMarkersRecord {
  readonly kind: "available";
  readonly value: HirMarkersCapture;
}

export interface AvailablePointerTypeRecord {
  readonly kind: "available";
  readonly value: HirPointerTypeCapture | null;
}

export interface AvailablePointerOperationRecord {
  readonly kind: "available";
  readonly value: HirPointerOperationCapture | null;
}

export interface AvailableAttributeRecord {
  readonly kind: "available";
  readonly value: HirAttributeCapture | null;
}

export interface AvailableSafetyRecord {
  readonly kind: "available";
  readonly value: HirSafetyCapture | null;
}

export interface AvailablePassingRecord {
  readonly kind: "available";
  readonly value: HirArgumentPassingCapture | null;
}

export interface AvailableFlowStateRecord {
  readonly kind: "available";
  readonly value: "moved" | "borrowed-shared" | "borrowed-mut" | null;
}

export interface StructMarkersRecord {
  readonly valueType: boolean;
  readonly fields: AvailableFieldsRecord | UnavailableRecord;
}

export interface DefaultMarkerRecord {
  readonly typeNode: SourceNodeRef;
  readonly type: AvailableTypeRecord | UnavailableRecord;
}

export interface AvailableFieldsRecord {
  readonly kind: "available";
  readonly value: readonly (HirFieldMarkerCapture)[];
}

export interface AttributeBuilderRecord {
  readonly kind: "builder-state";
  readonly occurrence: SourceNodeRef;
  readonly applicationTarget: SourceNodeRef;
  readonly selectedMember: SelectedMemberRecord | null;
  readonly applicationMemberKind: "property" | "method" | null;
  readonly applicationPlacement: "declaration" | "constructor" | null;
  readonly applicationParameterName: string | null;
  readonly applicationTargetSpecifier: string | null;
}

export interface AttributeApplicationRecord {
  readonly kind: "application";
  readonly occurrence: SourceNodeRef;
  readonly applicationTarget: SourceNodeRef;
  readonly selectedMember: SelectedMemberRecord | null;
  readonly applicationMemberKind: "property" | "method" | null;
  readonly applicationPlacement: "declaration" | "constructor" | null;
  readonly applicationParameterName: string | null;
  readonly applicationTargetSpecifier: string | null;
  readonly invocation: SourceNodeRef;
}

export interface SelectedMemberRecord {
  readonly selectedDeclaration: SourceNodeRef | null;
  readonly declarations: readonly (SourceNodeRef)[];
}

export interface UnsafeExpressionRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "unsafe-context";
  readonly operation: "expression";
  readonly expression: SourceNodeRef;
}

export interface UnsafeRemainingRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "unsafe-context";
  readonly operation: "remaining-block";
  readonly firstDirectStatement: boolean;
}

export interface SafetyRootRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "safety";
  readonly operation: "root";
  readonly form: "type" | "value";
  readonly target: SourceNodeRef | null;
}

export interface SafetyMemberRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "safety";
  readonly operation: "select-member";
  readonly predecessor: SourceNodeRef | null;
  readonly memberKind: "indexer" | "method" | "property";
  readonly selection: HirSafetySelectionCapture;
}

export interface SafetyPlacementRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "safety";
  readonly operation: "placement";
  readonly predecessor: SourceNodeRef | null;
  readonly placement: "declaration" | "constructor" | "getter" | "setter";
}

export interface SafetyApplyRecord {
  readonly occurrence: SourceNodeRef;
  readonly provider: DefId;
  readonly family: "safety";
  readonly operation: "apply";
  readonly predecessor: SourceNodeRef | null;
  readonly contract: "requires-unsafe" | "safe";
}

export interface SafetySelectedRecord {
  readonly kind: "selected";
  readonly expression: SourceNodeRef;
  readonly declaration: SourceNodeRef | null;
  readonly declarations: readonly (SourceNodeRef)[];
}

export interface SafetyUnavailableRecord {
  readonly kind: "unavailable";
  readonly reason: "function-shape" | "receiver" | "member-evidence";
}

export interface DeclarationPassingRecord {
  readonly role: "declaration";
  readonly mode: "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";
}

export interface ArgumentPassingRecord {
  readonly role: "argument";
  readonly mode: "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";
  readonly storageExpression: SourceNodeRef;
}

export interface CapturesSchemas {
  readonly hirCoreCaptureSchema: RecordSchema<HirCoreCapture>;
  readonly capturedProviderSchema: RecordSchema<AvailableProviderRecord | UnavailableRecord>;
  readonly availableProviderSchema: RecordSchema<AvailableProviderRecord>;
  readonly capturedMarkersSchema: RecordSchema<AvailableMarkersRecord | UnavailableRecord>;
  readonly availableMarkersSchema: RecordSchema<AvailableMarkersRecord>;
  readonly capturedPointerTypeSchema: RecordSchema<AvailablePointerTypeRecord | UnavailableRecord>;
  readonly availablePointerTypeSchema: RecordSchema<AvailablePointerTypeRecord>;
  readonly capturedPointerOperationSchema: RecordSchema<AvailablePointerOperationRecord | UnavailableRecord>;
  readonly availablePointerOperationSchema: RecordSchema<AvailablePointerOperationRecord>;
  readonly capturedAttributeSchema: RecordSchema<AvailableAttributeRecord | UnavailableRecord>;
  readonly availableAttributeSchema: RecordSchema<AvailableAttributeRecord>;
  readonly capturedSafetySchema: RecordSchema<AvailableSafetyRecord | UnavailableRecord>;
  readonly availableSafetySchema: RecordSchema<AvailableSafetyRecord>;
  readonly capturedPassingSchema: RecordSchema<AvailablePassingRecord | UnavailableRecord>;
  readonly availablePassingSchema: RecordSchema<AvailablePassingRecord>;
  readonly capturedFlowStateSchema: RecordSchema<AvailableFlowStateRecord | UnavailableRecord>;
  readonly availableFlowStateSchema: RecordSchema<AvailableFlowStateRecord>;
  readonly flowStateSchema: Schema<"borrowed-mut" | "borrowed-shared" | "moved">;
  readonly hirMarkersCaptureSchema: RecordSchema<HirMarkersCapture>;
  readonly structMarkersSchema: RecordSchema<StructMarkersRecord>;
  readonly defaultMarkerSchema: RecordSchema<DefaultMarkerRecord>;
  readonly hirFieldMarkerCaptureSchema: RecordSchema<HirFieldMarkerCapture>;
  readonly capturedFieldsSchema: RecordSchema<AvailableFieldsRecord | UnavailableRecord>;
  readonly availableFieldsSchema: RecordSchema<AvailableFieldsRecord>;
  readonly hirAttributeCaptureSchema: RecordSchema<HirAttributeCapture>;
  readonly attributeBuilderSchema: RecordSchema<AttributeBuilderRecord>;
  readonly attributeApplicationSchema: RecordSchema<AttributeApplicationRecord>;
  readonly selectedMemberSchema: RecordSchema<SelectedMemberRecord>;
  readonly attributeMemberKindSchema: Schema<"method" | "property">;
  readonly attributePlacementSchema: Schema<"constructor" | "declaration">;
  readonly hirSafetyCaptureSchema: RecordSchema<HirSafetyCapture>;
  readonly unsafeExpressionSchema: RecordSchema<UnsafeExpressionRecord>;
  readonly unsafeFamilySchema: Schema<"unsafe-context">;
  readonly expressionNameSchema: Schema<"expression">;
  readonly unsafeRemainingSchema: RecordSchema<UnsafeRemainingRecord>;
  readonly remainingNameSchema: Schema<"remaining-block">;
  readonly safetyFamilySchema: Schema<"safety">;
  readonly safetyRootSchema: RecordSchema<SafetyRootRecord>;
  readonly rootNameSchema: Schema<"root">;
  readonly rootFormSchema: Schema<"type" | "value">;
  readonly safetyMemberSchema: RecordSchema<SafetyMemberRecord>;
  readonly selectMemberNameSchema: Schema<"select-member">;
  readonly safetyMemberKindSchema: Schema<"indexer" | "method" | "property">;
  readonly safetyPlacementSchema: RecordSchema<SafetyPlacementRecord>;
  readonly placementNameSchema: Schema<"placement">;
  readonly safetyPlacementKindSchema: Schema<"constructor" | "declaration" | "getter" | "setter">;
  readonly safetyApplySchema: RecordSchema<SafetyApplyRecord>;
  readonly applyNameSchema: Schema<"apply">;
  readonly safetyContractSchema: Schema<"requires-unsafe" | "safe">;
  readonly hirSafetySelectionCaptureSchema: RecordSchema<HirSafetySelectionCapture>;
  readonly safetySelectedSchema: RecordSchema<SafetySelectedRecord>;
  readonly safetyUnavailableSchema: RecordSchema<SafetyUnavailableRecord>;
  readonly safetyUnavailableReasonSchema: Schema<"function-shape" | "member-evidence" | "receiver">;
  readonly hirArgumentPassingCaptureSchema: RecordSchema<HirArgumentPassingCapture>;
  readonly declarationPassingSchema: RecordSchema<DeclarationPassingRecord>;
  readonly declarationRoleSchema: Schema<"declaration">;
  readonly argumentPassingSchema: RecordSchema<ArgumentPassingRecord>;
  readonly argumentRoleSchema: Schema<"argument">;
}

export function createCapturesSchemas(captureValues: CaptureValuesSchemas, data: DataSchemas, pointers: PointersSchemas): CapturesSchemas {
  const { capturedTypeSchema, unavailableSchema } = captureValues;
  const { booleanSchema, defSchema, passingModeSchema, sourceNodeRefSchema, stringSchema } = data;
  const { hirPointerOperationCaptureSchema, hirPointerTypeCaptureSchema } = pointers;
  const hirCoreCaptureSchema = recordSchema<HirCoreCapture>("HirCoreCapture", "HirCoreCapture", read => {
    const provider = read("provider", () => capturedProviderSchema, value => value.provider);
    const markers = read("markers", () => capturedMarkersSchema, value => value.markers);
    const pointerType = read("pointerType", () => capturedPointerTypeSchema, value => value.pointerType);
    const pointerOperation = read("pointerOperation", () => capturedPointerOperationSchema, value => value.pointerOperation);
    const attribute = read("attribute", () => capturedAttributeSchema, value => value.attribute);
    const safety = read("safety", () => capturedSafetySchema, value => value.safety);
    const argumentPassing = read("argumentPassing", () => capturedPassingSchema, value => value.argumentPassing);
    const flowState = read("flowState", () => capturedFlowStateSchema, value => value.flowState);
    return { fields: [provider, markers, pointerType, pointerOperation, attribute, safety, argumentPassing, flowState], value: () => ({ provider: provider.value(), markers: markers.value(), pointerType: pointerType.value(), pointerOperation: pointerOperation.value(), attribute: attribute.value(), safety: safety.value(), argumentPassing: argumentPassing.value(), flowState: flowState.value() }) };
  });

  const capturedProviderSchema: RecordSchema<AvailableProviderRecord | UnavailableRecord> = unionSchema<AvailableProviderRecord | UnavailableRecord>("CapturedProvider",
    () => [availableProviderSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableProviderSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableProviderSchema = recordSchema<AvailableProviderRecord>("AvailableProvider", "available", read => {
    const value = read("value", () => nullableSchema(defSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedMarkersSchema: RecordSchema<AvailableMarkersRecord | UnavailableRecord> = unionSchema<AvailableMarkersRecord | UnavailableRecord>("CapturedMarkers",
    () => [availableMarkersSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableMarkersSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableMarkersSchema = recordSchema<AvailableMarkersRecord>("AvailableMarkers", "available", read => {
    const value = read("value", () => hirMarkersCaptureSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedPointerTypeSchema: RecordSchema<AvailablePointerTypeRecord | UnavailableRecord> = unionSchema<AvailablePointerTypeRecord | UnavailableRecord>("CapturedPointerType",
    () => [availablePointerTypeSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availablePointerTypeSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availablePointerTypeSchema = recordSchema<AvailablePointerTypeRecord>("AvailablePointerType", "available", read => {
    const value = read("value", () => nullableSchema(hirPointerTypeCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedPointerOperationSchema: RecordSchema<AvailablePointerOperationRecord | UnavailableRecord> = unionSchema<AvailablePointerOperationRecord | UnavailableRecord>("CapturedPointerOperation",
    () => [availablePointerOperationSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availablePointerOperationSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availablePointerOperationSchema = recordSchema<AvailablePointerOperationRecord>("AvailablePointerOperation", "available", read => {
    const value = read("value", () => nullableSchema(hirPointerOperationCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedAttributeSchema: RecordSchema<AvailableAttributeRecord | UnavailableRecord> = unionSchema<AvailableAttributeRecord | UnavailableRecord>("CapturedAttribute",
    () => [availableAttributeSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableAttributeSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableAttributeSchema = recordSchema<AvailableAttributeRecord>("AvailableAttribute", "available", read => {
    const value = read("value", () => nullableSchema(hirAttributeCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedSafetySchema: RecordSchema<AvailableSafetyRecord | UnavailableRecord> = unionSchema<AvailableSafetyRecord | UnavailableRecord>("CapturedSafety",
    () => [availableSafetySchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableSafetySchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableSafetySchema = recordSchema<AvailableSafetyRecord>("AvailableSafety", "available", read => {
    const value = read("value", () => nullableSchema(hirSafetyCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedPassingSchema: RecordSchema<AvailablePassingRecord | UnavailableRecord> = unionSchema<AvailablePassingRecord | UnavailableRecord>("CapturedPassing",
    () => [availablePassingSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availablePassingSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availablePassingSchema = recordSchema<AvailablePassingRecord>("AvailablePassing", "available", read => {
    const value = read("value", () => nullableSchema(hirArgumentPassingCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedFlowStateSchema: RecordSchema<AvailableFlowStateRecord | UnavailableRecord> = unionSchema<AvailableFlowStateRecord | UnavailableRecord>("CapturedFlowState",
    () => [availableFlowStateSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableFlowStateSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableFlowStateSchema = recordSchema<AvailableFlowStateRecord>("AvailableFlowState", "available", read => {
    const value = read("value", () => nullableSchema(flowStateSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const flowStateSchema = enumSchema("FlowState", ["moved","borrowed-shared","borrowed-mut"]);

  const hirMarkersCaptureSchema = recordSchema<HirMarkersCapture>("HirMarkersCapture", "HirMarkersCapture", read => {
    const struct = read("struct", () => nullableSchema(structMarkersSchema), value => value.struct);
    const field = read("field", () => nullableSchema(hirFieldMarkerCaptureSchema), value => value.field);
    const defaultValue = read("defaultValue", () => nullableSchema(defaultMarkerSchema), value => value.defaultValue);
    const jsString = read("jsString", () => booleanSchema, value => value.jsString);
    return { fields: [struct, field, defaultValue, jsString], value: () => ({ struct: struct.value(), field: field.value(), defaultValue: defaultValue.value(), jsString: jsString.value() }) };
  });

  const structMarkersSchema = recordSchema<StructMarkersRecord>("StructMarkers", "Record", read => {
    const valueType = read("valueType", () => booleanSchema, value => value.valueType);
    const fields = read("fields", () => capturedFieldsSchema, value => value.fields);
    return { fields: [valueType, fields], value: () => ({ valueType: valueType.value(), fields: fields.value() }) };
  });

  const defaultMarkerSchema = recordSchema<DefaultMarkerRecord>("DefaultMarker", "Record", read => {
    const typeNode = read("typeNode", () => sourceNodeRefSchema, value => value.typeNode);
    const type = read("type", () => capturedTypeSchema, value => value.type);
    return { fields: [typeNode, type], value: () => ({ typeNode: typeNode.value(), type: type.value() }) };
  });

  const hirFieldMarkerCaptureSchema = recordSchema<HirFieldMarkerCapture>("HirFieldMarkerCapture", "HirFieldMarkerCapture", read => {
    const name = read("name", () => stringSchema, value => value.name);
    const typeNode = read("typeNode", () => sourceNodeRefSchema, value => value.typeNode);
    const type = read("type", () => capturedTypeSchema, value => value.type);
    const readonly = read("readonly", () => booleanSchema, value => value.readonly);
    return { fields: [name, typeNode, type, readonly], value: () => ({ name: name.value(), typeNode: typeNode.value(), type: type.value(), readonly: readonly.value() }) };
  });

  const capturedFieldsSchema: RecordSchema<AvailableFieldsRecord | UnavailableRecord> = unionSchema<AvailableFieldsRecord | UnavailableRecord>("CapturedFields",
    () => [availableFieldsSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableFieldsSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableFieldsSchema = recordSchema<AvailableFieldsRecord>("AvailableFields", "available", read => {
    const value = read("value", () => arraySchema(hirFieldMarkerCaptureSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const hirAttributeCaptureSchema: RecordSchema<HirAttributeCapture> = unionSchema<HirAttributeCapture>("HirAttributeCapture",
    () => [attributeBuilderSchema, attributeApplicationSchema], value => {
    switch (value.kind) {
      case "builder-state": return attributeBuilderSchema.stage(value);
      case "application": return attributeApplicationSchema.stage(value);
    }
  });

  const attributeBuilderSchema = recordSchema<AttributeBuilderRecord>("AttributeBuilder", "builder-state", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const applicationTarget = read("applicationTarget", () => sourceNodeRefSchema, value => value.applicationTarget);
    const selectedMember = read("selectedMember", () => nullableSchema(selectedMemberSchema), value => value.selectedMember);
    const applicationMemberKind = read("applicationMemberKind", () => nullableSchema(attributeMemberKindSchema), value => value.applicationMemberKind);
    const applicationPlacement = read("applicationPlacement", () => nullableSchema(attributePlacementSchema), value => value.applicationPlacement);
    const applicationParameterName = read("applicationParameterName", () => nullableSchema(stringSchema), value => value.applicationParameterName);
    const applicationTargetSpecifier = read("applicationTargetSpecifier", () => nullableSchema(stringSchema), value => value.applicationTargetSpecifier);
    return { fields: [occurrence, applicationTarget, selectedMember, applicationMemberKind, applicationPlacement, applicationParameterName, applicationTargetSpecifier], value: () => ({ kind: "builder-state", occurrence: occurrence.value(), applicationTarget: applicationTarget.value(), selectedMember: selectedMember.value(), applicationMemberKind: applicationMemberKind.value(), applicationPlacement: applicationPlacement.value(), applicationParameterName: applicationParameterName.value(), applicationTargetSpecifier: applicationTargetSpecifier.value() }) };
  });

  const attributeApplicationSchema = recordSchema<AttributeApplicationRecord>("AttributeApplication", "application", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const applicationTarget = read("applicationTarget", () => sourceNodeRefSchema, value => value.applicationTarget);
    const selectedMember = read("selectedMember", () => nullableSchema(selectedMemberSchema), value => value.selectedMember);
    const applicationMemberKind = read("applicationMemberKind", () => nullableSchema(attributeMemberKindSchema), value => value.applicationMemberKind);
    const applicationPlacement = read("applicationPlacement", () => nullableSchema(attributePlacementSchema), value => value.applicationPlacement);
    const applicationParameterName = read("applicationParameterName", () => nullableSchema(stringSchema), value => value.applicationParameterName);
    const applicationTargetSpecifier = read("applicationTargetSpecifier", () => nullableSchema(stringSchema), value => value.applicationTargetSpecifier);
    const invocation = read("invocation", () => sourceNodeRefSchema, value => value.invocation);
    return { fields: [occurrence, applicationTarget, selectedMember, applicationMemberKind, applicationPlacement, applicationParameterName, applicationTargetSpecifier, invocation], value: () => ({ kind: "application", occurrence: occurrence.value(), applicationTarget: applicationTarget.value(), selectedMember: selectedMember.value(), applicationMemberKind: applicationMemberKind.value(), applicationPlacement: applicationPlacement.value(), applicationParameterName: applicationParameterName.value(), applicationTargetSpecifier: applicationTargetSpecifier.value(), invocation: invocation.value() }) };
  });

  const selectedMemberSchema = recordSchema<SelectedMemberRecord>("SelectedMember", "Record", read => {
    const selectedDeclaration = read("selectedDeclaration", () => nullableSchema(sourceNodeRefSchema), value => value.selectedDeclaration);
    const declarations = read("declarations", () => arraySchema(sourceNodeRefSchema), value => value.declarations);
    return { fields: [selectedDeclaration, declarations], value: () => ({ selectedDeclaration: selectedDeclaration.value(), declarations: declarations.value() }) };
  });

  const attributeMemberKindSchema = enumSchema("AttributeMemberKind", ["property","method"]);

  const attributePlacementSchema = enumSchema("AttributePlacement", ["declaration","constructor"]);

  const hirSafetyCaptureSchema: RecordSchema<HirSafetyCapture> = unionSchema<HirSafetyCapture>("HirSafetyCapture",
    () => [unsafeExpressionSchema, unsafeRemainingSchema, safetyRootSchema, safetyMemberSchema, safetyPlacementSchema, safetyApplySchema], value => {
    switch (value.family) {
      case "unsafe-context":
        switch (value.operation) {
          case "expression": return unsafeExpressionSchema.stage(value);
          case "remaining-block": return unsafeRemainingSchema.stage(value);
        }
      case "safety":
        switch (value.operation) {
          case "root": return safetyRootSchema.stage(value);
          case "select-member": return safetyMemberSchema.stage(value);
          case "placement": return safetyPlacementSchema.stage(value);
          case "apply": return safetyApplySchema.stage(value);
        }
    }
  });

  const unsafeExpressionSchema = recordSchema<UnsafeExpressionRecord>("UnsafeExpression", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => unsafeFamilySchema, value => value.family);
    const operation = read("operation", () => expressionNameSchema, value => value.operation);
    const expression = read("expression", () => sourceNodeRefSchema, value => value.expression);
    return { fields: [occurrence, provider, family, operation, expression], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), expression: expression.value() }) };
  });

  const unsafeFamilySchema = enumSchema("UnsafeFamily", ["unsafe-context"]);

  const expressionNameSchema = enumSchema("ExpressionName", ["expression"]);

  const unsafeRemainingSchema = recordSchema<UnsafeRemainingRecord>("UnsafeRemaining", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => unsafeFamilySchema, value => value.family);
    const operation = read("operation", () => remainingNameSchema, value => value.operation);
    const firstDirectStatement = read("firstDirectStatement", () => booleanSchema, value => value.firstDirectStatement);
    return { fields: [occurrence, provider, family, operation, firstDirectStatement], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), firstDirectStatement: firstDirectStatement.value() }) };
  });

  const remainingNameSchema = enumSchema("RemainingName", ["remaining-block"]);

  const safetyFamilySchema = enumSchema("SafetyFamily", ["safety"]);

  const safetyRootSchema = recordSchema<SafetyRootRecord>("SafetyRoot", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => safetyFamilySchema, value => value.family);
    const operation = read("operation", () => rootNameSchema, value => value.operation);
    const form = read("form", () => rootFormSchema, value => value.form);
    const target = read("target", () => nullableSchema(sourceNodeRefSchema), value => value.target);
    return { fields: [occurrence, provider, family, operation, form, target], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), form: form.value(), target: target.value() }) };
  });

  const rootNameSchema = enumSchema("RootName", ["root"]);

  const rootFormSchema = enumSchema("RootForm", ["type","value"]);

  const safetyMemberSchema = recordSchema<SafetyMemberRecord>("SafetyMember", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => safetyFamilySchema, value => value.family);
    const operation = read("operation", () => selectMemberNameSchema, value => value.operation);
    const predecessor = read("predecessor", () => nullableSchema(sourceNodeRefSchema), value => value.predecessor);
    const memberKind = read("memberKind", () => safetyMemberKindSchema, value => value.memberKind);
    const selection = read("selection", () => hirSafetySelectionCaptureSchema, value => value.selection);
    return { fields: [occurrence, provider, family, operation, predecessor, memberKind, selection], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), predecessor: predecessor.value(), memberKind: memberKind.value(), selection: selection.value() }) };
  });

  const selectMemberNameSchema = enumSchema("SelectMemberName", ["select-member"]);

  const safetyMemberKindSchema = enumSchema("SafetyMemberKind", ["indexer","method","property"]);

  const safetyPlacementSchema = recordSchema<SafetyPlacementRecord>("SafetyPlacement", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => safetyFamilySchema, value => value.family);
    const operation = read("operation", () => placementNameSchema, value => value.operation);
    const predecessor = read("predecessor", () => nullableSchema(sourceNodeRefSchema), value => value.predecessor);
    const placement = read("placement", () => safetyPlacementKindSchema, value => value.placement);
    return { fields: [occurrence, provider, family, operation, predecessor, placement], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), predecessor: predecessor.value(), placement: placement.value() }) };
  });

  const placementNameSchema = enumSchema("PlacementName", ["placement"]);

  const safetyPlacementKindSchema = enumSchema("SafetyPlacementKind", ["declaration","constructor","getter","setter"]);

  const safetyApplySchema = recordSchema<SafetyApplyRecord>("SafetyApply", "HirSafetyCapture", read => {
    const occurrence = read("occurrence", () => sourceNodeRefSchema, value => value.occurrence);
    const provider = read("provider", () => defSchema, value => value.provider);
    const family = read("family", () => safetyFamilySchema, value => value.family);
    const operation = read("operation", () => applyNameSchema, value => value.operation);
    const predecessor = read("predecessor", () => nullableSchema(sourceNodeRefSchema), value => value.predecessor);
    const contract = read("contract", () => safetyContractSchema, value => value.contract);
    return { fields: [occurrence, provider, family, operation, predecessor, contract], value: () => ({ occurrence: occurrence.value(), provider: provider.value(), family: family.value(), operation: operation.value(), predecessor: predecessor.value(), contract: contract.value() }) };
  });

  const applyNameSchema = enumSchema("ApplyName", ["apply"]);

  const safetyContractSchema = enumSchema("SafetyContract", ["requires-unsafe","safe"]);

  const hirSafetySelectionCaptureSchema: RecordSchema<HirSafetySelectionCapture> = unionSchema<HirSafetySelectionCapture>("HirSafetySelectionCapture",
    () => [safetySelectedSchema, safetyUnavailableSchema], value => {
    switch (value.kind) {
      case "selected": return safetySelectedSchema.stage(value);
      case "unavailable": return safetyUnavailableSchema.stage(value);
    }
  });

  const safetySelectedSchema = recordSchema<SafetySelectedRecord>("SafetySelected", "selected", read => {
    const expression = read("expression", () => sourceNodeRefSchema, value => value.expression);
    const declaration = read("declaration", () => nullableSchema(sourceNodeRefSchema), value => value.declaration);
    const declarations = read("declarations", () => arraySchema(sourceNodeRefSchema), value => value.declarations);
    return { fields: [expression, declaration, declarations], value: () => ({ kind: "selected", expression: expression.value(), declaration: declaration.value(), declarations: declarations.value() }) };
  });

  const safetyUnavailableSchema = recordSchema<SafetyUnavailableRecord>("SafetyUnavailable", "unavailable", read => {
    const reason = read("reason", () => safetyUnavailableReasonSchema, value => value.reason);
    return { fields: [reason], value: () => ({ kind: "unavailable", reason: reason.value() }) };
  });

  const safetyUnavailableReasonSchema = enumSchema("SafetyUnavailableReason", ["function-shape","receiver","member-evidence"]);

  const hirArgumentPassingCaptureSchema: RecordSchema<HirArgumentPassingCapture> = unionSchema<HirArgumentPassingCapture>("HirArgumentPassingCapture",
    () => [declarationPassingSchema, argumentPassingSchema], value => {
    switch (value.role) {
      case "declaration": return declarationPassingSchema.stage(value);
      case "argument": return argumentPassingSchema.stage(value);
    }
  });

  const declarationPassingSchema = recordSchema<DeclarationPassingRecord>("DeclarationPassing", "HirArgumentPassingCapture", read => {
    const role = read("role", () => declarationRoleSchema, value => value.role);
    const mode = read("mode", () => passingModeSchema, value => value.mode);
    return { fields: [role, mode], value: () => ({ role: role.value(), mode: mode.value() }) };
  });

  const declarationRoleSchema = enumSchema("DeclarationRole", ["declaration"]);

  const argumentPassingSchema = recordSchema<ArgumentPassingRecord>("ArgumentPassing", "HirArgumentPassingCapture", read => {
    const role = read("role", () => argumentRoleSchema, value => value.role);
    const mode = read("mode", () => passingModeSchema, value => value.mode);
    const storageExpression = read("storageExpression", () => sourceNodeRefSchema, value => value.storageExpression);
    return { fields: [role, mode, storageExpression], value: () => ({ role: role.value(), mode: mode.value(), storageExpression: storageExpression.value() }) };
  });

  const argumentRoleSchema = enumSchema("ArgumentRole", ["argument"]);
  return { hirCoreCaptureSchema, capturedProviderSchema, availableProviderSchema, capturedMarkersSchema, availableMarkersSchema, capturedPointerTypeSchema, availablePointerTypeSchema, capturedPointerOperationSchema, availablePointerOperationSchema, capturedAttributeSchema, availableAttributeSchema, capturedSafetySchema, availableSafetySchema, capturedPassingSchema, availablePassingSchema, capturedFlowStateSchema, availableFlowStateSchema, flowStateSchema, hirMarkersCaptureSchema, structMarkersSchema, defaultMarkerSchema, hirFieldMarkerCaptureSchema, capturedFieldsSchema, availableFieldsSchema, hirAttributeCaptureSchema, attributeBuilderSchema, attributeApplicationSchema, selectedMemberSchema, attributeMemberKindSchema, attributePlacementSchema, hirSafetyCaptureSchema, unsafeExpressionSchema, unsafeFamilySchema, expressionNameSchema, unsafeRemainingSchema, remainingNameSchema, safetyFamilySchema, safetyRootSchema, rootNameSchema, rootFormSchema, safetyMemberSchema, selectMemberNameSchema, safetyMemberKindSchema, safetyPlacementSchema, placementNameSchema, safetyPlacementKindSchema, safetyApplySchema, applyNameSchema, safetyContractSchema, hirSafetySelectionCaptureSchema, safetySelectedSchema, safetyUnavailableSchema, safetyUnavailableReasonSchema, hirArgumentPassingCaptureSchema, declarationPassingSchema, declarationRoleSchema, argumentPassingSchema, argumentRoleSchema };
}
