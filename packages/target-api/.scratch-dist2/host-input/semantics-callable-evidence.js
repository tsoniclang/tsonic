export function selectSourceCallableTypeEvidence(type, types, ast) {
    const signatures = types.signatureInfos(type, "call");
    const signature = signatures.length === 1 ? signatures[0] : undefined;
    if (signature === undefined)
        return undefined;
    const result = signatureResultEvidence(signature, types, ast);
    return result === undefined ? undefined : Object.freeze({
        parameters: Object.freeze(signature.parameters.map(parameter => sourceCallableParameterEvidence(parameter, ast))),
        result,
    });
}
/** How a call may omit the parameter: required, omissible as undefined, defaulted by an initializer, or rest. */
export function sourceCallableParameterEvidence(parameter, ast) {
    const omissionKind = parameter.parameterKind === "rest" ? "rest"
        : parameter.declaration !== undefined && ast.is.IsParameterDeclaration(parameter.declaration) &&
            ast.as.AsParameterDeclaration(parameter.declaration)?.Initializer !== undefined ? "initializer"
            : parameter.acceptsOmission ? "undefined" : "required";
    return Object.freeze({ ...parameter, omissionKind });
}
function signatureResultEvidence(signature, types, ast) {
    const selectedType = signature.returnType;
    if (selectedType === undefined)
        return undefined;
    const declaration = types.signatureDeclaration(signature.signature);
    const authoredTypeNode = declaration === undefined ? undefined : ast.typeNode(declaration);
    return Object.freeze({
        selectedType,
        ...(declaration === undefined ? {} : { declaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    });
}
//# sourceMappingURL=semantics-callable-evidence.js.map