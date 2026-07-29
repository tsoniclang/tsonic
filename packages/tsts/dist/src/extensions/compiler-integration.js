import { Node_Body, Node_Expression, Node_Locals, Node_Members, Node_ModifierFlags, Node_Parameters, Node_Symbol, Node_Text, SourceFile_FileName, SourceFile_Text } from "../internal/ast/ast.js";
import { Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import { ModifierFlagsStatic } from "../internal/ast/modifierflags.js";
import { GetSymbolId } from "../internal/ast/utilities.js";
import * as utf8 from "../go/unicode/utf8.js";
import { KindClassDeclaration, KindComputedPropertyName, KindConstructSignature, KindConstructor, KindEnumDeclaration, KindEnumMember, KindFunctionDeclaration, KindFunctionType, KindIndexSignature, KindInterfaceDeclaration, KindMethodDeclaration, KindMethodSignature, KindModuleDeclaration, KindPropertyDeclaration, KindPropertyAccessExpression, KindPropertySignature, KindTypeAliasDeclaration, KindVariableDeclaration, } from "../internal/ast/generated/kinds.js";
import { argumentPassingFactKey, canonicalIdentityFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, } from "./facts.js";
import { extensionHostRunSourceAnalysis, extensionHostSetFact, getExtensionHost, } from "./host.js";
import { getProviderVirtualArtifactForCompiler, getProviderVirtualCompilerMetadata, } from "./provider-virtual-internal.js";
import { parseProviderFunctionSignatureMarker, providerFunctionSignatureMarkerMaximumLength } from "./provider-callable-signatures.js";
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
}
export function finalizeExtensionSemantics(program) {
    const extensionHost = getExtensionHost(program);
    if (extensionHost === undefined) {
        return undefined;
    }
    extensionHost[extensionHostRunSourceAnalysis]();
    extensionHost.finalizeSemantics();
    return extensionHost;
}
function recordProviderVirtualModuleFacts(extensionHost, file, virtualModule) {
    const evidence = getProviderVirtualModuleEvidence(virtualModule);
    const compilerMetadata = getProviderVirtualCompilerMetadata(extensionHost.providers, virtualModule.fileName);
    if (compilerMetadata === undefined) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has no compiler-owned metadata.`);
    }
    const directDeclarationIds = new Set(compilerMetadata.directDeclarationIds);
    extensionHost[extensionHostSetFact](file, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
        ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
        subpath: virtualModule.moduleSpecifier,
    }, evidence);
    extensionHost[extensionHostSetFact](file, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    recordProviderVirtualFunctionSignatureFacts(extensionHost, file, virtualModule, compilerMetadata.renderedFunctionSignatures, evidence);
    const fileSymbol = Node_Symbol(file);
    if (fileSymbol === undefined) {
        return;
    }
    extensionHost[extensionHostSetFact](fileSymbol, canonicalIdentityFactKey, {
        kind: "module",
        id: virtualModule.declarationModel.providerModuleId,
        ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
        ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
        subpath: virtualModule.moduleSpecifier,
        canonicalSymbolId: getSymbolFactId(fileSymbol),
    }, evidence);
    extensionHost[extensionHostSetFact](fileSymbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);
    for (const family of getProviderTypeFamilies(virtualModule)) {
        const familySymbol = fileSymbol.Exports?.get(family.exportName);
        if (familySymbol === undefined) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' did not bind type-family export '${family.exportName}'.`);
        }
        extensionHost[extensionHostSetFact](familySymbol, canonicalIdentityFactKey, {
            kind: "export",
            id: `${virtualModule.declarationModel.providerModuleId}::${family.exportName}`,
            ...(virtualModule.packageName !== undefined ? { packageName: virtualModule.packageName } : {}),
            ...(virtualModule.packageVersion !== undefined ? { packageVersion: virtualModule.packageVersion } : {}),
            subpath: virtualModule.moduleSpecifier,
            exportName: family.exportName,
            canonicalSymbolId: getSymbolFactId(familySymbol),
        }, evidence);
        extensionHost[extensionHostSetFact](familySymbol, providerTypeFamilyFactKey, getProviderTypeFamilyFact(virtualModule, family), evidence);
    }
    for (const declaration of virtualModule.declarationModel.exports) {
        const isDirectDeclaration = directDeclarationIds.has(declaration.id);
        if (declaration.sourceTypeFamily !== undefined && !isDirectDeclaration) {
            continue;
        }
        const exportName = getProviderSourceExportName(declaration);
        const symbol = getProviderDeclarationSymbol(file, fileSymbol, declaration);
        if (symbol === undefined) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' did not bind export identity '${declaration.id}'.`);
        }
        extensionHost[extensionHostSetFact](symbol, canonicalIdentityFactKey, {
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
        extensionHost[extensionHostSetFact](symbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);
        if (!isDirectDeclaration) {
            continue;
        }
        if (declaration.signatures === undefined || declaration.signatures.length === 0) {
            for (const exportDeclaration of symbol.Declarations ?? []) {
                if (exportDeclaration === undefined) {
                    continue;
                }
                extensionHost[extensionHostSetFact](exportDeclaration, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);
            }
        }
        if (declaration.signatures !== undefined && declaration.signatures.length > 0) {
            recordProviderVirtualSignatureFacts(extensionHost, symbol, virtualModule, declaration, declaration.signatures, evidence);
        }
        if (declaration.members !== undefined) {
            recordProviderVirtualMemberFacts(extensionHost, symbol, virtualModule, declaration, evidence);
        }
    }
}
function recordProviderVirtualFunctionSignatureFacts(extensionHost, file, virtualModule, renderedFunctionSignatures, evidence) {
    if (renderedFunctionSignatures.length === 0) {
        return;
    }
    const functionTypeNodes = [];
    collectProviderFunctionTypeNodes(file, functionTypeNodes);
    if (functionTypeNodes.length !== renderedFunctionSignatures.length) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' rendered ${renderedFunctionSignatures.length} provider function signatures but parsed ${functionTypeNodes.length} function-type declarations.`);
    }
    const declarationsById = new Map(virtualModule.declarationModel.exports.map((declaration) => [declaration.id, declaration]));
    const membersByDeclarationId = new Map();
    for (const declaration of virtualModule.declarationModel.exports) {
        const membersById = new Map();
        for (const member of declaration.members ?? []) {
            membersById.set(member.id, member);
        }
        if (membersById.size !== 0) {
            membersByDeclarationId.set(declaration.id, membersById);
        }
    }
    const usedMarkers = new Set();
    const sourceText = SourceFile_Text(file);
    const sourceTextByteLength = utf8.StringByteLen(sourceText);
    for (const node of functionTypeNodes) {
        const start = Node_Pos(node);
        if (start < 0 || start > sourceTextByteLength) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has an invalid function-type source position.`);
        }
        const marker = parseProviderFunctionSignatureMarker(utf8.StringByteSlice(sourceText, start, Math.min(sourceTextByteLength, start + providerFunctionSignatureMarkerMaximumLength)));
        if (marker === undefined || marker < 0 || marker >= renderedFunctionSignatures.length || usedMarkers.has(marker)) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has an invalid or duplicate function-signature marker.`);
        }
        usedMarkers.add(marker);
        const rendered = renderedFunctionSignatures[marker];
        if (rendered.marker !== marker) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has a non-canonical function-signature manifest marker '${marker}'.`);
        }
        const declaration = declarationsById.get(rendered.exportId);
        if (declaration === undefined) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has no declaration for rendered function export identity '${rendered.exportId}'.`);
        }
        const member = rendered.memberId === undefined
            ? undefined
            : membersByDeclarationId.get(rendered.exportId)?.get(rendered.memberId);
        if (rendered.memberId !== undefined && member === undefined) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has no member for rendered function member identity '${rendered.memberId}'.`);
        }
        extensionHost[extensionHostSetFact](node, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member, rendered.signatureId), evidence);
        recordProviderVirtualParameterFacts(extensionHost, node, rendered.parameters, evidence);
    }
    if (usedMarkers.size !== renderedFunctionSignatures.length) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' did not bind every rendered function-signature marker.`);
    }
}
function collectProviderFunctionTypeNodes(node, result) {
    if (node.Kind === KindFunctionType) {
        result.push(node);
    }
    Node_ForEachChild(node, (child) => {
        if (child !== undefined) {
            collectProviderFunctionTypeNodes(child, result);
        }
        return false;
    });
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
    const directExportDeclarations = (exportSymbol.Declarations ?? []).filter((node) => node !== undefined && providerExportDeclarationMatchesNode(declaration, node));
    if (directExportDeclarations.length === 0) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has no direct declaration for member-owning export identity '${declaration.id}'.`);
    }
    const memberNodes = directExportDeclarations.flatMap(getProviderMemberCandidateNodes);
    const usedMemberNodes = new Set();
    for (const member of declaration.members ?? []) {
        const matchingMemberNodes = memberNodes.filter((node) => node !== undefined
            && !usedMemberNodes.has(node)
            && providerMemberMatchesNode(member, node));
        const expectedNodeCount = providerMemberDeclarationCount(member);
        if (matchingMemberNodes.length !== expectedNodeCount) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' bound ${matchingMemberNodes.length} declarations for member identity '${member.id}', expected ${expectedNodeCount}.`);
        }
        const memberSymbol = findProviderMemberSymbol(matchingMemberNodes);
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
            const signature = member.signatures?.[index];
            extensionHost[extensionHostSetFact](memberNode, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member, signature), evidence);
            if (signature !== undefined) {
                recordProviderVirtualParameterFacts(extensionHost, memberNode, signature.parameters, evidence);
            }
            const nodeSymbol = Node_Symbol(memberNode);
            if (nodeSymbol !== undefined && nodeSymbol !== memberSymbol) {
                setProviderVirtualDeclarationSymbolFact(extensionHost, nodeSymbol, memberFact, evidence);
            }
        }
    }
    if (usedMemberNodes.size !== memberNodes.length) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' contains ${memberNodes.length - usedMemberNodes.size} unclaimed member declarations for export identity '${declaration.id}'.`);
    }
}
function providerExportDeclarationMatchesNode(declaration, node) {
    switch (declaration.kind) {
        case "class":
            return node.Kind === KindClassDeclaration;
        case "interface":
            return node.Kind === KindInterfaceDeclaration;
        case "function":
            return node.Kind === KindFunctionDeclaration;
        case "type":
            return node.Kind === KindTypeAliasDeclaration;
        case "value":
            return node.Kind === KindVariableDeclaration;
        case "namespace":
            return node.Kind === KindModuleDeclaration;
        case "enum":
            return node.Kind === KindEnumDeclaration;
    }
}
function providerMemberDeclarationCount(member) {
    switch (member.kind) {
        case "constructor":
        case "method":
        case "indexer":
            return member.signatures?.length ?? 0;
        case "property":
        case "field":
            return 1;
    }
}
function setProviderVirtualDeclarationSymbolFact(extensionHost, symbol, fact, evidence) {
    const existing = extensionHost.facts.get(symbol, providerVirtualDeclarationFactKey);
    if (existing !== undefined && !providerVirtualDeclarationFactKey.equals(existing, fact)) {
        throw new Error("A provider virtual symbol resolved to conflicting exact declaration identities.");
    }
    extensionHost[extensionHostSetFact](symbol, providerVirtualDeclarationFactKey, fact, evidence);
}
function findProviderMemberSymbol(matchingMemberNodes) {
    for (const node of matchingMemberNodes) {
        const symbol = Node_Symbol(node);
        if (symbol !== undefined) {
            return symbol;
        }
    }
    return undefined;
}
function providerMemberMatchesNode(member, node) {
    if (!providerMemberKindMatchesNode(member, node)) {
        return false;
    }
    if (member.kind !== "constructor" && member.kind !== "indexer" && !providerPropertyNameMatchesNode(member.name, Node_Name(node))) {
        return false;
    }
    if (((Node_ModifierFlags(node) & ModifierFlagsStatic) !== 0) !== (member.static === true)) {
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
    if (signatures.length === 0) {
        throw new Error(`Provider export identity '${declaration.id}' has no signatures to record.`);
    }
    const signatureDeclarations = (symbol.Declarations ?? []).filter((candidate) => candidate?.Kind === KindFunctionDeclaration);
    if (signatureDeclarations.length === 0) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' has no direct function declarations for export identity '${declaration.id}'.`);
    }
    if (signatureDeclarations.length !== signatures.length) {
        throw new Error(`Provider virtual artifact '${virtualModule.fileName}' bound ${signatureDeclarations.length} function declarations for export identity '${declaration.id}', expected ${signatures.length}.`);
    }
    for (let index = 0; index < signatures.length; index++) {
        const signatureDeclaration = signatureDeclarations[index];
        if (signatureDeclaration === undefined) {
            throw new Error(`Provider virtual artifact '${virtualModule.fileName}' lost function signature ${index} for export identity '${declaration.id}'.`);
        }
        extensionHost[extensionHostSetFact](signatureDeclaration, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration, member, signatures[index]), evidence);
        recordProviderVirtualParameterFacts(extensionHost, signatureDeclaration, signatures[index].parameters, evidence);
    }
}
function recordProviderVirtualParameterFacts(extensionHost, signatureDeclaration, parameters, evidence) {
    const parameterDeclarations = Node_Parameters(signatureDeclaration) ?? [];
    if (parameterDeclarations.length !== parameters.length) {
        throw new Error(`Provider virtual signature bound ${parameterDeclarations.length} parameter declarations, expected ${parameters.length}.`);
    }
    for (let index = 0; index < parameters.length; index++) {
        const mode = parameters[index]?.passingMode;
        if (mode === undefined) {
            continue;
        }
        const parameterDeclaration = parameterDeclarations[index];
        if (parameterDeclaration === undefined) {
            throw new Error(`Provider virtual signature lost parameter declaration ${index}.`);
        }
        const fact = { mode };
        extensionHost[extensionHostSetFact](parameterDeclaration, argumentPassingFactKey, fact, evidence);
        const parameterSymbol = Node_Symbol(parameterDeclaration);
        if (parameterSymbol !== undefined) {
            extensionHost[extensionHostSetFact](parameterSymbol, argumentPassingFactKey, fact, evidence);
        }
    }
}
function getSymbolFactId(symbol) {
    return `${symbol.Name}:${String(GetSymbolId(symbol))}`;
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
        ...(member !== undefined ? { memberStatic: member.static === true } : {}),
        ...(signature !== undefined ? { signatureId: typeof signature === "string" ? signature : signature.id } : {}),
    };
}
function getProviderTypeFamilyFact(virtualModule, family) {
    return {
        exportName: family.exportName,
        variants: family.variants
            .map((declaration) => ({
            sourceTypeArgumentCount: declaration.sourceTypeFamily.typeArgumentCount,
            declaration: getProviderVirtualDeclarationFact(virtualModule, declaration),
        }))
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
    return fileSymbol.Exports?.get(exportName);
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
//# sourceMappingURL=compiler-integration.js.map