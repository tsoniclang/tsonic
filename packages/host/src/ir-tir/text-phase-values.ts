import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  BackedConversionIdentity, ConversionDecision, ConversionIdentity, MemberSelection, TargetAccess, TirApplication, TirDemand, TirProtocol, TirResolution, TirSelection, TypedApplication, TypedBigInt, TypedBinary, TypedConditional, TypedConstruction, TypedControlTransfer, TypedDecorator, TypedInstantiation, TypedIteration, TypedKeyword, TypedMember, TypedName, TypedNumber, TypedObjectSpread, TypedOmission, TypedOperation, TypedOperationOf, TypedPrefix, TypedProperty, TypedPropertyKey, TypedProtocolValue, TypedShorthand, TypedSpread, TypedString, TypedTemplate, TypedUnary, TypedUpdate, TypedValue
} from "./contract.js";
import type {
  BindingVector, ExactRational, MemberKey
} from "../ir-types/contract.js";
import type {
  NodeRef
} from "../ids/contract.js";
import type {
  DeclarationTarget, ImportTarget
} from "../ir-hir/contract.js";
import type {
  ApplicationDecision, ConstructionPartDecision, OperationDecision, RefinementDecision, RuleOutcome
} from "../ir-infer/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, nullableWork, sequenceWork } from "./text-layouts.js";

export interface PhaseValuesTextReads {
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_ConstructionPartDecision: TirRecordCodec<ConstructionPartDecision>;
  readonly work_ConversionDecision: TirRecordCodec<ConversionDecision>;
  readonly work_DeclarationTarget: TirRecordCodec<DeclarationTarget>;
  readonly work_ExactRational: TirRecordCodec<ExactRational>;
  readonly work_ImportTarget: TirRecordCodec<ImportTarget>;
  readonly work_MemberKey: TirRecordCodec<MemberKey>;
  readonly work_NodeRef: TirRecordCodec<NodeRef>;
  readonly work_O_ApplicationDecision_: TirRecordCodec<RuleOutcome<ApplicationDecision>>;
  readonly work_O_MemberSelection_: TirRecordCodec<RuleOutcome<MemberSelection>>;
  readonly work_O_TirApplication_: TirRecordCodec<RuleOutcome<TirApplication>>;
  readonly work_O_TirProtocol_: TirRecordCodec<RuleOutcome<TirProtocol>>;
  readonly work_O_TypedOperation_: TirRecordCodec<RuleOutcome<TypedOperation>>;
  readonly work_OperationDecision: TirRecordCodec<OperationDecision>;
  readonly work_OperationDecision_conversion: TirRecordCodec<OperationDecision & { readonly operation: ConversionIdentity }>;
  readonly work_OperationDecision_backed: TirRecordCodec<OperationDecision & { readonly operation: BackedConversionIdentity }>;
  readonly work_RefinementDecision: TirRecordCodec<RefinementDecision>;
  readonly work_TargetAccess: TirRecordCodec<TargetAccess>;
  readonly work_TirDemand: TirRecordCodec<TirDemand>;
  readonly work_TirResolution: TirRecordCodec<TirResolution>;
  readonly work_TirSelection: TirRecordCodec<TirSelection>;
}

export interface PhaseValuesTextModel {
  readonly work_TypedOperation: TirRecordCodec<TypedOperation>;
  readonly work_TypedOperation_conversion: TirRecordCodec<TypedOperationOf<ConversionIdentity>>;
  readonly work_TypedOperation_backed: TirRecordCodec<TypedOperationOf<BackedConversionIdentity>>;
  readonly work_TypedValue: TirRecordCodec<TypedValue>;
  readonly work_TypedName_value: TirRecordCodec<TypedName & { readonly role: "value" }>;
  readonly work_TypedName_shorthand_value: TirRecordCodec<TypedName & { readonly role: "shorthand-value" }>;
  readonly work_TypedName_assignment_target: TirRecordCodec<TypedName & { readonly role: "assignment-target" }>;
  readonly work_TypedName_declaration_name: TirRecordCodec<TypedName & { readonly role: "declaration-name" }>;
  readonly work_TypedName_property_name: TirRecordCodec<TypedName & { readonly role: "property-name" }>;
  readonly work_TypedName_type_name: TirRecordCodec<TypedName & { readonly role: "type-name" }>;
  readonly work_TypedName_label: TirRecordCodec<TypedName & { readonly role: "label" }>;
  readonly work_TypedName_private_name: TirRecordCodec<TypedName & { readonly role: "private-name" }>;
  readonly work_TypedPropertyKey_constant: TirRecordCodec<TypedPropertyKey & { readonly kind: "constant" }>;
  readonly work_TypedPropertyKey_computed: TirRecordCodec<TypedPropertyKey & { readonly kind: "computed" }>;
  readonly work_TypedString_value: TirRecordCodec<TypedString & { readonly role: "value" }>;
  readonly work_TypedString_property_name: TirRecordCodec<TypedString & { readonly role: "property-name" }>;
  readonly work_TypedString_declaration_name: TirRecordCodec<TypedString & { readonly role: "declaration-name" }>;
  readonly work_TypedString_type_literal: TirRecordCodec<TypedString & { readonly role: "type-literal" }>;
  readonly work_TypedString_module_specifier: TirRecordCodec<TypedString & { readonly role: "module-specifier" }>;
  readonly work_TypedString_export_name: TirRecordCodec<TypedString & { readonly role: "export-name" }>;
  readonly work_TypedString_attribute_value: TirRecordCodec<TypedString & { readonly role: "attribute-value" }>;
  readonly work_TypedNumber_value: TirRecordCodec<TypedNumber & { readonly role: "value" }>;
  readonly work_TypedNumber_property_name: TirRecordCodec<TypedNumber & { readonly role: "property-name" }>;
  readonly work_TypedNumber_declaration_name: TirRecordCodec<TypedNumber & { readonly role: "declaration-name" }>;
  readonly work_TypedNumber_type_literal: TirRecordCodec<TypedNumber & { readonly role: "type-literal" }>;
  readonly work_TypedBigInt_value: TirRecordCodec<TypedBigInt & { readonly role: "value" }>;
  readonly work_TypedBigInt_property_name: TirRecordCodec<TypedBigInt & { readonly role: "property-name" }>;
  readonly work_TypedBigInt_declaration_name: TirRecordCodec<TypedBigInt & { readonly role: "declaration-name" }>;
  readonly work_TypedBigInt_type_literal: TirRecordCodec<TypedBigInt & { readonly role: "type-literal" }>;
  readonly work_TypedKeyword_value: TirRecordCodec<TypedKeyword & { readonly role: "value" }>;
  readonly work_TypedKeyword_receiver: TirRecordCodec<TypedKeyword & { readonly role: "receiver" }>;
  readonly work_TypedKeyword_super: TirRecordCodec<TypedKeyword & { readonly role: "super" }>;
  readonly work_TypedKeyword_type_literal: TirRecordCodec<TypedKeyword & { readonly role: "type-literal" }>;
  readonly work_TypedBinary_arithmetic: TirRecordCodec<TypedBinary & { readonly role: "arithmetic" }>;
  readonly work_TypedBinary_comparison: TirRecordCodec<TypedBinary & { readonly role: "comparison" }>;
  readonly work_TypedBinary_short_circuit: TirRecordCodec<TypedBinary & { readonly role: "short-circuit" }>;
  readonly work_TypedBinary_assignment: TirRecordCodec<TypedBinary & { readonly role: "assignment" }>;
  readonly work_TypedBinary_sequence: TirRecordCodec<TypedBinary & { readonly role: "sequence" }>;
  readonly work_TypedUnary: TirRecordCodec<TypedUnary>;
  readonly work_TypedPrefix_value: TirRecordCodec<TypedPrefix & { readonly role: "value" }>;
  readonly work_TypedPrefix_update: TirRecordCodec<TypedPrefix & { readonly role: "update" }>;
  readonly work_TypedPrefix_type_literal: TirRecordCodec<TypedPrefix & { readonly role: "type-literal" }>;
  readonly work_TypedUpdate: TirRecordCodec<TypedUpdate>;
  readonly work_TypedConditional: TirRecordCodec<TypedConditional>;
  readonly work_TypedMember_value: TirRecordCodec<TypedMember & { readonly role: "value" }>;
  readonly work_TypedMember_assignment_target: TirRecordCodec<TypedMember & { readonly role: "assignment-target" }>;
  readonly work_TypedApplication: TirRecordCodec<TypedApplication>;
  readonly work_TypedProtocolValue: TirRecordCodec<TypedProtocolValue>;
  readonly work_TypedSpread: TirRecordCodec<TypedSpread>;
  readonly work_TypedObjectSpread: TirRecordCodec<TypedObjectSpread>;
  readonly work_TypedConstruction_value: TirRecordCodec<TypedConstruction & { readonly role: "value" }>;
  readonly work_TypedConstruction_assignment_pattern: TirRecordCodec<TypedConstruction & { readonly role: "assignment-pattern" }>;
  readonly work_TypedTemplate: TirRecordCodec<TypedTemplate>;
  readonly work_TypedInstantiation_value: TirRecordCodec<TypedInstantiation & { readonly role: "value" }>;
  readonly work_TypedInstantiation_heritage: TirRecordCodec<TypedInstantiation & { readonly role: "heritage" }>;
  readonly work_TypedProperty: TirRecordCodec<TypedProperty>;
  readonly work_TypedShorthand: TirRecordCodec<TypedShorthand>;
  readonly work_TypedOmission: TirRecordCodec<TypedOmission>;
  readonly work_TypedIteration: TirRecordCodec<TypedIteration>;
  readonly work_TypedControlTransfer: TirRecordCodec<TypedControlTransfer>;
  readonly work_TypedDecorator: TirRecordCodec<TypedDecorator>;
  readonly work_TypedName: TirRecordCodec<TypedName>;
  readonly work_TypedPropertyKey: TirRecordCodec<TypedPropertyKey>;
  readonly work_TypedString: TirRecordCodec<TypedString>;
  readonly work_TypedNumber: TirRecordCodec<TypedNumber>;
  readonly work_TypedBigInt: TirRecordCodec<TypedBigInt>;
  readonly work_TypedKeyword: TirRecordCodec<TypedKeyword>;
  readonly work_TypedBinary: TirRecordCodec<TypedBinary>;
  readonly work_TypedPrefix: TirRecordCodec<TypedPrefix>;
  readonly work_TypedMember: TirRecordCodec<TypedMember>;
  readonly work_TypedConstruction: TirRecordCodec<TypedConstruction>;
  readonly work_TypedInstantiation: TirRecordCodec<TypedInstantiation>;
}

export const createPhaseValuesText = (kernel: TirTextKernel, read: PhaseValuesTextReads): PhaseValuesTextModel => {
  const { defineRecord, bigintReader, definitionReader, nodeReader, numberReader, stringReader, typeReader } = kernel;
  const work_TypedOperation: TirRecordCodec<TypedOperation> = defineRecord<TypedOperation>("TypedOperation", "TypedOperation", null, "TypedOperation", null, null, fields => fields
    .field("decision", "OperationDecision", value => read.work_OperationDecision.write(value.decision), lazyReader(() => read.work_OperationDecision.reader))
    .field("permissionScope", "?n", value => nullableWork(value.permissionScope, actual => referenceWork("n", actual)), nullableReader(nodeReader))
    .finish((field_decision, field_permissionScope) => ({ decision: field_decision, permissionScope: field_permissionScope })));
  const work_TypedOperation_conversion: TirRecordCodec<TypedOperationOf<ConversionIdentity>> = defineRecord<TypedOperationOf<ConversionIdentity>>("TypedOperation@conversion", "TypedOperation", null, "TypedOperation", null, null, fields => fields
    .field("decision", "OperationDecision", value => read.work_OperationDecision_conversion.write(value.decision), lazyReader(() => read.work_OperationDecision_conversion.reader))
    .field("permissionScope", "?n", value => nullableWork(value.permissionScope, actual => referenceWork("n", actual)), nullableReader(nodeReader))
    .finish((field_decision, field_permissionScope) => ({ decision: field_decision, permissionScope: field_permissionScope })));
  const work_TypedOperation_backed: TirRecordCodec<TypedOperationOf<BackedConversionIdentity>> = defineRecord<TypedOperationOf<BackedConversionIdentity>>("TypedOperation@backed", "TypedOperation", null, "TypedOperation", null, null, fields => fields
    .field("decision", "OperationDecision", value => read.work_OperationDecision_backed.write(value.decision), lazyReader(() => read.work_OperationDecision_backed.reader))
    .field("permissionScope", "?n", value => nullableWork(value.permissionScope, actual => referenceWork("n", actual)), nullableReader(nodeReader))
    .finish((field_decision, field_permissionScope) => ({ decision: field_decision, permissionScope: field_permissionScope })));
  const work_TypedValue: TirRecordCodec<TypedValue> = defineRecord<TypedValue>("TypedValue", "TypedValue", null, "TypedValue", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand,
    })));
  const work_TypedName_value: TirRecordCodec<TypedName & { readonly role: "value" }> = defineRecord<TypedName & { readonly role: "value" }>("TypedName@value", "TypedName", { field: "role", value: "value" }, "TypedName", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedName & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("resolution", "TirResolution", value => read.work_TirResolution.write(value.resolution), lazyReader(() => read.work_TirResolution.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_resolution) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, resolution: field_resolution,
    })));
  const work_TypedName_shorthand_value: TirRecordCodec<TypedName & { readonly role: "shorthand-value" }> = defineRecord<TypedName & { readonly role: "shorthand-value" }>("TypedName@shorthand-value", "TypedName", { field: "role", value: "shorthand-value" }, "TypedName", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'shorthand-value", value => scalarWork("'shorthand-value", value.role), literalReader<(TypedName & { readonly role: "shorthand-value" })["role"]>("'shorthand-value", ["shorthand-value"]))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("resolution", "TirResolution", value => read.work_TirResolution.write(value.resolution), lazyReader(() => read.work_TirResolution.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_key, field_resolution) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, key: field_key, resolution: field_resolution,
    })));
  const work_TypedName_assignment_target: TirRecordCodec<TypedName & { readonly role: "assignment-target" }> = defineRecord<TypedName & { readonly role: "assignment-target" }>("TypedName@assignment-target", "TypedName", { field: "role", value: "assignment-target" }, "TypedName", null, null, fields => fields
    .field("role", "'assignment-target", value => scalarWork("'assignment-target", value.role), literalReader<(TypedName & { readonly role: "assignment-target" })["role"]>("'assignment-target", ["assignment-target"]))
    .field("resolution", "TirResolution", value => read.work_TirResolution.write(value.resolution), lazyReader(() => read.work_TirResolution.reader))
    .field("access", "TargetAccess", value => read.work_TargetAccess.write(value.access), lazyReader(() => read.work_TargetAccess.reader))
    .finish((field_role, field_resolution, field_access) => ({ role: field_role, resolution: field_resolution, access: field_access })));
  const work_TypedName_declaration_name: TirRecordCodec<TypedName & { readonly role: "declaration-name" }> = defineRecord<TypedName & { readonly role: "declaration-name" }>("TypedName@declaration-name", "TypedName", { field: "role", value: "declaration-name" }, "TypedName", null, null, fields => fields
    .field("role", "'declaration-name", value => scalarWork("'declaration-name", value.role), literalReader<(TypedName & { readonly role: "declaration-name" })["role"]>("'declaration-name", ["declaration-name"]))
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .field("storage", "?t", value => nullableWork(value.storage, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .finish((field_role, field_declaration, field_storage) => ({ role: field_role, declaration: field_declaration, storage: field_storage })));
  const work_TypedName_property_name: TirRecordCodec<TypedName & { readonly role: "property-name" }> = defineRecord<TypedName & { readonly role: "property-name" }>("TypedName@property-name", "TypedName", { field: "role", value: "property-name" }, "TypedName", null, null, fields => fields
    .field("role", "'property-name", value => scalarWork("'property-name", value.role), literalReader<(TypedName & { readonly role: "property-name" })["role"]>("'property-name", ["property-name"]))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .finish((field_role, field_key) => ({ role: field_role, key: field_key })));
  const work_TypedName_type_name: TirRecordCodec<TypedName & { readonly role: "type-name" }> = defineRecord<TypedName & { readonly role: "type-name" }>("TypedName@type-name", "TypedName", { field: "role", value: "type-name" }, "TypedName", null, null, fields => fields
    .field("role", "'type-name", value => scalarWork("'type-name", value.role), literalReader<(TypedName & { readonly role: "type-name" })["role"]>("'type-name", ["type-name"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("declarations", "[def]", value => sequenceWork("[def]", value.declarations, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_role, field_type, field_declarations) => ({ role: field_role, type: field_type, declarations: field_declarations })));
  const work_TypedName_label: TirRecordCodec<TypedName & { readonly role: "label" }> = defineRecord<TypedName & { readonly role: "label" }>("TypedName@label", "TypedName", { field: "role", value: "label" }, "TypedName", null, null, fields => fields
    .field("role", "'label", value => scalarWork("'label", value.role), literalReader<(TypedName & { readonly role: "label" })["role"]>("'label", ["label"]))
    .field("target", "NodeRef", value => read.work_NodeRef.write(value.target), lazyReader(() => read.work_NodeRef.reader))
    .finish((field_role, field_target) => ({ role: field_role, target: field_target })));
  const work_TypedName_private_name: TirRecordCodec<TypedName & { readonly role: "private-name" }> = defineRecord<TypedName & { readonly role: "private-name" }>("TypedName@private-name", "TypedName", { field: "role", value: "private-name" }, "TypedName", null, null, fields => fields
    .field("role", "'private-name", value => scalarWork("'private-name", value.role), literalReader<(TypedName & { readonly role: "private-name" })["role"]>("'private-name", ["private-name"]))
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_role, field_declaration) => ({ role: field_role, declaration: field_declaration })));
  const work_TypedPropertyKey_constant: TirRecordCodec<TypedPropertyKey & { readonly kind: "constant" }> = defineRecord<TypedPropertyKey & { readonly kind: "constant" }>("TypedPropertyKey#constant", "TypedPropertyKey", { field: "kind", value: "constant" }, "constant", null, null, fields => fields
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .finish((field_key) => ({ kind: "constant", key: field_key })));
  const work_TypedPropertyKey_computed: TirRecordCodec<TypedPropertyKey & { readonly kind: "computed" }> = defineRecord<TypedPropertyKey & { readonly kind: "computed" }>("TypedPropertyKey#computed", "TypedPropertyKey", { field: "kind", value: "computed" }, "computed", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_type) => ({ kind: "computed", type: field_type })));
  const work_TypedString_value: TirRecordCodec<TypedString & { readonly role: "value" }> = defineRecord<TypedString & { readonly role: "value" }>("TypedString@value", "TypedString", { field: "role", value: "value" }, "TypedString", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedString & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_value) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, value: field_value,
    })));
  const work_TypedString_property_name: TirRecordCodec<TypedString & { readonly role: "property-name" }> = defineRecord<TypedString & { readonly role: "property-name" }>("TypedString@property-name", "TypedString", { field: "role", value: "property-name" }, "TypedString", null, null, fields => fields
    .field("role", "'property-name", value => scalarWork("'property-name", value.role), literalReader<(TypedString & { readonly role: "property-name" })["role"]>("'property-name", ["property-name"]))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .finish((field_role, field_key) => ({ role: field_role, key: field_key })));
  const work_TypedString_declaration_name: TirRecordCodec<TypedString & { readonly role: "declaration-name" }> = defineRecord<TypedString & { readonly role: "declaration-name" }>("TypedString@declaration-name", "TypedString", { field: "role", value: "declaration-name" }, "TypedString", null, null, fields => fields
    .field("role", "'declaration-name", value => scalarWork("'declaration-name", value.role), literalReader<(TypedString & { readonly role: "declaration-name" })["role"]>("'declaration-name", ["declaration-name"]))
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .finish((field_role, field_declaration) => ({ role: field_role, declaration: field_declaration })));
  const work_TypedString_type_literal: TirRecordCodec<TypedString & { readonly role: "type-literal" }> = defineRecord<TypedString & { readonly role: "type-literal" }>("TypedString@type-literal", "TypedString", { field: "role", value: "type-literal" }, "TypedString", null, null, fields => fields
    .field("role", "'type-literal", value => scalarWork("'type-literal", value.role), literalReader<(TypedString & { readonly role: "type-literal" })["role"]>("'type-literal", ["type-literal"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_role, field_type) => ({ role: field_role, type: field_type })));
  const work_TypedString_module_specifier: TirRecordCodec<TypedString & { readonly role: "module-specifier" }> = defineRecord<TypedString & { readonly role: "module-specifier" }>("TypedString@module-specifier", "TypedString", { field: "role", value: "module-specifier" }, "TypedString", null, null, fields => fields
    .field("role", "'module-specifier", value => scalarWork("'module-specifier", value.role), literalReader<(TypedString & { readonly role: "module-specifier" })["role"]>("'module-specifier", ["module-specifier"]))
    .field("target", "ImportTarget", value => read.work_ImportTarget.write(value.target), lazyReader(() => read.work_ImportTarget.reader))
    .finish((field_role, field_target) => ({ role: field_role, target: field_target })));
  const work_TypedString_export_name: TirRecordCodec<TypedString & { readonly role: "export-name" }> = defineRecord<TypedString & { readonly role: "export-name" }>("TypedString@export-name", "TypedString", { field: "role", value: "export-name" }, "TypedString", null, null, fields => fields
    .field("role", "'export-name", value => scalarWork("'export-name", value.role), literalReader<(TypedString & { readonly role: "export-name" })["role"]>("'export-name", ["export-name"]))
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .finish((field_role, field_definition) => ({ role: field_role, definition: field_definition })));
  const work_TypedString_attribute_value: TirRecordCodec<TypedString & { readonly role: "attribute-value" }> = defineRecord<TypedString & { readonly role: "attribute-value" }>("TypedString@attribute-value", "TypedString", { field: "role", value: "attribute-value" }, "TypedString", null, null, fields => fields
    .field("role", "'attribute-value", value => scalarWork("'attribute-value", value.role), literalReader<(TypedString & { readonly role: "attribute-value" })["role"]>("'attribute-value", ["attribute-value"]))
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_role, field_value) => ({ role: field_role, value: field_value })));
  const work_TypedNumber_value: TirRecordCodec<TypedNumber & { readonly role: "value" }> = defineRecord<TypedNumber & { readonly role: "value" }>("TypedNumber@value", "TypedNumber", { field: "role", value: "value" }, "TypedNumber", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedNumber & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("value", "ExactRational", value => read.work_ExactRational.write(value.value), lazyReader(() => read.work_ExactRational.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_value) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, value: field_value,
    })));
  const work_TypedNumber_property_name: TirRecordCodec<TypedNumber & { readonly role: "property-name" }> = defineRecord<TypedNumber & { readonly role: "property-name" }>("TypedNumber@property-name", "TypedNumber", { field: "role", value: "property-name" }, "TypedNumber", null, null, fields => fields
    .field("role", "'property-name", value => scalarWork("'property-name", value.role), literalReader<(TypedNumber & { readonly role: "property-name" })["role"]>("'property-name", ["property-name"]))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .finish((field_role, field_key) => ({ role: field_role, key: field_key })));
  const work_TypedNumber_declaration_name: TirRecordCodec<TypedNumber & { readonly role: "declaration-name" }> = defineRecord<TypedNumber & { readonly role: "declaration-name" }>("TypedNumber@declaration-name", "TypedNumber", { field: "role", value: "declaration-name" }, "TypedNumber", null, null, fields => fields
    .field("role", "'declaration-name", value => scalarWork("'declaration-name", value.role), literalReader<(TypedNumber & { readonly role: "declaration-name" })["role"]>("'declaration-name", ["declaration-name"]))
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .finish((field_role, field_declaration) => ({ role: field_role, declaration: field_declaration })));
  const work_TypedNumber_type_literal: TirRecordCodec<TypedNumber & { readonly role: "type-literal" }> = defineRecord<TypedNumber & { readonly role: "type-literal" }>("TypedNumber@type-literal", "TypedNumber", { field: "role", value: "type-literal" }, "TypedNumber", null, null, fields => fields
    .field("role", "'type-literal", value => scalarWork("'type-literal", value.role), literalReader<(TypedNumber & { readonly role: "type-literal" })["role"]>("'type-literal", ["type-literal"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_role, field_type) => ({ role: field_role, type: field_type })));
  const work_TypedBigInt_value: TirRecordCodec<TypedBigInt & { readonly role: "value" }> = defineRecord<TypedBigInt & { readonly role: "value" }>("TypedBigInt@value", "TypedBigInt", { field: "role", value: "value" }, "TypedBigInt", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedBigInt & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("value", "bigint", value => scalarWork("bigint", value.value), bigintReader)
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_value) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, value: field_value,
    })));
  const work_TypedBigInt_property_name: TirRecordCodec<TypedBigInt & { readonly role: "property-name" }> = defineRecord<TypedBigInt & { readonly role: "property-name" }>("TypedBigInt@property-name", "TypedBigInt", { field: "role", value: "property-name" }, "TypedBigInt", null, null, fields => fields
    .field("role", "'property-name", value => scalarWork("'property-name", value.role), literalReader<(TypedBigInt & { readonly role: "property-name" })["role"]>("'property-name", ["property-name"]))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .finish((field_role, field_key) => ({ role: field_role, key: field_key })));
  const work_TypedBigInt_declaration_name: TirRecordCodec<TypedBigInt & { readonly role: "declaration-name" }> = defineRecord<TypedBigInt & { readonly role: "declaration-name" }>("TypedBigInt@declaration-name", "TypedBigInt", { field: "role", value: "declaration-name" }, "TypedBigInt", null, null, fields => fields
    .field("role", "'declaration-name", value => scalarWork("'declaration-name", value.role), literalReader<(TypedBigInt & { readonly role: "declaration-name" })["role"]>("'declaration-name", ["declaration-name"]))
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .finish((field_role, field_declaration) => ({ role: field_role, declaration: field_declaration })));
  const work_TypedBigInt_type_literal: TirRecordCodec<TypedBigInt & { readonly role: "type-literal" }> = defineRecord<TypedBigInt & { readonly role: "type-literal" }>("TypedBigInt@type-literal", "TypedBigInt", { field: "role", value: "type-literal" }, "TypedBigInt", null, null, fields => fields
    .field("role", "'type-literal", value => scalarWork("'type-literal", value.role), literalReader<(TypedBigInt & { readonly role: "type-literal" })["role"]>("'type-literal", ["type-literal"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_role, field_type) => ({ role: field_role, type: field_type })));
  const work_TypedKeyword_value: TirRecordCodec<TypedKeyword & { readonly role: "value" }> = defineRecord<TypedKeyword & { readonly role: "value" }>("TypedKeyword@value", "TypedKeyword", { field: "role", value: "value" }, "TypedKeyword", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedKeyword & { readonly role: "value" })["role"]>("'value", ["value"]))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role,
    })));
  const work_TypedKeyword_receiver: TirRecordCodec<TypedKeyword & { readonly role: "receiver" }> = defineRecord<TypedKeyword & { readonly role: "receiver" }>("TypedKeyword@receiver", "TypedKeyword", { field: "role", value: "receiver" }, "TypedKeyword", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'receiver", value => scalarWork("'receiver", value.role), literalReader<(TypedKeyword & { readonly role: "receiver" })["role"]>("'receiver", ["receiver"]))
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_owner) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, owner: field_owner,
    })));
  const work_TypedKeyword_super: TirRecordCodec<TypedKeyword & { readonly role: "super" }> = defineRecord<TypedKeyword & { readonly role: "super" }>("TypedKeyword@super", "TypedKeyword", { field: "role", value: "super" }, "TypedKeyword", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'super", value => scalarWork("'super", value.role), literalReader<(TypedKeyword & { readonly role: "super" })["role"]>("'super", ["super"]))
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .field("base", "t", value => referenceWork("t", value.base), typeReader)
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_owner, field_base) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, owner: field_owner, base: field_base,
    })));
  const work_TypedKeyword_type_literal: TirRecordCodec<TypedKeyword & { readonly role: "type-literal" }> = defineRecord<TypedKeyword & { readonly role: "type-literal" }>("TypedKeyword@type-literal", "TypedKeyword", { field: "role", value: "type-literal" }, "TypedKeyword", null, null, fields => fields
    .field("role", "'type-literal", value => scalarWork("'type-literal", value.role), literalReader<(TypedKeyword & { readonly role: "type-literal" })["role"]>("'type-literal", ["type-literal"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_role, field_type) => ({ role: field_role, type: field_type })));
  const work_TypedBinary_arithmetic: TirRecordCodec<TypedBinary & { readonly role: "arithmetic" }> = defineRecord<TypedBinary & { readonly role: "arithmetic" }>("TypedBinary@arithmetic", "TypedBinary", { field: "role", value: "arithmetic" }, "TypedBinary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'arithmetic", value => scalarWork("'arithmetic", value.role), literalReader<(TypedBinary & { readonly role: "arithmetic" })["role"]>("'arithmetic", ["arithmetic"]))
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, operation: field_operation,
    })));
  const work_TypedBinary_comparison: TirRecordCodec<TypedBinary & { readonly role: "comparison" }> = defineRecord<TypedBinary & { readonly role: "comparison" }>("TypedBinary@comparison", "TypedBinary", { field: "role", value: "comparison" }, "TypedBinary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'comparison", value => scalarWork("'comparison", value.role), literalReader<(TypedBinary & { readonly role: "comparison" })["role"]>("'comparison", ["comparison"]))
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, operation: field_operation,
    })));
  const work_TypedBinary_short_circuit: TirRecordCodec<TypedBinary & { readonly role: "short-circuit" }> = defineRecord<TypedBinary & { readonly role: "short-circuit" }>("TypedBinary@short-circuit", "TypedBinary", { field: "role", value: "short-circuit" }, "TypedBinary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'short-circuit", value => scalarWork("'short-circuit", value.role), literalReader<(TypedBinary & { readonly role: "short-circuit" })["role"]>("'short-circuit", ["short-circuit"]))
    .field("selection", "TirSelection", value => read.work_TirSelection.write(value.selection), lazyReader(() => read.work_TirSelection.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_selection) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, selection: field_selection,
    })));
  const work_TypedBinary_assignment: TirRecordCodec<TypedBinary & { readonly role: "assignment" }> = defineRecord<TypedBinary & { readonly role: "assignment" }>("TypedBinary@assignment", "TypedBinary", { field: "role", value: "assignment" }, "TypedBinary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'assignment", value => scalarWork("'assignment", value.role), literalReader<(TypedBinary & { readonly role: "assignment" })["role"]>("'assignment", ["assignment"]))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("calculation", "?O<TypedOperation>", value => nullableWork(value.calculation, actual => read.work_O_TypedOperation_.write(actual)), nullableReader(lazyReader(() => read.work_O_TypedOperation_.reader)))
    .field("selection", "?TirSelection", value => nullableWork(value.selection, actual => read.work_TirSelection.write(actual)), nullableReader(lazyReader(() => read.work_TirSelection.reader)))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_storage, field_calculation, field_selection) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, storage: field_storage,
      calculation: field_calculation, selection: field_selection,
    })));
  const work_TypedBinary_sequence: TirRecordCodec<TypedBinary & { readonly role: "sequence" }> = defineRecord<TypedBinary & { readonly role: "sequence" }>("TypedBinary@sequence", "TypedBinary", { field: "role", value: "sequence" }, "TypedBinary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'sequence", value => scalarWork("'sequence", value.role), literalReader<(TypedBinary & { readonly role: "sequence" })["role"]>("'sequence", ["sequence"]))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role,
    })));
  const work_TypedUnary: TirRecordCodec<TypedUnary> = defineRecord<TypedUnary>("TypedUnary", "TypedUnary", null, "TypedUnary", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, operation: field_operation,
    })));
  const work_TypedPrefix_value: TirRecordCodec<TypedPrefix & { readonly role: "value" }> = defineRecord<TypedPrefix & { readonly role: "value" }>("TypedPrefix@value", "TypedPrefix", { field: "role", value: "value" }, "TypedPrefix", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedPrefix & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, operation: field_operation,
    })));
  const work_TypedPrefix_update: TirRecordCodec<TypedPrefix & { readonly role: "update" }> = defineRecord<TypedPrefix & { readonly role: "update" }>("TypedPrefix@update", "TypedPrefix", { field: "role", value: "update" }, "TypedPrefix", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'update", value => scalarWork("'update", value.role), literalReader<(TypedPrefix & { readonly role: "update" })["role"]>("'update", ["update"]))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_storage, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, storage: field_storage, operation: field_operation,
    })));
  const work_TypedPrefix_type_literal: TirRecordCodec<TypedPrefix & { readonly role: "type-literal" }> = defineRecord<TypedPrefix & { readonly role: "type-literal" }>("TypedPrefix@type-literal", "TypedPrefix", { field: "role", value: "type-literal" }, "TypedPrefix", null, null, fields => fields
    .field("role", "'type-literal", value => scalarWork("'type-literal", value.role), literalReader<(TypedPrefix & { readonly role: "type-literal" })["role"]>("'type-literal", ["type-literal"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_role, field_type) => ({ role: field_role, type: field_type })));
  const work_TypedUpdate: TirRecordCodec<TypedUpdate> = defineRecord<TypedUpdate>("TypedUpdate", "TypedUpdate", null, "TypedUpdate", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_storage, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, storage: field_storage, operation: field_operation,
    })));
  const work_TypedConditional: TirRecordCodec<TypedConditional> = defineRecord<TypedConditional>("TypedConditional", "TypedConditional", null, "TypedConditional", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("selection", "TirSelection", value => read.work_TirSelection.write(value.selection), lazyReader(() => read.work_TirSelection.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_selection) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, selection: field_selection,
    })));
  const work_TypedMember_value: TirRecordCodec<TypedMember & { readonly role: "value" }> = defineRecord<TypedMember & { readonly role: "value" }>("TypedMember@value", "TypedMember", { field: "role", value: "value" }, "TypedMember", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedMember & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("selection", "O<MemberSelection>", value => read.work_O_MemberSelection_.write(value.selection), lazyReader(() => read.work_O_MemberSelection_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_selection) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, selection: field_selection,
    })));
  const work_TypedMember_assignment_target: TirRecordCodec<TypedMember & { readonly role: "assignment-target" }> = defineRecord<TypedMember & { readonly role: "assignment-target" }>("TypedMember@assignment-target", "TypedMember", { field: "role", value: "assignment-target" }, "TypedMember", null, null, fields => fields
    .field("role", "'assignment-target", value => scalarWork("'assignment-target", value.role), literalReader<(TypedMember & { readonly role: "assignment-target" })["role"]>("'assignment-target", ["assignment-target"]))
    .field("selection", "O<MemberSelection>", value => read.work_O_MemberSelection_.write(value.selection), lazyReader(() => read.work_O_MemberSelection_.reader))
    .field("access", "TargetAccess", value => read.work_TargetAccess.write(value.access), lazyReader(() => read.work_TargetAccess.reader))
    .finish((field_role, field_selection, field_access) => ({ role: field_role, selection: field_selection, access: field_access })));
  const work_TypedApplication: TirRecordCodec<TypedApplication> = defineRecord<TypedApplication>("TypedApplication", "TypedApplication", null, "TypedApplication", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("application", "O<TirApplication>", value => read.work_O_TirApplication_.write(value.application), lazyReader(() => read.work_O_TirApplication_.reader))
    .field("operation", "?O<TypedOperation>", value => nullableWork(value.operation, actual => read.work_O_TypedOperation_.write(actual)), nullableReader(lazyReader(() => read.work_O_TypedOperation_.reader)))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_application, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, application: field_application, operation: field_operation,
    })));
  const work_TypedProtocolValue: TirRecordCodec<TypedProtocolValue> = defineRecord<TypedProtocolValue>("TypedProtocolValue", "TypedProtocolValue", null, "TypedProtocolValue", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("protocol", "O<TirProtocol>", value => read.work_O_TirProtocol_.write(value.protocol), lazyReader(() => read.work_O_TirProtocol_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_protocol) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, protocol: field_protocol,
    })));
  const work_TypedSpread: TirRecordCodec<TypedSpread> = defineRecord<TypedSpread>("TypedSpread", "TypedSpread", null, "TypedSpread", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("protocol", "O<TirProtocol>", value => read.work_O_TirProtocol_.write(value.protocol), lazyReader(() => read.work_O_TirProtocol_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_protocol) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, protocol: field_protocol,
    })));
  const work_TypedObjectSpread: TirRecordCodec<TypedObjectSpread> = defineRecord<TypedObjectSpread>("TypedObjectSpread", "TypedObjectSpread", null, "TypedObjectSpread", null, null, fields => fields
    .field("construction", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.construction), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_construction) => ({ construction: field_construction })));
  const work_TypedConstruction_value: TirRecordCodec<TypedConstruction & { readonly role: "value" }> = defineRecord<TypedConstruction & { readonly role: "value" }>("TypedConstruction@value", "TypedConstruction", { field: "role", value: "value" }, "TypedConstruction", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedConstruction & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("construction", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.construction), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_construction) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, construction: field_construction,
    })));
  const work_TypedConstruction_assignment_pattern: TirRecordCodec<TypedConstruction & { readonly role: "assignment-pattern" }> = defineRecord<TypedConstruction & { readonly role: "assignment-pattern" }>("TypedConstruction@assignment-pattern", "TypedConstruction", { field: "role", value: "assignment-pattern" }, "TypedConstruction", null, null, fields => fields
    .field("role", "'assignment-pattern", value => scalarWork("'assignment-pattern", value.role), literalReader<(TypedConstruction & { readonly role: "assignment-pattern" })["role"]>("'assignment-pattern", ["assignment-pattern"]))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("parts", "[ConstructionPartDecision]", value => sequenceWork("[ConstructionPartDecision]", value.parts, actual => read.work_ConstructionPartDecision.write(actual)), sequenceReader("[ConstructionPartDecision]", lazyReader(() => read.work_ConstructionPartDecision.reader)))
    .finish((field_role, field_storage, field_parts) => ({ role: field_role, storage: field_storage, parts: field_parts })));
  const work_TypedTemplate: TirRecordCodec<TypedTemplate> = defineRecord<TypedTemplate>("TypedTemplate", "TypedTemplate", null, "TypedTemplate", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("operation", "O<TypedOperation>", value => read.work_O_TypedOperation_.write(value.operation), lazyReader(() => read.work_O_TypedOperation_.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_operation) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, operation: field_operation,
    })));
  const work_TypedInstantiation_value: TirRecordCodec<TypedInstantiation & { readonly role: "value" }> = defineRecord<TypedInstantiation & { readonly role: "value" }>("TypedInstantiation@value", "TypedInstantiation", { field: "role", value: "value" }, "TypedInstantiation", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("role", "'value", value => scalarWork("'value", value.role), literalReader<(TypedInstantiation & { readonly role: "value" })["role"]>("'value", ["value"]))
    .field("bindings", "BindingVector", value => read.work_BindingVector.write(value.bindings), lazyReader(() => read.work_BindingVector.reader))
    .field("application", "?O<ApplicationDecision>", value => nullableWork(value.application, actual => read.work_O_ApplicationDecision_.write(actual)), nullableReader(lazyReader(() => read.work_O_ApplicationDecision_.reader)))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_role, field_bindings, field_application) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, role: field_role, bindings: field_bindings,
      application: field_application,
    })));
  const work_TypedInstantiation_heritage: TirRecordCodec<TypedInstantiation & { readonly role: "heritage" }> = defineRecord<TypedInstantiation & { readonly role: "heritage" }>("TypedInstantiation@heritage", "TypedInstantiation", { field: "role", value: "heritage" }, "TypedInstantiation", null, null, fields => fields
    .field("role", "'heritage", value => scalarWork("'heritage", value.role), literalReader<(TypedInstantiation & { readonly role: "heritage" })["role"]>("'heritage", ["heritage"]))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("bindings", "BindingVector", value => read.work_BindingVector.write(value.bindings), lazyReader(() => read.work_BindingVector.reader))
    .field("declarations", "[def]", value => sequenceWork("[def]", value.declarations, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_role, field_type, field_bindings, field_declarations) => ({ role: field_role, type: field_type, bindings: field_bindings, declarations: field_declarations })));
  const work_TypedProperty: TirRecordCodec<TypedProperty> = defineRecord<TypedProperty>("TypedProperty", "TypedProperty", null, "TypedProperty", null, null, fields => fields
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("member", "O<MemberSelection>", value => read.work_O_MemberSelection_.write(value.member), lazyReader(() => read.work_O_MemberSelection_.reader))
    .finish((field_key, field_member) => ({ key: field_key, member: field_member })));
  const work_TypedShorthand: TirRecordCodec<TypedShorthand> = defineRecord<TypedShorthand>("TypedShorthand", "TypedShorthand", null, "TypedShorthand", null, null, fields => fields
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("member", "O<MemberSelection>", value => read.work_O_MemberSelection_.write(value.member), lazyReader(() => read.work_O_MemberSelection_.reader))
    .finish((field_key, field_member) => ({ key: field_key, member: field_member })));
  const work_TypedOmission: TirRecordCodec<TypedOmission> = defineRecord<TypedOmission>("TypedOmission", "TypedOmission", null, "TypedOmission", null, null, fields => fields
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .finish((field_storage) => ({ storage: field_storage })));
  const work_TypedIteration: TirRecordCodec<TypedIteration> = defineRecord<TypedIteration>("TypedIteration", "TypedIteration", null, "TypedIteration", null, null, fields => fields
    .field("protocol", "O<TirProtocol>", value => read.work_O_TirProtocol_.write(value.protocol), lazyReader(() => read.work_O_TirProtocol_.reader))
    .finish((field_protocol) => ({ protocol: field_protocol })));
  const work_TypedControlTransfer: TirRecordCodec<TypedControlTransfer> = defineRecord<TypedControlTransfer>("TypedControlTransfer", "TypedControlTransfer", null, "TypedControlTransfer", null, null, fields => fields
    .field("target", "NodeRef", value => read.work_NodeRef.write(value.target), lazyReader(() => read.work_NodeRef.reader))
    .finish((field_target) => ({ target: field_target })));
  const work_TypedDecorator: TirRecordCodec<TypedDecorator> = defineRecord<TypedDecorator>("TypedDecorator", "TypedDecorator", null, "TypedDecorator", null, null, fields => fields
    .field("application", "O<TirApplication>", value => read.work_O_TirApplication_.write(value.application), lazyReader(() => read.work_O_TirApplication_.reader))
    .finish((field_application) => ({ application: field_application })));
  const work_TypedName: TirRecordCodec<TypedName> = unionRecord<TypedName>("TypedName", (value: TypedName): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedName_value.write(value);
      case "shorthand-value": return work_TypedName_shorthand_value.write(value);
      case "assignment-target": return work_TypedName_assignment_target.write(value);
      case "declaration-name": return work_TypedName_declaration_name.write(value);
      case "property-name": return work_TypedName_property_name.write(value);
      case "type-name": return work_TypedName_type_name.write(value);
      case "label": return work_TypedName_label.write(value);
      case "private-name": return work_TypedName_private_name.write(value);
    }
  }, () => [work_TypedName_value.reader, work_TypedName_shorthand_value.reader, work_TypedName_assignment_target.reader, work_TypedName_declaration_name.reader, work_TypedName_property_name.reader, work_TypedName_type_name.reader, work_TypedName_label.reader, work_TypedName_private_name.reader]);
  const work_TypedPropertyKey: TirRecordCodec<TypedPropertyKey> = unionRecord<TypedPropertyKey>("TypedPropertyKey", (value: TypedPropertyKey): TirTypedRecordWork => {
    switch (value.kind) {
      case "constant": return work_TypedPropertyKey_constant.write(value);
      case "computed": return work_TypedPropertyKey_computed.write(value);
    }
  }, () => [work_TypedPropertyKey_constant.reader, work_TypedPropertyKey_computed.reader]);
  const work_TypedString: TirRecordCodec<TypedString> = unionRecord<TypedString>("TypedString", (value: TypedString): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedString_value.write(value);
      case "property-name": return work_TypedString_property_name.write(value);
      case "declaration-name": return work_TypedString_declaration_name.write(value);
      case "type-literal": return work_TypedString_type_literal.write(value);
      case "module-specifier": return work_TypedString_module_specifier.write(value);
      case "export-name": return work_TypedString_export_name.write(value);
      case "attribute-value": return work_TypedString_attribute_value.write(value);
    }
  }, () => [work_TypedString_value.reader, work_TypedString_property_name.reader, work_TypedString_declaration_name.reader, work_TypedString_type_literal.reader, work_TypedString_module_specifier.reader, work_TypedString_export_name.reader, work_TypedString_attribute_value.reader]);
  const work_TypedNumber: TirRecordCodec<TypedNumber> = unionRecord<TypedNumber>("TypedNumber", (value: TypedNumber): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedNumber_value.write(value);
      case "property-name": return work_TypedNumber_property_name.write(value);
      case "declaration-name": return work_TypedNumber_declaration_name.write(value);
      case "type-literal": return work_TypedNumber_type_literal.write(value);
    }
  }, () => [work_TypedNumber_value.reader, work_TypedNumber_property_name.reader, work_TypedNumber_declaration_name.reader, work_TypedNumber_type_literal.reader]);
  const work_TypedBigInt: TirRecordCodec<TypedBigInt> = unionRecord<TypedBigInt>("TypedBigInt", (value: TypedBigInt): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedBigInt_value.write(value);
      case "property-name": return work_TypedBigInt_property_name.write(value);
      case "declaration-name": return work_TypedBigInt_declaration_name.write(value);
      case "type-literal": return work_TypedBigInt_type_literal.write(value);
    }
  }, () => [work_TypedBigInt_value.reader, work_TypedBigInt_property_name.reader, work_TypedBigInt_declaration_name.reader, work_TypedBigInt_type_literal.reader]);
  const work_TypedKeyword: TirRecordCodec<TypedKeyword> = unionRecord<TypedKeyword>("TypedKeyword", (value: TypedKeyword): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedKeyword_value.write(value);
      case "receiver": return work_TypedKeyword_receiver.write(value);
      case "super": return work_TypedKeyword_super.write(value);
      case "type-literal": return work_TypedKeyword_type_literal.write(value);
    }
  }, () => [work_TypedKeyword_value.reader, work_TypedKeyword_receiver.reader, work_TypedKeyword_super.reader, work_TypedKeyword_type_literal.reader]);
  const work_TypedBinary: TirRecordCodec<TypedBinary> = unionRecord<TypedBinary>("TypedBinary", (value: TypedBinary): TirTypedRecordWork => {
    switch (value.role) {
      case "arithmetic": return work_TypedBinary_arithmetic.write(value);
      case "comparison": return work_TypedBinary_comparison.write(value);
      case "short-circuit": return work_TypedBinary_short_circuit.write(value);
      case "assignment": return work_TypedBinary_assignment.write(value);
      case "sequence": return work_TypedBinary_sequence.write(value);
    }
  }, () => [work_TypedBinary_arithmetic.reader, work_TypedBinary_comparison.reader, work_TypedBinary_short_circuit.reader, work_TypedBinary_assignment.reader, work_TypedBinary_sequence.reader]);
  const work_TypedPrefix: TirRecordCodec<TypedPrefix> = unionRecord<TypedPrefix>("TypedPrefix", (value: TypedPrefix): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedPrefix_value.write(value);
      case "update": return work_TypedPrefix_update.write(value);
      case "type-literal": return work_TypedPrefix_type_literal.write(value);
    }
  }, () => [work_TypedPrefix_value.reader, work_TypedPrefix_update.reader, work_TypedPrefix_type_literal.reader]);
  const work_TypedMember: TirRecordCodec<TypedMember> = unionRecord<TypedMember>("TypedMember", (value: TypedMember): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedMember_value.write(value);
      case "assignment-target": return work_TypedMember_assignment_target.write(value);
    }
  }, () => [work_TypedMember_value.reader, work_TypedMember_assignment_target.reader]);
  const work_TypedConstruction: TirRecordCodec<TypedConstruction> = unionRecord<TypedConstruction>("TypedConstruction", (value: TypedConstruction): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedConstruction_value.write(value);
      case "assignment-pattern": return work_TypedConstruction_assignment_pattern.write(value);
    }
  }, () => [work_TypedConstruction_value.reader, work_TypedConstruction_assignment_pattern.reader]);
  const work_TypedInstantiation: TirRecordCodec<TypedInstantiation> = unionRecord<TypedInstantiation>("TypedInstantiation", (value: TypedInstantiation): TirTypedRecordWork => {
    switch (value.role) {
      case "value": return work_TypedInstantiation_value.write(value);
      case "heritage": return work_TypedInstantiation_heritage.write(value);
    }
  }, () => [work_TypedInstantiation_value.reader, work_TypedInstantiation_heritage.reader]);
  return { work_TypedOperation_conversion, work_TypedOperation_backed, work_TypedOperation, work_TypedValue, work_TypedName_value, work_TypedName_shorthand_value, work_TypedName_assignment_target, work_TypedName_declaration_name, work_TypedName_property_name, work_TypedName_type_name, work_TypedName_label, work_TypedName_private_name, work_TypedPropertyKey_constant, work_TypedPropertyKey_computed, work_TypedString_value, work_TypedString_property_name, work_TypedString_declaration_name, work_TypedString_type_literal, work_TypedString_module_specifier, work_TypedString_export_name, work_TypedString_attribute_value, work_TypedNumber_value, work_TypedNumber_property_name, work_TypedNumber_declaration_name, work_TypedNumber_type_literal, work_TypedBigInt_value, work_TypedBigInt_property_name, work_TypedBigInt_declaration_name, work_TypedBigInt_type_literal, work_TypedKeyword_value, work_TypedKeyword_receiver, work_TypedKeyword_super, work_TypedKeyword_type_literal, work_TypedBinary_arithmetic, work_TypedBinary_comparison, work_TypedBinary_short_circuit, work_TypedBinary_assignment, work_TypedBinary_sequence, work_TypedUnary, work_TypedPrefix_value, work_TypedPrefix_update, work_TypedPrefix_type_literal, work_TypedUpdate, work_TypedConditional, work_TypedMember_value, work_TypedMember_assignment_target, work_TypedApplication, work_TypedProtocolValue, work_TypedSpread, work_TypedObjectSpread, work_TypedConstruction_value, work_TypedConstruction_assignment_pattern, work_TypedTemplate, work_TypedInstantiation_value, work_TypedInstantiation_heritage, work_TypedProperty, work_TypedShorthand, work_TypedOmission, work_TypedIteration, work_TypedControlTransfer, work_TypedDecorator, work_TypedName, work_TypedPropertyKey, work_TypedString, work_TypedNumber, work_TypedBigInt, work_TypedKeyword, work_TypedBinary, work_TypedPrefix, work_TypedMember, work_TypedConstruction, work_TypedInstantiation };
};
