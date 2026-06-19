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

export interface TargetParameter {
  readonly name: string;
  readonly type: TargetTypeRef;
  readonly passingMode: ArgumentPassingMode;
  readonly optional?: boolean;
  readonly paramsArray?: boolean;
}

export interface TargetMember {
  readonly id: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly kind: "method" | "constructor" | "property" | "field" | "indexer" | "event" | "operator";
  readonly static?: boolean;
  readonly parameters: readonly TargetParameter[];
  readonly returnType?: TargetTypeRef;
  readonly typeParameters?: readonly TargetTypeParameter[];
  readonly overloadGroup?: string;
}

export interface TargetBindingFact {
  readonly id: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly target: string;
  readonly kind: "class" | "struct" | "interface" | "trait" | "enum" | "delegate" | "function" | "opaque";
  readonly typeParameters?: readonly TargetTypeParameter[];
  readonly members?: readonly TargetMember[];
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
  readonly operationKind: "property" | "method" | "indexer" | "operator" | "constructor";
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
  equals: (left, right) => optionalTargetTypeRefEquals(left.convertedType, right.convertedType) && optionalTargetOperationFactEquals(left.operation, right.operation),
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
    && targetTypeParameterArrayEquals(left.typeParameters, right.typeParameters)
    && targetMemberArrayEquals(left.members, right.members)
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
    && left.static === right.static
    && targetParameterArrayEquals(left.parameters, right.parameters)
    && optionalTargetTypeRefEquals(left.returnType, right.returnType)
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
    && left.paramsArray === right.paramsArray;
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
    && left.resultType === right.resultType;
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
