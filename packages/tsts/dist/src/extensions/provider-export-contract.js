import { canonicalizeProviderAbiModel, canonicalizeProviderAbiTypeParameter, } from "./provider-model-graph.js";
export function getProviderExportContractKeyMap(moduleSpecifier, exports) {
    const canonicalExports = canonicalizeProviderAbiModel({
        moduleSpecifier,
        providerModuleId: "provider-contract",
        exports,
    }).exports;
    const declarationsByExport = new Map();
    for (const declaration of canonicalExports) {
        const exportName = getProviderSourceExportName(declaration);
        const declarations = declarationsByExport.get(exportName) ?? [];
        declarations.push(declaration);
        declarationsByExport.set(exportName, declarations);
    }
    return new Map([...declarationsByExport]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([exportName, declarations]) => [
        exportName,
        JSON.stringify(declarations.sort(compareProviderContractDeclarations)),
    ]));
}
export function getProviderIncrementalExportContractMap(moduleSpecifier, exports) {
    const canonicalExports = canonicalizeProviderAbiModel({
        moduleSpecifier,
        providerModuleId: "provider-incremental-contract",
        exports,
    }).exports;
    return new Map(canonicalExports.map((declaration) => {
        const sourceExportName = getProviderSourceExportName(declaration);
        const typeArgumentCount = declaration.sourceTypeFamily?.typeArgumentCount;
        const { members, signatures, ...header } = declaration;
        const contract = Object.freeze({
            sourceExportName,
            ...(typeArgumentCount === undefined ? {} : { typeArgumentCount }),
            headerKey: JSON.stringify(header),
            ...(members === undefined && signatures === undefined
                ? {}
                : { bodyKey: JSON.stringify({ members, signatures }) }),
        });
        return [
            JSON.stringify([sourceExportName, typeArgumentCount ?? null]),
            contract,
        ];
    }));
}
export function getProviderTypeParameterContractKey(parameter) {
    return JSON.stringify(canonicalizeProviderAbiTypeParameter(parameter));
}
function compareProviderContractDeclarations(left, right) {
    const leftArity = left.sourceTypeFamily?.typeArgumentCount ?? -1;
    const rightArity = right.sourceTypeFamily?.typeArgumentCount ?? -1;
    if (leftArity !== rightArity) {
        return leftArity - rightArity;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
function getProviderExportName(declaration) {
    return declaration.exportKind === "default" ? "default" : declaration.exportName ?? declaration.name;
}
function getProviderSourceExportName(declaration) {
    return declaration.sourceTypeFamily?.exportName ?? getProviderExportName(declaration);
}
//# sourceMappingURL=provider-export-contract.js.map