import { Node_Arguments, Node_Expression, Node_Elements, Node_ImportClause, Node_Initializer, Node_ModuleSpecifier, Node_Parameters, Node_PropertyName, Node_Properties, SourceFile_Path, Node_Statements, Node_Symbol, Node_Text, Node_TypeArguments, Node_TypeParameters, } from "../internal/ast/ast.js";
import { Node_End, Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import { AsExportDeclaration, AsExportSpecifier, AsImportClause, AsNamespaceImport, AsPropertyAccessExpression, AsQualifiedName, AsTypeReferenceNode } from "../internal/ast/generated/casts.js";
import { KindArrayBindingPattern, KindCallExpression, KindExportDeclaration, KindExportSpecifier, KindIdentifier, KindImportDeclaration, KindImportSpecifier, KindNamedImports, KindNamedExports, KindNamespaceImport, KindNumericLiteral, KindObjectLiteralExpression, KindObjectBindingPattern, KindPropertyAccessExpression, KindPropertyAssignment, KindPropertyDeclaration, KindQualifiedName, KindStringLiteral, KindTypeKeyword, KindTypeReference, KindTupleType, KindVariableDeclaration, } from "../internal/ast/generated/kinds.js";
import { GetSourceFileOfNode, GetSymbolId, IsDeclarationName, IsFunctionLike, IsLeftHandSideExpression, IsRightSideOfQualifiedNameOrPropertyAccess, } from "../internal/ast/utilities.js";
import { argumentPassingFactKey, attributeFactKey, canonicalIdentityFactKey, defaultValueFactKey, fieldFactKey, flowStateFactKey, functionPointerFactKey, pointerFactKey, pointerOperationFactKey, rawPointerFactKey, rawPointerOperationFactKey, providerVirtualDeclarationFactKey, sourceMarkerFactKey, sourcePrimitiveFactKey, structFactKey, } from "./facts.js";
import { defineExtensionFactKey } from "./fact-key.js";
import { encodeIdentityTuple } from "./identity-tuple.js";
export const sourceSemanticsExtensionId = "tsts.source-semantics";
const selectedSourceMarkerDeclarationFactKey = defineExtensionFactKey({
    extensionId: sourceSemanticsExtensionId,
    name: "selectedSourceMarkerDeclaration",
    snapshot: (value) => Object.freeze({ ...value }),
    equals: (left, right) => left.kind === right.kind
        && left.exportName === right.exportName
        && left.marker === right.marker,
});
function createSourceSemanticsModules(modules) {
    return modules.map((module) => {
        const primitivesByExportName = new Map();
        const callMarkersByExportName = new Map();
        const typeMarkersByExportName = new Map();
        for (const exportDeclaration of module.exports) {
            switch (exportDeclaration.kind) {
                case "source-primitive":
                    primitivesByExportName.set(exportDeclaration.exportName, exportDeclaration);
                    break;
                case "call-marker":
                    callMarkersByExportName.set(exportDeclaration.exportName, exportDeclaration);
                    break;
                case "type-marker":
                    typeMarkersByExportName.set(exportDeclaration.exportName, exportDeclaration);
                    break;
            }
        }
        return {
            moduleSpecifier: module.moduleSpecifier,
            ...(module.packageName !== undefined ? { packageName: module.packageName } : {}),
            ...(module.packageVersion !== undefined ? { packageVersion: module.packageVersion } : {}),
            ...(module.subpath !== undefined ? { subpath: module.subpath } : {}),
            ...(module.capabilities !== undefined ? { capabilities: module.capabilities } : {}),
            primitivesByExportName,
            callMarkersByExportName,
            typeMarkersByExportName,
        };
    });
}
export function createSourceSemanticsExtension(options) {
    const modules = createSourceSemanticsModules(options.modules);
    return {
        identity: {
            id: sourceSemanticsExtensionId,
            version: "1.0.0",
        },
        initialize(context) {
            context.registerFactResolver(sourcePrimitiveFactKey, (subject, resolverContext) => resolveSourcePrimitiveFact(subject, resolverContext, modules));
        },
        analyzeSource(context) {
            const sourceFiles = context.source.getSourceFiles().filter((sourceFile) => sourceFile !== undefined);
            for (const sourceFile of sourceFiles) {
                recordConfiguredSourceSemanticsDeclarations(sourceFile, context.source.getSourceFileQueries(sourceFile).checker, context.facts, modules);
            }
            for (const sourceFile of sourceFiles) {
                recordSourceSemanticsMarkerAliases(context.facts, sourceFile, context.source.getSourceFileQueries(sourceFile).checker);
            }
            for (const sourceFile of sourceFiles) {
                recordSourceSemanticsFacts(sourceFile, context.source.getSourceFileQueries(sourceFile).checker, context.facts, context.diagnostics, sourceSemanticsExtensionId, modules);
            }
        },
    };
}
function recordConfiguredSourceSemanticsDeclarations(sourceFile, checker, facts, modules) {
    for (const statement of Node_Statements(sourceFile) ?? []) {
        if (statement?.Kind === KindImportDeclaration) {
            const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
            if (moduleIdentity !== undefined) {
                recordSourceSemanticsImportClause(facts, checker, statement, moduleIdentity);
            }
            continue;
        }
        if (statement?.Kind === KindExportDeclaration) {
            const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
            if (moduleIdentity !== undefined) {
                recordSourceSemanticsExportClause(facts, checker, statement, moduleIdentity);
            }
        }
    }
}
function recordSourceSemanticsMarkerAliases(facts, sourceFile, checker) {
    visitSourceSemanticsNodePost(sourceFile, (node) => {
        if (node === undefined ||
            (node.Kind !== KindImportSpecifier && node.Kind !== KindExportSpecifier)) {
            return;
        }
        const localSymbol = Node_Symbol(node);
        if (localSymbol === undefined) {
            return;
        }
        const selectedSymbol = checker.getAliasedSymbol(localSymbol);
        if (selectedSymbol === undefined) {
            return;
        }
        const marker = facts.get(selectedSymbol, selectedSourceMarkerDeclarationFactKey);
        if (marker === undefined) {
            return;
        }
        const markerFact = marker.kind === "call-marker"
            ? { kind: marker.kind, marker: marker.marker }
            : { kind: marker.kind, marker: marker.marker };
        const evidence = createMarkerEvidence(marker.exportName);
        facts.set(node, selectedSourceMarkerDeclarationFactKey, marker, evidence);
        facts.set(node, sourceMarkerFactKey, markerFact, evidence);
        facts.set(localSymbol, selectedSourceMarkerDeclarationFactKey, marker, evidence);
        facts.set(localSymbol, sourceMarkerFactKey, markerFact, evidence);
    });
}
function recordSourceSemanticsFacts(sourceFile, checker, facts, diagnostics, extensionId, modules) {
    const markerImportIndex = createSourceSemanticsMarkerImportIndex(sourceFile, modules);
    recordSourceSemanticsMarkerReferences(facts, sourceFile, checker, modules);
    recordSourceSemanticsCallMarkers(facts, diagnostics, extensionId, sourceFile, checker, modules);
    recordSourceSemanticsTypeReferences(facts, sourceFile, modules, markerImportIndex);
}
function recordSourceSemanticsImportClause(facts, checker, importDeclaration, moduleIdentity) {
    const importClause = Node_ImportClause(importDeclaration);
    if (importClause === undefined) {
        return;
    }
    const typedImport = AsImportClause(importClause).PhaseModifier === KindTypeKeyword;
    const namedBindings = AsImportClause(importClause).NamedBindings;
    if (namedBindings === undefined) {
        return;
    }
    if (namedBindings.Kind === KindNamespaceImport) {
        recordNamespaceImportIdentity(facts, namedBindings, moduleIdentity, typedImport);
        return;
    }
    if (namedBindings.Kind !== KindNamedImports) {
        return;
    }
    for (const importSpecifier of Node_Elements(namedBindings) ?? []) {
        if (importSpecifier === undefined) {
            continue;
        }
        const localName = Node_Name(importSpecifier);
        if (localName === undefined) {
            continue;
        }
        const exportName = Node_Text(Node_PropertyName(importSpecifier) ?? localName);
        const primitiveFact = moduleIdentity.primitivesByExportName.get(exportName);
        if (primitiveFact !== undefined) {
            recordSourcePrimitiveImport(facts, importSpecifier, moduleIdentity, exportName, primitiveFact, typedImport);
            continue;
        }
        const callMarker = moduleIdentity.callMarkersByExportName.get(exportName);
        if (callMarker !== undefined) {
            recordSourceSemanticsMarkerImport(facts, checker, importSpecifier, moduleIdentity, exportName, typedImport ? "type" : "value", callMarker);
            continue;
        }
        const typeMarker = moduleIdentity.typeMarkersByExportName.get(exportName);
        if (typeMarker !== undefined) {
            recordSourceSemanticsMarkerImport(facts, checker, importSpecifier, moduleIdentity, exportName, typedImport ? "type" : "value", typeMarker);
        }
    }
}
function recordSourceSemanticsExportClause(facts, checker, exportDeclaration, moduleIdentity) {
    const exportClause = AsExportDeclaration(exportDeclaration).ExportClause;
    if (exportClause === undefined || exportClause.Kind !== KindNamedExports) {
        return;
    }
    const declarationIsTypeOnly = AsExportDeclaration(exportDeclaration).IsTypeOnly;
    for (const exportSpecifier of Node_Elements(exportClause) ?? []) {
        if (exportSpecifier === undefined) {
            continue;
        }
        const exportedName = Node_Name(exportSpecifier);
        if (exportedName === undefined) {
            continue;
        }
        const sourceName = Node_Text(Node_PropertyName(exportSpecifier) ?? exportedName);
        const primitiveFact = moduleIdentity.primitivesByExportName.get(sourceName);
        if (primitiveFact !== undefined) {
            const specifierIsTypeOnly = AsExportSpecifier(exportSpecifier).IsTypeOnly;
            recordSourcePrimitiveImport(facts, exportSpecifier, moduleIdentity, sourceName, primitiveFact, declarationIsTypeOnly || specifierIsTypeOnly);
            continue;
        }
        const specifierIsTypeOnly = AsExportSpecifier(exportSpecifier).IsTypeOnly;
        const callMarker = moduleIdentity.callMarkersByExportName.get(sourceName);
        if (callMarker !== undefined) {
            recordSourceSemanticsMarkerImport(facts, checker, exportSpecifier, moduleIdentity, sourceName, declarationIsTypeOnly || specifierIsTypeOnly ? "type" : "value", callMarker);
            continue;
        }
        const typeMarker = moduleIdentity.typeMarkersByExportName.get(sourceName);
        if (typeMarker !== undefined) {
            recordSourceSemanticsMarkerImport(facts, checker, exportSpecifier, moduleIdentity, sourceName, declarationIsTypeOnly || specifierIsTypeOnly ? "type" : "value", typeMarker);
        }
    }
}
function recordSourceSemanticsMarkerReferences(facts, sourceFile, checker, modules) {
    visitSourceSemanticsNodePost(sourceFile, (node) => {
        if (node === undefined ||
            (node.Kind !== KindIdentifier &&
                node.Kind !== KindPropertyAccessExpression &&
                node.Kind !== KindQualifiedName) ||
            IsDeclarationName(node) ||
            IsRightSideOfQualifiedNameOrPropertyAccess(node)) {
            return;
        }
        const callMarker = resolveMarkerFromCheckedReference(facts, checker, node, modules, "call-marker");
        const marker = callMarker ?? resolveMarkerFromCheckedReference(facts, checker, node, modules, "type-marker");
        if (marker === undefined) {
            return;
        }
        const fact = marker.kind === "call-marker"
            ? { kind: marker.kind, marker: marker.marker }
            : { kind: marker.kind, marker: marker.marker };
        facts.set(node, selectedSourceMarkerDeclarationFactKey, marker, createMarkerEvidence(marker.exportName));
        facts.set(node, sourceMarkerFactKey, fact, createMarkerEvidence(marker.exportName));
    });
}
function recordSourceSemanticsCallMarkers(facts, diagnostics, extensionId, sourceFile, checker, modules) {
    visitSourceSemanticsNodePost(sourceFile, (node) => {
        if (node?.Kind !== KindCallExpression) {
            return;
        }
        const callInfo = checker.getResolvedCallInfo(node);
        const marker = resolveSelectedSourceSemanticsCallMarker(facts, callInfo, modules);
        if (marker === undefined || callInfo === undefined) {
            return;
        }
        recordSourceSemanticsCallMarker(facts, diagnostics, extensionId, checker, node, callInfo, marker);
    });
}
function recordSourceSemanticsCallMarker(facts, diagnostics, extensionId, checker, callExpression, callInfo, marker) {
    const evidence = createMarkerEvidence(marker.exportName);
    switch (marker.marker) {
        case "write-only-reference":
        case "read-write-reference":
        case "read-only-reference": {
            if (!hasMarkerArgumentCount(callExpression, 1)) {
                return;
            }
            const argument = (Node_Arguments(callExpression) ?? [])[0];
            if (argument === undefined) {
                return;
            }
            recordArgumentPassingMarker(facts, diagnostics, extensionId, callExpression, argument, marker, evidence);
            return;
        }
        case "shared-borrow": {
            if (!hasMarkerArgumentCount(callExpression, 1)) {
                return;
            }
            const argument = (Node_Arguments(callExpression) ?? [])[0];
            if (argument === undefined) {
                return;
            }
            recordFlowMarker(facts, callExpression, argument, { state: "borrowed-shared" }, evidence);
            return;
        }
        case "mutable-borrow": {
            if (!hasMarkerArgumentCount(callExpression, 1)) {
                return;
            }
            const argument = (Node_Arguments(callExpression) ?? [])[0];
            if (argument === undefined) {
                return;
            }
            recordFlowMarker(facts, callExpression, argument, { state: "borrowed-mut" }, evidence);
            return;
        }
        case "move": {
            if (!hasMarkerArgumentCount(callExpression, 1)) {
                return;
            }
            const argument = (Node_Arguments(callExpression) ?? [])[0];
            if (argument === undefined) {
                return;
            }
            recordFlowMarker(facts, callExpression, argument, { state: "moved" }, evidence);
            return;
        }
        case "field":
            if (!hasMarkerArgumentCount(callExpression, 0) || !hasMarkerTypeArgumentCount(callExpression, 1)) {
                return;
            }
            recordFieldMarker(facts, callExpression, evidence);
            return;
        case "struct":
            if (!hasMarkerArgumentCount(callExpression, 1)) {
                return;
            }
            recordStructMarker(facts, callExpression, evidence);
            return;
        case "attribute":
            if (!hasMarkerTypeArgumentCount(callExpression, 1)) {
                return;
            }
            recordAttributeMarker(facts, callExpression, evidence);
            return;
        case "default-value":
            if (!hasMarkerArgumentCount(callExpression, 0) || !hasMarkerTypeArgumentCount(callExpression, 1)) {
                return;
            }
            recordDefaultValueMarker(facts, callExpression, evidence);
            return;
        case "address-of":
        case "allocate":
        case "load":
        case "store":
        case "equal-pointer":
        case "hash-pointer":
        case "bind-pointer":
        case "project-pointer":
            recordPointerOperation(facts, diagnostics, extensionId, checker, callExpression, callInfo, marker, evidence);
            return;
        case "bind-raw-pointer":
        case "equal-raw-pointer":
        case "hash-raw-pointer":
            recordRawPointerOperation(facts, callExpression, callInfo, marker, evidence);
            return;
    }
}
function hasMarkerArgumentCount(callExpression, count) {
    return (Node_Arguments(callExpression) ?? []).length === count;
}
function hasMarkerTypeArgumentCount(callExpression, count) {
    return (Node_TypeArguments(callExpression) ?? []).length === count;
}
function recordPointerOperation(facts, diagnostics, extensionId, checker, callExpression, callInfo, marker, evidence) {
    if (callInfo.sourceSelectedSignatureKind !== "resolved") {
        return;
    }
    const selectedTypeArguments = callInfo.sourceSelectedMethodTypeArguments ?? [];
    const expectedTypeArgumentCount = marker.marker === "project-pointer" ? 2 : 1;
    const pointeeIndex = marker.marker === "project-pointer" ? 1 : 0;
    const pointeeType = selectedTypeArguments.length === expectedTypeArgumentCount
        ? selectedTypeArguments[pointeeIndex]?.selectedType
        : undefined;
    const explicitPointeeTypeNode = selectedTypeArguments.length === expectedTypeArgumentCount
        ? selectedTypeArguments[pointeeIndex]?.explicitTypeNode
        : undefined;
    if (pointeeType === undefined) {
        diagnostics.append({
            extensionId,
            extensionCode: "SOURCE_SEMANTICS_POINTER_TYPE_EVIDENCE_MISSING",
            numericCode: 9901103,
            publicCode: "TSTS_SOURCE_SEMANTICS_0003",
            category: "error",
            message: `${marker.exportName}(...) requires ${expectedTypeArgumentCount} exact selected pointer type argument${expectedTypeArgumentCount === 1 ? "" : "s"}.`,
            nodeOrSpan: callExpression,
            evidence,
            identity: sourceSemanticsDiagnosticIdentity("pointer-type", marker.exportName, callExpression),
        });
        return;
    }
    switch (marker.marker) {
        case "address-of": {
            const storageArgument = exactSourceCallArgument(callInfo, 0, 1);
            if (storageArgument === undefined) {
                return;
            }
            const storage = checker.getResolvedStorageInfo(storageArgument.expression);
            if (storage === undefined || !storage.writable) {
                diagnostics.append({
                    extensionId,
                    extensionCode: "SOURCE_SEMANTICS_WRITABLE_STORAGE_REQUIRED",
                    numericCode: 9901102,
                    publicCode: "TSTS_SOURCE_SEMANTICS_0002",
                    category: "error",
                    message: `${marker.exportName}(...) requires writable storage.`,
                    nodeOrSpan: storageArgument.expression,
                    evidence,
                    identity: sourceSemanticsDiagnosticIdentity("writable-storage", marker.exportName, callExpression),
                });
                return;
            }
            const fact = {
                operation: "address-of",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                storageExpression: storage.storageExpression,
                storageType: storage.type,
                ...(storage.symbol === undefined ? {} : { storageSymbol: storage.symbol }),
                ...(storage.declaration === undefined
                    ? {}
                    : { storageDeclaration: storage.declaration }),
                locationIdentity: storage.storageExpression,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "allocate": {
            const initial = exactSourceCallArgument(callInfo, 0, 1);
            if (initial === undefined) {
                return;
            }
            const fact = {
                operation: "allocate",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                initialExpression: initial.expression,
                initialType: initial.type,
                locationIdentity: callExpression,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "load": {
            const pointer = exactSourceCallArgument(callInfo, 0, 1);
            if (pointer === undefined) {
                return;
            }
            const fact = {
                operation: "load",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                pointerExpression: pointer.expression,
                pointerType: pointer.type,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "store": {
            const pointer = exactSourceCallArgument(callInfo, 0, 2);
            const value = exactSourceCallArgument(callInfo, 1, 2);
            if (pointer === undefined || value === undefined) {
                return;
            }
            const fact = {
                operation: "store",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                pointerExpression: pointer.expression,
                pointerType: pointer.type,
                valueExpression: value.expression,
                valueType: value.type,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "equal-pointer": {
            const left = exactSourceCallArgument(callInfo, 0, 2);
            const right = exactSourceCallArgument(callInfo, 1, 2);
            if (left === undefined || right === undefined) {
                return;
            }
            const fact = {
                operation: "equal-pointer",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                leftExpression: left.expression,
                leftType: left.type,
                rightExpression: right.expression,
                rightType: right.type,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "hash-pointer": {
            const pointer = exactSourceCallArgument(callInfo, 0, 1);
            if (pointer === undefined) {
                return;
            }
            const fact = {
                operation: "hash-pointer",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                pointerExpression: pointer.expression,
                pointerType: pointer.type,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "bind-pointer": {
            const identity = exactSourceCallArgument(callInfo, 0, 3);
            const read = exactSourceCallArgument(callInfo, 1, 3);
            const write = exactSourceCallArgument(callInfo, 2, 3);
            if (identity === undefined || read === undefined || write === undefined) {
                return;
            }
            const fact = {
                operation: "bind-pointer",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                identityExpression: identity.expression,
                identityType: identity.type,
                readExpression: read.expression,
                readType: read.type,
                writeExpression: write.expression,
                writeType: write.type,
                locationIdentity: identity.expression,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        case "project-pointer": {
            const pointer = exactSourceCallArgument(callInfo, 0, 3);
            const fromSource = exactSourceCallArgument(callInfo, 1, 3);
            const toSource = exactSourceCallArgument(callInfo, 2, 3);
            const sourceTypeArgument = selectedTypeArguments[0];
            if (pointer === undefined ||
                fromSource === undefined ||
                toSource === undefined ||
                sourceTypeArgument?.selectedType === undefined) {
                return;
            }
            const fact = {
                operation: "project-pointer",
                call: callExpression,
                pointeeType,
                ...(explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode }),
                resultType: callInfo.sourceResultType,
                sourcePointeeType: sourceTypeArgument.selectedType,
                ...(sourceTypeArgument.explicitTypeNode === undefined
                    ? {}
                    : { explicitSourcePointeeTypeNode: sourceTypeArgument.explicitTypeNode }),
                pointerExpression: pointer.expression,
                pointerType: pointer.type,
                fromSourceExpression: fromSource.expression,
                fromSourceType: fromSource.type,
                toSourceExpression: toSource.expression,
                toSourceType: toSource.type,
            };
            facts.set(callExpression, pointerOperationFactKey, fact, evidence);
            return;
        }
        default:
            return;
    }
}
function exactSourceCallArgument(callInfo, index, expectedCount) {
    return callInfo.sourceArguments.length === expectedCount
        ? callInfo.sourceArguments[index]
        : undefined;
}
function recordRawPointerOperation(facts, callExpression, callInfo, marker, evidence) {
    if (callInfo.sourceSelectedSignatureKind !== "resolved") {
        return;
    }
    switch (marker.marker) {
        case "bind-raw-pointer": {
            const identity = exactSourceCallArgument(callInfo, 0, 1);
            if (identity === undefined) {
                return;
            }
            facts.set(callExpression, rawPointerOperationFactKey, {
                operation: marker.marker,
                call: callExpression,
                resultType: callInfo.sourceResultType,
                identityExpression: identity.expression,
                identityType: identity.type,
            }, evidence);
            return;
        }
        case "equal-raw-pointer": {
            const left = exactSourceCallArgument(callInfo, 0, 2);
            const right = exactSourceCallArgument(callInfo, 1, 2);
            if (left === undefined || right === undefined) {
                return;
            }
            facts.set(callExpression, rawPointerOperationFactKey, {
                operation: marker.marker,
                call: callExpression,
                resultType: callInfo.sourceResultType,
                leftExpression: left.expression,
                leftType: left.type,
                rightExpression: right.expression,
                rightType: right.type,
            }, evidence);
            return;
        }
        case "hash-raw-pointer": {
            const pointer = exactSourceCallArgument(callInfo, 0, 1);
            if (pointer === undefined) {
                return;
            }
            facts.set(callExpression, rawPointerOperationFactKey, {
                operation: marker.marker,
                call: callExpression,
                resultType: callInfo.sourceResultType,
                pointerExpression: pointer.expression,
                pointerType: pointer.type,
            }, evidence);
            return;
        }
        default:
            return;
    }
}
function recordArgumentPassingMarker(facts, diagnostics, extensionId, callExpression, target, marker, evidence) {
    const fact = {
        mode: getArgumentPassingMode(marker.marker),
        storageExpression: target,
    };
    facts.set(callExpression, argumentPassingFactKey, fact, evidence);
    if (IsLeftHandSideExpression(target)) {
        facts.set(target, argumentPassingFactKey, fact, evidence);
        return;
    }
    diagnostics.append({
        extensionId,
        extensionCode: "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
        numericCode: 9901101,
        publicCode: "TSTS_SOURCE_SEMANTICS_0001",
        category: "error",
        message: `${marker.exportName}(...) requires a storage expression.`,
        nodeOrSpan: target,
        evidence,
        identity: sourceSemanticsDiagnosticIdentity("non-storage", marker.exportName, target),
    });
}
function sourceSemanticsDiagnosticIdentity(diagnostic, exportName, node) {
    const sourceFile = GetSourceFileOfNode(node);
    return encodeIdentityTuple([
        "source-semantics",
        diagnostic,
        exportName,
        sourceFile === undefined ? undefined : SourceFile_Path(sourceFile),
        Node_Pos(node),
        Node_End(node),
    ]);
}
function getArgumentPassingMode(kind) {
    switch (kind) {
        case "write-only-reference":
            return "byref-writeonly-must-init";
        case "read-write-reference":
            return "byref-readwrite";
        case "read-only-reference":
            return "byref-readonly";
    }
}
function recordFieldMarker(facts, callExpression, evidence) {
    const fieldType = (Node_TypeArguments(callExpression) ?? [])[0];
    if (fieldType === undefined) {
        return;
    }
    const fieldOwner = callExpression?.Parent;
    if (fieldOwner === undefined ||
        (fieldOwner.Kind !== KindPropertyAssignment &&
            fieldOwner.Kind !== KindPropertyDeclaration) ||
        Node_Initializer(fieldOwner) !== callExpression) {
        return;
    }
    const nameNode = Node_Name(fieldOwner) ?? Node_PropertyName(fieldOwner);
    const name = getStaticSourceSemanticsNameText(nameNode);
    if (name === undefined) {
        return;
    }
    const fact = {
        name,
        type: fieldType,
    };
    facts.set(callExpression, fieldFactKey, fact, evidence);
    facts.set(fieldOwner, fieldFactKey, fact, evidence);
    if (nameNode !== undefined) {
        facts.set(nameNode, fieldFactKey, fact, evidence);
    }
}
function recordStructMarker(facts, callExpression, evidence) {
    const shape = (Node_Arguments(callExpression) ?? [])[0];
    const fields = [];
    if (shape?.Kind === KindObjectLiteralExpression) {
        for (const property of Node_Properties(shape) ?? []) {
            if (property?.Kind !== KindPropertyAssignment) {
                continue;
            }
            const initializer = Node_Initializer(property);
            const field = facts.get(property, fieldFactKey) ?? (initializer === undefined ? undefined : facts.get(initializer, fieldFactKey));
            if (field !== undefined) {
                fields.push(field);
            }
        }
    }
    const fact = {
        valueType: true,
        fields,
    };
    facts.set(callExpression, structFactKey, fact, evidence);
    recordInitializerOwnerFact(facts, callExpression, structFactKey, fact, evidence);
}
function recordAttributeMarker(facts, callExpression, evidence) {
    const target = (Node_TypeArguments(callExpression) ?? [])[0];
    if (target === undefined) {
        return;
    }
    const fact = {
        target,
        attributeName: getTypeReferenceNameText(target),
        arguments: definedNodes(Node_Arguments(callExpression) ?? []),
    };
    facts.set(callExpression, attributeFactKey, fact, evidence);
    recordInitializerOwnerFact(facts, callExpression, attributeFactKey, fact, evidence);
}
function recordDefaultValueMarker(facts, callExpression, evidence) {
    const type = (Node_TypeArguments(callExpression) ?? [])[0];
    if (type === undefined) {
        return;
    }
    const fact = { type };
    facts.set(callExpression, defaultValueFactKey, fact, evidence);
    recordInitializerOwnerFact(facts, callExpression, defaultValueFactKey, fact, evidence);
}
function recordInitializerOwnerFact(facts, callExpression, key, fact, evidence) {
    const parent = callExpression?.Parent;
    if (parent === undefined || !isInitializerOwner(parent) || Node_Initializer(parent) !== callExpression) {
        return;
    }
    facts.set(parent, key, fact, evidence);
    const symbol = Node_Symbol(parent);
    if (symbol !== undefined) {
        facts.set(symbol, key, fact, evidence);
    }
}
function isInitializerOwner(node) {
    return node?.Kind === KindVariableDeclaration || node?.Kind === KindPropertyDeclaration || node?.Kind === KindPropertyAssignment;
}
function recordFlowMarker(facts, callExpression, target, fact, evidence) {
    facts.set(callExpression, flowStateFactKey, fact, evidence);
    facts.set(target, flowStateFactKey, fact, evidence);
    const symbol = Node_Symbol(target);
    if (symbol !== undefined) {
        facts.set(symbol, flowStateFactKey, fact, evidence);
    }
}
function resolveSourcePrimitiveFact(subject, context, modules) {
    if (subject === null || subject === undefined || typeof subject !== "object") {
        return undefined;
    }
    const node = subject;
    if (node?.Kind !== KindTypeReference) {
        return undefined;
    }
    const typeName = AsTypeReferenceNode(node)?.TypeName;
    const primitive = resolvePrimitiveTypeReference(context.facts, typeName, modules);
    if (primitive === undefined) {
        return undefined;
    }
    return {
        value: stripExportName(primitive.primitiveFact),
        evidence: createPrimitiveEvidence(primitive.moduleIdentity, primitive.exportName),
    };
}
function recordSourceSemanticsTypeReferences(facts, sourceFile, modules, markerImportIndex) {
    visitSourceSemanticsNode(sourceFile, (node) => {
        if (node?.Kind !== KindTypeReference) {
            return;
        }
        const typeName = AsTypeReferenceNode(node).TypeName;
        if (typeName === undefined) {
            return;
        }
        const marker = resolveSourceSemanticsTypeMarkerReference(facts, typeName, modules, markerImportIndex);
        if (marker !== undefined) {
            recordSourceSemanticsTypeMarker(facts, node, typeName, marker);
        }
        const primitive = resolvePrimitiveTypeReference(facts, typeName, modules, markerImportIndex);
        if (primitive === undefined) {
            return;
        }
        const evidence = createPrimitiveEvidence(primitive.moduleIdentity, primitive.exportName);
        facts.set(node, canonicalIdentityFactKey, primitive.identity, evidence);
        facts.set(node, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
        facts.set(typeName, canonicalIdentityFactKey, primitive.identity, evidence);
        facts.set(typeName, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
        if (typeName.Kind === KindQualifiedName) {
            const right = AsQualifiedName(typeName).Right;
            if (right === undefined) {
                return;
            }
            facts.set(right, canonicalIdentityFactKey, primitive.identity, evidence);
            facts.set(right, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
        }
    });
}
function recordSourceSemanticsTypeMarker(facts, typeReference, typeName, marker) {
    const typeArguments = Node_TypeArguments(typeReference) ?? [];
    const evidence = createMarkerEvidence(marker.exportName);
    if (marker.marker === "raw-pointer") {
        if (typeArguments.length !== 0) {
            return;
        }
        const fact = { representation: "opaque-identity" };
        facts.set(typeReference, rawPointerFactKey, fact, evidence);
        facts.set(typeName, rawPointerFactKey, fact, evidence);
        return;
    }
    if (marker.marker === "pointer") {
        if (typeArguments.length !== 1) {
            return;
        }
        const pointee = typeArguments[0];
        if (pointee === undefined) {
            return;
        }
        const fact = {
            pointee,
            mutability: "readwrite",
        };
        facts.set(typeReference, pointerFactKey, fact, evidence);
        facts.set(typeName, pointerFactKey, fact, evidence);
        return;
    }
    if (typeArguments.length !== 2) {
        return;
    }
    const result = typeArguments[1];
    if (result === undefined) {
        return;
    }
    const parameters = getFunctionPointerParameters(typeArguments[0]);
    const fact = {
        parameters,
        result,
        abi: ["target-default"],
    };
    facts.set(typeReference, functionPointerFactKey, fact, evidence);
    facts.set(typeName, functionPointerFactKey, fact, evidence);
}
function getFunctionPointerParameters(parameterList) {
    if (parameterList === undefined) {
        return [];
    }
    if (parameterList.Kind === KindTupleType) {
        return definedNodes(Node_Elements(parameterList) ?? []);
    }
    return [parameterList];
}
function resolveSelectedSourceSemanticsCallMarker(facts, callInfo, modules) {
    if (callInfo === undefined) {
        return undefined;
    }
    const callee = callInfo.sourceCallee;
    for (const subject of [
        callee.selectedDeclaration,
        callee.declaration,
    ]) {
        const marker = resolveCallMarkerFromSelectedSubject(facts, subject, modules);
        if (marker !== undefined) {
            return marker;
        }
    }
    for (const symbol of [callee.selectedSymbol, callee.symbol]) {
        const marker = resolveCallMarkerFromSelectedSubject(facts, symbol, modules)
            ?? resolveCallMarkerFromSelectedSymbol(facts, symbol, modules);
        if (marker !== undefined) {
            return marker;
        }
    }
    const access = callInfo.sourceCalleeAccess;
    if (access === undefined) {
        return undefined;
    }
    const receiverIdentity = access.receiver.symbol === undefined
        ? undefined
        : facts.get(access.receiver.symbol, canonicalIdentityFactKey);
    if (receiverIdentity?.kind === "module" && access.selectedSymbol !== undefined) {
        return getModuleCallMarker(modules, receiverIdentity.id, access.selectedSymbol.Name);
    }
    return undefined;
}
function resolveCallMarkerFromSelectedSubject(facts, subject, modules) {
    return resolveMarkerFromSelectedSubject(facts, subject, modules, "call-marker");
}
function resolveMarkerFromCheckedReference(facts, checker, node, modules, capability) {
    const localSymbol = checker.getSymbolAtLocation(node);
    const direct = resolveMarkerFromSelectedSubject(facts, localSymbol, modules, capability);
    if (direct !== undefined) {
        return direct;
    }
    const receiver = node.Kind === KindPropertyAccessExpression
        ? AsPropertyAccessExpression(node)?.Expression
        : node.Kind === KindQualifiedName
            ? AsQualifiedName(node)?.Left
            : undefined;
    if (receiver !== undefined) {
        const receiverSymbol = checker.getSymbolAtLocation(receiver);
        const receiverIdentity = receiverSymbol === undefined
            ? undefined
            : facts.get(receiverSymbol, canonicalIdentityFactKey);
        const selectedSymbol = checker.getResolvedSymbolOrNil(node);
        if (receiverIdentity?.kind === "module" &&
            selectedSymbol !== undefined) {
            const module = modules.find((candidate) => candidate.moduleSpecifier === receiverIdentity.id);
            const selected = getModuleMarker(module, capability, checker.getSymbolName(selectedSymbol));
            if (selected !== undefined) {
                return selected;
            }
        }
    }
    return resolveMarkerFromSelectedSymbol(facts, checker.getResolvedSymbolOrNil(node), modules, capability);
}
function resolveMarkerFromSelectedSubject(facts, subject, modules, capability) {
    if (subject === undefined) {
        return undefined;
    }
    const selectedMarker = facts.get(subject, selectedSourceMarkerDeclarationFactKey);
    if (selectedMarker?.kind === capability) {
        return selectedMarker;
    }
    const providerDeclaration = facts.get(subject, providerVirtualDeclarationFactKey);
    if (providerDeclaration?.exportName !== undefined) {
        const module = modules.find((candidate) => candidate.moduleSpecifier === providerDeclaration.moduleSpecifier);
        return getModuleMarker(module, capability, providerDeclaration.exportName);
    }
    const identity = facts.get(subject, canonicalIdentityFactKey);
    if (identity?.kind === "export" && identity.exportName !== undefined) {
        const module = modules.find((candidate) => identity.id === `${candidate.moduleSpecifier}::${identity.exportName}`);
        return getModuleMarker(module, capability, identity.exportName);
    }
    return undefined;
}
function resolveCallMarkerFromSelectedSymbol(facts, symbol, modules) {
    return resolveMarkerFromSelectedSymbol(facts, symbol, modules, "call-marker");
}
function resolveTypeMarkerFromSelectedSymbol(facts, symbol, modules) {
    return resolveMarkerFromSelectedSymbol(facts, symbol, modules, "type-marker");
}
function resolveMarkerFromSelectedSymbol(facts, symbol, modules, capability) {
    const direct = resolveMarkerFromSelectedSubject(facts, symbol, modules, capability);
    if (direct !== undefined) {
        return direct;
    }
    const parentIdentity = symbol?.Parent === undefined
        ? undefined
        : facts.get(symbol.Parent, canonicalIdentityFactKey);
    if (parentIdentity?.kind !== "module" || symbol === undefined) {
        return undefined;
    }
    const module = modules.find((candidate) => candidate.moduleSpecifier === parentIdentity.id);
    return getModuleMarker(module, capability, symbol.Name);
}
function getModuleCallMarker(modules, moduleSpecifier, exportName) {
    return modules.find((candidate) => candidate.moduleSpecifier === moduleSpecifier)
        ?.callMarkersByExportName.get(exportName);
}
function resolveSourceSemanticsTypeMarkerReference(facts, node, modules, markerImportIndex) {
    return resolveSourceSemanticsTypeMarkerFromImportIndex(node, markerImportIndex.typeMarkersByLocalName, markerImportIndex.namespacesByLocalName) ?? resolveSourceSemanticsTypeMarkerReferenceFromFacts(facts, node, modules);
}
function resolveSourceSemanticsTypeMarkerFromImportIndex(node, markersByLocalName, namespacesByLocalName) {
    if (node === undefined) {
        return undefined;
    }
    if (node.Kind === KindPropertyAccessExpression) {
        const receiver = AsPropertyAccessExpression(node)?.Expression;
        const receiverName = getIdentifierText(receiver);
        if (receiverName === undefined) {
            return undefined;
        }
        const namespaceBinding = namespacesByLocalName.get(receiverName);
        if (namespaceBinding === undefined || isImportBindingShadowed(receiver, receiverName)) {
            return undefined;
        }
        const propertyName = getStaticSourceSemanticsNameText(Node_Name(node));
        if (propertyName === undefined) {
            return undefined;
        }
        return namespaceBinding.moduleIdentity.typeMarkersByExportName.get(propertyName);
    }
    if (node.Kind === KindQualifiedName) {
        const qualifiedName = AsQualifiedName(node);
        const leftName = getIdentifierText(qualifiedName?.Left);
        if (leftName === undefined) {
            return undefined;
        }
        const namespaceBinding = namespacesByLocalName.get(leftName);
        if (namespaceBinding === undefined || isImportBindingShadowed(qualifiedName?.Left, leftName)) {
            return undefined;
        }
        const exportName = getIdentifierText(qualifiedName?.Right);
        if (exportName === undefined) {
            return undefined;
        }
        return namespaceBinding.moduleIdentity.typeMarkersByExportName.get(exportName);
    }
    const localName = getIdentifierText(node);
    if (localName === undefined) {
        return undefined;
    }
    const binding = markersByLocalName.get(localName);
    return binding !== undefined && !isImportBindingShadowed(node, localName) ? binding.marker : undefined;
}
function resolveSourceSemanticsTypeMarkerReferenceFromFacts(facts, node, modules) {
    if (node === undefined) {
        return undefined;
    }
    const selected = facts.get(node, selectedSourceMarkerDeclarationFactKey)
        ?? facts.get(Node_Symbol(node), selectedSourceMarkerDeclarationFactKey);
    if (selected?.kind === "type-marker") {
        return selected;
    }
    if (node.Kind === KindPropertyAccessExpression) {
        const propertyName = Node_Text(Node_Name(node));
        const receiverSymbol = Node_Symbol(AsPropertyAccessExpression(node)?.Expression);
        const receiverIdentity = receiverSymbol === undefined ? undefined : facts.get(receiverSymbol, canonicalIdentityFactKey);
        if (receiverIdentity?.kind !== "module") {
            return undefined;
        }
        const module = modules.find((candidate) => candidate.moduleSpecifier === receiverIdentity.id);
        return module?.typeMarkersByExportName.get(propertyName);
    }
    if (node.Kind === KindQualifiedName) {
        const qualifiedName = AsQualifiedName(node);
        const exportName = Node_Text(qualifiedName?.Right);
        const leftSymbol = Node_Symbol(qualifiedName?.Left);
        const leftIdentity = leftSymbol === undefined ? undefined : facts.get(leftSymbol, canonicalIdentityFactKey);
        if (leftIdentity?.kind !== "module") {
            return undefined;
        }
        const module = modules.find((candidate) => candidate.moduleSpecifier === leftIdentity.id);
        return module?.typeMarkersByExportName.get(exportName);
    }
    const symbol = Node_Symbol(node);
    const identity = symbol === undefined ? undefined : facts.get(symbol, canonicalIdentityFactKey);
    if (identity?.exportName === undefined) {
        return undefined;
    }
    const module = modules.find((candidate) => identity.id === `${candidate.moduleSpecifier}::${identity.exportName}`);
    return module?.typeMarkersByExportName.get(identity.exportName);
}
function createSourceSemanticsMarkerImportIndex(sourceFile, modules) {
    const primitivesByLocalName = new Map();
    const typeMarkersByLocalName = new Map();
    const namespacesByLocalName = new Map();
    for (const statement of Node_Statements(sourceFile) ?? []) {
        if (statement?.Kind !== KindImportDeclaration) {
            continue;
        }
        const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
        if (moduleIdentity === undefined) {
            continue;
        }
        const namedBindings = AsImportClause(Node_ImportClause(statement))?.NamedBindings;
        if (namedBindings === undefined) {
            continue;
        }
        if (namedBindings.Kind === KindNamespaceImport) {
            const namespaceNameNode = Node_Name(namedBindings);
            const namespaceName = Node_Text(namespaceNameNode);
            if (namespaceName !== "") {
                namespacesByLocalName.set(namespaceName, {
                    localName: namespaceName,
                    moduleIdentity,
                });
            }
            continue;
        }
        if (namedBindings.Kind !== KindNamedImports) {
            continue;
        }
        for (const importSpecifier of Node_Elements(namedBindings) ?? []) {
            const localNameNode = Node_Name(importSpecifier);
            const localName = Node_Text(localNameNode);
            const exportName = Node_Text(Node_PropertyName(importSpecifier) ?? localNameNode);
            const primitive = moduleIdentity.primitivesByExportName.get(exportName);
            if (primitive !== undefined) {
                primitivesByLocalName.set(localName, {
                    moduleIdentity,
                    localName,
                    exportName,
                    primitiveFact: primitive,
                });
            }
            const typeMarker = moduleIdentity.typeMarkersByExportName.get(exportName);
            if (typeMarker !== undefined) {
                typeMarkersByLocalName.set(localName, {
                    localName,
                    marker: typeMarker,
                });
            }
        }
    }
    return { primitivesByLocalName, typeMarkersByLocalName, namespacesByLocalName };
}
function resolvePrimitiveTypeReference(facts, typeName, modules, importIndex) {
    if (typeName === undefined) {
        return undefined;
    }
    if (typeName.Kind === KindQualifiedName) {
        return resolveQualifiedPrimitiveFromImportIndex(typeName, importIndex)
            ?? resolveQualifiedPrimitiveReference(facts, typeName, modules);
    }
    const indexedPrimitive = resolvePrimitiveFromImportIndex(typeName, importIndex);
    if (indexedPrimitive !== undefined) {
        return indexedPrimitive;
    }
    const typeNameSymbol = Node_Symbol(typeName);
    if (typeNameSymbol === undefined) {
        return undefined;
    }
    const primitiveFact = facts.get(typeNameSymbol, sourcePrimitiveFactKey);
    const identity = facts.get(typeNameSymbol, canonicalIdentityFactKey);
    if (primitiveFact === undefined || identity === undefined || identity.exportName === undefined) {
        return undefined;
    }
    const moduleIdentity = modules.find((candidate) => identity.id === `${candidate.moduleSpecifier}::${identity.exportName}`);
    if (moduleIdentity === undefined) {
        return undefined;
    }
    const declaration = moduleIdentity.primitivesByExportName.get(identity.exportName);
    if (declaration === undefined) {
        return undefined;
    }
    return { moduleIdentity, exportName: identity.exportName, primitiveFact: declaration, identity };
}
function resolvePrimitiveFromImportIndex(typeName, importIndex) {
    if (typeName === undefined || importIndex === undefined) {
        return undefined;
    }
    const binding = importIndex.primitivesByLocalName.get(Node_Text(typeName));
    if (binding === undefined || isImportBindingShadowed(typeName, binding.localName)) {
        return undefined;
    }
    const symbol = Node_Symbol(typeName);
    return {
        ...binding,
        identity: createExportIdentity(binding.moduleIdentity, binding.exportName, "type", symbol === undefined ? `${binding.moduleIdentity.moduleSpecifier}::${binding.exportName}` : getSymbolFactId(symbol)),
    };
}
function resolveQualifiedPrimitiveFromImportIndex(typeName, importIndex) {
    if (typeName === undefined || importIndex === undefined) {
        return undefined;
    }
    const qualifiedName = AsQualifiedName(typeName);
    const leftName = Node_Text(qualifiedName?.Left);
    const namespaceBinding = importIndex.namespacesByLocalName.get(leftName);
    if (namespaceBinding === undefined || isImportBindingShadowed(qualifiedName?.Left, leftName)) {
        return undefined;
    }
    const right = qualifiedName.Right;
    const exportName = Node_Text(right);
    const primitiveFact = namespaceBinding.moduleIdentity.primitivesByExportName.get(exportName);
    if (primitiveFact === undefined) {
        return undefined;
    }
    const symbol = Node_Symbol(right);
    return {
        moduleIdentity: namespaceBinding.moduleIdentity,
        exportName,
        primitiveFact,
        identity: createExportIdentity(namespaceBinding.moduleIdentity, exportName, "type", symbol === undefined ? `${namespaceBinding.moduleIdentity.moduleSpecifier}::${exportName}` : getSymbolFactId(symbol)),
    };
}
function isImportBindingShadowed(node, localName) {
    if (node === undefined || localName === "") {
        return false;
    }
    let current = node.Parent;
    while (current !== undefined) {
        if (IsFunctionLike(current)) {
            if (declarationListContainsName(Node_Parameters(current), localName) || declarationListContainsName(Node_TypeParameters(current) ?? [], localName)) {
                return true;
            }
        }
        current = current.Parent;
    }
    return false;
}
function declarationListContainsName(declarations, localName) {
    return declarations.some((declaration) => bindingNameContainsName(Node_Name(declaration), localName));
}
function bindingNameContainsName(name, localName) {
    if (name === undefined) {
        return false;
    }
    if (name.Kind === KindIdentifier) {
        return Node_Text(name) === localName;
    }
    if (name.Kind !== KindArrayBindingPattern && name.Kind !== KindObjectBindingPattern) {
        return false;
    }
    return (Node_Elements(name) ?? []).some((element) => bindingNameContainsName(Node_Name(element), localName));
}
function getIdentifierText(node) {
    return node?.Kind === KindIdentifier ? Node_Text(node) : undefined;
}
function getStaticSourceSemanticsNameText(node) {
    switch (node?.Kind) {
        case KindIdentifier:
        case KindStringLiteral:
        case KindNumericLiteral:
            return Node_Text(node);
        default:
            return undefined;
    }
}
function resolveQualifiedPrimitiveReference(facts, typeName, modules) {
    const qualifiedName = AsQualifiedName(typeName);
    const leftSymbol = Node_Symbol(qualifiedName?.Left);
    if (leftSymbol === undefined) {
        return undefined;
    }
    const moduleIdentityFact = facts.get(leftSymbol, canonicalIdentityFactKey);
    if (moduleIdentityFact?.kind !== "module") {
        return undefined;
    }
    const moduleIdentity = modules.find((candidate) => candidate.moduleSpecifier === moduleIdentityFact.id);
    if (moduleIdentity === undefined) {
        return undefined;
    }
    const right = qualifiedName.Right;
    const exportName = Node_Text(right);
    const primitiveFact = moduleIdentity.primitivesByExportName.get(exportName);
    if (primitiveFact === undefined) {
        return undefined;
    }
    const rightSymbol = Node_Symbol(right);
    const identity = createExportIdentity(moduleIdentity, exportName, "type", rightSymbol === undefined ? `${moduleIdentity.moduleSpecifier}::${exportName}` : getSymbolFactId(rightSymbol));
    return { moduleIdentity, exportName, primitiveFact, identity };
}
function visitSourceSemanticsNode(node, visit) {
    if (node === undefined) {
        return;
    }
    visit(node);
    Node_ForEachChild(node, (child) => {
        visitSourceSemanticsNode(child, visit);
        return false;
    });
}
function visitSourceSemanticsNodePost(node, visit) {
    if (node === undefined) {
        return;
    }
    Node_ForEachChild(node, (child) => {
        visitSourceSemanticsNodePost(child, visit);
        return false;
    });
    visit(node);
}
function definedNodes(subjects) {
    return subjects.filter((subject) => subject !== undefined);
}
function recordNamespaceImportIdentity(facts, namespaceImport, moduleIdentity, typedImport) {
    const namespaceSymbol = Node_Symbol(namespaceImport);
    if (namespaceSymbol === undefined) {
        return;
    }
    facts.set(namespaceImport, canonicalIdentityFactKey, createModuleIdentity(moduleIdentity, "namespace", getSymbolFactId(namespaceSymbol)), createModuleEvidence(moduleIdentity));
    facts.set(namespaceSymbol, canonicalIdentityFactKey, createModuleIdentity(moduleIdentity, typedImport ? "type" : "namespace", getSymbolFactId(namespaceSymbol)), createModuleEvidence(moduleIdentity));
}
function getSourceSemanticsModuleIdentity(node, modules) {
    const moduleSpecifier = Node_ModuleSpecifier(node);
    return moduleSpecifier === undefined
        ? undefined
        : modules.find((candidate) => candidate.moduleSpecifier === Node_Text(moduleSpecifier));
}
function recordSourcePrimitiveImport(facts, importSpecifier, moduleIdentity, exportName, primitiveFact, typedImport) {
    const localSymbol = Node_Symbol(importSpecifier);
    if (localSymbol === undefined) {
        return;
    }
    const identity = createExportIdentity(moduleIdentity, exportName, typedImport ? "type" : "value", getSymbolFactId(localSymbol));
    const evidence = createPrimitiveEvidence(moduleIdentity, exportName);
    facts.set(importSpecifier, canonicalIdentityFactKey, identity, evidence);
    facts.set(importSpecifier, sourcePrimitiveFactKey, stripExportName(primitiveFact), evidence);
    facts.set(localSymbol, canonicalIdentityFactKey, identity, evidence);
    facts.set(localSymbol, sourcePrimitiveFactKey, stripExportName(primitiveFact), evidence);
}
function recordSourceSemanticsSymbolImport(facts, importSpecifier, moduleIdentity, exportName, importKind) {
    const localSymbol = Node_Symbol(importSpecifier);
    if (localSymbol === undefined) {
        return;
    }
    const identity = createExportIdentity(moduleIdentity, exportName, importKind, getSymbolFactId(localSymbol));
    facts.set(importSpecifier, canonicalIdentityFactKey, identity, createModuleEvidence(moduleIdentity));
    facts.set(localSymbol, canonicalIdentityFactKey, identity, createModuleEvidence(moduleIdentity));
}
function recordSourceSemanticsMarkerImport(facts, checker, importSpecifier, moduleIdentity, exportName, importKind, marker) {
    recordSourceSemanticsSymbolImport(facts, importSpecifier, moduleIdentity, exportName, importKind);
    const localSymbol = Node_Symbol(importSpecifier);
    if (localSymbol === undefined) {
        return;
    }
    const fact = marker.kind === "call-marker"
        ? { kind: marker.kind, marker: marker.marker }
        : { kind: marker.kind, marker: marker.marker };
    const evidence = createMarkerEvidence(exportName);
    facts.set(importSpecifier, selectedSourceMarkerDeclarationFactKey, marker, evidence);
    facts.set(importSpecifier, sourceMarkerFactKey, fact, evidence);
    facts.set(localSymbol, selectedSourceMarkerDeclarationFactKey, marker, evidence);
    facts.set(localSymbol, sourceMarkerFactKey, fact, evidence);
    const selectedSymbol = checker.getAliasedSymbol(localSymbol);
    if (selectedSymbol !== undefined && selectedSymbol !== localSymbol) {
        facts.set(selectedSymbol, selectedSourceMarkerDeclarationFactKey, marker, evidence);
        facts.set(selectedSymbol, sourceMarkerFactKey, fact, evidence);
    }
}
function createModuleIdentity(moduleIdentity, importKind, canonicalSymbolId) {
    return {
        kind: "module",
        id: moduleIdentity.moduleSpecifier,
        ...(moduleIdentity.packageName !== undefined ? { packageName: moduleIdentity.packageName } : {}),
        ...(moduleIdentity.packageVersion !== undefined ? { packageVersion: moduleIdentity.packageVersion } : {}),
        subpath: moduleIdentity.subpath ?? moduleIdentity.moduleSpecifier,
        importKind,
        canonicalSymbolId,
    };
}
function createExportIdentity(moduleIdentity, exportName, importKind, canonicalSymbolId) {
    return {
        kind: "export",
        id: `${moduleIdentity.moduleSpecifier}::${exportName}`,
        ...(moduleIdentity.packageName !== undefined ? { packageName: moduleIdentity.packageName } : {}),
        ...(moduleIdentity.packageVersion !== undefined ? { packageVersion: moduleIdentity.packageVersion } : {}),
        subpath: moduleIdentity.subpath ?? moduleIdentity.moduleSpecifier,
        exportName,
        importKind,
        canonicalSymbolId,
    };
}
function createPrimitiveEvidence(moduleIdentity, exportName) {
    return [{
            message: "source primitive import",
            details: {
                moduleSpecifier: moduleIdentity.moduleSpecifier,
                exportName,
            },
        }];
}
function createModuleEvidence(moduleIdentity) {
    return [{
            message: "source semantics module import",
            details: {
                moduleSpecifier: moduleIdentity.moduleSpecifier,
            },
        }];
}
function createMarkerEvidence(exportName) {
    return [{
            message: "source semantics marker",
            details: { exportName },
        }];
}
function getTypeReferenceNameText(node) {
    if (node?.Kind === KindTypeReference) {
        return getTypeReferenceNameText(AsTypeReferenceNode(node)?.TypeName);
    }
    if (node?.Kind === KindQualifiedName) {
        const qualifiedName = AsQualifiedName(node);
        const left = getTypeReferenceNameText(qualifiedName?.Left);
        const right = getTypeReferenceNameText(qualifiedName?.Right);
        return left === "" ? right : `${left}.${right}`;
    }
    return Node_Text(node);
}
function getModuleMarker(moduleIdentity, capability, exportName) {
    if (moduleIdentity === undefined) {
        return undefined;
    }
    switch (capability) {
        case "call-marker":
            return moduleIdentity.callMarkersByExportName.get(exportName);
        case "type-marker":
            return moduleIdentity.typeMarkersByExportName.get(exportName);
        case "primitive":
            return undefined;
    }
}
function stripExportName(declaration) {
    return {
        kind: declaration.primitive,
        runtimeBase: declaration.runtimeBase,
        ...(declaration.signed !== undefined ? { signed: declaration.signed } : {}),
        ...(declaration.width !== undefined ? { width: declaration.width } : {}),
    };
}
export function sourcePrimitive(exportName, primitiveKind, runtimeBase, signed, width) {
    return {
        kind: "source-primitive",
        exportName,
        primitive: primitiveKind,
        runtimeBase,
        ...(signed !== undefined ? { signed } : {}),
        ...(width !== undefined ? { width } : {}),
    };
}
function getSymbolFactId(symbol) {
    return `${symbol.Name}:${String(GetSymbolId(symbol))}`;
}
//# sourceMappingURL=source-semantics.js.map