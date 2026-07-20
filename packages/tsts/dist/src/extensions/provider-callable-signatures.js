const providerFunctionMarkerPrefix = "/*@tsts-provider-function:";
const providerFunctionMarkerSuffix = "*/";
export const providerFunctionSignatureMarkerMaximumLength = providerFunctionMarkerPrefix.length + 16 + providerFunctionMarkerSuffix.length;
export function createProviderRenderedFunctionSignature(declaration, member, signature, marker) {
    return Object.freeze({
        marker,
        exportId: declaration.id,
        ...(member === undefined ? {} : { memberId: member.id }),
        signatureId: signature.id,
    });
}
export function renderProviderFunctionSignatureMarker(marker) {
    if (!Number.isSafeInteger(marker) || marker < 0) {
        throw new Error("Provider function signature marker must be a non-negative safe integer.");
    }
    return `${providerFunctionMarkerPrefix}${marker}${providerFunctionMarkerSuffix}`;
}
export function parseProviderFunctionSignatureMarker(sourceText) {
    if (!sourceText.startsWith(providerFunctionMarkerPrefix)) {
        return undefined;
    }
    const end = sourceText.indexOf(providerFunctionMarkerSuffix, providerFunctionMarkerPrefix.length);
    if (end < 0) {
        return undefined;
    }
    const digits = sourceText.slice(providerFunctionMarkerPrefix.length, end);
    if (digits.length === 0 || digits.length > 16) {
        return undefined;
    }
    for (let index = 0; index < digits.length; index++) {
        const code = digits.charCodeAt(index);
        if (code < 48 || code > 57) {
            return undefined;
        }
    }
    if (digits.length > 1 && digits.charCodeAt(0) === 48) {
        return undefined;
    }
    const marker = Number(digits);
    return Number.isSafeInteger(marker) ? marker : undefined;
}
export function hasUniqueProviderCallableIdentities(model) {
    const exportIds = new Set();
    for (const declaration of model.exports) {
        if (!addUniqueIdentity(exportIds, declaration.id)) {
            return false;
        }
        const exportSignatureIds = new Set();
        if (!collectProviderExportCallableIdentities(declaration, exportSignatureIds)) {
            return false;
        }
        const memberIds = new Set();
        const memberSurfaces = new Set();
        for (const member of declaration.members ?? []) {
            if (!addUniqueIdentity(memberIds, member.id)
                || !addUniqueIdentity(memberSurfaces, providerMemberSurfaceKey(member))
                || !collectProviderMemberCallableIdentities(member, new Set())) {
                return false;
            }
        }
    }
    return true;
}
function providerMemberSurfaceKey(member) {
    const staticMember = member.static === true;
    switch (member.kind) {
        case "constructor":
            return "constructor";
        case "indexer":
            return "indexer";
        case "method":
        case "property":
        case "field":
            return JSON.stringify([
                staticMember,
                providerPropertySourceKey(member.name),
            ]);
    }
}
function providerPropertySourceKey(name) {
    if (typeof name !== "string" && name.kind === "well-known-symbol") {
        return ["well-known-symbol", name.name];
    }
    const text = typeof name === "string"
        ? name
        : name.kind === "number-literal"
            ? String(name.value)
            : name.text;
    return ["property-key", text];
}
function collectProviderExportCallableIdentities(declaration, identities) {
    return collectProviderTypeParameterCallableIdentities(declaration.typeParameters ?? [], identities)
        && (declaration.type === undefined || collectProviderTypeCallableIdentities(declaration.type, identities))
        && (declaration.heritage ?? []).every((heritage) => collectProviderTypeCallableIdentities(heritage.type, identities))
        && (declaration.signatures ?? []).every((signature) => collectProviderSignatureCallableIdentities(signature, identities));
}
function collectProviderMemberCallableIdentities(member, identities) {
    return (member.type === undefined || collectProviderTypeCallableIdentities(member.type, identities))
        && (member.signatures ?? []).every((signature) => collectProviderSignatureCallableIdentities(signature, identities));
}
function collectProviderSignatureCallableIdentities(signature, identities) {
    return addUniqueIdentity(identities, signature.id)
        && collectProviderTypeParameterCallableIdentities(signature.typeParameters ?? [], identities)
        && collectProviderParameterCallableIdentities(signature.parameters, identities)
        && (signature.returnType === undefined || collectProviderTypeCallableIdentities(signature.returnType, identities));
}
function collectProviderTypeParameterCallableIdentities(parameters, identities) {
    return parameters.every((parameter) => (parameter.constraints ?? []).every((constraint) => collectProviderTypeCallableIdentities(constraint, identities))
        && (parameter.defaultType === undefined || collectProviderTypeCallableIdentities(parameter.defaultType, identities)));
}
function collectProviderParameterCallableIdentities(parameters, identities) {
    return parameters.every((parameter) => collectProviderTypeCallableIdentities(parameter.type, identities)
        && (parameter.defaultType === undefined || collectProviderTypeCallableIdentities(parameter.defaultType, identities)));
}
function collectProviderTypeCallableIdentities(type, identities) {
    switch (type.kind) {
        case "function":
            return addUniqueIdentity(identities, type.id)
                && collectProviderTypeParameterCallableIdentities(type.typeParameters ?? [], identities)
                && collectProviderParameterCallableIdentities(type.parameters, identities)
                && collectProviderTypeCallableIdentities(type.returnType, identities);
        case "target-named":
            return (type.typeArguments ?? []).every((argument) => collectProviderTypeCallableIdentities(argument, identities))
                && collectProviderTypeCallableIdentities(type.sourceShape, identities);
        case "opaque":
            return collectProviderTypeCallableIdentities(type.sourceShape, identities);
        case "source-global":
        case "provider-ref":
            return (type.typeArguments ?? []).every((argument) => collectProviderTypeCallableIdentities(argument, identities));
        case "array":
            return collectProviderTypeCallableIdentities(type.elementType, identities);
        case "tuple":
            return type.elementTypes.every((element) => collectProviderTypeCallableIdentities(element, identities));
        case "union":
        case "intersection":
            return type.types.every((nested) => collectProviderTypeCallableIdentities(nested, identities));
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "undefined":
        case "boolean":
        case "string":
        case "number":
        case "bigint":
        case "object":
        case "source-primitive":
        case "type-parameter":
        case "literal":
            return true;
    }
}
function addUniqueIdentity(identities, identity) {
    if (identity.length === 0 || identities.has(identity)) {
        return false;
    }
    identities.add(identity);
    return true;
}
//# sourceMappingURL=provider-callable-signatures.js.map