import { Node_Symbol, SourceFile_FileName } from "../internal/ast/ast.js";
import { canonicalIdentityFactKey, providerVirtualDeclarationFactKey, targetBindingFactKey, } from "./facts.js";
import { ExtensionLifecycleEvent, getExtensionHost } from "./host.js";
export function recordBoundSourceFileExtensionFacts(program, file) {
    const extensionHost = getExtensionHost(program);
    if (extensionHost === undefined || file === undefined) {
        return;
    }
    const fileName = SourceFile_FileName(file);
    const virtualModule = extensionHost.providers.getVirtualModuleByFileName(fileName);
    if (virtualModule !== undefined) {
        recordProviderVirtualModuleFacts(extensionHost, file, virtualModule);
    }
    extensionHost.runLifecycle(ExtensionLifecycleEvent.afterSourceFileBound, {
        sourceFile: file,
        fileName,
        ...(virtualModule !== undefined ? { providerVirtualModule: virtualModule } : {}),
    });
}
export function finalizeExtensionSemantics(program) {
    const extensionHost = getExtensionHost(program);
    if (extensionHost === undefined) {
        return undefined;
    }
    extensionHost.finalizeSemantics();
    return extensionHost;
}
function recordProviderVirtualModuleFacts(extensionHost, file, virtualModule) {
    const evidence = getProviderVirtualModuleEvidence(virtualModule);
    extensionHost.facts.set(file, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
        ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
        subpath: virtualModule.resolution.moduleSpecifier,
    }, evidence);
    extensionHost.facts.set(file, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    const fileSymbol = Node_Symbol(file);
    if (fileSymbol === undefined) {
        return;
    }
    extensionHost.facts.set(fileSymbol, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
        ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
        subpath: virtualModule.resolution.moduleSpecifier,
        canonicalSymbolId: getSymbolFactId(fileSymbol),
    }, evidence);
    extensionHost.facts.set(fileSymbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    for (const declaration of virtualModule.declarationModel.exports) {
        const symbol = fileSymbol.Exports?.get(declaration.name);
        if (symbol === undefined) {
            continue;
        }
        extensionHost.facts.set(symbol, canonicalIdentityFactKey, {
            kind: "export",
            id: `${virtualModule.declarationModel.providerModuleId}::${declaration.name}`,
            ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
            ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
            subpath: virtualModule.resolution.moduleSpecifier,
            exportName: declaration.name,
            canonicalSymbolId: getSymbolFactId(symbol),
        }, evidence);
        extensionHost.facts.set(symbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);
        const targetBinding = getTargetBindingFact(virtualModule, declaration);
        if (targetBinding !== undefined) {
            extensionHost.facts.set(symbol, targetBindingFactKey, targetBinding, evidence);
        }
        if (declaration.signatures !== undefined && declaration.signatures.length > 0) {
            recordProviderVirtualSignatureFacts(extensionHost, symbol, virtualModule, declaration, declaration.signatures, evidence);
        }
        if (declaration.members !== undefined) {
            for (const member of declaration.members) {
                const memberSymbol = symbol.Members?.get(member.name);
                if (memberSymbol === undefined) {
                    continue;
                }
                extensionHost.facts.set(memberSymbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member), evidence);
                if (member.signatures !== undefined && member.signatures.length > 0) {
                    recordProviderVirtualSignatureFacts(extensionHost, memberSymbol, virtualModule, declaration, member.signatures, evidence, member);
                }
            }
        }
    }
}
function getProviderVirtualModuleEvidence(virtualModule) {
    return [{
            message: "provider virtual module",
            details: {
                provider: virtualModule.provider.identity,
                moduleSpecifier: virtualModule.resolution.moduleSpecifier,
                providerModuleId: virtualModule.resolution.providerModuleId,
                virtualFileName: virtualModule.resolution.virtualFileName,
            },
        }];
}
function recordProviderVirtualSignatureFacts(extensionHost, symbol, virtualModule, declaration, signatures, evidence, member) {
    if (signatures.length === 0 || symbol.Declarations === undefined) {
        return;
    }
    for (let index = 0; index < signatures.length; index++) {
        const signatureDeclaration = symbol.Declarations[index];
        if (signatureDeclaration === undefined) {
            continue;
        }
        extensionHost.facts.set(signatureDeclaration, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member, signatures[index]), evidence);
    }
}
function getSymbolFactId(symbol) {
    return `${symbol.Name}:${String(symbol.id)}`;
}
function getTargetBindingFact(virtualModule, declaration) {
    if (declaration.targetIdentity === undefined) {
        return undefined;
    }
    return {
        id: declaration.targetIdentity.id,
        sourceName: declaration.name,
        targetName: declaration.targetIdentity.displayName ?? declaration.targetIdentity.id,
        target: declaration.targetIdentity.target,
        kind: getTargetBindingKind(declaration.kind),
        ...(declaration.typeParameters !== undefined
            ? {
                typeParameters: declaration.typeParameters.map(getTargetTypeParameter),
            }
            : {}),
        ...(declaration.members !== undefined ? { members: declaration.members.flatMap((member) => getTargetMembers(virtualModule, declaration, member)) } : {}),
    };
}
function getTargetTypeParameter(parameter) {
    const constraints = (parameter.constraints ?? []).flatMap(getTargetConstraint);
    return {
        name: parameter.name,
        ...(constraints.length > 0 ? { constraints } : {}),
        ...(parameter.variance !== undefined ? { variance: parameter.variance } : {}),
    };
}
function getTargetMembers(virtualModule, declaration, member) {
    if (member.signatures !== undefined && member.signatures.length > 0) {
        return member.signatures.map((signature) => getTargetMemberFromSignature(member.name, member.kind, signature, virtualModule, declaration, member));
    }
    return [{
            id: member.id,
            sourceName: member.name,
            targetName: member.name,
            kind: member.kind,
            parameters: [],
            ...(member.static !== undefined ? { static: member.static } : {}),
            ...(member.type !== undefined ? { returnType: getTargetTypeRef(member.type) } : {}),
            providerDeclaration: getProviderDeclarationIdentity(virtualModule, declaration, member),
        }];
}
function getTargetMemberFromSignature(sourceName, kind, signature, virtualModule, declaration, member) {
    const typeParameters = (signature.typeParameters ?? []).map(getTargetTypeParameter);
    return {
        id: signature.id,
        sourceName,
        targetName: signature.name ?? member?.name ?? sourceName,
        kind,
        parameters: signature.parameters.map(getTargetParameter),
        ...(member?.static !== undefined ? { static: member.static } : {}),
        ...(signature.returnType !== undefined ? { returnType: getTargetTypeRef(signature.returnType) } : {}),
        ...(typeParameters.length > 0 ? { typeParameters } : {}),
        overloadGroup: member?.id ?? sourceName,
        providerDeclaration: getProviderDeclarationIdentity(virtualModule, declaration, member, signature),
    };
}
function getTargetParameter(parameter) {
    return {
        name: parameter.name,
        type: getTargetTypeRef(parameter.type),
        passingMode: getArgumentPassingMode(parameter),
        ...(parameter.optional === true ? { optional: true } : {}),
        ...(parameter.rest === true ? { paramsArray: true } : {}),
    };
}
function getArgumentPassingMode(parameter) {
    return "by-value";
}
function getTargetConstraint(type) {
    switch (type.kind) {
        case "target-named":
            return [{
                    kind: "implements",
                    contract: type.id,
                    ...(type.typeArguments !== undefined ? { typeArguments: type.typeArguments.map(getTargetTypeRef) } : {}),
                }];
        default:
            return [];
    }
}
function getTargetTypeRef(type) {
    switch (type.kind) {
        case "boolean":
            return { kind: "source-primitive", name: "bool" };
        case "bigint":
            return { kind: "source-primitive", name: "int64" };
        case "source-primitive":
            return { kind: "source-primitive", name: getSourcePrimitiveKind(type.name) };
        case "type-parameter":
            return { kind: "type-parameter", name: type.name };
        case "target-named":
            return {
                kind: "target-named",
                id: type.id,
                ...(type.typeArguments !== undefined ? { typeArguments: type.typeArguments.map(getTargetTypeRef) } : {}),
            };
        case "array":
            return { kind: "array", element: getTargetTypeRef(type.elementType) };
        case "tuple":
            return { kind: "tuple", elements: type.elementTypes.map(getTargetTypeRef) };
        case "function":
            return {
                kind: "function-pointer",
                args: type.parameters.map((parameter) => getTargetTypeRef(parameter.type)),
                result: getTargetTypeRef(type.returnType),
            };
        case "opaque":
            return { kind: "opaque", id: type.id };
        case "provider-ref":
            return { kind: "opaque", id: `${type.moduleSpecifier}::${type.exportName}` };
        case "string":
        case "number":
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "object":
        case "union":
        case "intersection":
        case "literal":
            return { kind: "opaque", id: type.kind };
    }
}
function getSourcePrimitiveKind(name) {
    switch (name) {
        case "bool":
        case "boolean":
            return "bool";
        case "char":
            return "char";
        case "sbyte":
        case "int8":
            return "int8";
        case "byte":
        case "uint8":
            return "uint8";
        case "short":
        case "int16":
            return "int16";
        case "ushort":
        case "uint16":
            return "uint16";
        case "int":
        case "int32":
            return "int32";
        case "uint":
        case "uint32":
            return "uint32";
        case "long":
        case "int64":
            return "int64";
        case "ulong":
        case "uint64":
            return "uint64";
        case "nint":
        case "native-int":
            return "native-int";
        case "nuint":
        case "native-uint":
            return "native-uint";
        case "half":
        case "float16":
            return "float16";
        case "float":
        case "float32":
            return "float32";
        case "double":
        case "float64":
            return "float64";
        case "decimal":
            return "decimal";
        case "int128":
            return "int128";
        case "uint128":
            return "uint128";
        default:
            throw new Error(`Unknown source primitive '${name}'.`);
    }
}
function getProviderVirtualDeclarationFact(virtualModule, declaration, member, signature) {
    return {
        providerId: virtualModule.provider.identity.id,
        providerVersion: virtualModule.provider.identity.version,
        providerModuleId: virtualModule.resolution.providerModuleId,
        moduleSpecifier: virtualModule.resolution.moduleSpecifier,
        virtualFileName: virtualModule.resolution.virtualFileName,
        ...(declaration !== undefined ? { exportName: declaration.name } : {}),
        ...(declaration !== undefined ? { exportId: declaration.id } : {}),
        ...(member !== undefined ? { memberName: member.name } : {}),
        ...(member !== undefined ? { memberId: member.id } : {}),
        ...(signature !== undefined ? { signatureId: signature.id } : {}),
        ...(declaration?.targetIdentity !== undefined
            ? {
                targetIdentity: {
                    kind: "target-named",
                    id: declaration.targetIdentity.id,
                },
            }
            : {}),
    };
}
function getProviderDeclarationIdentity(virtualModule, declaration, member, signature) {
    return getProviderVirtualDeclarationFact(virtualModule, declaration, member, signature);
}
function getTargetBindingKind(kind) {
    switch (kind) {
        case "class":
            return "class";
        case "interface":
            return "interface";
        case "enum":
            return "enum";
        case "function":
            return "function";
        case "opaque":
            return "opaque";
        case "type":
        case "value":
        case "namespace":
            return "opaque";
    }
}
//# sourceMappingURL=compiler-integration.js.map