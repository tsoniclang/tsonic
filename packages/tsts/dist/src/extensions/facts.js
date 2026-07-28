import { defineExtensionFactKey, markHostSourceReadableFactKey, } from "./fact-key.js";
import { isArgumentPassingMode, } from "./argument-passing.js";
export const canonicalIdentityFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "canonicalIdentity",
    snapshot: snapshotCanonicalIdentityFact,
    equals: canonicalIdentityEquals,
}));
export const sourcePrimitiveFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "sourcePrimitive",
    snapshot: snapshotSourcePrimitiveFact,
    equals: (left, right) => left.kind === right.kind
        && left.width === right.width
        && left.signed === right.signed
        && left.runtimeBase === right.runtimeBase,
}));
export const argumentPassingFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "argumentPassing",
    snapshot: snapshotArgumentPassingFact,
    equals: (left, right) => left.mode === right.mode
        && left.targetExpression === right.targetExpression,
}));
export const functionPointerFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "functionPointer",
    snapshot: snapshotFunctionPointerFact,
    equals: (left, right) => left.result === right.result
        && identityArrayEquals(left.parameters, right.parameters)
        && stringArrayEquals(left.abi, right.abi),
}));
export const pointerFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "pointer",
    snapshot: snapshotPointerFact,
    equals: (left, right) => left.pointee === right.pointee
        && left.mutability === right.mutability
        && left.unsafeRequired === right.unsafeRequired,
}));
export const structFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "struct",
    snapshot: snapshotStructFact,
    equals: (left, right) => left.valueType === right.valueType
        && optionalFieldArrayEquals(left.fields, right.fields),
}));
export const fieldFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "field",
    snapshot: snapshotFieldFact,
    equals: fieldFactEquals,
}));
export const attributeFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "attribute",
    snapshot: snapshotAttributeFact,
    equals: (left, right) => left.target === right.target
        && left.attributeName === right.attributeName
        && optionalIdentityArrayEquals(left.arguments, right.arguments),
}));
export const defaultValueFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "defaultValue",
    snapshot: snapshotDefaultValueFact,
    equals: (left, right) => left.type === right.type,
}));
export const flowStateFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "flowState",
    snapshot: snapshotFlowStateFact,
    equals: (left, right) => left.state === right.state,
}));
export const providerVirtualDeclarationFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "virtualDeclaration",
    snapshot: snapshotProviderVirtualDeclarationFact,
    equals: providerDeclarationIdentityEquals,
}));
export const providerTypeFamilyFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.provider",
    name: "typeFamily",
    snapshot: snapshotProviderTypeFamilyFact,
    equals: (left, right) => left.exportName === right.exportName
        && providerTypeFamilyVariantArrayEquals(left.variants, right.variants),
}));
export const associatedTypeFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "associatedType",
    snapshot: snapshotAssociatedTypeFact,
    equals: (left, right) => left.owner === right.owner
        && left.name === right.name
        && left.value === right.value,
}));
export const constGenericFactKey = markHostSourceReadableFactKey(defineExtensionFactKey({
    extensionId: "tsts.source-semantics",
    name: "constGeneric",
    snapshot: snapshotConstGenericFact,
    equals: (left, right) => left.name === right.name
        && left.value === right.value,
}));
function snapshotCanonicalIdentityFact(value) {
    const record = exactRecord(value, "ExtensionCanonicalIdentity", [
        "kind",
        "id",
        "packageName",
        "packageVersion",
        "subpath",
        "exportName",
        "importKind",
        "canonicalSymbolId",
    ]);
    const kind = requiredString(record, "kind", "ExtensionCanonicalIdentity");
    if (!canonicalIdentityKinds.has(kind)) {
        throw new Error(`ExtensionCanonicalIdentity.kind '${kind}' is invalid.`);
    }
    const importKind = optionalString(record, "importKind", "ExtensionCanonicalIdentity");
    if (importKind !== undefined && !importKinds.has(importKind)) {
        throw new Error(`ExtensionCanonicalIdentity.importKind '${importKind}' is invalid.`);
    }
    return Object.freeze({
        kind,
        id: requiredString(record, "id", "ExtensionCanonicalIdentity"),
        ...optionalStringFields(record, "ExtensionCanonicalIdentity", [
            "packageName",
            "packageVersion",
            "subpath",
            "exportName",
            "canonicalSymbolId",
        ]),
        ...(importKind === undefined ? {} : { importKind }),
    });
}
function snapshotSourcePrimitiveFact(value) {
    const record = exactRecord(value, "SourcePrimitiveFact", ["kind", "signed", "width", "runtimeBase"]);
    const kind = requiredString(record, "kind", "SourcePrimitiveFact");
    if (!sourcePrimitiveKinds.has(kind)) {
        throw new Error(`SourcePrimitiveFact.kind '${kind}' is invalid.`);
    }
    const runtimeBase = requiredString(record, "runtimeBase", "SourcePrimitiveFact");
    if (!sourceRuntimeBases.has(runtimeBase)) {
        throw new Error(`SourcePrimitiveFact.runtimeBase '${runtimeBase}' is invalid.`);
    }
    const signed = optionalBoolean(record, "signed", "SourcePrimitiveFact");
    const width = optionalSafeInteger(record, "width", "SourcePrimitiveFact");
    if (width !== undefined && width <= 0) {
        throw new Error("SourcePrimitiveFact.width must be positive.");
    }
    return Object.freeze({
        kind,
        runtimeBase,
        ...(signed === undefined ? {} : { signed }),
        ...(width === undefined ? {} : { width }),
    });
}
function snapshotArgumentPassingFact(value) {
    const record = exactRecord(value, "ArgumentPassingFact", ["mode", "targetExpression"]);
    const mode = requiredString(record, "mode", "ArgumentPassingFact");
    if (!isArgumentPassingMode(mode)) {
        throw new Error(`ArgumentPassingFact.mode '${mode}' is invalid.`);
    }
    const targetExpression = optionalSubject(record, "targetExpression", "ArgumentPassingFact");
    return Object.freeze({
        mode,
        ...(targetExpression === undefined ? {} : { targetExpression }),
    });
}
function snapshotFunctionPointerFact(value) {
    const record = exactRecord(value, "FunctionPointerFact", ["parameters", "result", "abi"]);
    return Object.freeze({
        parameters: subjectArray(record.parameters, "FunctionPointerFact.parameters"),
        result: requiredSubject(record, "result", "FunctionPointerFact"),
        abi: stringArray(record.abi, "FunctionPointerFact.abi"),
    });
}
function snapshotPointerFact(value) {
    const record = exactRecord(value, "PointerFact", ["pointee", "mutability", "unsafeRequired"]);
    const mutability = requiredString(record, "mutability", "PointerFact");
    if (!pointerMutabilities.has(mutability)) {
        throw new Error(`PointerFact.mutability '${mutability}' is invalid.`);
    }
    return Object.freeze({
        pointee: requiredSubject(record, "pointee", "PointerFact"),
        mutability,
        unsafeRequired: requiredBoolean(record, "unsafeRequired", "PointerFact"),
    });
}
function snapshotStructFact(value) {
    const record = exactRecord(value, "StructFact", ["valueType", "fields"]);
    const fields = optionalArray(record.fields, "StructFact.fields", snapshotFieldFact);
    return Object.freeze({
        valueType: requiredBoolean(record, "valueType", "StructFact"),
        ...(fields === undefined ? {} : { fields }),
    });
}
function snapshotFieldFact(value) {
    const record = exactRecord(value, "FieldFact", ["name", "type", "readonly"]);
    const readonly = optionalBoolean(record, "readonly", "FieldFact");
    return Object.freeze({
        name: requiredString(record, "name", "FieldFact"),
        type: requiredSubject(record, "type", "FieldFact"),
        ...(readonly === undefined ? {} : { readonly }),
    });
}
function snapshotAttributeFact(value) {
    const record = exactRecord(value, "AttributeFact", ["target", "attributeName", "arguments"]);
    const args = optionalSubjectArray(record.arguments, "AttributeFact.arguments");
    return Object.freeze({
        target: requiredSubject(record, "target", "AttributeFact"),
        attributeName: requiredString(record, "attributeName", "AttributeFact"),
        ...(args === undefined ? {} : { arguments: args }),
    });
}
function snapshotDefaultValueFact(value) {
    const record = exactRecord(value, "DefaultValueFact", ["type"]);
    return Object.freeze({
        type: requiredSubject(record, "type", "DefaultValueFact"),
    });
}
function snapshotFlowStateFact(value) {
    const record = exactRecord(value, "FlowStateFact", ["state"]);
    const state = requiredString(record, "state", "FlowStateFact");
    if (!flowStates.has(state)) {
        throw new Error(`FlowStateFact.state '${state}' is invalid.`);
    }
    return Object.freeze({ state });
}
function snapshotProviderVirtualDeclarationFact(value) {
    const record = exactRecord(value, "ProviderVirtualDeclarationFact", [
        "providerId",
        "providerVersion",
        "providerModuleId",
        "moduleSpecifier",
        "artifactFileName",
        "exportName",
        "exportId",
        "memberName",
        "memberKey",
        "memberId",
        "memberStatic",
        "signatureId",
    ]);
    const memberKey = record.memberKey === undefined
        ? undefined
        : snapshotProviderMemberKey(record.memberKey);
    const memberStatic = optionalBoolean(record, "memberStatic", "ProviderVirtualDeclarationFact");
    return Object.freeze({
        providerId: requiredString(record, "providerId", "ProviderVirtualDeclarationFact"),
        providerVersion: requiredString(record, "providerVersion", "ProviderVirtualDeclarationFact"),
        providerModuleId: requiredString(record, "providerModuleId", "ProviderVirtualDeclarationFact"),
        moduleSpecifier: requiredString(record, "moduleSpecifier", "ProviderVirtualDeclarationFact"),
        artifactFileName: requiredString(record, "artifactFileName", "ProviderVirtualDeclarationFact"),
        ...optionalStringFields(record, "ProviderVirtualDeclarationFact", [
            "exportName",
            "exportId",
            "memberName",
            "memberId",
            "signatureId",
        ]),
        ...(memberKey === undefined ? {} : { memberKey }),
        ...(memberStatic === undefined ? {} : { memberStatic }),
    });
}
function snapshotProviderMemberKey(value) {
    const record = exactRecord(value, "ProviderMemberKey", ["kind", "name"]);
    const kind = requiredString(record, "kind", "ProviderMemberKey");
    const name = requiredString(record, "name", "ProviderMemberKey");
    if (kind === "property-key") {
        return Object.freeze({ kind, name });
    }
    if (kind === "well-known-symbol" && providerWellKnownSymbolNames.has(name)) {
        return Object.freeze({ kind, name: name });
    }
    throw new Error(`ProviderMemberKey kind/name '${kind}:${name}' is invalid.`);
}
function snapshotProviderTypeFamilyFact(value) {
    const record = exactRecord(value, "ProviderTypeFamilyFact", ["exportName", "variants"]);
    return Object.freeze({
        exportName: requiredString(record, "exportName", "ProviderTypeFamilyFact"),
        variants: requiredArray(record.variants, "ProviderTypeFamilyFact.variants", snapshotProviderTypeFamilyVariantFact),
    });
}
function snapshotProviderTypeFamilyVariantFact(value) {
    const record = exactRecord(value, "ProviderTypeFamilyVariantFact", ["sourceTypeArgumentCount", "declaration"]);
    const sourceTypeArgumentCount = requiredSafeInteger(record, "sourceTypeArgumentCount", "ProviderTypeFamilyVariantFact");
    if (sourceTypeArgumentCount < 0) {
        throw new Error("ProviderTypeFamilyVariantFact.sourceTypeArgumentCount cannot be negative.");
    }
    return Object.freeze({
        sourceTypeArgumentCount,
        declaration: snapshotProviderVirtualDeclarationFact(record.declaration),
    });
}
function snapshotAssociatedTypeFact(value) {
    const record = exactRecord(value, "AssociatedTypeFact", ["owner", "name", "value"]);
    return Object.freeze({
        owner: requiredSubject(record, "owner", "AssociatedTypeFact"),
        name: requiredString(record, "name", "AssociatedTypeFact"),
        value: requiredSubject(record, "value", "AssociatedTypeFact"),
    });
}
function snapshotConstGenericFact(value) {
    const record = exactRecord(value, "ConstGenericFact", ["name", "value"]);
    const scalar = record.value;
    if (typeof scalar !== "string"
        && typeof scalar !== "number"
        && typeof scalar !== "bigint"
        && typeof scalar !== "boolean") {
        throw new Error("ConstGenericFact.value must be a string, number, bigint, or boolean.");
    }
    if (typeof scalar === "number" && !Number.isFinite(scalar)) {
        throw new Error("ConstGenericFact.value must be finite when numeric.");
    }
    return Object.freeze({
        name: requiredString(record, "name", "ConstGenericFact"),
        value: scalar,
    });
}
function canonicalIdentityEquals(left, right) {
    return left.kind === right.kind
        && left.id === right.id
        && left.packageName === right.packageName
        && left.packageVersion === right.packageVersion
        && left.subpath === right.subpath
        && left.exportName === right.exportName
        && left.importKind === right.importKind
        && left.canonicalSymbolId === right.canonicalSymbolId;
}
function providerDeclarationIdentityEquals(left, right) {
    return left.providerId === right.providerId
        && left.providerVersion === right.providerVersion
        && left.providerModuleId === right.providerModuleId
        && left.moduleSpecifier === right.moduleSpecifier
        && left.artifactFileName === right.artifactFileName
        && left.exportName === right.exportName
        && left.exportId === right.exportId
        && left.memberName === right.memberName
        && providerMemberKeyEquals(left.memberKey, right.memberKey)
        && left.memberId === right.memberId
        && left.memberStatic === right.memberStatic
        && left.signatureId === right.signatureId;
}
function providerMemberKeyEquals(left, right) {
    return left === undefined
        ? right === undefined
        : right !== undefined
            && left.kind === right.kind
            && left.name === right.name;
}
function providerTypeFamilyVariantArrayEquals(left, right) {
    return left.length === right.length
        && left.every((variant, index) => {
            const candidate = right[index];
            return variant.sourceTypeArgumentCount === candidate.sourceTypeArgumentCount
                && providerDeclarationIdentityEquals(variant.declaration, candidate.declaration);
        });
}
function fieldFactEquals(left, right) {
    return left.name === right.name
        && left.type === right.type
        && left.readonly === right.readonly;
}
function optionalFieldArrayEquals(left, right) {
    return left === undefined
        ? right === undefined
        : right !== undefined
            && left.length === right.length
            && left.every((field, index) => fieldFactEquals(field, right[index]));
}
function optionalIdentityArrayEquals(left, right) {
    return left === undefined
        ? right === undefined
        : right !== undefined && identityArrayEquals(left, right);
}
function identityArrayEquals(left, right) {
    return left.length === right.length
        && left.every((subject, index) => subject === right[index]);
}
function stringArrayEquals(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}
function exactRecord(value, name, allowedFields) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${name} must be an object.`);
    }
    const allowed = new Set(allowedFields);
    const captured = {};
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string" || !allowed.has(key)) {
            throw new Error(`${name} contains unsupported field '${String(key)}'.`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor)) {
            throw new Error(`${name}.${key} must be an own data property.`);
        }
        captured[key] = descriptor.value;
    }
    return captured;
}
function requiredString(record, field, name) {
    const value = record[field];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${name}.${field} must be a non-empty string.`);
    }
    return value;
}
function optionalString(record, field, name) {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`${name}.${field} must be a string when present.`);
    }
    return value;
}
function optionalStringFields(record, name, fields) {
    const result = {};
    for (const field of fields) {
        const value = optionalString(record, field, name);
        if (value !== undefined) {
            result[field] = value;
        }
    }
    return result;
}
function requiredBoolean(record, field, name) {
    const value = record[field];
    if (typeof value !== "boolean") {
        throw new Error(`${name}.${field} must be a boolean.`);
    }
    return value;
}
function optionalBoolean(record, field, name) {
    const value = record[field];
    if (value !== undefined && typeof value !== "boolean") {
        throw new Error(`${name}.${field} must be a boolean when present.`);
    }
    return value;
}
function requiredSafeInteger(record, field, name) {
    const value = record[field];
    if (!Number.isSafeInteger(value)) {
        throw new Error(`${name}.${field} must be a safe integer.`);
    }
    return value;
}
function optionalSafeInteger(record, field, name) {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isSafeInteger(value)) {
        throw new Error(`${name}.${field} must be a safe integer when present.`);
    }
    return value;
}
function requiredSubject(record, field, name) {
    const value = record[field];
    if (typeof value !== "object" || value === null) {
        throw new Error(`${name}.${field} must be an identity-bearing object.`);
    }
    return value;
}
function optionalSubject(record, field, name) {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "object" || value === null) {
        throw new Error(`${name}.${field} must be an identity-bearing object when present.`);
    }
    return value;
}
function requiredArray(value, name, snapshot) {
    if (!Array.isArray(value)) {
        throw new Error(`${name} must be an array.`);
    }
    return Object.freeze(value.map((element) => snapshot(element)));
}
function optionalArray(value, name, snapshot) {
    return value === undefined ? undefined : requiredArray(value, name, snapshot);
}
function subjectArray(value, name) {
    if (!Array.isArray(value)) {
        throw new Error(`${name} must be an array.`);
    }
    return Object.freeze(value.map((subject, index) => {
        if (typeof subject !== "object" || subject === null) {
            throw new Error(`${name}[${index}] must be an identity-bearing object.`);
        }
        return subject;
    }));
}
function optionalSubjectArray(value, name) {
    return value === undefined ? undefined : subjectArray(value, name);
}
function stringArray(value, name) {
    if (!Array.isArray(value)) {
        throw new Error(`${name} must be an array.`);
    }
    return Object.freeze(value.map((element, index) => {
        if (typeof element !== "string") {
            throw new Error(`${name}[${index}] must be a string.`);
        }
        return element;
    }));
}
const canonicalIdentityKinds = new Set([
    "module",
    "package",
    "export",
    "local-alias",
    "symbol",
    "type",
    "signature",
    "instantiated-type",
]);
const importKinds = new Set(["type", "value", "namespace", "unknown"]);
const sourcePrimitiveKinds = new Set([
    "bool",
    "char",
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "native-int",
    "native-uint",
    "float16",
    "float32",
    "float64",
    "decimal",
    "int128",
    "uint128",
]);
const sourceRuntimeBases = new Set([
    "boolean",
    "number",
    "bigint",
    "string",
    "object",
]);
const pointerMutabilities = new Set(["readonly", "readwrite", "target-defined"]);
const flowStates = new Set(["moved", "borrowed-shared", "borrowed-mut"]);
const providerWellKnownSymbolNames = new Set([
    "asyncIterator",
    "hasInstance",
    "isConcatSpreadable",
    "iterator",
    "match",
    "matchAll",
    "replace",
    "search",
    "species",
    "split",
    "toPrimitive",
    "toStringTag",
    "unscopables",
]);
//# sourceMappingURL=facts.js.map