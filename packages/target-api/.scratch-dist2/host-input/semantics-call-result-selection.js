export function selectSourceCallResult(ast, checker, source, providerSignature) {
    if (source.sourceSelectedSignatureKind !== "resolved") {
        return undefined;
    }
    const selectedReturnType = checker.getInvocationReturnTypeOfSignature(source.selectedSignature);
    if (selectedReturnType === undefined) {
        return undefined;
    }
    const declaration = checker.getSignatureDeclaration(source.selectedSignature);
    const authoredTypeNode = ast.typeNode(declaration);
    const provider = providerSignature(declaration);
    return Object.freeze({
        ...(provider === undefined ? {} : { providerSignature: provider }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        selectedReturnType,
        resultType: source.sourceResultType,
    });
}
//# sourceMappingURL=semantics-call-result-selection.js.map