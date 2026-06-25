import { defineExtensionFactKey } from "./host.js";
import type { ExtensionEvidence, ExtensionFactSubject } from "./host.js";

export type ExtensionCanonicalIdentityKind =
  | "module"
  | "package"
  | "export"
  | "local-alias"
  | "symbol"
  | "type"
  | "signature"
  | "instantiated-type";

export type ExtensionImportKind = "type" | "value" | "namespace" | "unknown";

export type SourcePrimitiveKind =
  | "bool"
  | "char"
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "native-int"
  | "native-uint"
  | "float16"
  | "float32"
  | "float64"
  | "decimal"
  | "int128"
  | "uint128";

export interface ExtensionCanonicalIdentity {
  readonly kind: ExtensionCanonicalIdentityKind;
  readonly id: string;
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly subpath?: string;
  readonly exportName?: string;
  readonly importKind?: ExtensionImportKind;
  readonly canonicalSymbolId?: string;
}

export type ArgumentPassingMode =
  | "by-value"
  | "byref-readonly"
  | "byref-readwrite"
  | "byref-writeonly-must-init"
  | "borrow-shared"
  | "borrow-mut"
  | "move";

export type SourcePointerMutability = "readonly" | "readwrite" | "target-defined";

export interface SourcePrimitiveFact {
  readonly kind: SourcePrimitiveKind;
  readonly signed?: boolean;
  readonly width?: number;
  readonly runtimeBase: "boolean" | "number" | "bigint" | "string" | "object";
}

export interface ArgumentPassingFact {
  readonly mode: ArgumentPassingMode;
  readonly targetExpression?: ExtensionFactSubject;
}

export interface FunctionPointerFact {
  readonly parameters: readonly ExtensionFactSubject[];
  readonly result: ExtensionFactSubject;
  readonly abi: readonly string[];
}

export interface PointerFact {
  readonly pointee: ExtensionFactSubject;
  readonly mutability: SourcePointerMutability;
  readonly unsafeRequired: boolean;
}

export interface StructFact {
  readonly valueType: boolean;
  readonly fields?: readonly FieldFact[];
}

export interface FieldFact {
  readonly name: string;
  readonly type: ExtensionFactSubject;
  readonly readonly?: boolean;
}

export interface AttributeFact {
  readonly target: ExtensionFactSubject;
  readonly applicationTarget?: ExtensionFactSubject;
  readonly applicationTargetSpecifier?: string;
  readonly applicationParameterName?: string;
  readonly applicationPlacement?: "constructor";
  readonly attributeName: string;
  readonly arguments?: readonly ExtensionFactSubject[];
}

export interface DefaultValueFact {
  readonly type: ExtensionFactSubject;
}

export type TargetTypeRef =
  | { readonly kind: "source-primitive"; readonly name: SourcePrimitiveKind }
  | { readonly kind: "target-named"; readonly id: string; readonly typeArguments?: readonly TargetTypeRef[] }
  | { readonly kind: "type-parameter"; readonly name: string }
  | { readonly kind: "array"; readonly element: TargetTypeRef; readonly rank?: number }
  | { readonly kind: "tuple"; readonly elements: readonly TargetTypeRef[] }
  | { readonly kind: "pointer"; readonly pointee: TargetTypeRef; readonly mutability?: "const" | "mut" | "target-defined" }
  | { readonly kind: "function-pointer"; readonly args: readonly TargetTypeRef[]; readonly result: TargetTypeRef; readonly abi?: readonly string[] }
  | { readonly kind: "opaque"; readonly id: string }
  | { readonly kind: "associated-type"; readonly owner: TargetTypeRef; readonly name: string }
  | { readonly kind: "lifetime"; readonly name: string }
  | { readonly kind: "target-specific"; readonly target: string; readonly name: string; readonly value?: unknown };

export type TargetConstraint =
  | { readonly kind: "implements"; readonly contract: string; readonly typeArguments?: readonly TargetTypeRef[] }
  | { readonly kind: "value-type" }
  | { readonly kind: "reference-type" }
  | { readonly kind: "constructible" }
  | { readonly kind: "unmanaged" }
  | { readonly kind: "unsupported"; readonly target: string; readonly id: string; readonly reason: string; readonly value?: unknown }
  | { readonly kind: "copy" }
  | { readonly kind: "clone" }
  | { readonly kind: "default" }
  | { readonly kind: "sized" }
  | { readonly kind: "lifetime"; readonly name: string }
  | { readonly kind: "target-specific"; readonly target: string; readonly name: string; readonly value?: unknown };

export interface TargetTypeParameter {
  readonly name: string;
  readonly constraints?: readonly TargetConstraint[];
  readonly variance?: "in" | "out" | "invariant" | "target-defined";
}

export type TargetParameterDefaultValue =
  | { readonly kind: "null" }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "source-primitive"; readonly name: SourcePrimitiveKind; readonly value: string | boolean }
  | { readonly kind: "enum"; readonly value: string; readonly fieldName?: string }
  | { readonly kind: "target-specific"; readonly target: string; readonly value?: unknown; readonly evidence?: readonly ExtensionEvidence[] };

export interface TargetUnsupportedParameterDefaultValue {
  readonly kind: "unsupported-default-value";
  readonly id: string;
  readonly parameterName: string;
  readonly reason: string;
  readonly evidence?: readonly ExtensionEvidence[];
}

export interface TargetParameter {
  readonly name: string;
  readonly type: TargetTypeRef;
  readonly passingMode: ArgumentPassingMode;
  readonly optional?: boolean;
  readonly paramsArray?: boolean;
  readonly defaultValue?: TargetParameterDefaultValue;
  readonly unsupportedDefaultValue?: TargetUnsupportedParameterDefaultValue;
  readonly attributes?: readonly TargetAttributeFact[];
  readonly unsupportedAttributes?: readonly TargetUnsupportedAttributeFact[];
}

export interface TargetMember {
  readonly id: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly kind: "method" | "constructor" | "property" | "field" | "indexer" | "event" | "operator";
  readonly declaringType?: TargetTypeRef;
  readonly static?: boolean;
  readonly readonly?: boolean;
  readonly receiverPassing?: "instance" | "first-argument";
  readonly parameters: readonly TargetParameter[];
  readonly returnType?: TargetTypeRef;
  readonly attributes?: readonly TargetAttributeFact[];
  readonly unsupportedAttributes?: readonly TargetUnsupportedAttributeFact[];
  readonly returnAttributes?: readonly TargetAttributeFact[];
  readonly unsupportedReturnAttributes?: readonly TargetUnsupportedAttributeFact[];
  readonly typeParameters?: readonly TargetTypeParameter[];
  readonly overloadGroup?: string;
}

export interface TargetConversionOperatorFact {
  readonly id: string;
  readonly conversionKind: "implicit" | "explicit";
  readonly declaringType: TargetTypeRef;
  readonly sourceType: TargetTypeRef;
  readonly targetType: TargetTypeRef;
}

export type TargetAttributePlacement =
  | "type"
  | "constructor"
  | "method"
  | "property"
  | "field"
  | "event"
  | "parameter"
  | "return";

export type TargetAttributeValue =
  | { readonly kind: "null" }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "source-primitive"; readonly name: SourcePrimitiveKind; readonly value: string | boolean }
  | { readonly kind: "type"; readonly type: TargetTypeRef }
  | { readonly kind: "enum"; readonly type: TargetTypeRef; readonly value: string; readonly fieldName?: string }
  | { readonly kind: "array"; readonly elements: readonly TargetAttributeValue[] };

export type TargetAttributeArgument =
  | { readonly kind: "constructor"; readonly value: TargetAttributeValue }
  | { readonly kind: "named"; readonly name: string; readonly memberKind: "field" | "property"; readonly value: TargetAttributeValue };

export interface TargetAttributeFact {
  readonly id: string;
  readonly target: TargetAttributePlacement;
  readonly attributeType: TargetTypeRef;
  readonly constructorId: string;
  readonly arguments?: readonly TargetAttributeArgument[];
  readonly evidence?: readonly ExtensionEvidence[];
}

export interface TargetUnsupportedAttributeFact {
  readonly id: string;
  readonly target: TargetAttributePlacement;
  readonly attributeType?: TargetTypeRef;
  readonly constructorId?: string;
  readonly reason: string;
  readonly evidence?: readonly ExtensionEvidence[];
}

export interface TargetBindingFact {
  readonly id: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly target: string;
  readonly kind: "class" | "struct" | "interface" | "trait" | "enum" | "delegate" | "function" | "opaque";
  readonly attributes?: readonly TargetAttributeFact[];
  readonly unsupportedAttributes?: readonly TargetUnsupportedAttributeFact[];
  readonly typeParameters?: readonly TargetTypeParameter[];
  readonly members?: readonly TargetMember[];
  readonly conversionOperators?: readonly TargetConversionOperatorFact[];
  readonly implementedContracts?: readonly TargetConstraint[];
}

export interface InstantiatedTargetTypeFact {
  readonly targetType: TargetBindingFact;
  readonly typeArguments: readonly ExtensionFactSubject[];
  readonly resolvedTypeArguments?: readonly TargetTypeRef[];
}

export interface SelectedTargetSignatureFact {
  readonly member: TargetMember;
  readonly typeArguments?: readonly ExtensionFactSubject[];
  readonly targetTypeArguments?: readonly TargetTypeRef[];
  readonly argumentConversions?: readonly TargetTypeRef[];
}

export interface ContextualTargetTypeFact {
  readonly type: ExtensionFactSubject;
  readonly targetType?: TargetTypeRef;
}

export interface TargetOperationFact {
  readonly operationId: string;
  readonly operationKind: "property" | "method" | "indexer" | "operator" | "constructor" | "iteration";
  readonly targetOperation: string;
  readonly resultType?: ExtensionFactSubject;
  readonly evidence?: readonly ExtensionEvidence[];
}

export interface FlowStateFact {
  readonly state: "moved" | "borrowed-shared" | "borrowed-mut" | "initialized" | "uninitialized" | "target-validation-required";
  readonly targetCompiler?: string;
  readonly evidence?: readonly ExtensionEvidence[];
}

export interface RuntimeCarrierFact {
  readonly carrier: TargetTypeRef;
  readonly requiresAllocation?: boolean;
}

export interface TargetConversionFact {
  readonly sourceType?: TargetTypeRef;
  readonly convertedType?: TargetTypeRef;
  readonly operation?: TargetOperationFact;
}

export interface ProviderVirtualDeclarationFact {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly moduleSpecifier: string;
  readonly virtualFileName: string;
  readonly exportName?: string;
  readonly memberName?: string;
  readonly memberId?: string;
  readonly signatureId?: string;
  readonly targetIdentity?: TargetTypeRef;
}

export interface AssociatedTypeFact {
  readonly owner: ExtensionFactSubject;
  readonly name: string;
  readonly value: ExtensionFactSubject;
}

export interface ConstGenericFact {
  readonly name: string;
  readonly value: string | number | bigint | boolean;
}

export const canonicalIdentityFactKey = defineExtensionFactKey<ExtensionCanonicalIdentity>({
  extensionId: "tsts.identity",
  name: "canonicalIdentity",
  equals: (left, right) =>
    left.kind === right.kind
    && left.id === right.id
    && left.packageName === right.packageName
    && left.packageVersion === right.packageVersion
    && left.subpath === right.subpath
    && left.exportName === right.exportName
    && left.importKind === right.importKind
    && left.canonicalSymbolId === right.canonicalSymbolId,
});

export const sourcePrimitiveFactKey = defineExtensionFactKey<SourcePrimitiveFact>({
  extensionId: "tsts.source-semantics",
  name: "sourcePrimitive",
  equals: (left, right) => left.kind === right.kind && left.width === right.width && left.signed === right.signed && left.runtimeBase === right.runtimeBase,
});

export const argumentPassingFactKey = defineExtensionFactKey<ArgumentPassingFact>({
  extensionId: "tsts.source-semantics",
  name: "argumentPassing",
  equals: (left, right) => left.mode === right.mode && left.targetExpression === right.targetExpression,
});

export const functionPointerFactKey = defineExtensionFactKey<FunctionPointerFact>({
  extensionId: "tsts.source-semantics",
  name: "functionPointer",
  equals: (left, right) =>
    left.result === right.result
    && left.parameters.length === right.parameters.length
    && left.parameters.every((parameter, index) => parameter === right.parameters[index])
    && left.abi.length === right.abi.length
    && left.abi.every((abi, index) => abi === right.abi[index]),
});

export const pointerFactKey = defineExtensionFactKey<PointerFact>({
  extensionId: "tsts.source-semantics",
  name: "pointer",
  equals: (left, right) => left.pointee === right.pointee && left.mutability === right.mutability && left.unsafeRequired === right.unsafeRequired,
});

export const structFactKey = defineExtensionFactKey<StructFact>({
  extensionId: "tsts.source-semantics",
  name: "struct",
  equals: (left, right) =>
    left.valueType === right.valueType
    && fieldFactArrayEquals(left.fields, right.fields),
});

export const fieldFactKey = defineExtensionFactKey<FieldFact>({
  extensionId: "tsts.source-semantics",
  name: "field",
  equals: (left, right) => left.name === right.name && left.type === right.type && left.readonly === right.readonly,
});

export const attributeFactKey = defineExtensionFactKey<AttributeFact>({
  extensionId: "tsts.source-semantics",
  name: "attribute",
  equals: (left, right) =>
    left.target === right.target
    && left.applicationTarget === right.applicationTarget
    && left.applicationTargetSpecifier === right.applicationTargetSpecifier
    && left.applicationParameterName === right.applicationParameterName
    && left.applicationPlacement === right.applicationPlacement
    && left.attributeName === right.attributeName
    && factSubjectArrayEquals(left.arguments, right.arguments),
});

export const defaultValueFactKey = defineExtensionFactKey<DefaultValueFact>({
  extensionId: "tsts.source-semantics",
  name: "defaultValue",
  equals: (left, right) => left.type === right.type,
});

export const targetBindingFactKey = defineExtensionFactKey<TargetBindingFact>({
  extensionId: "tsts.target-bindings",
  name: "targetBinding",
  equals: targetBindingFactEquals,
});

export const instantiatedTargetTypeFactKey = defineExtensionFactKey<InstantiatedTargetTypeFact>({
  extensionId: "tsts.target-bindings",
  name: "instantiatedTargetType",
  equals: (left, right) =>
    targetBindingFactEquals(left.targetType, right.targetType)
    && factSubjectArrayEquals(left.typeArguments, right.typeArguments)
    && targetTypeRefArrayEquals(left.resolvedTypeArguments, right.resolvedTypeArguments),
});

export const selectedTargetSignatureFactKey = defineExtensionFactKey<SelectedTargetSignatureFact>({
  extensionId: "tsts.target-bindings",
  name: "selectedTargetSignature",
  equals: (left, right) =>
    targetMemberEquals(left.member, right.member)
    && factSubjectArrayEquals(left.typeArguments, right.typeArguments)
    && targetTypeRefArrayEquals(left.targetTypeArguments, right.targetTypeArguments)
    && targetTypeRefArrayEquals(left.argumentConversions, right.argumentConversions),
});

export const contextualTargetTypeFactKey = defineExtensionFactKey<ContextualTargetTypeFact>({
  extensionId: "tsts.target-bindings",
  name: "contextualTargetType",
  equals: (left, right) => left.type === right.type && optionalTargetTypeRefEquals(left.targetType, right.targetType),
});

export const targetOperationFactKey = defineExtensionFactKey<TargetOperationFact>({
  extensionId: "tsts.target-bindings",
  name: "targetOperation",
  equals: targetOperationFactEquals,
});

export const flowStateFactKey = defineExtensionFactKey<FlowStateFact>({
  extensionId: "tsts.flow",
  name: "flowState",
  equals: (left, right) => left.state === right.state && left.targetCompiler === right.targetCompiler,
});

export const runtimeCarrierFactKey = defineExtensionFactKey<RuntimeCarrierFact>({
  extensionId: "tsts.target-bindings",
  name: "runtimeCarrier",
  equals: (left, right) => targetTypeRefEquals(left.carrier, right.carrier) && left.requiresAllocation === right.requiresAllocation,
});

export const targetConversionFactKey = defineExtensionFactKey<TargetConversionFact>({
  extensionId: "tsts.target-bindings",
  name: "targetConversion",
  equals: targetConversionFactEquals,
});

export const providerVirtualDeclarationFactKey = defineExtensionFactKey<ProviderVirtualDeclarationFact>({
  extensionId: "tsts.provider",
  name: "virtualDeclaration",
  equals: (left, right) =>
    left.providerId === right.providerId
    && left.providerVersion === right.providerVersion
    && left.providerModuleId === right.providerModuleId
    && left.moduleSpecifier === right.moduleSpecifier
    && left.virtualFileName === right.virtualFileName
    && left.exportName === right.exportName
    && left.memberName === right.memberName
    && left.memberId === right.memberId
    && left.signatureId === right.signatureId
    && optionalTargetTypeRefEquals(left.targetIdentity, right.targetIdentity),
});

export const associatedTypeFactKey = defineExtensionFactKey<AssociatedTypeFact>({
  extensionId: "tsts.target-bindings",
  name: "associatedType",
  equals: (left, right) => left.owner === right.owner && left.name === right.name && left.value === right.value,
});

export const constGenericFactKey = defineExtensionFactKey<ConstGenericFact>({
  extensionId: "tsts.target-bindings",
  name: "constGeneric",
  equals: (left, right) => left.name === right.name && left.value === right.value,
});

function optionalTargetTypeRefEquals(left: TargetTypeRef | undefined, right: TargetTypeRef | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return targetTypeRefEquals(left, right);
}

function factSubjectArrayEquals(left: readonly ExtensionFactSubject[] | undefined, right: readonly ExtensionFactSubject[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fieldFactArrayEquals(left: readonly FieldFact[] | undefined, right: readonly FieldFact[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => fieldFactEquals(value, right[index]!));
}

function fieldFactEquals(left: FieldFact, right: FieldFact): boolean {
  return left.name === right.name && left.type === right.type && left.readonly === right.readonly;
}

function targetTypeRefArrayEquals(left: readonly TargetTypeRef[] | undefined, right: readonly TargetTypeRef[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetTypeRefEquals(value, right[index]!));
}

function targetBindingFactEquals(left: TargetBindingFact, right: TargetBindingFact): boolean {
  return left.id === right.id
    && left.sourceName === right.sourceName
    && left.targetName === right.targetName
    && left.target === right.target
    && left.kind === right.kind
    && targetAttributeArrayEquals(left.attributes, right.attributes)
    && targetUnsupportedAttributeArrayEquals(left.unsupportedAttributes, right.unsupportedAttributes)
    && targetTypeParameterArrayEquals(left.typeParameters, right.typeParameters)
    && targetMemberArrayEquals(left.members, right.members)
    && targetConversionOperatorArrayEquals(left.conversionOperators, right.conversionOperators)
    && targetConstraintArrayEquals(left.implementedContracts, right.implementedContracts);
}

function targetMemberArrayEquals(left: readonly TargetMember[] | undefined, right: readonly TargetMember[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetMemberEquals(value, right[index]!));
}

function targetMemberEquals(left: TargetMember, right: TargetMember): boolean {
  return left.id === right.id
    && left.sourceName === right.sourceName
    && left.targetName === right.targetName
    && left.kind === right.kind
    && optionalTargetTypeRefEquals(left.declaringType, right.declaringType)
    && left.static === right.static
    && left.readonly === right.readonly
    && targetParameterArrayEquals(left.parameters, right.parameters)
    && optionalTargetTypeRefEquals(left.returnType, right.returnType)
    && targetAttributeArrayEquals(left.attributes, right.attributes)
    && targetUnsupportedAttributeArrayEquals(left.unsupportedAttributes, right.unsupportedAttributes)
    && targetAttributeArrayEquals(left.returnAttributes, right.returnAttributes)
    && targetUnsupportedAttributeArrayEquals(left.unsupportedReturnAttributes, right.unsupportedReturnAttributes)
    && targetTypeParameterArrayEquals(left.typeParameters, right.typeParameters)
    && left.overloadGroup === right.overloadGroup;
}

function targetParameterArrayEquals(left: readonly TargetParameter[], right: readonly TargetParameter[]): boolean {
  return left.length === right.length && left.every((value, index) => targetParameterEquals(value, right[index]!));
}

function targetParameterEquals(left: TargetParameter, right: TargetParameter): boolean {
  return left.name === right.name
    && targetTypeRefEquals(left.type, right.type)
    && left.passingMode === right.passingMode
    && left.optional === right.optional
    && left.paramsArray === right.paramsArray
    && targetAttributeArrayEquals(left.attributes, right.attributes)
    && targetUnsupportedAttributeArrayEquals(left.unsupportedAttributes, right.unsupportedAttributes);
}

function targetConversionOperatorArrayEquals(left: readonly TargetConversionOperatorFact[] | undefined, right: readonly TargetConversionOperatorFact[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetConversionOperatorEquals(value, right[index]!));
}

function targetConversionFactEquals(left: TargetConversionFact, right: TargetConversionFact): boolean {
  return optionalTargetTypeRefMatchesWhenPresent(left.sourceType, right.sourceType) &&
    optionalTargetTypeRefEquals(left.convertedType, right.convertedType) &&
    optionalTargetOperationFactEquals(left.operation, right.operation);
}

function optionalTargetTypeRefMatchesWhenPresent(left: TargetTypeRef | undefined, right: TargetTypeRef | undefined): boolean {
  return left === undefined || right === undefined || targetTypeRefEquals(left, right);
}

function targetConversionOperatorEquals(left: TargetConversionOperatorFact, right: TargetConversionOperatorFact): boolean {
  return left.id === right.id
    && left.conversionKind === right.conversionKind
    && targetTypeRefEquals(left.declaringType, right.declaringType)
    && targetTypeRefEquals(left.sourceType, right.sourceType)
    && targetTypeRefEquals(left.targetType, right.targetType);
}

function targetAttributeArrayEquals(left: readonly TargetAttributeFact[] | undefined, right: readonly TargetAttributeFact[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetAttributeEquals(value, right[index]!));
}

function targetAttributeEquals(left: TargetAttributeFact, right: TargetAttributeFact): boolean {
  return left.id === right.id
    && left.target === right.target
    && targetTypeRefEquals(left.attributeType, right.attributeType)
    && left.constructorId === right.constructorId
    && targetAttributeArgumentArrayEquals(left.arguments, right.arguments);
}

function targetUnsupportedAttributeArrayEquals(left: readonly TargetUnsupportedAttributeFact[] | undefined, right: readonly TargetUnsupportedAttributeFact[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetUnsupportedAttributeEquals(value, right[index]!));
}

function targetUnsupportedAttributeEquals(left: TargetUnsupportedAttributeFact, right: TargetUnsupportedAttributeFact): boolean {
  return left.id === right.id
    && left.target === right.target
    && optionalTargetTypeRefEquals(left.attributeType, right.attributeType)
    && left.constructorId === right.constructorId
    && left.reason === right.reason;
}

function targetAttributeArgumentArrayEquals(left: readonly TargetAttributeArgument[] | undefined, right: readonly TargetAttributeArgument[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetAttributeArgumentEquals(value, right[index]!));
}

function targetAttributeArgumentEquals(left: TargetAttributeArgument, right: TargetAttributeArgument): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "constructor":
      return right.kind === "constructor" && targetAttributeValueEquals(left.value, right.value);
    case "named":
      return right.kind === "named"
        && left.name === right.name
        && left.memberKind === right.memberKind
        && targetAttributeValueEquals(left.value, right.value);
  }
}

function targetAttributeValueEquals(left: TargetAttributeValue, right: TargetAttributeValue): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "null":
      return true;
    case "string":
      return right.kind === "string" && left.value === right.value;
    case "source-primitive":
      return right.kind === "source-primitive" && left.name === right.name && Object.is(left.value, right.value);
    case "type":
      return right.kind === "type" && targetTypeRefEquals(left.type, right.type);
    case "enum":
      return right.kind === "enum"
        && targetTypeRefEquals(left.type, right.type)
        && left.value === right.value
        && left.fieldName === right.fieldName;
    case "array":
      return right.kind === "array"
        && left.elements.length === right.elements.length
        && left.elements.every((value, index) => targetAttributeValueEquals(value, right.elements[index]!));
  }
}

function targetTypeParameterArrayEquals(left: readonly TargetTypeParameter[] | undefined, right: readonly TargetTypeParameter[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetTypeParameterEquals(value, right[index]!));
}

function targetTypeParameterEquals(left: TargetTypeParameter, right: TargetTypeParameter): boolean {
  return left.name === right.name
    && left.variance === right.variance
    && targetConstraintArrayEquals(left.constraints, right.constraints);
}

function targetConstraintArrayEquals(left: readonly TargetConstraint[] | undefined, right: readonly TargetConstraint[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((value, index) => targetConstraintEquals(value, right[index]!));
}

function targetConstraintEquals(left: TargetConstraint, right: TargetConstraint): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "implements":
      return right.kind === "implements"
        && left.contract === right.contract
        && targetTypeRefArrayEquals(left.typeArguments, right.typeArguments);
    case "lifetime":
      return right.kind === "lifetime" && left.name === right.name;
    case "target-specific":
      return right.kind === "target-specific" && left.target === right.target && left.name === right.name && Object.is(left.value, right.value);
    case "unsupported":
      return right.kind === "unsupported" && left.target === right.target && left.id === right.id && left.reason === right.reason && Object.is(left.value, right.value);
    case "value-type":
    case "reference-type":
    case "constructible":
    case "unmanaged":
    case "copy":
    case "clone":
    case "default":
    case "sized":
      return true;
  }
}

function optionalTargetOperationFactEquals(left: TargetOperationFact | undefined, right: TargetOperationFact | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return targetOperationFactEquals(left, right);
}

function targetOperationFactEquals(left: TargetOperationFact, right: TargetOperationFact): boolean {
  return left.operationId === right.operationId
    && left.operationKind === right.operationKind
    && left.targetOperation === right.targetOperation
    && optionalFactSubjectEquals(left.resultType, right.resultType);
}

function optionalFactSubjectEquals(left: ExtensionFactSubject | undefined, right: ExtensionFactSubject | undefined): boolean {
  if (left === undefined || right === undefined || left === right) {
    return left === right;
  }
  return isTargetTypeRef(left) && isTargetTypeRef(right) && targetTypeRefEquals(left, right);
}

function isTargetTypeRef(value: ExtensionFactSubject): value is TargetTypeRef {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }
  switch ((value as { readonly kind?: string }).kind) {
    case "source-primitive":
    case "target-named":
    case "type-parameter":
    case "array":
    case "tuple":
    case "pointer":
    case "function-pointer":
    case "opaque":
    case "associated-type":
    case "lifetime":
    case "target-specific":
      return true;
    default:
      return false;
  }
}

function targetTypeRefEquals(left: TargetTypeRef, right: TargetTypeRef): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "source-primitive":
      return right.kind === "source-primitive" && left.name === right.name;
    case "target-named":
      return right.kind === "target-named"
        && left.id === right.id
        && targetTypeRefListEquals(left.typeArguments ?? [], right.typeArguments ?? []);
    case "type-parameter":
      return right.kind === "type-parameter" && left.name === right.name;
    case "array":
      return right.kind === "array" && left.rank === right.rank && targetTypeRefEquals(left.element, right.element);
    case "tuple":
      return right.kind === "tuple" && targetTypeRefListEquals(left.elements, right.elements);
    case "pointer":
      return right.kind === "pointer" && left.mutability === right.mutability && targetTypeRefEquals(left.pointee, right.pointee);
    case "function-pointer":
      return right.kind === "function-pointer"
        && targetTypeRefListEquals(left.args, right.args)
        && targetTypeRefEquals(left.result, right.result)
        && stringListEquals(left.abi ?? [], right.abi ?? []);
    case "opaque":
      return right.kind === "opaque" && left.id === right.id;
    case "associated-type":
      return right.kind === "associated-type" && left.name === right.name && targetTypeRefEquals(left.owner, right.owner);
    case "lifetime":
      return right.kind === "lifetime" && left.name === right.name;
    case "target-specific":
      return right.kind === "target-specific" && left.target === right.target && left.name === right.name && Object.is(left.value, right.value);
  }
}

function targetTypeRefListEquals(left: readonly TargetTypeRef[], right: readonly TargetTypeRef[]): boolean {
  return left.length === right.length && left.every((item, index) => targetTypeRefEquals(item, right[index]!));
}

function stringListEquals(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
