import { selectSourceProviderSignature } from "../source-semantics/provider-signature.js";
import { aliasedSymbol, referenceDeclarationForMeaning, symbolAtReferenceNode } from "./navigation-references.js";
import { createSourceDeclarationSymbolQuery, sourceDeclaredValueType } from "./navigation-checker.js";
import { authoredSourceTypeFactDependencies } from "./semantics-authored-type-facts.js";
import { selectAuthoredSourceType } from "./semantics-authored-type-selection.js";
import { selectSourceCallResult } from "./semantics-call-result-selection.js";
import { selectSourceContextualType, selectSourceContextualValueType } from "./semantics-contextual-type-selection.js";
import { sourceSelectedFactSubjects, sourceTypeFactSubjects } from "./semantics-fact-subjects.js";
import { selectSourceCallableTypeEvidence } from "./semantics-callable-evidence.js";
import { getSourceTypeArgumentBindings } from "./semantics-type-arguments.js";
import { selectSourceTypeRefinement } from "./semantics-type-refinement.js";
import { sourceTypeRelationship } from "./semantics-type-relationship.js";
import { createSourceStructuralMemberQueries } from "./semantics-structural-members.js";
import { analyzeSourcePropertyNames } from "./semantics-property-names.js";
export function createSourceSemanticsInput(source, services) {
    const { navigation, enumConstants } = services;
    // One checked type identity per expression node for this program. The checker builds a new anonymous Type for an
    // object literal on every getTypeAtLocation call; every host-input consumer that keys or compares checked types by
    // identity (shape caches, member correspondence) needs the same Type object for the same node.
    const expressionTypes = new WeakMap();
    const sourceFileSet = new Set(source.sourceFiles.filter((file) => file !== undefined));
    const declarationSymbol = createSourceDeclarationSymbolQuery(source);
    const cache = new WeakMap();
    const providerSignatures = new WeakMap();
    const providerSignature = (declaration) => {
        if (declaration === undefined)
            return undefined;
        const existing = providerSignatures.get(declaration);
        if (existing !== undefined)
            return existing ?? undefined;
        const selected = selectSourceProviderSignature(source.sourceFacts, declaration);
        providerSignatures.set(declaration, selected ?? null);
        return selected;
    };
    function createFileView(sourceFile) {
        const queries = source.getSourceFileQueries(sourceFile);
        const operations = Object.freeze({
            call: queries.checker.getResolvedCallInfo,
            propertyName: queries.checker.getEffectivePropertyName,
            // The checker access record with the declarations of the one member-access witness (host-input/navigation.ts:
            // role-normalized, refined for a narrowed unselected read), so every host-input reader sees one answer (R2 #2).
            propertyAccess(node) {
                const checked = queries.checker.getResolvedPropertyAccessInfo(node);
                if (checked === undefined)
                    return undefined;
                const witness = navigation.memberAccess(node);
                if (witness === undefined)
                    throw new Error("A checked property access requires its member-access witness.");
                if (witness.declaration === checked.selectedDeclaration && witness.readDeclaration === checked.selectedReadDeclaration &&
                    witness.writeDeclaration === checked.selectedWriteDeclaration)
                    return checked;
                return Object.freeze({ ...checked,
                    ...(witness.declaration === undefined ? {} : { selectedDeclaration: witness.declaration }),
                    ...(witness.readDeclaration === undefined ? {} : { selectedReadDeclaration: witness.readDeclaration }),
                    ...(witness.writeDeclaration === undefined ? {} : { selectedWriteDeclaration: witness.writeDeclaration }) });
            },
            elementAccess: queries.checker.getResolvedElementAccessInfo,
            iteration: queries.checker.getResolvedIterationInfo,
            objectLiteralElement: queries.checker.getResolvedObjectLiteralElementInfo,
            storage: queries.checker.getResolvedStorageInfo,
            callableCompletion: queries.checker.getResolvedCallableCompletionInfo,
            generator: queries.checker.getResolvedGeneratorInfo,
            wellKnownSymbol: queries.checker.getResolvedWellKnownSymbolInfo,
            resourceManagement: queries.checker.getResolvedResourceManagementInfo,
            yield: queries.checker.getResolvedYieldInfo,
            callResult(call) {
                return selectSourceCallResult(source.ast, queries.checker, call, providerSignature);
            },
        });
        const declarations = Object.freeze({
            authoredTypeDeclaration(node) {
                const reference = source.ast.is.IsTypeReferenceNode(node) ? source.ast.as.AsTypeReferenceNode(node)?.TypeName
                    : source.ast.is.IsImportTypeNode(node) ? source.ast.as.AsImportTypeNode(node)?.Qualifier : undefined;
                const symbol = reference === undefined ? undefined : symbolAtReferenceNode(source.ast, queries.checker, reference);
                return referenceDeclarationForMeaning(source.ast, queries.checker, aliasedSymbol(source.ast, queries.checker, symbol) ?? symbol, "type");
            },
            isDefaultLibraryDeclaration: queries.checker.isDefaultLibraryDeclaration,
            declaredValueType(declaration) {
                return sourceDeclaredValueType(source.ast, queries.checker, selected => declarationSymbol(selected, sourceFile), declaration);
            },
            declaredType(declaration) {
                return queries.checker.getDeclaredTypeOfSymbol(declarationSymbol(declaration, sourceFile));
            },
            typeSymbol: queries.checker.getTypeSymbol,
            typeAliasSymbol: queries.checker.getTypeAliasSymbol,
            aliasedSymbol: queries.checker.getAliasedSymbol,
            symbolDeclarations(symbol) {
                return definedValues(queries.checker.getSymbolDeclarations(symbol));
            },
            primarySymbolDeclaration: queries.checker.getPrimarySymbolDeclaration,
            rootSymbols(symbol) {
                return definedValues(queries.checker.getRootSymbols(symbol));
            },
            declarationSignature: queries.checker.getSignatureFromDeclaration,
            signatureDeclaration: queries.checker.getSignatureDeclaration,
            signatureParameters(signature) {
                return definedValues(queries.checker.getSignatureParameters(signature));
            },
        });
        const facts = Object.freeze({
            authoredTypeSubjects(node) {
                return authoredSourceTypeFactDependencies(source.ast, navigation, source.sourceFacts, queries.checker, node);
            },
            selectedSubjects(symbol, declaration) {
                return sourceSelectedFactSubjects(queries.checker, symbol, declaration);
            },
            typeSubjects(type) {
                return sourceTypeFactSubjects(queries.checker, type);
            },
        });
        const types = Object.freeze({
            expressionType(node) {
                const known = expressionTypes.get(node);
                if (known !== undefined)
                    return known;
                const selected = queries.checker.getTypeAtLocation(node);
                if (selected !== undefined)
                    expressionTypes.set(node, selected);
                return selected;
            },
            authoredType: queries.checker.getTypeFromTypeNode,
            contextualType(node) {
                return selectSourceContextualType(source.ast, queries.checker, forFile(sourceFile), node);
            },
            typeArgumentBindings(type) {
                return getSourceTypeArgumentBindings(source.ast, queries, type);
            },
            instantiatedBaseTypes: queries.typeShape.getInstantiatedBaseTypes,
            instantiateAlias: queries.typeShape.instantiateTypeAlias,
            aliasApplication: queries.typeShape.getTypeAliasApplication,
            typeArguments(type) {
                return definedValues(queries.typeShape.getTypeArguments(type));
            },
            typeReferenceTarget: queries.typeShape.getTypeReferenceTarget,
            tupleElementTypes(type) {
                return definedValues(queries.typeShape.getTupleElementTypes(type));
            },
            tupleElementInfos: queries.typeShape.getTupleElementInfos,
            unionOrIntersectionTypes(type) {
                return definedValues(queries.typeShape.getUnionOrIntersectionTypes(type));
            },
            propertyInfos: queries.typeShape.getPropertyInfos,
            ...createSourceStructuralMemberQueries(source.ast, queries.checker, queries.typeShape),
            indexInfos: queries.typeShape.getIndexInfos,
            selectIndexedAccess: queries.typeShape.selectIndexedAccess,
            callSignatures(type) {
                return definedValues(queries.typeShape.getCallSignatures(type));
            },
            constructSignatures(type) {
                return definedValues(queries.typeShape.getConstructSignatures(type));
            },
            signatureInfos: queries.typeShape.getSignatureInfos,
            declarationSignatureInfo: queries.typeShape.getDeclarationSignatureInfo,
            literalBaseType: queries.typeShape.getBaseTypeOfLiteralType,
            nonNullableType: queries.typeShape.getNonNullableType,
            numericLiteralValue: queries.typeShape.getNumericLiteralTypeValue,
            stringLiteralValue: queries.typeShape.getStringLiteralTypeValue,
            booleanLiteralValue: queries.typeShape.getBooleanLiteralTypeValue,
            isAny: queries.typeShape.isAny,
            isUnknown: queries.typeShape.isUnknown,
            isNever: queries.typeShape.isNever,
            intrinsicNullishFlags: queries.typeShape.intrinsicNullishFlags,
            isNonPrimitive: queries.typeShape.isNonPrimitive,
            isVoidLike: queries.typeShape.isVoidLike,
            isNullish: queries.typeShape.isNullish,
            isStringLike: queries.typeShape.isStringLike,
            isNumberLike: queries.typeShape.isNumberLike,
            isBooleanLike: queries.typeShape.isBooleanLike,
            isBigIntLike: queries.typeShape.isBigIntLike,
            isSymbolLike: queries.typeShape.isSymbolLike,
            isUnion: queries.typeShape.isUnion,
            isIntersection: queries.typeShape.isIntersection,
            isTypeReference: queries.typeShape.isTypeReference,
            isTuple: queries.typeShape.isTuple,
            isArrayLike: queries.typeShape.isArrayLike,
            isIdentical: queries.typeShape.isTypeIdenticalTo,
            couldContainTypeVariables: queries.typeShape.couldContainTypeVariables,
            authoredSelection(authoredTypeNode, selectedType) {
                return selectAuthoredSourceType(source.ast, queries.typeShape, queries.checker, source.sourceFacts, authoredTypeNode, selectedType, forFile(sourceFile));
            },
            contextualValueSelection(node) {
                return selectSourceContextualValueType(source.ast, queries.typeShape, queries.checker, forFile(sourceFile), node);
            },
            refinement(declaredType, selectedType) {
                return selectSourceTypeRefinement(queries.typeShape, queries.checker, source.sourceFacts, declaredType, selectedType);
            },
            relationship(left, right) {
                return sourceTypeRelationship(queries.typeShape, queries.checker, source.sourceFacts, left, right);
            },
            callable(type) {
                return selectSourceCallableTypeEvidence(type, Object.freeze({ ...types, signatureDeclaration: declarations.signatureDeclaration }), source.ast);
            },
        });
        return Object.freeze({
            sourceFile,
            propertyNameOperations: Object.freeze({
                propertyName: queries.checker.getEffectivePropertyName,
                objectLiteralElement: queries.checker.getResolvedObjectLiteralElementInfo,
                propertyAccess: queries.checker.getResolvedPropertyAccessInfo,
                elementAccess: queries.checker.getResolvedElementAccessInfo,
                wellKnownSymbol: queries.checker.getResolvedWellKnownSymbolInfo,
                call: queries.checker.getResolvedCallInfo,
                callResult: operations.callResult,
            }),
            operations,
            types,
            declarations,
            facts,
        });
    }
    function publishFileViews(fileViews) {
        const propertyNames = analyzeSourcePropertyNames(source.ast, fileViews.map(view => ({
            sourceFile: view.sourceFile,
            semantics: { operations: view.propertyNameOperations, types: view.types, declarations: view.declarations },
        })), navigation, enumConstants);
        for (const [index, view] of fileViews.entries()) {
            cache.set(view.sourceFile, Object.freeze({ sourceFile: view.sourceFile,
                propertyNames: propertyNames[index].propertyNames, operations: view.operations,
                types: view.types, declarations: view.declarations, facts: view.facts }));
        }
    }
    publishFileViews([...sourceFileSet].map(createFileView));
    function forFile(sourceFile) {
        if (!source.containsSourceFile(sourceFile))
            throw new Error("Source semantics require an exact source file from the checked program.");
        if (!cache.has(sourceFile))
            publishFileViews([createFileView(sourceFile)]);
        return cache.get(sourceFile);
    }
    const forNode = (node) => {
        const sourceFile = source.ast.getSourceFile(node);
        if (sourceFile === undefined)
            throw new Error("Source semantics require every source node to belong to the checked program.");
        return forFile(sourceFile);
    };
    const selectValueTypeRefinement = (node) => {
        const reference = navigation.referenceFor(node);
        if (reference === undefined)
            return Object.freeze({ kind: "not-project-reference" });
        const selectedSemantics = forNode(node);
        const declaredType = selectedSemantics.declarations.declaredValueType(reference.declaration);
        if (declaredType === undefined)
            return Object.freeze({ kind: "unresolved", reference, missing: "declared-type" });
        const selectedType = selectedSemantics.types.expressionType(node);
        if (selectedType === undefined)
            return Object.freeze({ kind: "unresolved", reference, missing: "selected-type" });
        return Object.freeze({ kind: "resolved", reference, declaredType, selectedType,
            refinement: selectedSemantics.types.refinement(declaredType, selectedType) });
    };
    const semantics = Object.freeze({
        includes: (sourceFile) => sourceFileSet.has(sourceFile),
        forFile,
        forNode,
        selectValueTypeRefinement,
    });
    const flowConditionWitnesses = new WeakMap();
    return Object.freeze({
        semantics,
        propertyNames: (sourceFile) => forFile(sourceFile).propertyNames,
        flowConditions(reference) {
            const known = flowConditionWitnesses.get(reference);
            if (known !== undefined)
                return known ?? undefined;
            const checked = source.getSourceFileQueries(source.ast.getSourceFile(reference)).checker.getResolvedFlowConditionInfo(reference);
            const witness = checked === undefined || checked.reference !== reference ? undefined : Object.freeze({
                reference,
                conditions: Object.freeze(checked.conditions.map(condition => Object.freeze({
                    expression: condition.expression, assumed: condition.assumed,
                    assignments: Object.freeze([...condition.assignments]),
                }))),
            });
            flowConditionWitnesses.set(reference, witness ?? null);
            return witness;
        },
    });
}
function definedValues(values) {
    return Object.freeze(values.filter((value) => value !== undefined));
}
//# sourceMappingURL=semantics-program.js.map