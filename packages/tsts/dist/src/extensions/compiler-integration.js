import { Node_Body, Node_Expression, Node_Locals, Node_Members, Node_ModifierFlags, Node_Symbol, Node_Text, Node_TypeArguments, SourceFile_FileName } from "../internal/ast/ast.js";
import { Node_ForEachChild, Node_Name } from "../internal/ast/spine.js";
import { ModifierFlagsStatic } from "../internal/ast/modifierflags.js";
import { GetSymbolId } from "../internal/ast/utilities.js";
import { KindClassDeclaration, KindComputedPropertyName, KindConstructSignature, KindConstructor, KindEnumDeclaration, KindEnumMember, KindFunctionDeclaration, KindIndexSignature, KindInterfaceDeclaration, KindMethodDeclaration, KindMethodSignature, KindModuleDeclaration, KindPropertyDeclaration, KindPropertyAccessExpression, KindPropertySignature, KindTypeAliasDeclaration, KindVariableDeclaration, } from "../internal/ast/generated/kinds.js";
import { canonicalIdentityFactKey, instantiatedTargetTypeFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, targetBindingFactKey, } from "./facts.js";
import { ExtensionLifecycleEvent, getExtensionHost } from "./host.js";
import { getProviderVirtualArtifactForCompiler } from "./provider-virtual-internal.js";
export function recordBoundSourceFileExtensionFacts(program, file) {
    const extensionHost = getExtensionHost(program);
    if (extensionHost === undefined || file === undefined) {
        return;
    }
    const fileName = SourceFile_FileName(file);
    const virtualArtifact = getProviderVirtualArtifactForCompiler(extensionHost.providers, fileName);
    if (virtualArtifact !== undefined) {
        recordProviderVirtualModuleFacts(extensionHost, file, virtualArtifact);
    }
    if (virtualArtifact?.kind === "canonical-export-owner") {
        return;
    }
    extensionHost.runLifecycle(ExtensionLifecycleEvent.afterSourceFileBound, {
        sourceFile: file,
        fileName,
        ...(virtualArtifact !== undefined ? { providerVirtualArtifact: virtualArtifact } : {}),
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
export function recordProviderTypeFamilyReferenceFacts(extensionHost, typeReference, type, symbol) {
    if (typeReference === undefined || symbol === undefined) {
        return;
    }
    const family = extensionHost.facts.get(symbol, providerTypeFamilyFactKey);
    if (family === undefined) {
        return;
    }
    const sourceTypeArgumentCount = (Node_TypeArguments(typeReference) ?? []).length;
    const variant = family.variants.find((candidate) => candidate.sourceTypeArgumentCount === sourceTypeArgumentCount);
    if (variant === undefined) {
        return;
    }
    const evidence = [{
            message: "provider type-family variant selected by source type-argument count",
            details: {
                exportName: family.exportName,
                sourceTypeArgumentCount,
                exportId: variant.declaration.exportId,
            },
        }];
    extensionHost.facts.set(typeReference, providerVirtualDeclarationFactKey, variant.declaration, evidence);
    if (variant.targetBinding !== undefined) {
        extensionHost.facts.set(typeReference, targetBindingFactKey, variant.targetBinding, evidence);
        if (type !== undefined) {
            extensionHost.facts.set(type, targetBindingFactKey, variant.targetBinding, evidence);
        }
        extensionHost.facts.set(typeReference, instantiatedTargetTypeFactKey, {
            targetType: variant.targetBinding,
            typeArguments: (Node_TypeArguments(typeReference) ?? []).filter((argument) => argument !== undefined),
        }, evidence);
    }
}
function recordProviderVirtualModuleFacts(extensionHost, file, virtualModule) {
    const evidence = getProviderVirtualModuleEvidence(virtualModule);
    extensionHost.facts.set(file, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
        ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
        subpath: virtualModule.moduleSpecifier,
    }, evidence);
    extensionHost.facts.set(file, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    const fileSymbol = Node_Symbol(file);
    if (fileSymbol === undefined) {
        return;
    }
    extensionHost.facts.set(fileSymbol, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
        ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
        subpath: virtualModule.moduleSpecifier,
        canonicalSymbolId: getSymbolFactId(fileSymbol),
    }, evidence);
    extensionHost.facts.set(fileSymbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    for (const family of getProviderTypeFamilies(virtualModule)) {
        const familySymbol = fileSymbol.Exports?.get(family.exportName);
        if (familySymbol === undefined) {
            continue;
        }
        extensionHost.facts.set(familySymbol, canonicalIdentityFactKey, {
            kind: "export",
            id: `${virtualModule.declarationModel.providerModuleId}::${family.exportName}`,
            ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
            ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
            subpath: virtualModule.moduleSpecifier,
            exportName: family.exportName,
            canonicalSymbolId: getSymbolFactId(familySymbol),
        }, evidence);
        extensionHost.facts.set(familySymbol, providerTypeFamilyFactKey, getProviderTypeFamilyFact(virtualModule, family), evidence);
    }
    for (const declaration of virtualModule.declarationModel.exports) {
        const exportName = getProviderSourceExportName(declaration);
        const symbol = getProviderDeclarationSymbol(file, fileSymbol, declaration);
        if (symbol === undefined) {
            continue;
        }
        extensionHost.facts.set(symbol, canonicalIdentityFactKey, {
            kind: "export",
            id: declaration.sourceTypeFamily === undefined
                ? `${virtualModule.declarationModel.providerModuleId}::${exportName}`
                : `${virtualModule.declarationModel.providerModuleId}::${exportName}:${declaration.sourceTypeFamily.typeArgumentCount}`,
            ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
            ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
            subpath: virtualModule.moduleSpecifier,
            exportName,
            canonicalSymbolId: getSymbolFactId(symbol),
        }, evidence);
        extensionHost.facts.set(symbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);
        if (declaration.signatures === undefined || declaration.signatures.length === 0) {
            for (const exportDeclaration of symbol.Declarations ?? []) {
                if (exportDeclaration === undefined) {
                    continue;
                }
                extensionHost.facts.set(exportDeclaration, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);
            }
        }
        const targetBinding = getTargetBindingFact(virtualModule, declaration);
        if (targetBinding !== undefined) {
            extensionHost.facts.set(symbol, targetBindingFactKey, targetBinding, evidence);
        }
        if (declaration.signatures !== undefined && declaration.signatures.length > 0) {
            recordProviderVirtualSignatureFacts(extensionHost, symbol, virtualModule, declaration, declaration.signatures, evidence);
        }
        if (declaration.members !== undefined) {
            recordProviderVirtualMemberFacts(extensionHost, symbol, virtualModule, declaration, evidence);
        }
    }
}
function getProviderVirtualModuleEvidence(virtualModule) {
    return [{
            message: "provider virtual module",
            details: {
                provider: virtualModule.provider,
                moduleSpecifier: virtualModule.moduleSpecifier,
                providerModuleId: virtualModule.providerModuleId,
                artifactFileName: virtualModule.fileName,
            },
        }];
}
function recordProviderVirtualMemberFacts(extensionHost, exportSymbol, virtualModule, declaration, evidence) {
    const memberNodes = (exportSymbol.Declarations ?? []).flatMap(getProviderMemberCandidateNodes);
    const usedMemberNodes = new Set();
    for (const member of declaration.members ?? []) {
        const matchingMemberNodes = memberNodes.filter((node) => node !== undefined
            && !usedMemberNodes.has(node)
            && providerMemberMatchesNode(member, node));
        const memberSymbol = findProviderMemberSymbol(exportSymbol, member, matchingMemberNodes);
        const memberFact = getProviderVirtualDeclarationFact(virtualModule, declaration, member);
        if (memberSymbol !== undefined) {
            setProviderVirtualDeclarationSymbolFact(extensionHost, memberSymbol, memberFact, evidence);
        }
        for (let index = 0; index < matchingMemberNodes.length; index++) {
            const memberNode = matchingMemberNodes[index];
            if (memberNode === undefined) {
                continue;
            }
            usedMemberNodes.add(memberNode);
            const signature = member.signatures?.[index] ?? member.signatures?.[0];
            extensionHost.facts.set(memberNode, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member, signature), evidence);
            const nodeSymbol = Node_Symbol(memberNode);
            if (nodeSymbol !== undefined && nodeSymbol !== memberSymbol) {
                setProviderVirtualDeclarationSymbolFact(extensionHost, nodeSymbol, memberFact, evidence);
            }
        }
    }
}
function setProviderVirtualDeclarationSymbolFact(extensionHost, symbol, fact, evidence) {
    const existing = extensionHost.facts.get(symbol, providerVirtualDeclarationFactKey);
    if (existing !== undefined && !providerVirtualDeclarationFactKey.equals(existing, fact)) {
        return;
    }
    extensionHost.facts.set(symbol, providerVirtualDeclarationFactKey, fact, evidence);
}
function findProviderMemberSymbol(exportSymbol, member, matchingMemberNodes) {
    for (const node of matchingMemberNodes) {
        const symbol = Node_Symbol(node);
        if (symbol !== undefined) {
            return symbol;
        }
    }
    if (typeof member.name !== "string" && member.name.kind === "well-known-symbol") {
        return undefined;
    }
    const memberName = getProviderPropertyNameText(member.name);
    if (member.static === true) {
        return exportSymbol.Exports?.get(memberName);
    }
    if (member.static === false) {
        return exportSymbol.Members?.get(memberName);
    }
    return exportSymbol.Members?.get(memberName) ?? exportSymbol.Exports?.get(memberName);
}
function providerMemberMatchesNode(member, node) {
    if (!providerMemberKindMatchesNode(member, node)) {
        return false;
    }
    if (member.kind !== "constructor" && member.kind !== "indexer" && !providerPropertyNameMatchesNode(member.name, Node_Name(node))) {
        return false;
    }
    if (member.static !== undefined && ((Node_ModifierFlags(node) & ModifierFlagsStatic) !== 0) !== member.static) {
        return false;
    }
    return true;
}
function providerPropertyNameMatchesNode(name, nodeName) {
    if (nodeName === undefined) {
        return false;
    }
    if (typeof name !== "string" && name.kind === "well-known-symbol") {
        if (nodeName.Kind !== KindComputedPropertyName) {
            return false;
        }
        const expression = Node_Expression(nodeName);
        return expression?.Kind === KindPropertyAccessExpression
            && Node_Text(Node_Expression(expression)) === "Symbol"
            && Node_Text(Node_Name(expression)) === name.name;
    }
    return nodeName.Kind !== KindComputedPropertyName && Node_Text(nodeName) === getProviderPropertyNameText(name);
}
function providerMemberKindMatchesNode(member, node) {
    switch (member.kind) {
        case "constructor":
            return node.Kind === KindConstructor || node.Kind === KindConstructSignature;
        case "method":
            return node.Kind === KindMethodDeclaration || node.Kind === KindMethodSignature || node.Kind === KindFunctionDeclaration;
        case "property":
        case "field":
            return node.Kind === KindPropertyDeclaration || node.Kind === KindPropertySignature || node.Kind === KindEnumMember || node.Kind === KindVariableDeclaration;
        case "indexer":
            return node.Kind === KindIndexSignature;
    }
}
function getProviderMemberCandidateNodes(exportDeclaration) {
    if (exportDeclaration === undefined) {
        return [];
    }
    if (exportDeclaration.Kind === KindClassDeclaration
        || exportDeclaration.Kind === KindInterfaceDeclaration
        || exportDeclaration.Kind === KindEnumDeclaration
        || exportDeclaration.Kind === KindTypeAliasDeclaration
        || exportDeclaration.Kind === KindFunctionDeclaration
        || exportDeclaration.Kind === KindVariableDeclaration) {
        return Node_Members(exportDeclaration) ?? [];
    }
    if (exportDeclaration.Kind !== KindModuleDeclaration) {
        return [];
    }
    const candidates = [];
    collectProviderNamespaceMemberCandidateNodes(Node_Body(exportDeclaration), candidates);
    return candidates;
}
function collectProviderNamespaceMemberCandidateNodes(node, candidates) {
    if (node === undefined) {
        return;
    }
    switch (node.Kind) {
        case KindFunctionDeclaration:
        case KindVariableDeclaration:
            candidates.push(node);
            return;
        default:
            Node_ForEachChild(node, (child) => {
                collectProviderNamespaceMemberCandidateNodes(child, candidates);
                return false;
            });
    }
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
    return `${symbol.Name}:${String(GetSymbolId(symbol))}`;
}
function getTargetBindingFact(virtualModule, declaration) {
    if (declaration.targetIdentity === undefined) {
        return undefined;
    }
    return {
        id: declaration.targetIdentity.id,
        sourceName: getProviderSourceExportName(declaration),
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
    const sourceName = getProviderPropertyNameText(member.name);
    if (member.signatures !== undefined && member.signatures.length > 0) {
        return member.signatures.map((signature) => getTargetMemberFromSignature(sourceName, member.kind, signature, virtualModule, declaration, member));
    }
    return [{
            id: member.id,
            sourceName,
            targetName: sourceName,
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
        targetName: signature.name ?? (member === undefined ? sourceName : getProviderPropertyNameText(member.name)),
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
    return parameter.passingMode ?? "by-value";
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
            return { kind: "source-primitive", name: type.name };
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
        case "undefined":
        case "object":
        case "union":
        case "intersection":
        case "literal":
            return { kind: "opaque", id: type.kind };
    }
}
function getProviderVirtualDeclarationFact(virtualModule, declaration, member, signature) {
    return {
        providerId: virtualModule.provider.id,
        providerVersion: virtualModule.provider.version,
        providerModuleId: virtualModule.providerModuleId,
        moduleSpecifier: virtualModule.moduleSpecifier,
        artifactFileName: virtualModule.fileName,
        ...(declaration !== undefined ? { exportName: getProviderSourceExportName(declaration) } : {}),
        ...(declaration !== undefined ? { exportId: declaration.id } : {}),
        ...(member !== undefined ? { memberName: getProviderPropertyNameText(member.name) } : {}),
        ...(member !== undefined ? { memberKey: getProviderMemberKey(member.name) } : {}),
        ...(member !== undefined ? { memberId: member.id } : {}),
        ...(member?.static !== undefined ? { memberStatic: member.static } : {}),
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
function getProviderTypeFamilyFact(virtualModule, family) {
    return {
        exportName: family.exportName,
        variants: family.variants
            .map((declaration) => {
            const targetBinding = getTargetBindingFact(virtualModule, declaration);
            return {
                sourceTypeArgumentCount: declaration.sourceTypeFamily.typeArgumentCount,
                declaration: getProviderVirtualDeclarationFact(virtualModule, declaration),
                ...(targetBinding !== undefined ? { targetBinding } : {}),
            };
        })
            .sort((left, right) => left.sourceTypeArgumentCount - right.sourceTypeArgumentCount),
    };
}
function getProviderExportName(declaration) {
    return declaration.exportKind === "default" ? "default" : declaration.exportName ?? declaration.name;
}
function getProviderSourceExportName(declaration) {
    return declaration.sourceTypeFamily?.exportName ?? getProviderExportName(declaration);
}
function getProviderDeclarationSymbol(file, fileSymbol, declaration) {
    if (declaration.sourceTypeFamily !== undefined) {
        return Node_Locals(file)?.get(getProviderTypeFamilyVariantLocalName(declaration));
    }
    const exportName = getProviderExportName(declaration);
    return fileSymbol.Exports?.get(exportName) ?? fileSymbol.Exports?.get(declaration.name);
}
function getProviderTypeFamilies(virtualModule) {
    const groups = new Map();
    for (const declaration of virtualModule.declarationModel.exports) {
        if (declaration.sourceTypeFamily === undefined) {
            continue;
        }
        const variants = groups.get(declaration.sourceTypeFamily.exportName) ?? [];
        variants.push(declaration);
        groups.set(declaration.sourceTypeFamily.exportName, variants);
    }
    return [...groups].map(([exportName, variants]) => ({
        exportName,
        variants: variants.sort((left, right) => left.sourceTypeFamily.typeArgumentCount - right.sourceTypeFamily.typeArgumentCount),
    }));
}
function getProviderTypeFamilyVariantLocalName(declaration) {
    return `__TstsProvider_${declaration.sourceTypeFamily.exportName}_${declaration.sourceTypeFamily.typeArgumentCount}`;
}
function getProviderPropertyNameText(name) {
    if (typeof name === "string") {
        return name;
    }
    switch (name.kind) {
        case "identifier":
        case "string-literal":
            return name.text;
        case "number-literal":
            return String(name.value);
        case "well-known-symbol":
            return `Symbol.${name.name}`;
    }
}
function getProviderMemberKey(name) {
    return typeof name !== "string" && name.kind === "well-known-symbol"
        ? { kind: "well-known-symbol", name: name.name }
        : { kind: "property-key", name: getProviderPropertyNameText(name) };
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