import { Node_Arguments, Node_Expression, Node_Text, Node_Type, Node_TypeArguments } from "../internal/ast/ast.js";
import { Node_ForEachChild, Node_Name } from "../internal/ast/spine.js";
import { IsCallOrNewExpression, IsFunctionLike, SkipParentheses } from "../internal/ast/utilities.js";
import { AsElementAccessExpression, AsForInOrOfStatement } from "../internal/ast/generated/casts.js";
import { IsNewExpression, IsParenthesizedExpression, IsSpreadElement } from "../internal/ast/generated/predicates.js";
import { NodeFlagsOptionalChain } from "../internal/ast/generated/flags.js";
import { TokenToString } from "../internal/scanner/scanner.js";
import { signatureHasRestParameter } from "../internal/checker/checker/state.js";
import { Type_Flags, Type_Id, Type_Symbol, TypeFlagsUniqueESSymbol } from "../internal/checker/types.js";
import { LinkStore_Get } from "../internal/core/linkstore.js";
import { Checker_getMinArgumentCount } from "../internal/checker/relater.js";
import { Checker_getTypeOfParameter } from "../internal/checker/checker/signatures.js";
import { Checker_getDeclarationOfAliasSymbol, Checker_getResolvedSymbolOrNil } from "../internal/checker/checker/symbols.js";
import { ExtensionObservationPoint } from "./observations.js";
import { argumentPassingFactKey, contextualTargetTypeFactKey, flowStateFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitiveFactKey, targetBindingFactKey, targetCallArgumentConversionFactKey, targetCallArgumentPassingFactKey, targetConversionFactKey, targetOperationFactKey } from "./facts.js";
import { extensionHostGetCheckedOperationReference, extensionHostGetCheckedOperationRequest, extensionHostHasCheckedOperationOwner, extensionHostRunCheckedOperation, getExtensionHost } from "./host.js";
import { recordProviderTypeFamilyReferenceFacts } from "./compiler-integration.js";
import { createCheckedOperationRequestSnapshotCache, snapshotSelectedTargetSignatureFact, snapshotTargetOperationFact } from "./checked-operation-value-snapshot.js";
import { substituteTargetParameter } from "./target-type-ref-substitution.js";
import { CheckedOperationReferenceIndex, } from "./checked-operation-finalization.js";
const checkedOperationApplied = Object.freeze({ kind: "applied" });
const checkedOperationUnavailable = Object.freeze({ kind: "unavailable" });
export function hasExtensionCheckedOperationHost(checker, observation) {
    return getCheckedOperationExtensionHost(checker, observation) !== undefined;
}
function getCheckedOperationExtensionHost(checker, observation) {
    if (checker === undefined) {
        return undefined;
    }
    const extensionHost = getExtensionHost(checker.program);
    return extensionHost?.[extensionHostHasCheckedOperationOwner](observation) === true ? extensionHost : undefined;
}
function retainCheckedCallSelectionSeed(checker, callExpression, incoming) {
    const links = LinkStore_Get(checker.signatureLinks, callExpression);
    const existing = links.checkedCallSelectionSeed;
    const calleeProvenance = mergeCheckedCallSourceSelectionProvenance(existing?.calleeProvenance, incoming.calleeProvenance);
    const receiver = mergeResolvedCallSourceValueEvidence(existing?.receiver, incoming.receiver);
    const inputOperationSubjects = mergeCheckedCallInputOperationSubjects(existing?.inputOperationSubjects, incoming.inputOperationSubjects);
    const seed = Object.freeze({
        ...(calleeProvenance === undefined ? {} : { calleeProvenance }),
        ...(receiver === undefined ? {} : { receiver }),
        ...(inputOperationSubjects === undefined ? {} : { inputOperationSubjects }),
    });
    links.checkedCallSelectionSeed = seed;
    return seed;
}
function mergeCheckedCallSourceSelectionProvenance(existing, incoming) {
    if (existing === undefined) {
        return incoming === undefined ? undefined : Object.freeze({ ...incoming });
    }
    if (incoming === undefined) {
        return existing;
    }
    return Object.freeze({
        ...mergeCheckedCallProvenanceFields(existing, incoming, "callee"),
    });
}
function mergeResolvedCallSourceValueEvidence(existing, incoming) {
    if (existing === undefined) {
        return incoming === undefined ? undefined : Object.freeze({ ...incoming });
    }
    if (incoming === undefined) {
        return existing;
    }
    if (existing.expression !== incoming.expression || existing.type !== incoming.type) {
        throw new Error("Checked call receiver evidence conflicted before resolved-signature finalization.");
    }
    return Object.freeze({
        expression: existing.expression,
        type: existing.type,
        ...mergeCheckedCallProvenanceFields(existing, incoming, "receiver"),
    });
}
function mergeCheckedCallProvenanceFields(existing, incoming, subject) {
    const symbol = mergeCheckedCallIdentity(existing.symbol, incoming.symbol, subject, "symbol");
    const declaration = mergeCheckedCallIdentity(existing.declaration, incoming.declaration, subject, "declaration");
    const selectedSymbol = mergeCheckedCallIdentity(existing.selectedSymbol, incoming.selectedSymbol, subject, "selectedSymbol");
    const selectedDeclaration = mergeCheckedCallIdentity(existing.selectedDeclaration, incoming.selectedDeclaration, subject, "selectedDeclaration");
    const authoredTypeNode = mergeCheckedCallIdentity(existing.authoredTypeNode, incoming.authoredTypeNode, subject, "authoredTypeNode");
    return Object.freeze({
        ...(symbol === undefined ? {} : { symbol }),
        ...(declaration === undefined ? {} : { declaration }),
        ...(selectedSymbol === undefined ? {} : { selectedSymbol }),
        ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    });
}
function mergeCheckedCallIdentity(existing, incoming, subject, field) {
    if (existing !== undefined && incoming !== undefined && existing !== incoming) {
        throw new Error(`Checked call ${subject} ${field} conflicted before resolved-signature finalization.`);
    }
    return existing ?? incoming;
}
function mergeCheckedCallInputOperationSubjects(existing, incoming) {
    if (existing === undefined) {
        return incoming === undefined ? undefined : Object.freeze([...incoming]);
    }
    if (incoming === undefined) {
        return existing;
    }
    const merged = [...existing];
    for (const subject of incoming) {
        if (!merged.includes(subject)) {
            merged.push(subject);
        }
    }
    return Object.freeze(merged);
}
export function retainExtensionCheckedIdentifierCalleeSelection(checker, identifier, sourceSymbol, sourceSelectedSymbol) {
    if (checker === undefined || identifier === undefined) {
        return;
    }
    const callExpression = checkedCallForCallee(identifier);
    if (callExpression === undefined) {
        return;
    }
    const extensionHost = getCheckedOperationExtensionHost(checker, ExtensionObservationPoint.mapCheckedCall);
    const callee = Node_Expression(callExpression);
    if (extensionHost === undefined || callee === undefined) {
        return;
    }
    const canonicalSourceSymbol = selectedSourceSymbol(checker, sourceSymbol);
    const canonicalSelectedSymbol = selectedSourceSymbol(checker, sourceSelectedSymbol);
    const sourceDeclaration = canonicalSourceSymbol === undefined
        ? undefined
        : Checker_getDeclarationOfAliasSymbol(checker, canonicalSourceSymbol) ?? symbolValueDeclaration(canonicalSourceSymbol);
    const sourceSelectedDeclaration = symbolValueDeclaration(canonicalSelectedSymbol);
    const authoredTypeNode = sourceSelectedDeclaration === undefined
        ? sourceDeclaration === undefined ? undefined : Node_Type(sourceDeclaration)
        : Node_Type(sourceSelectedDeclaration);
    retainCheckedCallSelectionSeed(checker, callExpression, {
        calleeProvenance: Object.freeze({
            ...(canonicalSourceSymbol === undefined ? {} : { symbol: canonicalSourceSymbol }),
            ...(sourceDeclaration === undefined ? {} : { declaration: sourceDeclaration }),
            ...(canonicalSelectedSymbol === undefined ? {} : { selectedSymbol: canonicalSelectedSymbol }),
            ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
            ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        }),
    });
}
export function recordExtensionCheckedCallMapping(checker, callExpression, resolvedCallEvidence) {
    if (checker === undefined || callExpression === undefined) {
        return;
    }
    const extensionHost = getCheckedOperationExtensionHost(checker, ExtensionObservationPoint.mapCheckedCall);
    if (extensionHost === undefined) {
        return;
    }
    const callee = Node_Expression(callExpression);
    if (callee === undefined) {
        return;
    }
    const arguments_ = Node_Arguments(callExpression) ?? [];
    const sourceSelectedSignature = resolvedCallEvidence.selectedSignature;
    const selectedSourceCallee = resolvedCallEvidence.sourceCallee;
    const selectedSourceArguments = resolvedCallEvidence.sourceArguments;
    const selectedSourceArgumentBindings = resolvedCallEvidence.sourceArgumentBindings;
    if (resolvedCallEvidence.call !== callExpression
        || (resolvedCallEvidence.outcome !== "applicable" && resolvedCallEvidence.outcome !== "untyped")
        || resolvedCallEvidence.sourceResultType === undefined
        || sourceSelectedSignature === undefined) {
        throw new Error("Checked call mapping requires complete exact callee, signature, argument, topology, and result evidence from source checking.");
    }
    if (arguments_.some((argument) => argument === undefined)) {
        throw new Error("Checked call mapping encountered an absent authored argument node.");
    }
    if (selectedSourceArguments.length !== arguments_.length
        || selectedSourceArguments.some((evidence, index) => evidence.expression !== arguments_[index])) {
        throw new Error("Checked call mapping requires one exact selected source evidence record for every authored argument.");
    }
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedCall, callExpression);
    const dependencies = collectResolvedCallDependencies(extensionHost, resolvedCallEvidence);
    const sourceSelectedMethodTypeArguments = preserveEquivalentSelectedMethodTypeArguments(retainedRequest?.sourceSelectedMethodTypeArguments, getSourceSelectedMethodTypeArguments(callExpression, sourceSelectedSignature));
    const sourceSelectedSignatureParameters = preserveEquivalentSelectedSignatureParameters(retainedRequest?.sourceSelectedSignatureParameters, getSourceSelectedSignatureParameters(checker, sourceSelectedSignature));
    const sourceSelectedSignatureKind = getSourceSelectedSignatureKind(checker, sourceSelectedSignature);
    const sourceArgumentBindings = preserveEquivalentSelectedCallArgumentBindings(retainedRequest?.sourceArgumentBindings, selectedSourceArgumentBindings);
    const sourceResultType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceResult.type, resolvedCallEvidence.sourceResultType);
    const sourceCalleeType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceCallee.type, selectedSourceCallee.type);
    const sourceArgumentTypes = selectedSourceArguments.map((evidence, index) => preserveEquivalentCheckedSourceType(retainedRequest?.sourceArguments[index]?.type, evidence.type));
    if (sourceResultType === undefined || sourceCalleeType === undefined || sourceArgumentTypes.some((type) => type === undefined)) {
        throw new Error("Checked call mapping lost exact selected source value evidence.");
    }
    const sourceReceiver = resolvedCallEvidence.sourceReceiver === undefined
        ? undefined
        : selectedSourceValueEvidence(resolvedCallEvidence.sourceReceiver.expression, resolvedCallEvidence.sourceReceiver.type, selectedSourceEvidenceProvenance(resolvedCallEvidence.sourceReceiver));
    const sourceCallee = selectedSourceValueEvidence(callee, sourceCalleeType, selectedSourceEvidenceProvenance(selectedSourceCallee));
    const sourceArguments = selectedSourceArguments.map((evidence, index) => selectedSourceValueEvidence(arguments_[index], sourceArgumentTypes[index], selectedSourceEvidenceProvenance(evidence)));
    const sourceResult = selectedSourceValueEvidence(callExpression, sourceResultType);
    const request = {
        call: callExpression,
        callee,
        arguments: definedFactSubjects(arguments_),
        callKind: checkedCallKind(callExpression),
        ...(sourceSelectedSignature !== undefined ? { sourceSelectedSignature } : {}),
        ...(sourceSelectedSignature?.declaration !== undefined ? { sourceSelectedDeclaration: sourceSelectedSignature.declaration } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(sourceSelectedSignatureParameters !== undefined ? { sourceSelectedSignatureParameters } : {}),
        ...(sourceSelectedSignatureKind !== undefined ? { sourceSelectedSignatureKind } : {}),
        ...(sourceArgumentBindings === undefined ? {} : { sourceArgumentBindings }),
        sourceCallee,
        sourceArguments,
        sourceResult,
        ...(((callExpression.Flags ?? 0) & NodeFlagsOptionalChain) !== 0 ? { optionalChain: true } : {}),
        ...(sourceReceiver === undefined ? {} : { sourceReceiver }),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    };
    let retainedTargetApplication;
    extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedCall, request, () => {
        throw new Error("Extension-owned checked call mapping unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        if (value.kind === "source") {
            return;
        }
        const finalizedCall = acceptedRequest.call;
        if (retainedTargetApplication === undefined) {
            const finalizedArguments = acceptedRequest.arguments;
            const finalizedSourceProvenance = selectedSourceCallProvenanceFromRequest(acceptedRequest);
            const snapshotCache = createCheckedOperationRequestSnapshotCache();
            const selectedSignature = withSelectedTargetSignatureProvenance(value, finalizedSourceProvenance, snapshotCache);
            retainedTargetApplication = Object.freeze({
                result: value,
                selectedSignature,
                argumentSlots: selectTargetArgumentConversionSlots(selectedSignature, finalizedArguments),
                snapshotCache,
            });
        }
        else if (retainedTargetApplication.result !== value) {
            throw new Error("A retained checked call changed its accepted target mapping result during application replay.");
        }
        const { selectedSignature, argumentSlots, snapshotCache } = retainedTargetApplication;
        const conversionOutcome = recordExtensionCallArgumentConversions(extensionHost, finalizedCall, selectedSignature, argumentSlots, snapshotCache);
        if (conversionOutcome.kind !== "applied") {
            return conversionOutcome;
        }
        const writeResult = extensionHost.facts.set(finalizedCall, selectedTargetSignatureFactKey, selectedSignature, evidence);
        if (writeResult !== "inserted" && writeResult !== "idempotent") {
            throw new Error(`Cannot publish selected target signature '${selectedSignature.member.id}': ${writeResult}.`);
        }
        recordExtensionCallParameterModes(extensionHost, finalizedCall, selectedSignature, argumentSlots, evidence);
        return checkedOperationApplied;
    }, { requireOwner: true }, undefined, dependencies);
}
function collectResolvedCallDependencies(extensionHost, evidence) {
    const selectedDependencies = [];
    for (const subject of evidence.inputOperationSubjects ?? []) {
        const reference = extensionHost[extensionHostGetCheckedOperationReference](subject);
        if (reference === undefined) {
            throw new Error("Resolved call evidence references a source input operation that was not retained for finalization.");
        }
        selectedDependencies.push(reference);
    }
    return collectCheckedOperationDependencies(extensionHost, [evidence.sourceCallee.expression, ...evidence.sourceArguments.map((argument) => argument.expression)], selectedDependencies);
}
export function recordExtensionCheckedPropertyAccessMapping(checker, propertyAccessExpression, selected) {
    if (checker === undefined || propertyAccessExpression === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    const accessOwned = extensionHost?.[extensionHostHasCheckedOperationOwner](ExtensionObservationPoint.mapCheckedPropertyAccess) === true;
    const callOwned = selected.callCallee
        && extensionHost?.[extensionHostHasCheckedOperationOwner](ExtensionObservationPoint.mapCheckedCall) === true;
    if (extensionHost === undefined || (!accessOwned && !callOwned)) {
        return;
    }
    const receiver = Node_Expression(propertyAccessExpression);
    const propertyName = Node_Text(Node_Name(propertyAccessExpression));
    if (receiver === undefined || propertyName === "") {
        return;
    }
    const sourceSelectedSymbol = selectedSourceSymbol(checker, selected.selectedSymbol);
    const sourceSelectedDeclaration = symbolValueDeclaration(sourceSelectedSymbol);
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedPropertyAccess, propertyAccessExpression);
    const callExpression = selected.callCallee ? checkedCallForCallee(propertyAccessExpression) : undefined;
    if (selected.callCallee && callExpression === undefined) {
        throw new Error("Checked property callee evidence has no enclosing call expression.");
    }
    const canonicalSourceReceiverType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceReceiver.type, selected.receiverType);
    const canonicalSourceResultType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceResult.type, selected.resultType);
    const sourceReceiver = selectedSourceReceiverEvidence(receiver, canonicalSourceReceiverType);
    if (canonicalSourceReceiverType === undefined || canonicalSourceResultType === undefined) {
        throw new Error("Checked property access mapping requires exact selected source receiver and result types.");
    }
    const sourceResult = selectedSourceValueEvidence(propertyAccessExpression, canonicalSourceResultType, {
        ...(sourceSelectedSymbol === undefined ? {} : { selectedSymbol: sourceSelectedSymbol }),
        ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
        ...(sourceSelectedDeclaration === undefined || Node_Type(sourceSelectedDeclaration) === undefined
            ? {}
            : { authoredTypeNode: Node_Type(sourceSelectedDeclaration) }),
    });
    const sourceReceiverDependencies = collectCheckedOperationDependencies(extensionHost, [receiver]);
    const request = {
        expression: propertyAccessExpression,
        receiver,
        propertyName,
        accessMode: selected.accessMode,
        callCallee: selected.callCallee,
        sourceReceiver,
        sourceResult,
        ...(((propertyAccessExpression.Flags ?? 0) & NodeFlagsOptionalChain) !== 0 ? { optionalChain: true } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    };
    if (callOwned) {
        const callCallee = Node_Expression(callExpression);
        if (callCallee === undefined) {
            throw new Error("Checked property callee evidence lost the enclosing call callee.");
        }
        const inputOperationSubjects = accessOwned
            ? Object.freeze([propertyAccessExpression])
            : sourceReceiverDependencies.length === 0
                ? undefined
                : Object.freeze(sourceReceiverDependencies.map((dependency) => dependency.subject));
        retainCheckedCallSelectionSeed(checker, callExpression, {
            calleeProvenance: Object.freeze({
                ...(sourceSelectedSymbol === undefined ? {} : { symbol: sourceSelectedSymbol }),
                ...(sourceSelectedDeclaration === undefined ? {} : { declaration: sourceSelectedDeclaration }),
                ...(sourceSelectedSymbol === undefined ? {} : { selectedSymbol: sourceSelectedSymbol }),
                ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
                ...(sourceResult.authoredTypeNode === undefined ? {} : { authoredTypeNode: sourceResult.authoredTypeNode }),
            }),
            receiver: Object.freeze({
                expression: receiver,
                type: canonicalSourceReceiverType,
            }),
            ...(inputOperationSubjects === undefined ? {} : { inputOperationSubjects }),
        });
    }
    if (!accessOwned) {
        return;
    }
    extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedPropertyAccess, request, () => {
        throw new Error("Extension-owned checked property access mapping unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        const operationWithResult = withCheckedOperationResultType(value.operation, value.resultType);
        const operation = value.provenance === undefined
            ? operationWithResult
            : withTargetOperationProvenance(operationWithResult, value.provenance);
        const operationWithProvenance = withTargetOperationProvenance(operation, {
            sourceExpression: acceptedRequest.expression,
            sourceReceiver: acceptedRequest.receiver,
            sourceReceiverType: acceptedRequest.sourceReceiver.type,
            sourceAccessMode: acceptedRequest.accessMode,
            sourceCallCallee: acceptedRequest.callCallee,
            ...(acceptedRequest.sourceResult.selectedSymbol !== undefined ? { sourceSelectedSymbol: acceptedRequest.sourceResult.selectedSymbol } : {}),
            ...(acceptedRequest.sourceResult.selectedDeclaration !== undefined ? { sourceSelectedDeclaration: acceptedRequest.sourceResult.selectedDeclaration } : {}),
            sourceResultType: acceptedRequest.sourceResult.type,
            ...(acceptedRequest.optionalChain === true ? { sourceOptionalChain: true } : {}),
        });
        extensionHost.facts.set(acceptedRequest.expression, targetOperationFactKey, snapshotTargetOperationFact(preserveEquivalentCheckedSourceResultType(extensionHost, acceptedRequest.expression, operationWithProvenance, acceptedRequest.sourceResult.type)), evidence);
    }, { requireOwner: true }, undefined, sourceReceiverDependencies);
}
export function recordExtensionCheckedElementAccessMapping(checker, elementAccessExpression, selected) {
    if (checker === undefined || elementAccessExpression === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    const accessOwned = extensionHost?.[extensionHostHasCheckedOperationOwner](ExtensionObservationPoint.mapCheckedElementAccess) === true;
    const callOwned = selected.callCallee
        && extensionHost?.[extensionHostHasCheckedOperationOwner](ExtensionObservationPoint.mapCheckedCall) === true;
    if (extensionHost === undefined || (!accessOwned && !callOwned)) {
        return;
    }
    const receiver = Node_Expression(elementAccessExpression);
    const argument = AsElementAccessExpression(elementAccessExpression)?.ArgumentExpression;
    if (receiver === undefined || argument === undefined) {
        return;
    }
    const sourceSelectedSymbol = selectedSourceSymbol(checker, selected.selectedSymbol);
    const sourceSelectedDeclaration = symbolValueDeclaration(sourceSelectedSymbol);
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedElementAccess, elementAccessExpression);
    const callExpression = selected.callCallee ? checkedCallForCallee(elementAccessExpression) : undefined;
    if (selected.callCallee && callExpression === undefined) {
        throw new Error("Checked element callee evidence has no enclosing call expression.");
    }
    const canonicalSourceReceiverType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceReceiver.type, selected.receiverType);
    const canonicalSourceResultType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceResult.type, selected.resultType);
    const canonicalSourceArgumentType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceArgument.type, selected.argumentType);
    const sourceReceiver = selectedSourceReceiverEvidence(receiver, canonicalSourceReceiverType);
    if (canonicalSourceReceiverType === undefined || canonicalSourceArgumentType === undefined || canonicalSourceResultType === undefined) {
        throw new Error("Checked element access mapping requires exact selected source receiver, argument, and result types.");
    }
    const sourceArgument = selectedSourceValueEvidence(argument, canonicalSourceArgumentType);
    const sourceResult = selectedSourceValueEvidence(elementAccessExpression, canonicalSourceResultType, {
        ...(sourceSelectedSymbol === undefined ? {} : { selectedSymbol: sourceSelectedSymbol }),
        ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
        ...(sourceSelectedDeclaration === undefined || Node_Type(sourceSelectedDeclaration) === undefined
            ? {}
            : { authoredTypeNode: Node_Type(sourceSelectedDeclaration) }),
    });
    const dependencies = collectCheckedOperationDependencies(extensionHost, [receiver, argument]);
    const request = {
        expression: elementAccessExpression,
        receiver,
        argument,
        accessMode: selected.accessMode,
        callCallee: selected.callCallee,
        sourceReceiver,
        sourceArgument,
        sourceResult,
        ...(selected.selectedElementIndex !== undefined ? { sourceSelectedElementIndex: selected.selectedElementIndex } : {}),
        ...(((elementAccessExpression.Flags ?? 0) & NodeFlagsOptionalChain) !== 0 ? { optionalChain: true } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    };
    if (callOwned) {
        const callCallee = Node_Expression(callExpression);
        if (callCallee === undefined) {
            throw new Error("Checked element callee evidence lost the enclosing call callee.");
        }
        const inputOperationSubjects = accessOwned
            ? Object.freeze([elementAccessExpression])
            : dependencies.length === 0
                ? undefined
                : Object.freeze(dependencies.map((dependency) => dependency.subject));
        retainCheckedCallSelectionSeed(checker, callExpression, {
            calleeProvenance: Object.freeze({
                ...(sourceSelectedSymbol === undefined ? {} : { symbol: sourceSelectedSymbol }),
                ...(sourceSelectedDeclaration === undefined ? {} : { declaration: sourceSelectedDeclaration }),
                ...(sourceSelectedSymbol === undefined ? {} : { selectedSymbol: sourceSelectedSymbol }),
                ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
                ...(sourceResult.authoredTypeNode === undefined ? {} : { authoredTypeNode: sourceResult.authoredTypeNode }),
            }),
            receiver: Object.freeze({
                expression: receiver,
                type: canonicalSourceReceiverType,
            }),
            ...(inputOperationSubjects === undefined ? {} : { inputOperationSubjects }),
        });
    }
    if (!accessOwned) {
        return;
    }
    extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedElementAccess, request, () => {
        throw new Error("Extension-owned checked element access mapping unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        const operationWithResult = withCheckedOperationResultType(value.operation, value.resultType);
        const operation = value.provenance === undefined
            ? operationWithResult
            : withTargetOperationProvenance(operationWithResult, value.provenance);
        const operationWithProvenance = withTargetOperationProvenance(operation, {
            sourceExpression: acceptedRequest.expression,
            sourceReceiver: acceptedRequest.receiver,
            sourceReceiverType: acceptedRequest.sourceReceiver.type,
            sourceAccessMode: acceptedRequest.accessMode,
            sourceCallCallee: acceptedRequest.callCallee,
            ...(acceptedRequest.sourceResult.selectedSymbol !== undefined ? { sourceSelectedSymbol: acceptedRequest.sourceResult.selectedSymbol } : {}),
            ...(acceptedRequest.sourceResult.selectedDeclaration !== undefined ? { sourceSelectedDeclaration: acceptedRequest.sourceResult.selectedDeclaration } : {}),
            sourceResultType: acceptedRequest.sourceResult.type,
            ...(acceptedRequest.optionalChain === true ? { sourceOptionalChain: true } : {}),
        });
        extensionHost.facts.set(acceptedRequest.expression, targetOperationFactKey, snapshotTargetOperationFact(preserveEquivalentCheckedSourceResultType(extensionHost, acceptedRequest.expression, operationWithProvenance, acceptedRequest.sourceResult.type)), evidence);
    }, { requireOwner: true }, undefined, dependencies);
}
export function recordExtensionCheckedAssertionConversion(checker, assertionExpression, sourceType, targetType, assertionKind) {
    if (checker === undefined || assertionExpression === undefined || sourceType === undefined || targetType === undefined) {
        return;
    }
    const extensionHost = getCheckedOperationExtensionHost(checker, ExtensionObservationPoint.mapCheckedConversion);
    if (extensionHost === undefined) {
        return;
    }
    const sourceExpression = Node_Expression(assertionExpression);
    const explicitTargetTypeNode = Node_Type(assertionExpression);
    if (sourceExpression === undefined || explicitTargetTypeNode === undefined) {
        return;
    }
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedConversion, assertionExpression, {
        observation: ExtensionObservationPoint.mapCheckedConversion,
        subject: assertionExpression,
        conversionKind: "assertion",
    });
    const retainedAssertion = retainedRequest?.conversionKind === "assertion" ? retainedRequest : undefined;
    const canonicalSourceType = preserveEquivalentCheckedSourceType(retainedAssertion?.source.type, sourceType);
    const canonicalTargetType = preserveEquivalentCheckedSourceType(retainedAssertion?.target.type, targetType);
    const sourceSelectedSymbol = selectedSourceSymbol(checker, Checker_getResolvedSymbolOrNil(checker, SkipParentheses(sourceExpression)));
    const sourceSelectedDeclaration = symbolValueDeclaration(sourceSelectedSymbol);
    const sourceSelectedDeclarationTypeNode = sourceSelectedDeclaration === undefined ? undefined : Node_Type(sourceSelectedDeclaration);
    if (canonicalSourceType === undefined || canonicalTargetType === undefined) {
        throw new Error("Checked assertion mapping requires exact selected source and target types.");
    }
    recordExtensionCheckedConversion(extensionHost, {
        conversionKind: "assertion",
        assertionKind,
        expression: assertionExpression,
        source: selectedSourceValueEvidence(sourceExpression, canonicalSourceType, {
            ...(sourceSelectedSymbol === undefined ? {} : { selectedSymbol: sourceSelectedSymbol }),
            ...(sourceSelectedDeclaration === undefined ? {} : { selectedDeclaration: sourceSelectedDeclaration }),
            ...(sourceSelectedDeclarationTypeNode === undefined ? {} : { authoredTypeNode: sourceSelectedDeclarationTypeNode }),
        }),
        target: Object.freeze({
            type: canonicalTargetType,
            authoredTypeNode: explicitTargetTypeNode,
        }),
        explicitTargetTypeNode,
        ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    });
}
export function recordExtensionCheckedOperatorMapping(checker, expression, operatorToken, left, right, sourceLeftType, sourceRightType, sourceResultType) {
    if (operatorToken === undefined) {
        return;
    }
    recordExtensionCheckedOperatorKindMapping(checker, expression, operatorToken.Kind, left, right, sourceLeftType, sourceRightType, sourceResultType);
}
export function recordExtensionCheckedOperatorKindMapping(checker, expression, operator, left, right, sourceLeftType, sourceRightType, sourceResultType) {
    if (checker === undefined || expression === undefined || operator === undefined || left === undefined) {
        return;
    }
    const extensionHost = getCheckedOperationExtensionHost(checker, ExtensionObservationPoint.mapCheckedOperator);
    if (extensionHost === undefined) {
        return;
    }
    const dependencies = collectCheckedOperationDependencies(extensionHost, [left, right]);
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedOperator, expression);
    const canonicalSourceResultType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceResult.type, sourceResultType);
    const canonicalSourceLeftType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceLeft?.type, sourceLeftType);
    const canonicalSourceRightType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceRight?.type, sourceRightType);
    if (canonicalSourceResultType === undefined || (right !== undefined) !== (canonicalSourceRightType !== undefined)) {
        throw new Error("Checked operator mapping requires exact selected source result and operand types.");
    }
    const sourceLeft = canonicalSourceLeftType === undefined ? undefined : selectedSourceValueEvidence(left, canonicalSourceLeftType);
    const sourceRight = right === undefined || canonicalSourceRightType === undefined
        ? undefined
        : selectedSourceValueEvidence(right, canonicalSourceRightType);
    const sourceResult = selectedSourceValueEvidence(expression, canonicalSourceResultType);
    const request = {
        expression,
        operator: TokenToString(operator),
        left,
        ...(right !== undefined ? { right } : {}),
        ...(sourceLeft === undefined ? {} : { sourceLeft }),
        ...(sourceRight === undefined ? {} : { sourceRight }),
        sourceResult,
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    };
    extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedOperator, request, () => {
        throw new Error("Extension-owned checked operator mapping unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        const operationWithResult = withCheckedOperationResultType(value.operation, value.resultType);
        const operation = value.provenance === undefined
            ? operationWithResult
            : withTargetOperationProvenance(operationWithResult, value.provenance);
        const operationWithProvenance = withTargetOperationProvenance(operation, {
            sourceExpression: acceptedRequest.expression,
            sourceResultType: acceptedRequest.sourceResult.type,
        });
        extensionHost.facts.set(acceptedRequest.expression, targetOperationFactKey, snapshotTargetOperationFact(preserveEquivalentCheckedSourceResultType(extensionHost, acceptedRequest.expression, operationWithProvenance, acceptedRequest.sourceResult.type)), evidence);
    }, { requireOwner: true }, undefined, dependencies);
}
export function recordExtensionCheckedIterationMapping(checker, statement, kind, sourceIterableType, sourceElementType) {
    if (checker === undefined || statement === undefined) {
        return;
    }
    const extensionHost = getCheckedOperationExtensionHost(checker, ExtensionObservationPoint.mapCheckedIteration);
    if (extensionHost === undefined) {
        return;
    }
    const data = AsForInOrOfStatement(statement);
    const expression = data?.Expression;
    if (expression === undefined) {
        return;
    }
    const dependencies = collectCheckedOperationDependencies(extensionHost, [expression, data?.Initializer]);
    const retainedRequest = extensionHost[extensionHostGetCheckedOperationRequest](ExtensionObservationPoint.mapCheckedIteration, statement);
    const canonicalSourceElementType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceElement.type, sourceElementType);
    const canonicalSourceIterableType = preserveEquivalentCheckedSourceType(retainedRequest?.sourceIterable.type, sourceIterableType);
    if (canonicalSourceElementType === undefined || canonicalSourceIterableType === undefined) {
        return;
    }
    const sourceIterable = selectedSourceValueEvidence(expression, canonicalSourceIterableType);
    const request = {
        statement,
        expression,
        ...(data?.Initializer !== undefined ? { initializer: data.Initializer } : {}),
        kind,
        sourceIterable,
        sourceElement: Object.freeze({ type: canonicalSourceElementType }),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    };
    extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedIteration, request, () => {
        throw new Error("Extension-owned checked iteration mapping unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        const operationWithResult = withCheckedOperationResultType(value.operation, value.resultType);
        const operation = value.provenance === undefined
            ? operationWithResult
            : withTargetOperationProvenance(operationWithResult, value.provenance);
        extensionHost.facts.set(acceptedRequest.statement, targetOperationFactKey, snapshotTargetOperationFact(withTargetOperationProvenance(operation, {
            sourceExpression: acceptedRequest.statement,
            sourceReceiver: acceptedRequest.expression,
        })), evidence);
    }, { requireOwner: true }, undefined, dependencies);
}
export function recordExtensionTargetConstraintValidation(checker, typeReference, symbol) {
    if (checker === undefined || typeReference === undefined || symbol === undefined) {
        return true;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.validateTargetConstraint) === undefined) {
        return true;
    }
    const targetBinding = extensionHost.facts.get(symbol, targetBindingFactKey);
    const typeParameters = targetBinding?.typeParameters ?? [];
    const typeArguments = Node_TypeArguments(typeReference) ?? [];
    if (targetBinding === undefined || typeParameters.length === 0 || typeArguments.length === 0) {
        return true;
    }
    let valid = true;
    for (let parameterIndex = 0; parameterIndex < typeParameters.length; parameterIndex++) {
        const parameter = typeParameters[parameterIndex];
        const argument = typeArguments[parameterIndex];
        if (parameter === undefined || argument === undefined) {
            continue;
        }
        for (const constraint of parameter.constraints ?? []) {
            const result = extensionHost.runObservation(ExtensionObservationPoint.validateTargetConstraint, {
                source: argument,
                constraint,
                target: extensionHost.activeTarget ?? targetBinding.target,
            }, () => {
                throw new Error("Extension-owned target constraint checking unexpectedly reached core fallback.");
            }, { requireOwner: true });
            if (result.kind !== "accept" || !result.value) {
                valid = false;
            }
        }
    }
    return valid;
}
export function recordExtensionRuntimeCarrierFact(checker, typeReference, type, symbol) {
    if (checker === undefined || type === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined) {
        return;
    }
    recordProviderTypeFamilyReferenceFacts(extensionHost, typeReference, type, symbol);
    if (extensionHost.getObservationOwner(ExtensionObservationPoint.resolveRuntimeCarrier) === undefined) {
        return;
    }
    if (!hasExtensionOwnedSubject(extensionHost, type) && !hasExtensionOwnedSubject(extensionHost, typeReference) && !hasExtensionOwnedSubject(extensionHost, symbol) && !hasExtensionOwnedSubject(extensionHost, type.symbol)) {
        return;
    }
    extensionHost.runObservation(ExtensionObservationPoint.resolveRuntimeCarrier, {
        type,
        ...(typeReference !== undefined ? { sourceTypeReference: typeReference } : {}),
        ...(symbol !== undefined ? { sourceSymbol: symbol } : {}),
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned runtime carrier resolution unexpectedly reached core fallback.");
    }, { requireOwner: true }, (value, evidence) => {
        const commonFact = {
            carrier: value.carrier,
            ...(value.requiresAllocation !== undefined ? { requiresAllocation: value.requiresAllocation } : {}),
        };
        const providerProvenance = value.provenance?.providerDeclaration === undefined
            ? {}
            : { providerDeclaration: value.provenance.providerDeclaration };
        extensionHost.facts.set(type, runtimeCarrierFactKey, {
            ...commonFact,
            provenance: {
                ...providerProvenance,
                sourceType: type,
            },
        }, evidence);
        if (typeReference !== undefined) {
            const retainedSourceType = extensionHost.facts.get(typeReference, runtimeCarrierFactKey)?.provenance?.sourceType;
            const canonicalSourceType = preserveEquivalentCheckedSourceType(retainedSourceType, type);
            if (canonicalSourceType === undefined) {
                throw new Error("Runtime-carrier recording lost the checked source type.");
            }
            extensionHost.facts.set(typeReference, runtimeCarrierFactKey, {
                ...commonFact,
                provenance: {
                    ...providerProvenance,
                    sourceType: canonicalSourceType,
                    sourceTypeReference: typeReference,
                    ...(symbol !== undefined ? { sourceSymbol: symbol } : {}),
                },
            }, evidence);
        }
        if (symbol !== undefined) {
            extensionHost.facts.set(symbol, runtimeCarrierFactKey, {
                ...commonFact,
                provenance: {
                    ...providerProvenance,
                    sourceSymbol: symbol,
                },
            }, evidence);
        }
        if (type.symbol !== undefined) {
            extensionHost.facts.set(type.symbol, runtimeCarrierFactKey, {
                ...commonFact,
                provenance: {
                    ...providerProvenance,
                    sourceSymbol: type.symbol,
                },
            }, evidence);
        }
    });
}
export function recordExtensionContextualTargetTypeFact(checker, expression, contextualType) {
    if (checker === undefined || expression === undefined || contextualType === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.recordContextualTargetType) === undefined) {
        return;
    }
    extensionHost.runObservation(ExtensionObservationPoint.recordContextualTargetType, {
        expression,
        context: contextualType,
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => ({
        type: contextualType,
    }), {}, (value, evidence) => {
        extensionHost.facts.set(expression, contextualTargetTypeFactKey, {
            type: value.type,
            ...(value.targetType !== undefined ? { targetType: value.targetType } : {}),
        }, evidence);
    });
}
export function recordExtensionPostCheckAssignabilityObservation(checker, source, target, errorNode, expression, relation) {
    if (checker === undefined || source === undefined || target === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.observePostCheckAssignability) === undefined) {
        return;
    }
    if (!hasExtensionOwnedSubject(extensionHost, source)
        && !hasExtensionOwnedSubject(extensionHost, target)
        && !hasExtensionOwnedSubject(extensionHost, source?.symbol)
        && !hasExtensionOwnedSubject(extensionHost, target?.symbol)
        && !hasExtensionOwnedSubject(extensionHost, errorNode)
        && !hasExtensionOwnedSubject(extensionHost, expression)) {
        return;
    }
    extensionHost.runObservation(ExtensionObservationPoint.observePostCheckAssignability, {
        source,
        target,
        ...(relation !== undefined ? { relation } : {}),
        ...(errorNode !== undefined ? { errorNode } : {}),
        ...(expression !== undefined ? { expression } : {}),
        ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
    }, () => undefined, { requireOwner: true });
}
export function recordExtensionFlowUseValidation(checker, useSite, symbol) {
    if (checker === undefined || useSite === undefined || symbol === undefined) {
        return;
    }
    const extensionHost = getExtensionHost(checker.program);
    if (extensionHost === undefined || extensionHost.getObservationOwner(ExtensionObservationPoint.validateExtensionFlowUse) === undefined) {
        return;
    }
    const useSiteFlowState = extensionHost.facts.getEntry(useSite, flowStateFactKey);
    if (useSiteFlowState !== undefined) {
        extensionHost.facts.set(symbol, flowStateFactKey, useSiteFlowState.value, useSiteFlowState.evidence);
        return;
    }
    const symbolFlowState = extensionHost.facts.get(symbol, flowStateFactKey);
    if (symbolFlowState === undefined) {
        return;
    }
    extensionHost.runObservation(ExtensionObservationPoint.validateExtensionFlowUse, {
        useSite,
        symbol,
        mode: "read",
        ...(extensionHost.activeTarget !== undefined ? { target: extensionHost.activeTarget } : {}),
    }, () => {
        throw new Error("Extension-owned flow validation unexpectedly reached core fallback.");
    }, { requireOwner: true }, (value, evidence) => {
        if (value.targetCompilerValidationRequired === true) {
            extensionHost.facts.set(useSite, flowStateFactKey, {
                state: "target-validation-required",
                ...(value.targetCompiler !== undefined ? { targetCompiler: value.targetCompiler } : {}),
            }, evidence);
        }
    });
}
function selectTargetArgumentConversionSlots(selectedSignature, arguments_) {
    const parameters = instantiateSelectedTargetParameters(selectedSignature);
    validateTargetParameterList(selectedSignature);
    const slotsByArgument = new Map();
    const slotsByTargetParameter = new Map();
    const uniqueSlots = new Set();
    for (const slot of selectedSignature.argumentConversions) {
        if (slot.sourceArgumentIndex >= arguments_.length) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' requests conversion for missing source argument ${slot.sourceArgumentIndex}.`);
        }
        if (slot.targetParameterIndex >= parameters.length) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' requests conversion to missing target parameter ${slot.targetParameterIndex}.`);
        }
        const identity = `${slot.sourceArgumentIndex}:${slot.sourceForm}:${slot.spreadElementIndex ?? "-"}:${slot.targetParameterIndex}:${slot.targetForm}`;
        if (uniqueSlots.has(identity)) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' repeats the same call-argument conversion slot.`);
        }
        uniqueSlots.add(identity);
        const argumentSlots = slotsByArgument.get(slot.sourceArgumentIndex) ?? [];
        argumentSlots.push(slot);
        slotsByArgument.set(slot.sourceArgumentIndex, argumentSlots);
        const parameterSlots = slotsByTargetParameter.get(slot.targetParameterIndex) ?? [];
        parameterSlots.push(slot);
        slotsByTargetParameter.set(slot.targetParameterIndex, parameterSlots);
    }
    const slots = [];
    for (const [sourceArgumentIndex, argumentSlots] of slotsByArgument) {
        const argument = arguments_[sourceArgumentIndex];
        if (argument === undefined) {
            throw new Error(`Selected target signature has no argument node at index ${sourceArgumentIndex}.`);
        }
        const spread = IsSpreadElement(argument);
        if (!spread && argumentSlots.some((slot) => slot.sourceForm !== "value")) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' gives non-spread source argument ${sourceArgumentIndex} a spread conversion slot.`);
        }
        if (spread && argumentSlots.some((slot) => slot.sourceForm === "value")) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' gives spread source argument ${sourceArgumentIndex} a scalar conversion slot.`);
        }
        const spreadSequences = argumentSlots.filter((slot) => slot.sourceForm === "spread-sequence");
        const spreadElements = argumentSlots.filter((slot) => slot.sourceForm === "spread-element");
        if (spreadSequences.length > 1 || (spreadSequences.length !== 0 && spreadElements.length !== 0)) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' gives spread source argument ${sourceArgumentIndex} incompatible sequence and element conversion slots.`);
        }
        if (spreadElements.length !== 0) {
            const elementIndices = spreadElements.map((slot) => slot.spreadElementIndex).sort((left, right) => left - right);
            for (let index = 0; index < elementIndices.length; index++) {
                if (elementIndices[index] !== index) {
                    throw new Error(`Selected target signature '${selectedSignature.member.id}' must map fixed spread argument ${sourceArgumentIndex} with contiguous element indices starting at zero.`);
                }
            }
        }
        for (const slot of argumentSlots) {
            const sourceBinding = selectedSignature.sourceArgumentBindings.find((binding) => binding.sourceArgumentIndex === slot.sourceArgumentIndex
                && binding.sourceForm === slot.sourceForm
                && binding.spreadElementIndex === slot.spreadElementIndex);
            if (sourceBinding === undefined) {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' requests a conversion slot that is absent from the checker-selected source call topology.`);
            }
            const targetParameter = parameters[slot.targetParameterIndex];
            const targetIsParams = targetParameter.paramsArray === true;
            if (slot.targetForm === "parameter" && targetIsParams) {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' maps a whole parameter conversion to params target parameter ${slot.targetParameterIndex}.`);
            }
            if (slot.targetForm !== "parameter" && !targetIsParams) {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' maps a params conversion to non-params target parameter ${slot.targetParameterIndex}.`);
            }
            if (slot.targetForm === "params-sequence" && slot.sourceForm !== "spread-sequence") {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' maps non-sequence source argument ${sourceArgumentIndex} as a params sequence.`);
            }
            if (slot.targetForm === "params-element" && slot.sourceForm === "spread-sequence") {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' maps a spread sequence as one params element.`);
            }
            const conversionTarget = slot.targetForm === "params-element"
                ? targetParameter.type.element
                : targetParameter.type;
            slots.push(Object.freeze({
                slot,
                argument,
                sourceArgumentIndex,
                targetParameter,
                targetParameterIndex: slot.targetParameterIndex,
                conversionTarget,
                sourceForm: slot.sourceForm,
                ...(slot.spreadElementIndex === undefined ? {} : { spreadElementIndex: slot.spreadElementIndex }),
                targetForm: slot.targetForm,
                sourceBinding,
            }));
        }
    }
    for (const [targetParameterIndex, parameterSlots] of slotsByTargetParameter) {
        const targetParameter = parameters[targetParameterIndex];
        if (targetParameter.paramsArray !== true) {
            if (parameterSlots.length > 1) {
                throw new Error(`Selected target signature '${selectedSignature.member.id}' requests multiple conversions to non-params target parameter ${targetParameterIndex}.`);
            }
            continue;
        }
        const sequenceSlots = parameterSlots.filter((slot) => slot.targetForm === "params-sequence");
        if (sequenceSlots.length > 1 || (sequenceSlots.length !== 0 && parameterSlots.length !== 1)) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' mixes a params sequence with other conversions for target parameter ${targetParameterIndex}.`);
        }
    }
    return Object.freeze(slots);
}
function instantiateSelectedTargetParameters(selectedSignature) {
    const typeParameters = selectedSignature.member.typeParameters ?? [];
    const typeArguments = selectedSignature.targetTypeArguments ?? [];
    if (typeParameters.length !== typeArguments.length) {
        throw new Error(`Selected target signature '${selectedSignature.member.id}' has ${typeParameters.length} target type parameters but ${typeArguments.length} selected target type arguments.`);
    }
    const substitutions = new Map();
    for (let index = 0; index < typeParameters.length; index++) {
        const typeParameter = typeParameters[index];
        if (substitutions.has(typeParameter.name)) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' declares duplicate target type parameter '${typeParameter.name}'.`);
        }
        substitutions.set(typeParameter.name, typeArguments[index]);
    }
    return Object.freeze(selectedSignature.member.parameters.map((parameter) => substituteTargetParameter(parameter, substitutions)));
}
function validateTargetParameterList(selectedSignature) {
    let paramsArrayIndex = -1;
    for (let index = 0; index < selectedSignature.member.parameters.length; index++) {
        const parameter = selectedSignature.member.parameters[index];
        if (parameter.paramsArray !== true) {
            continue;
        }
        if (paramsArrayIndex !== -1 || index !== selectedSignature.member.parameters.length - 1) {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' must have at most one params array and it must be the final target parameter.`);
        }
        if (parameter.type.kind !== "array") {
            throw new Error(`Selected target signature '${selectedSignature.member.id}' marks parameter ${index} as a params array without an array target type.`);
        }
        paramsArrayIndex = index;
    }
}
function recordExtensionCallParameterModes(extensionHost, callExpression, selectedSignature, slots, evidence) {
    for (const slot of slots) {
        extensionHost.facts.set(slot.slot, targetCallArgumentPassingFactKey, withArgumentPassingProvenance(selectedSignature, callExpression, slot), evidence);
    }
}
function recordExtensionCallArgumentConversions(extensionHost, callExpression, selectedSignature, slots, snapshotCache) {
    let unresolved;
    for (const slot of slots) {
        const sourceArgument = selectedSignature.sourceArguments[slot.sourceArgumentIndex];
        if (sourceArgument === undefined || sourceArgument.expression !== slot.argument) {
            throw new Error(`Selected call '${selectedSignature.member.id}' lost source argument evidence at index ${slot.sourceArgumentIndex}.`);
        }
        const result = recordExtensionCheckedConversion(extensionHost, {
            conversionKind: "call-argument",
            expression: slot.argument,
            source: sourceArgument,
            sourceBinding: slot.sourceBinding,
            target: slot.conversionTarget,
            call: callExpression,
            slot: slot.slot,
            sourceArgumentIndex: slot.sourceArgumentIndex,
            targetParameterIndex: slot.targetParameterIndex,
            sourceForm: slot.sourceForm,
            ...(slot.spreadElementIndex === undefined ? {} : { spreadElementIndex: slot.spreadElementIndex }),
            targetForm: slot.targetForm,
            targetParameter: slot.targetParameter,
            ...(selectedSignature.sourceSignature !== undefined ? { sourceSelectedSignature: selectedSignature.sourceSignature } : {}),
            selectedSignature,
            ...(extensionHost.activeTarget !== undefined ? { targetPlatform: extensionHost.activeTarget } : {}),
        }, snapshotCache);
        if (result.kind === "accept") {
            continue;
        }
        if (result.kind === "owner-deferred") {
            unresolved ??= checkedCallArgumentConversionReference(callExpression, slot);
            continue;
        }
        return checkedOperationUnavailable;
    }
    return unresolved === undefined
        ? checkedOperationApplied
        : Object.freeze({ kind: "deferred", unresolved });
}
function recordExtensionCheckedConversion(extensionHost, request, requestSnapshotCache, additionalDependencies = []) {
    const sourceExpression = request.source.expression;
    const dependencies = collectCheckedOperationDependencies(extensionHost, [sourceExpression], additionalDependencies);
    return extensionHost[extensionHostRunCheckedOperation](ExtensionObservationPoint.mapCheckedConversion, request, () => {
        throw new Error("Extension-owned conversion resolution unexpectedly reached core fallback.");
    }, (value, evidence, acceptedRequest) => {
        if (acceptedRequest.conversionKind === "assertion"
            && value.convertedType === undefined
            && value.operation === undefined) {
            return;
        }
        const conversion = Object.freeze({
            ...(value.convertedType !== undefined ? { convertedType: value.convertedType } : {}),
            ...(value.operation !== undefined ? { operation: value.operation } : {}),
        });
        if (acceptedRequest.conversionKind === "call-argument") {
            extensionHost.facts.set(acceptedRequest.slot, targetCallArgumentConversionFactKey, Object.freeze({
                ...conversion,
                slot: acceptedRequest.slot,
                call: acceptedRequest.call,
                sourceArgumentIndex: acceptedRequest.sourceArgumentIndex,
                targetParameterIndex: acceptedRequest.targetParameterIndex,
                sourceForm: acceptedRequest.sourceForm,
                ...(acceptedRequest.spreadElementIndex === undefined ? {} : { spreadElementIndex: acceptedRequest.spreadElementIndex }),
                targetForm: acceptedRequest.targetForm,
                sourceBinding: acceptedRequest.sourceBinding,
            }), evidence);
        }
        else {
            extensionHost.facts.set(acceptedRequest.expression, targetConversionFactKey, conversion, evidence);
        }
    }, { requireOwner: true }, requestSnapshotCache, dependencies, request.conversionKind === "call-argument"
        ? Object.freeze({ observation: ExtensionObservationPoint.mapCheckedCall, subject: request.call })
        : undefined);
}
function checkedCallArgumentConversionReference(callExpression, slot) {
    return Object.freeze({
        observation: ExtensionObservationPoint.mapCheckedConversion,
        subject: slot.argument,
        conversionKind: "call-argument",
        call: callExpression,
        slot: slot.slot,
        sourceArgumentIndex: slot.sourceArgumentIndex,
        targetParameterIndex: slot.targetParameterIndex,
    });
}
function definedFactSubjects(subjects) {
    return subjects.filter((subject) => subject !== undefined);
}
function collectCheckedOperationDependencies(extensionHost, roots, additional = []) {
    const dependencies = [];
    const dependencyIndex = new CheckedOperationReferenceIndex();
    const visited = new WeakSet();
    const add = (reference) => {
        if (dependencyIndex.add(reference)) {
            dependencies.push(reference);
        }
    };
    for (const reference of additional) {
        add(reference);
    }
    const pending = [...roots].reverse();
    while (pending.length !== 0) {
        const node = pending.pop();
        if (node === undefined || visited.has(node)) {
            continue;
        }
        visited.add(node);
        const reference = extensionHost[extensionHostGetCheckedOperationReference](node);
        if (reference !== undefined) {
            add(reference);
            continue;
        }
        if (IsFunctionLike(node)) {
            continue;
        }
        const children = [];
        Node_ForEachChild(node, (child) => {
            children.push(child);
            return false;
        });
        for (let index = children.length - 1; index >= 0; index--) {
            pending.push(children[index]);
        }
    }
    return Object.freeze(dependencies);
}
function selectedSourceSymbol(checker, symbol) {
    return symbol === undefined || symbol === checker?.unknownSymbol ? undefined : symbol;
}
function symbolValueDeclaration(symbol) {
    return symbol?.ValueDeclaration;
}
function selectedSourceValueEvidence(expression, type, selection = {}) {
    return Object.freeze({
        expression,
        type,
        ...(selection.symbol === undefined ? {} : { symbol: selection.symbol }),
        ...(selection.declaration === undefined ? {} : { declaration: selection.declaration }),
        ...(selection.selectedSymbol === undefined ? {} : { selectedSymbol: selection.selectedSymbol }),
        ...(selection.selectedDeclaration === undefined ? {} : { selectedDeclaration: selection.selectedDeclaration }),
        ...(selection.authoredTypeNode === undefined ? {} : { authoredTypeNode: selection.authoredTypeNode }),
    });
}
function selectedSourceEvidenceProvenance(evidence) {
    return {
        ...(evidence.symbol === undefined ? {} : { symbol: evidence.symbol }),
        ...(evidence.declaration === undefined ? {} : { declaration: evidence.declaration }),
        ...(evidence.selectedSymbol === undefined ? {} : { selectedSymbol: evidence.selectedSymbol }),
        ...(evidence.selectedDeclaration === undefined ? {} : { selectedDeclaration: evidence.selectedDeclaration }),
        ...(evidence.authoredTypeNode === undefined ? {} : { authoredTypeNode: evidence.authoredTypeNode }),
    };
}
function selectedSourceCallProvenanceFromRequest(request) {
    return {
        sourceSelectedSignature: request.sourceSelectedSignature,
        sourceSelectedDeclaration: request.sourceSelectedDeclaration,
        sourceSelectedMethodTypeArguments: request.sourceSelectedMethodTypeArguments,
        sourceSelectedSignatureParameters: request.sourceSelectedSignatureParameters,
        sourceSelectedSignatureKind: request.sourceSelectedSignatureKind,
        sourceCallKind: request.callKind,
        sourceArgumentBindings: request.sourceArgumentBindings,
        sourceCallee: request.sourceCallee,
        sourceArguments: request.sourceArguments,
        sourceResult: request.sourceResult,
        sourceReceiver: request.sourceReceiver,
        sourceOptionalChain: request.optionalChain,
    };
}
function withSelectedTargetSignatureProvenance(callResult, provenance, snapshotCache) {
    const signature = callResult.selectedSignature;
    const sourceSelectedSignature = provenance.sourceSelectedSignature;
    const sourceSelectedMethodTypeArguments = provenance.sourceSelectedMethodTypeArguments;
    const sourceSelectedSignatureParameters = provenance.sourceSelectedSignatureParameters;
    const sourceArgumentBindings = provenance.sourceArgumentBindings;
    if (sourceArgumentBindings === undefined) {
        throw new Error(`Target call selection '${signature.member.id}' requires complete checker-selected source argument topology.`);
    }
    const providerDeclaration = signature.providerDeclaration ?? signature.member.providerDeclaration;
    return snapshotSelectedTargetSignatureFact({
        member: signature.member,
        argumentConversions: callResult.argumentConversions,
        sourceArgumentBindings,
        ...(signature.targetTypeArguments !== undefined ? { targetTypeArguments: signature.targetTypeArguments } : {}),
        ...(sourceSelectedMethodTypeArguments !== undefined ? { sourceSelectedMethodTypeArguments } : {}),
        ...(sourceSelectedSignatureParameters !== undefined ? { sourceSelectedSignatureParameters } : {}),
        ...(provenance.sourceSelectedSignatureKind !== undefined ? { sourceSelectedSignatureKind: provenance.sourceSelectedSignatureKind } : {}),
        sourceCallKind: provenance.sourceCallKind,
        ...(sourceSelectedSignature !== undefined ? { sourceSignature: sourceSelectedSignature } : {}),
        ...(provenance.sourceSelectedDeclaration !== undefined ? { sourceDeclaration: provenance.sourceSelectedDeclaration } : {}),
        sourceCallee: provenance.sourceCallee,
        sourceArguments: provenance.sourceArguments,
        sourceResult: provenance.sourceResult,
        ...(provenance.sourceOptionalChain !== undefined ? { sourceOptionalChain: provenance.sourceOptionalChain } : {}),
        ...(provenance.sourceReceiver !== undefined ? { sourceReceiver: provenance.sourceReceiver } : {}),
        ...(providerDeclaration !== undefined ? { providerDeclaration } : {}),
    }, snapshotCache);
}
function selectedSourceReceiverEvidence(receiver, sourceReceiverType) {
    if (receiver === undefined || sourceReceiverType === undefined) {
        throw new Error("Checked receiver evidence requires both the source expression and its exact selected type.");
    }
    return selectedSourceValueEvidence(receiver, sourceReceiverType);
}
function checkedCallForCallee(callee) {
    let current = callee;
    while (current !== undefined && IsParenthesizedExpression(current.Parent)) {
        current = current.Parent;
    }
    const parent = current?.Parent;
    return IsCallOrNewExpression(parent) && Node_Expression(parent) === current ? parent : undefined;
}
function checkedCallKind(callExpression) {
    if (!IsCallOrNewExpression(callExpression)) {
        throw new Error("Checked call mapping requires a call or construction expression.");
    }
    return IsNewExpression(callExpression) ? "construct" : "call";
}
function getSourceSelectedMethodTypeArguments(callExpression, sourceSelectedSignature) {
    if (sourceSelectedSignature === undefined) {
        return undefined;
    }
    const typeParameters = sourceSelectedSignature.target?.typeParameters ?? sourceSelectedSignature.typeParameters ?? [];
    if (typeParameters.length === 0) {
        return undefined;
    }
    const explicitTypeNodes = Node_TypeArguments(callExpression) ?? [];
    const selected = [];
    for (let index = 0; index < typeParameters.length; index++) {
        const typeParameter = typeParameters[index];
        const typeParameterName = typeParameter?.symbol?.Name ?? "";
        if (typeParameter === undefined || typeParameterName === "") {
            return undefined;
        }
        const explicitTypeNode = explicitTypeNodes[index];
        const selectedType = sourceSelectedSignature.mapper?.data.Map(typeParameter);
        if (selectedType === undefined) {
            return undefined;
        }
        selected.push({
            typeParameterName,
            typeParameter,
            selectedType,
            ...(explicitTypeNode !== undefined ? { explicitTypeNode } : {}),
        });
    }
    return selected.length === 0 ? undefined : selected;
}
function getSourceSelectedSignatureParameters(checker, sourceSelectedSignature) {
    if (checker === undefined || sourceSelectedSignature === undefined) {
        return undefined;
    }
    const selected = [];
    const minimumArgumentCount = Checker_getMinArgumentCount(checker, sourceSelectedSignature);
    const restParameterIndex = signatureHasRestParameter(sourceSelectedSignature) ? sourceSelectedSignature.parameters.length - 1 : -1;
    for (let parameterIndex = 0; parameterIndex < sourceSelectedSignature.parameters.length; parameterIndex++) {
        const parameterSymbol = sourceSelectedSignature.parameters[parameterIndex];
        if (parameterSymbol === undefined) {
            return undefined;
        }
        const selectedType = Checker_getTypeOfParameter(checker, parameterSymbol);
        if (selectedType === undefined) {
            return undefined;
        }
        const parameterDeclaration = symbolValueDeclaration(parameterSymbol);
        const authoredTypeNode = parameterDeclaration === undefined ? undefined : Node_Type(parameterDeclaration);
        selected.push({
            parameterIndex,
            parameterName: parameterSymbol.Name,
            parameterSymbol,
            ...(parameterDeclaration !== undefined ? { parameterDeclaration } : {}),
            selectedType,
            ...(authoredTypeNode !== undefined ? { authoredTypeNode } : {}),
            acceptsOmission: parameterIndex >= minimumArgumentCount,
            rest: parameterIndex === restParameterIndex,
        });
    }
    return selected;
}
function getSourceSelectedSignatureKind(checker, sourceSelectedSignature) {
    if (checker === undefined || sourceSelectedSignature === undefined) {
        return undefined;
    }
    if (sourceSelectedSignature === checker.anySignature) {
        return "untyped";
    }
    if (sourceSelectedSignature === checker.unknownSignature) {
        return "error";
    }
    if (sourceSelectedSignature === checker.silentNeverSignature) {
        return "silent-never";
    }
    return "resolved";
}
function preserveEquivalentSelectedMethodTypeArguments(existing, incoming) {
    if (existing === undefined || incoming === undefined || existing.length !== incoming.length) {
        return incoming;
    }
    return incoming.map((argument, index) => {
        const retained = existing[index];
        if (retained === undefined
            || retained.typeParameterName !== argument.typeParameterName
            || retained.explicitTypeNode !== argument.explicitTypeNode) {
            return argument;
        }
        const typeParameter = preserveEquivalentCheckedSourceType(retained.typeParameter, argument.typeParameter);
        const selectedType = preserveEquivalentCheckedSourceType(retained.selectedType, argument.selectedType);
        return typeParameter === retained.typeParameter && selectedType === retained.selectedType
            ? retained
            : {
                ...argument,
                ...(typeParameter === undefined ? {} : { typeParameter }),
                selectedType: selectedType,
            };
    });
}
function preserveEquivalentSelectedCallArgumentBindings(existing, incoming) {
    if (incoming === undefined) {
        return undefined;
    }
    return Object.freeze(incoming.map((binding, index) => {
        if (!Number.isSafeInteger(binding.sourceArgumentIndex) || binding.sourceArgumentIndex < 0
            || !Number.isSafeInteger(binding.effectiveArgumentIndex) || binding.effectiveArgumentIndex !== index
            || !Number.isSafeInteger(binding.sourceParameterIndex) || binding.sourceParameterIndex < 0
            || (binding.spreadElementIndex !== undefined
                && (!Number.isSafeInteger(binding.spreadElementIndex) || binding.spreadElementIndex < 0))
            || binding.selectedArgumentType === undefined
            || binding.selectedParameterType === undefined) {
            throw new Error("Checked call mapping received invalid source-selected argument binding evidence.");
        }
        const retained = existing?.[index];
        if (retained === undefined
            || retained.sourceArgumentIndex !== binding.sourceArgumentIndex
            || retained.effectiveArgumentIndex !== binding.effectiveArgumentIndex
            || retained.sourceForm !== binding.sourceForm
            || retained.spreadElementIndex !== binding.spreadElementIndex
            || retained.sourceParameterIndex !== binding.sourceParameterIndex
            || retained.sourceParameterForm !== binding.sourceParameterForm) {
            return Object.freeze({ ...binding });
        }
        const selectedArgumentType = preserveEquivalentCheckedSourceType(retained.selectedArgumentType, binding.selectedArgumentType);
        const selectedParameterType = preserveEquivalentCheckedSourceType(retained.selectedParameterType, binding.selectedParameterType);
        return selectedArgumentType === retained.selectedArgumentType
            && selectedParameterType === retained.selectedParameterType
            ? retained
            : Object.freeze({
                ...binding,
                selectedArgumentType: selectedArgumentType,
                selectedParameterType: selectedParameterType,
            });
    }));
}
function preserveEquivalentSelectedSignatureParameters(existing, incoming) {
    if (existing === undefined || incoming === undefined || existing.length !== incoming.length) {
        return incoming;
    }
    return incoming.map((parameter, index) => {
        const retained = existing[index];
        if (retained === undefined
            || retained.parameterIndex !== parameter.parameterIndex
            || retained.parameterName !== parameter.parameterName
            || retained.parameterSymbol !== parameter.parameterSymbol
            || retained.parameterDeclaration !== parameter.parameterDeclaration
            || retained.authoredTypeNode !== parameter.authoredTypeNode
            || retained.acceptsOmission !== parameter.acceptsOmission
            || retained.rest !== parameter.rest) {
            return parameter;
        }
        const selectedType = preserveEquivalentCheckedSourceType(retained.selectedType, parameter.selectedType);
        return selectedType === retained.selectedType
            ? retained
            : { ...parameter, selectedType: selectedType };
    });
}
function withTargetOperationProvenance(operation, provenance) {
    return Object.freeze({
        ...operation,
        provenance: Object.freeze({
            ...(operation.provenance !== undefined ? operation.provenance : {}),
            ...provenance,
        }),
    });
}
function preserveEquivalentCheckedSourceType(existing, incoming) {
    if (incoming === undefined) {
        return undefined;
    }
    if (existing === undefined || existing === incoming) {
        return incoming;
    }
    return checkedSourceTypesShareStableIdentity(existing, incoming) ? existing : incoming;
}
function preserveEquivalentCheckedSourceResultType(extensionHost, subject, incoming, incomingSourceResultType) {
    if (incomingSourceResultType === undefined) {
        return incoming;
    }
    const existing = extensionHost.facts.get(subject, targetOperationFactKey);
    const existingSourceResultType = existing?.provenance?.sourceResultType;
    if (existing === undefined || existingSourceResultType === undefined || existingSourceResultType === incomingSourceResultType) {
        return incoming;
    }
    const withExistingSourceResultType = withTargetOperationProvenance(incoming, {
        sourceResultType: existingSourceResultType,
    });
    if (!targetOperationFactKey.equals(existing, withExistingSourceResultType)) {
        return incoming;
    }
    return checkedSourceTypesShareStableIdentity(existingSourceResultType, incomingSourceResultType)
        ? withExistingSourceResultType
        : incoming;
}
function checkedSourceTypesShareStableIdentity(left, right) {
    if (left === right) {
        return true;
    }
    if (left?.checker !== undefined && left.checker === right?.checker && Type_Id(left) === Type_Id(right)) {
        return true;
    }
    const leftIsUniqueSymbol = (Type_Flags(left) & TypeFlagsUniqueESSymbol) !== 0;
    const rightIsUniqueSymbol = (Type_Flags(right) & TypeFlagsUniqueESSymbol) !== 0;
    if (leftIsUniqueSymbol || rightIsUniqueSymbol) {
        if (!leftIsUniqueSymbol || !rightIsUniqueSymbol) {
            return false;
        }
        const leftSymbol = Type_Symbol(left);
        const rightSymbol = Type_Symbol(right);
        if (leftSymbol === undefined || leftSymbol !== rightSymbol) {
            return false;
        }
        const declaration = symbolValueDeclaration(leftSymbol);
        return declaration !== undefined && declaration === symbolValueDeclaration(rightSymbol);
    }
    return false;
}
function withCheckedOperationResultType(operation, resultType) {
    if (operation.resultType !== undefined || resultType === undefined) {
        return operation;
    }
    return Object.freeze({
        ...operation,
        resultType,
    });
}
function withArgumentPassingProvenance(selectedSignature, call, slot) {
    return Object.freeze({
        slot: slot.slot,
        mode: slot.targetParameter.passingMode,
        targetExpression: slot.argument,
        call,
        sourceArgumentIndex: slot.sourceArgumentIndex,
        targetParameterIndex: slot.targetParameterIndex,
        sourceForm: slot.sourceForm,
        ...(slot.spreadElementIndex === undefined ? {} : { spreadElementIndex: slot.spreadElementIndex }),
        targetForm: slot.targetForm,
        sourceBinding: slot.sourceBinding,
        targetParameter: slot.targetParameter,
        ...(selectedSignature.providerDeclaration !== undefined
            ? { selectedSignature: selectedSignature.providerDeclaration }
            : selectedSignature.member.providerDeclaration !== undefined
                ? { selectedSignature: selectedSignature.member.providerDeclaration }
                : {}),
    });
}
function hasExtensionOwnedSubject(extensionHost, subject) {
    if (subject === undefined) {
        return false;
    }
    return extensionHost.facts.get(subject, targetBindingFactKey) !== undefined
        || extensionHost.facts.get(subject, providerTypeFamilyFactKey) !== undefined
        || extensionHost.facts.get(subject, providerVirtualDeclarationFactKey) !== undefined
        || extensionHost.facts.get(subject, sourcePrimitiveFactKey) !== undefined
        || extensionHost.facts.get(subject, argumentPassingFactKey) !== undefined
        || extensionHost.facts.get(subject, targetCallArgumentPassingFactKey) !== undefined
        || extensionHost.facts.get(subject, flowStateFactKey) !== undefined
        || extensionHost.facts.get(subject, runtimeCarrierFactKey) !== undefined;
}
//# sourceMappingURL=checker-integration.js.map