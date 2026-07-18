import { ExtensionObservationPoint } from "./observations.js";
const checkedOperationResponseSnapshots = new WeakMap();
export function createCheckedOperationRequestSnapshotCache() {
    return Object.freeze({
        selectedTargetSignatures: new WeakMap(),
        targetParameters: new WeakMap(),
        targetCallArgumentConversionSlots: new WeakMap(),
    });
}
export function snapshotCheckedOperationRequest(observation, request, cache = createCheckedOperationRequestSnapshotCache()) {
    const path = createSnapshotPath(`checked-operation request[${observation}]`);
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            return snapshotCallRequest(request, path);
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            return snapshotPropertyRequest(request, path);
        case ExtensionObservationPoint.mapCheckedElementAccess:
            return snapshotElementRequest(request, path);
        case ExtensionObservationPoint.mapCheckedOperator:
            return snapshotOperatorRequest(request, path);
        case ExtensionObservationPoint.mapCheckedIteration:
            return snapshotIterationRequest(request, path);
        case ExtensionObservationPoint.mapCheckedConversion:
            return snapshotConversionRequest(request, cache, path);
    }
}
export function snapshotCheckedOperationResult(observation, result) {
    const path = createSnapshotPath(`checked-operation result[${observation}]`);
    assertRecord(result, "checked-operation result", path);
    const actualKind = readDiscriminant(result, "checked-operation result", path);
    switch (actualKind) {
        case "core": {
            const core = result;
            const value = core.value;
            return Object.freeze({ kind: "core", value: snapshotCheckedOperationResponse(observation, value) });
        }
        case "accept": {
            const accepted = result;
            const value = accepted.value;
            const extensionId = accepted.extensionId;
            const evidence = accepted.evidence;
            return Object.freeze({
                kind: "accept",
                value: snapshotCheckedOperationResponse(observation, value),
                extensionId,
                ...(evidence === undefined ? {} : {
                    evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
                }),
            });
        }
        case "reject": {
            const rejected = result;
            const diagnostic = rejected.diagnostic;
            const extensionId = rejected.extensionId;
            return Object.freeze({
                kind: "reject",
                diagnostic: snapshotDiagnostic(diagnostic, childSnapshotPath(path, "diagnostic")),
                extensionId,
            });
        }
        case "missing-owner": {
            const missing = result;
            return Object.freeze({ kind: "missing-owner", observation: missing.observation });
        }
        case "owner-deferred": {
            const deferred = result;
            return Object.freeze({ kind: "owner-deferred", observation: deferred.observation, extensionId: deferred.extensionId });
        }
        case "conflict": {
            const conflict = result;
            return Object.freeze({ kind: "conflict", observation: conflict.observation });
        }
        default:
            throw unknownKindError("checked-operation result", actualKind, path);
    }
}
function snapshotCallRequest(request, path) {
    assertRecord(request, "CheckedCallMappingRequest", path);
    assertExactOwnFields(request, [
        "call",
        "callee",
        "arguments",
        "callKind",
        "sourceSelectedSignature",
        "sourceSelectedDeclaration",
        "sourceSelectedMethodTypeArguments",
        "sourceSelectedSignatureParameters",
        "sourceSelectedSignatureKind",
        "sourceArgumentBindings",
        "sourceCallee",
        "sourceArguments",
        "sourceResult",
        "sourceReceiver",
        "optionalChain",
        "target",
    ], "CheckedCallMappingRequest", path);
    if (request.sourceArguments.length !== request.arguments.length) {
        throw new Error(`Invalid CheckedCallMappingRequest at '${formatSnapshotPath(path)}': sourceArguments length ${request.sourceArguments.length} does not match arguments length ${request.arguments.length}.`);
    }
    assertCheckedCallKind(request.callKind, childSnapshotPath(path, "callKind"));
    const sourceArguments = captureArray(request.sourceArguments, "CheckedCallMappingRequest sourceArguments", childSnapshotPath(path, "sourceArguments"));
    return Object.freeze({
        call: request.call,
        callee: request.callee,
        arguments: Object.freeze([...request.arguments]),
        callKind: request.callKind,
        ...(request.sourceSelectedSignature === undefined ? {} : { sourceSelectedSignature: request.sourceSelectedSignature }),
        ...(request.sourceSelectedDeclaration === undefined ? {} : { sourceSelectedDeclaration: request.sourceSelectedDeclaration }),
        ...(request.sourceSelectedMethodTypeArguments === undefined ? {} : {
            sourceSelectedMethodTypeArguments: snapshotMethodTypeArguments(request.sourceSelectedMethodTypeArguments),
        }),
        ...(request.sourceSelectedSignatureParameters === undefined ? {} : {
            sourceSelectedSignatureParameters: snapshotSignatureParameters(request.sourceSelectedSignatureParameters),
        }),
        ...(request.sourceSelectedSignatureKind === undefined ? {} : { sourceSelectedSignatureKind: request.sourceSelectedSignatureKind }),
        ...(request.sourceArgumentBindings === undefined ? {} : {
            sourceArgumentBindings: snapshotSelectedCallArgumentBindings(request.sourceArgumentBindings, childSnapshotPath(path, "sourceArgumentBindings"), request.arguments.length, request.sourceSelectedSignatureParameters?.length),
        }),
        sourceCallee: snapshotSelectedSourceValueEvidence(request.sourceCallee, childSnapshotPath(path, "sourceCallee")),
        sourceArguments: Object.freeze(sourceArguments.map((evidence, index) => snapshotSelectedSourceValueEvidence(evidence, indexedSnapshotPath(childSnapshotPath(path, "sourceArguments"), index)))),
        sourceResult: snapshotSelectedSourceValueEvidence(request.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(request.sourceReceiver === undefined ? {} : {
            sourceReceiver: snapshotSelectedSourceValueEvidence(request.sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        }),
        ...(request.optionalChain === undefined ? {} : { optionalChain: request.optionalChain }),
        ...(request.target === undefined ? {} : { target: request.target }),
    });
}
function snapshotPropertyRequest(request, path) {
    assertRecord(request, "CheckedPropertyAccessMappingRequest", path);
    assertExactOwnFields(request, ["expression", "receiver", "propertyName", "accessMode", "callCallee", "sourceReceiver", "sourceResult", "optionalChain", "target"], "CheckedPropertyAccessMappingRequest", path);
    assertCheckedAccessMode(request.accessMode, childSnapshotPath(path, "accessMode"));
    assertBoolean(request.callCallee, "CheckedPropertyAccessMappingRequest callCallee", childSnapshotPath(path, "callCallee"));
    return Object.freeze({
        expression: request.expression,
        receiver: request.receiver,
        propertyName: request.propertyName,
        accessMode: request.accessMode,
        callCallee: request.callCallee,
        sourceReceiver: snapshotSelectedSourceValueEvidence(request.sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        sourceResult: snapshotSelectedSourceValueEvidence(request.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(request.optionalChain === undefined ? {} : { optionalChain: request.optionalChain }),
        ...(request.target === undefined ? {} : { target: request.target }),
    });
}
function snapshotElementRequest(request, path) {
    assertRecord(request, "CheckedElementAccessMappingRequest", path);
    assertExactOwnFields(request, ["expression", "receiver", "argument", "accessMode", "callCallee", "sourceReceiver", "sourceArgument", "sourceResult", "sourceSelectedElementIndex", "optionalChain", "target"], "CheckedElementAccessMappingRequest", path);
    assertCheckedAccessMode(request.accessMode, childSnapshotPath(path, "accessMode"));
    assertBoolean(request.callCallee, "CheckedElementAccessMappingRequest callCallee", childSnapshotPath(path, "callCallee"));
    return Object.freeze({
        expression: request.expression,
        receiver: request.receiver,
        argument: request.argument,
        accessMode: request.accessMode,
        callCallee: request.callCallee,
        sourceReceiver: snapshotSelectedSourceValueEvidence(request.sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        sourceArgument: snapshotSelectedSourceValueEvidence(request.sourceArgument, childSnapshotPath(path, "sourceArgument")),
        sourceResult: snapshotSelectedSourceValueEvidence(request.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(request.sourceSelectedElementIndex === undefined ? {} : { sourceSelectedElementIndex: request.sourceSelectedElementIndex }),
        ...(request.optionalChain === undefined ? {} : { optionalChain: request.optionalChain }),
        ...(request.target === undefined ? {} : { target: request.target }),
    });
}
function snapshotOperatorRequest(request, path) {
    assertRecord(request, "CheckedOperatorMappingRequest", path);
    assertExactOwnFields(request, ["expression", "operator", "left", "right", "sourceLeft", "sourceRight", "sourceResult", "target"], "CheckedOperatorMappingRequest", path);
    return Object.freeze({
        expression: request.expression,
        operator: request.operator,
        left: request.left,
        ...(request.right === undefined ? {} : { right: request.right }),
        ...(request.sourceLeft === undefined ? {} : {
            sourceLeft: snapshotSelectedSourceValueEvidence(request.sourceLeft, childSnapshotPath(path, "sourceLeft")),
        }),
        ...(request.sourceRight === undefined ? {} : {
            sourceRight: snapshotSelectedSourceValueEvidence(request.sourceRight, childSnapshotPath(path, "sourceRight")),
        }),
        sourceResult: snapshotSelectedSourceValueEvidence(request.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(request.target === undefined ? {} : { target: request.target }),
    });
}
function snapshotIterationRequest(request, path) {
    assertRecord(request, "CheckedIterationMappingRequest", path);
    assertExactOwnFields(request, ["statement", "expression", "initializer", "kind", "sourceIterable", "sourceElement", "target"], "CheckedIterationMappingRequest", path);
    return Object.freeze({
        statement: request.statement,
        expression: request.expression,
        ...(request.initializer === undefined ? {} : { initializer: request.initializer }),
        kind: request.kind,
        sourceIterable: snapshotSelectedSourceValueEvidence(request.sourceIterable, childSnapshotPath(path, "sourceIterable")),
        sourceElement: snapshotSelectedSourceTypeEvidence(request.sourceElement, childSnapshotPath(path, "sourceElement")),
        ...(request.target === undefined ? {} : { target: request.target }),
    });
}
function snapshotConversionRequest(request, cache, path) {
    assertRecord(request, "CheckedConversionMappingRequest", path);
    const base = {
        expression: request.expression,
        source: snapshotSelectedSourceValueEvidence(request.source, childSnapshotPath(path, "source")),
        ...(request.targetPlatform === undefined ? {} : { targetPlatform: request.targetPlatform }),
    };
    if (request.conversionKind === "call-argument") {
        assertExactOwnFields(request, [
            "expression",
            "source",
            "targetPlatform",
            "conversionKind",
            "target",
            "call",
            "slot",
            "sourceArgumentIndex",
            "targetParameterIndex",
            "sourceForm",
            "spreadElementIndex",
            "targetForm",
            "targetParameter",
            "sourceSelectedSignature",
            "selectedSignature",
            "sourceBinding",
        ], "call-argument CheckedConversionMappingRequest", path);
        const selectedSignature = snapshotSelectedTargetSignature(request.selectedSignature, childSnapshotPath(path, "selectedSignature"), cache);
        const slot = cache.targetCallArgumentConversionSlots.get(request.slot);
        if (slot === undefined) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "slot"))}': slot is not one of the selected target signature's canonical conversion slots.`);
        }
        const target = request.target;
        const originalCanonicalTarget = request.targetForm === "params-element"
            ? request.targetParameter.type.kind === "array"
                ? request.targetParameter.type.element
                : undefined
            : request.targetParameter.type;
        if (originalCanonicalTarget === undefined || target !== originalCanonicalTarget) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "target"))}': target does not match the canonical selected target parameter conversion form.`);
        }
        const targetParameter = snapshotTargetParameter(request.targetParameter, childSnapshotPath(path, "targetParameter"), cache);
        const canonicalTarget = request.targetForm === "params-element"
            ? targetParameter.type.element
            : targetParameter.type;
        const sourceBinding = snapshotSelectedCallArgumentBinding(request.sourceBinding, childSnapshotPath(path, "sourceBinding"));
        const canonicalSourceBinding = selectedSignature.sourceArgumentBindings[sourceBinding.effectiveArgumentIndex];
        if (canonicalSourceBinding === undefined || !selectedCallArgumentBindingsEqual(canonicalSourceBinding, sourceBinding)) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "sourceBinding"))}': binding is not the canonical selected source argument binding at effective argument index ${sourceBinding.effectiveArgumentIndex}.`);
        }
        if (request.sourceArgumentIndex !== sourceBinding.sourceArgumentIndex
            || request.sourceForm !== sourceBinding.sourceForm
            || request.spreadElementIndex !== sourceBinding.spreadElementIndex) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(path)}': conversion source slot does not match its selected source argument binding.`);
        }
        if (slot.sourceArgumentIndex !== sourceBinding.sourceArgumentIndex
            || slot.sourceForm !== sourceBinding.sourceForm
            || slot.spreadElementIndex !== sourceBinding.spreadElementIndex) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "slot"))}': target conversion slot does not match its selected source argument binding.`);
        }
        return Object.freeze({
            ...base,
            conversionKind: "call-argument",
            target: canonicalTarget,
            call: request.call,
            slot,
            sourceArgumentIndex: request.sourceArgumentIndex,
            targetParameterIndex: request.targetParameterIndex,
            sourceForm: request.sourceForm,
            ...(request.spreadElementIndex === undefined ? {} : { spreadElementIndex: request.spreadElementIndex }),
            targetForm: request.targetForm,
            targetParameter,
            ...(request.sourceSelectedSignature === undefined ? {} : { sourceSelectedSignature: request.sourceSelectedSignature }),
            selectedSignature,
            sourceBinding: canonicalSourceBinding,
        });
    }
    assertExactOwnFields(request, [
        "expression",
        "source",
        "targetPlatform",
        "conversionKind",
        "target",
        "assertionKind",
        "explicitTargetTypeNode",
    ], "assertion CheckedConversionMappingRequest", path);
    return Object.freeze({
        ...base,
        conversionKind: "assertion",
        target: snapshotSelectedSourceTypeEvidence(request.target, childSnapshotPath(path, "target")),
        assertionKind: request.assertionKind,
        explicitTargetTypeNode: request.explicitTargetTypeNode,
    });
}
export function snapshotCheckedOperationResponse(observation, response) {
    const path = createSnapshotPath(`checked-operation response[${observation}]`);
    assertRecord(response, "checked-operation response", path);
    if (checkedOperationResponseSnapshots.get(response) === observation) {
        return response;
    }
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall: {
            const call = response;
            const kind = readDiscriminant(call, "checked call mapping response", path);
            if (kind === "source") {
                assertExactOwnFields(call, ["kind"], "source checked call mapping response", path);
                return checkedOperationResponseSnapshot(observation, Object.freeze({ kind: "source" }));
            }
            if (kind !== "target") {
                throw unknownKindError("checked call mapping response", kind, path);
            }
            const targetCall = call;
            assertExactOwnFields(targetCall, ["kind", "selectedSignature", "argumentConversions"], "target checked call mapping response", path);
            const selectedSignature = targetCall.selectedSignature;
            const argumentConversions = targetCall.argumentConversions;
            return checkedOperationResponseSnapshot(observation, Object.freeze({
                kind: "target",
                selectedSignature: snapshotTargetSignatureSelection(selectedSignature, childSnapshotPath(path, "selectedSignature")),
                argumentConversions: snapshotArgumentConversionSlots(argumentConversions, childSnapshotPath(path, "argumentConversions")),
            }));
        }
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
        case ExtensionObservationPoint.mapCheckedElementAccess:
        case ExtensionObservationPoint.mapCheckedOperator:
        case ExtensionObservationPoint.mapCheckedIteration:
            return checkedOperationResponseSnapshot(observation, snapshotOperationMappingResult(response, path));
        case ExtensionObservationPoint.mapCheckedConversion: {
            const conversion = response;
            assertExactOwnFields(conversion, ["convertedType", "operation"], "checked conversion mapping response", path);
            const convertedType = conversion.convertedType;
            const operation = conversion.operation;
            return checkedOperationResponseSnapshot(observation, Object.freeze({
                ...(convertedType === undefined ? {} : {
                    convertedType: snapshotTargetTypeRef(convertedType, childSnapshotPath(path, "convertedType")),
                }),
                ...(operation === undefined ? {} : {
                    operation: snapshotTargetOperation(operation, childSnapshotPath(path, "operation")),
                }),
            }));
        }
    }
}
function checkedOperationResponseSnapshot(observation, snapshot) {
    checkedOperationResponseSnapshots.set(snapshot, observation);
    return snapshot;
}
function snapshotOperationMappingResult(result, path) {
    assertRecord(result, "CheckedOperationMappingResult", path);
    assertExactOwnFields(result, ["operation", "resultType", "provenance"], "CheckedOperationMappingResult", path);
    const operation = result.operation;
    const resultType = result.resultType;
    const provenance = result.provenance;
    return Object.freeze({
        operation: snapshotTargetOperation(operation, childSnapshotPath(path, "operation")),
        ...(resultType === undefined ? {} : {
            resultType: snapshotTargetTypeRef(resultType, childSnapshotPath(path, "resultType")),
        }),
        ...(provenance === undefined ? {} : {
            provenance: snapshotOperationProvenance(provenance, childSnapshotPath(path, "provenance")),
        }),
    });
}
function snapshotTargetSignatureSelection(selection, path, cache) {
    assertRecord(selection, "TargetSignatureSelection", path);
    assertExactOwnFields(selection, ["member", "targetTypeArguments", "providerDeclaration"], "TargetSignatureSelection", path);
    const member = selection.member;
    const targetTypeArguments = selection.targetTypeArguments;
    const providerDeclaration = selection.providerDeclaration;
    const memberSnapshot = snapshotTargetMember(member, childSnapshotPath(path, "member"), cache);
    if (memberSnapshot.kind !== "method" && memberSnapshot.kind !== "constructor") {
        throw new Error(`Invalid selected target call member at '${formatSnapshotPath(childSnapshotPath(path, "member.kind"))}': '${memberSnapshot.kind}' is not callable.`);
    }
    const targetTypeParameterCount = memberSnapshot.typeParameters?.length ?? 0;
    const capturedTargetTypeArguments = targetTypeArguments === undefined
        ? []
        : captureArray(targetTypeArguments, "TargetSignatureSelection targetTypeArguments", childSnapshotPath(path, "targetTypeArguments"));
    if (capturedTargetTypeArguments.length !== targetTypeParameterCount) {
        throw new Error(`Invalid TargetSignatureSelection at '${formatSnapshotPath(path)}': selected target type argument count ${capturedTargetTypeArguments.length} does not match target member type parameter count ${targetTypeParameterCount}.`);
    }
    return Object.freeze({
        member: memberSnapshot,
        ...(targetTypeParameterCount === 0 ? {} : {
            targetTypeArguments: snapshotTargetTypeRefArray(capturedTargetTypeArguments, childSnapshotPath(path, "targetTypeArguments")),
        }),
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
    });
}
function snapshotSelectedTargetSignature(selection, path, cache) {
    assertRecord(selection, "SelectedTargetSignatureFact", path);
    assertExactOwnFields(selection, [
        "member",
        "targetTypeArguments",
        "providerDeclaration",
        "argumentConversions",
        "sourceSelectedMethodTypeArguments",
        "sourceSelectedSignatureParameters",
        "sourceSelectedSignatureKind",
        "sourceCallKind",
        "sourceArgumentBindings",
        "sourceSignature",
        "sourceDeclaration",
        "sourceCallee",
        "sourceArguments",
        "sourceResult",
        "sourceOptionalChain",
        "sourceReceiver",
    ], "SelectedTargetSignatureFact", path);
    const cached = cache.selectedTargetSignatures.get(selection);
    if (cached !== undefined) {
        return cached;
    }
    const targetSelection = snapshotTargetSignatureSelection({
        member: selection.member,
        ...(selection.targetTypeArguments === undefined ? {} : { targetTypeArguments: selection.targetTypeArguments }),
        ...(selection.providerDeclaration === undefined ? {} : { providerDeclaration: selection.providerDeclaration }),
    }, path, cache);
    const argumentConversions = snapshotArgumentConversionSlots(selection.argumentConversions, childSnapshotPath(path, "argumentConversions"), cache);
    const sourceSelectedMethodTypeArguments = selection.sourceSelectedMethodTypeArguments;
    const sourceSelectedSignatureParameters = selection.sourceSelectedSignatureParameters;
    const sourceSelectedSignatureKind = selection.sourceSelectedSignatureKind;
    const sourceCallKind = selection.sourceCallKind;
    const sourceArgumentBindings = selection.sourceArgumentBindings;
    const sourceSignature = selection.sourceSignature;
    const sourceDeclaration = selection.sourceDeclaration;
    const sourceCallee = selection.sourceCallee;
    const sourceArguments = selection.sourceArguments;
    const sourceResult = selection.sourceResult;
    const sourceReceiver = selection.sourceReceiver;
    const sourceOptionalChain = selection.sourceOptionalChain;
    if (sourceSelectedSignatureKind !== undefined
        && sourceSelectedSignatureKind !== "resolved"
        && sourceSelectedSignatureKind !== "untyped"
        && sourceSelectedSignatureKind !== "error"
        && sourceSelectedSignatureKind !== "silent-never") {
        throw invalidEnumValueError("SelectedTargetSignatureFact sourceSelectedSignatureKind", sourceSelectedSignatureKind, childSnapshotPath(path, "sourceSelectedSignatureKind"));
    }
    assertCheckedCallKind(sourceCallKind, childSnapshotPath(path, "sourceCallKind"));
    for (const [field, value] of [
        ["sourceSignature", sourceSignature],
        ["sourceDeclaration", sourceDeclaration],
    ]) {
        if (value !== undefined) {
            assertRecord(value, `SelectedTargetSignatureFact ${field}`, childSnapshotPath(path, field));
        }
    }
    if (sourceOptionalChain !== undefined) {
        assertBoolean(sourceOptionalChain, "SelectedTargetSignatureFact sourceOptionalChain", childSnapshotPath(path, "sourceOptionalChain"));
    }
    const capturedSourceArguments = captureArray(sourceArguments, "SelectedTargetSignatureFact sourceArguments", childSnapshotPath(path, "sourceArguments"));
    const snapshot = Object.freeze({
        member: targetSelection.member,
        argumentConversions,
        ...(targetSelection.targetTypeArguments === undefined ? {} : { targetTypeArguments: targetSelection.targetTypeArguments }),
        ...(targetSelection.providerDeclaration === undefined ? {} : { providerDeclaration: targetSelection.providerDeclaration }),
        ...(sourceSelectedMethodTypeArguments === undefined ? {} : {
            sourceSelectedMethodTypeArguments: snapshotMethodTypeArguments(sourceSelectedMethodTypeArguments),
        }),
        ...(sourceSelectedSignatureParameters === undefined ? {} : {
            sourceSelectedSignatureParameters: snapshotSignatureParameters(sourceSelectedSignatureParameters),
        }),
        ...(sourceSelectedSignatureKind === undefined ? {} : { sourceSelectedSignatureKind }),
        sourceCallKind,
        sourceArgumentBindings: snapshotSelectedCallArgumentBindings(sourceArgumentBindings, childSnapshotPath(path, "sourceArgumentBindings"), capturedSourceArguments.length, sourceSelectedSignatureParameters?.length),
        ...(sourceSignature === undefined ? {} : { sourceSignature }),
        ...(sourceDeclaration === undefined ? {} : { sourceDeclaration }),
        sourceCallee: snapshotSelectedSourceValueEvidence(sourceCallee, childSnapshotPath(path, "sourceCallee")),
        sourceArguments: Object.freeze(capturedSourceArguments.map((evidence, index) => snapshotSelectedSourceValueEvidence(evidence, indexedSnapshotPath(childSnapshotPath(path, "sourceArguments"), index)))),
        sourceResult: snapshotSelectedSourceValueEvidence(sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(sourceOptionalChain === undefined ? {} : { sourceOptionalChain }),
        ...(sourceReceiver === undefined ? {} : {
            sourceReceiver: snapshotSelectedSourceValueEvidence(sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        }),
    });
    cache.selectedTargetSignatures.set(selection, snapshot);
    cache.selectedTargetSignatures.set(snapshot, snapshot);
    return snapshot;
}
function snapshotTargetMember(member, path, cache) {
    assertRecord(member, "TargetMember", path);
    assertExactOwnFields(member, ["id", "sourceName", "targetName", "kind", "static", "parameters", "returnType", "typeParameters", "overloadGroup", "providerDeclaration"], "TargetMember", path);
    const id = member.id;
    const sourceName = member.sourceName;
    const targetName = member.targetName;
    const kind = member.kind;
    const static_ = member.static;
    const parameters = member.parameters;
    const returnType = member.returnType;
    const typeParameters = member.typeParameters;
    const overloadGroup = member.overloadGroup;
    const providerDeclaration = member.providerDeclaration;
    assertString(id, "TargetMember id", childSnapshotPath(path, "id"));
    assertString(sourceName, "TargetMember sourceName", childSnapshotPath(path, "sourceName"));
    assertString(targetName, "TargetMember targetName", childSnapshotPath(path, "targetName"));
    assertTargetMemberKind(kind, childSnapshotPath(path, "kind"));
    if (static_ !== undefined) {
        assertBoolean(static_, "TargetMember static", childSnapshotPath(path, "static"));
    }
    const capturedParameters = captureArray(parameters, "TargetMember parameters", childSnapshotPath(path, "parameters"));
    if (overloadGroup !== undefined) {
        assertString(overloadGroup, "TargetMember overloadGroup", childSnapshotPath(path, "overloadGroup"));
    }
    if (typeParameters !== undefined) {
        const seenNames = new Set();
        for (const [index, parameter] of captureArray(typeParameters, "TargetMember typeParameters", childSnapshotPath(path, "typeParameters")).entries()) {
            assertRecord(parameter, "TargetTypeParameter", indexedSnapshotPath(childSnapshotPath(path, "typeParameters"), index));
            if (seenNames.has(parameter.name)) {
                throw new Error(`Invalid TargetMember at '${formatSnapshotPath(path)}': duplicate target type parameter '${parameter.name}'.`);
            }
            seenNames.add(parameter.name);
        }
    }
    return Object.freeze({
        id,
        sourceName,
        targetName,
        kind,
        ...(static_ === undefined ? {} : { static: static_ }),
        parameters: Object.freeze(capturedParameters.map((parameter, index) => snapshotTargetParameter(parameter, indexedSnapshotPath(childSnapshotPath(path, "parameters"), index), cache))),
        ...(returnType === undefined ? {} : {
            returnType: snapshotTargetTypeRef(returnType, childSnapshotPath(path, "returnType")),
        }),
        ...(typeParameters === undefined ? {} : {
            typeParameters: snapshotTargetTypeParameterArray(typeParameters, childSnapshotPath(path, "typeParameters")),
        }),
        ...(overloadGroup === undefined ? {} : { overloadGroup }),
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
    });
}
function snapshotTargetParameter(parameter, path, cache) {
    assertRecord(parameter, "TargetParameter", path);
    assertExactOwnFields(parameter, ["name", "type", "passingMode", "optional", "paramsArray"], "TargetParameter", path);
    const cached = cache?.targetParameters.get(parameter);
    if (cached !== undefined) {
        return cached;
    }
    const name = parameter.name;
    const type = parameter.type;
    const passingMode = parameter.passingMode;
    const optional = parameter.optional;
    const paramsArray = parameter.paramsArray;
    assertString(name, "TargetParameter name", childSnapshotPath(path, "name"));
    assertArgumentPassingMode(passingMode, childSnapshotPath(path, "passingMode"));
    if (optional !== undefined) {
        assertBoolean(optional, "TargetParameter optional", childSnapshotPath(path, "optional"));
    }
    if (paramsArray !== undefined) {
        assertBoolean(paramsArray, "TargetParameter paramsArray", childSnapshotPath(path, "paramsArray"));
    }
    const snapshot = Object.freeze({
        name,
        type: snapshotTargetTypeRef(type, childSnapshotPath(path, "type")),
        passingMode,
        ...(optional === undefined ? {} : { optional }),
        ...(paramsArray === undefined ? {} : { paramsArray }),
    });
    cache?.targetParameters.set(parameter, snapshot);
    cache?.targetParameters.set(snapshot, snapshot);
    return snapshot;
}
function snapshotTargetTypeParameter(parameter, path) {
    assertRecord(parameter, "TargetTypeParameter", path);
    assertExactOwnFields(parameter, ["name", "constraints", "variance"], "TargetTypeParameter", path);
    const name = parameter.name;
    const constraints = parameter.constraints;
    const variance = parameter.variance;
    assertString(name, "TargetTypeParameter name", childSnapshotPath(path, "name"));
    if (variance !== undefined) {
        assertTargetTypeParameterVariance(variance, childSnapshotPath(path, "variance"));
    }
    return Object.freeze({
        name,
        ...(constraints === undefined ? {} : {
            constraints: snapshotTargetConstraintArray(constraints, childSnapshotPath(path, "constraints")),
        }),
        ...(variance === undefined ? {} : { variance }),
    });
}
function snapshotTargetTypeParameterArray(parameters, path) {
    const captured = captureArray(parameters, "TargetTypeParameter array", path);
    return Object.freeze(captured.map((parameter, index) => snapshotTargetTypeParameter(parameter, indexedSnapshotPath(path, index))));
}
function snapshotTargetConstraintArray(constraints, path) {
    const captured = captureArray(constraints, "TargetConstraint array", path);
    return Object.freeze(captured.map((constraint, index) => snapshotTargetConstraint(constraint, indexedSnapshotPath(path, index))));
}
function snapshotTargetConstraint(constraint, path) {
    assertRecord(constraint, "TargetConstraint", path);
    const actualKind = readDiscriminant(constraint, "TargetConstraint", path);
    switch (actualKind) {
        case "implements": {
            const implementsConstraint = constraint;
            assertExactOwnFields(implementsConstraint, ["kind", "contract", "typeArguments"], "implements TargetConstraint", path);
            const contract = implementsConstraint.contract;
            const typeArguments = implementsConstraint.typeArguments;
            assertString(contract, "TargetConstraint contract", childSnapshotPath(path, "contract"));
            return Object.freeze({
                kind: "implements",
                contract,
                ...(typeArguments === undefined ? {} : {
                    typeArguments: snapshotTargetTypeRefArray(typeArguments, childSnapshotPath(path, "typeArguments")),
                }),
            });
        }
        case "lifetime": {
            const lifetime = constraint;
            assertExactOwnFields(lifetime, ["kind", "name"], "lifetime TargetConstraint", path);
            const name = lifetime.name;
            assertString(name, "TargetConstraint lifetime name", childSnapshotPath(path, "name"));
            return Object.freeze({ kind: "lifetime", name });
        }
        case "target-specific": {
            const targetConstraint = constraint;
            assertExactOwnFields(targetConstraint, ["kind", "target", "name", "value"], "target-specific TargetConstraint", path);
            const target = targetConstraint.target;
            const name = targetConstraint.name;
            const value = targetConstraint.value;
            assertString(target, "TargetConstraint target", childSnapshotPath(path, "target"));
            assertString(name, "TargetConstraint name", childSnapshotPath(path, "name"));
            return Object.freeze({
                kind: "target-specific",
                target,
                name,
                ...snapshotTargetOwnedOpaqueIdentity(value),
            });
        }
        case "value-type":
        case "reference-type":
        case "constructible":
        case "unmanaged":
        case "copy":
        case "clone":
        case "default":
        case "sized":
            assertExactOwnFields(constraint, ["kind"], `${actualKind} TargetConstraint`, path);
            return Object.freeze({ kind: actualKind });
        default:
            throw unknownKindError("TargetConstraint", actualKind, path);
    }
}
function snapshotTargetTypeRefArray(types, path) {
    const captured = captureTargetTypeRefArray(types, path);
    return Object.freeze(captured.map((type, index) => snapshotTargetTypeRef(type, indexedSnapshotPath(path, index))));
}
function snapshotTargetTypeRef(type, path) {
    assertRecord(type, "TargetTypeRef", path);
    const snapshots = new WeakMap();
    const capturedTypes = new WeakMap();
    const activePaths = new WeakMap();
    const stack = [{ stage: "enter", type, path }];
    while (stack.length !== 0) {
        const frame = stack.pop();
        if (frame === undefined) {
            throw new Error("TargetTypeRef snapshot traversal lost its active frame.");
        }
        if (frame.stage === "exit") {
            const captured = capturedTypes.get(frame.type);
            if (captured === undefined) {
                throw new Error("TargetTypeRef snapshot traversal lost its captured value.");
            }
            const snapshot = captured.build(snapshots);
            snapshots.set(frame.type, snapshot);
            activePaths.delete(frame.type);
            continue;
        }
        assertRecord(frame.type, "TargetTypeRef", frame.path);
        if (snapshots.has(frame.type)) {
            continue;
        }
        const activePath = activePaths.get(frame.type);
        if (activePath !== undefined) {
            throw new Error(`Invalid TargetTypeRef at '${formatSnapshotPath(frame.path)}': cycle references the active TargetTypeRef at '${formatSnapshotPath(activePath)}'.`);
        }
        const captured = captureTargetTypeRef(frame.type, frame.path);
        capturedTypes.set(frame.type, captured);
        activePaths.set(frame.type, frame.path);
        stack.push({ stage: "exit", type: frame.type, path: frame.path });
        for (let index = captured.children.length - 1; index >= 0; index -= 1) {
            const child = captured.children[index];
            if (child !== undefined) {
                stack.push({ stage: "enter", type: child.type, path: child.path });
            }
        }
    }
    const snapshot = snapshots.get(type);
    if (snapshot === undefined) {
        throw new Error("TargetTypeRef snapshot traversal did not produce a root snapshot.");
    }
    return snapshot;
}
function captureTargetTypeRef(type, path) {
    const actualKind = readDiscriminant(type, "TargetTypeRef", path);
    switch (actualKind) {
        case "source-primitive": {
            const source = type;
            assertExactOwnFields(source, ["kind", "name"], "source-primitive TargetTypeRef", path);
            const name = source.name;
            assertSourcePrimitiveKind(name, childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "source-primitive", name }) };
        }
        case "source-global": {
            const source = type;
            assertExactOwnFields(source, ["kind", "name", "typeArguments"], "source-global TargetTypeRef", path);
            const name = source.name;
            const typeArguments = captureOptionalTargetTypeRefArray(source.typeArguments, childSnapshotPath(path, "typeArguments"));
            assertString(name, "TargetTypeRef source global name", childSnapshotPath(path, "name"));
            return {
                children: targetTypeRefChildren(typeArguments, childSnapshotPath(path, "typeArguments")),
                build: (snapshots) => Object.freeze({
                    kind: "source-global",
                    name,
                    ...(typeArguments === undefined ? {} : {
                        typeArguments: getTargetTypeRefSnapshotArray(typeArguments, childSnapshotPath(path, "typeArguments"), snapshots),
                    }),
                }),
            };
        }
        case "target-named": {
            const source = type;
            assertExactOwnFields(source, ["kind", "id", "typeArguments"], "target-named TargetTypeRef", path);
            const id = source.id;
            const typeArguments = captureOptionalTargetTypeRefArray(source.typeArguments, childSnapshotPath(path, "typeArguments"));
            assertString(id, "TargetTypeRef target id", childSnapshotPath(path, "id"));
            return {
                children: targetTypeRefChildren(typeArguments, childSnapshotPath(path, "typeArguments")),
                build: (snapshots) => Object.freeze({
                    kind: "target-named",
                    id,
                    ...(typeArguments === undefined ? {} : {
                        typeArguments: getTargetTypeRefSnapshotArray(typeArguments, childSnapshotPath(path, "typeArguments"), snapshots),
                    }),
                }),
            };
        }
        case "type-parameter": {
            const source = type;
            assertExactOwnFields(source, ["kind", "name"], "type-parameter TargetTypeRef", path);
            const name = source.name;
            assertString(name, "TargetTypeRef type parameter name", childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "type-parameter", name }) };
        }
        case "array": {
            const source = type;
            assertExactOwnFields(source, ["kind", "element", "rank"], "array TargetTypeRef", path);
            const element = source.element;
            const rank = source.rank;
            if (rank !== undefined) {
                assertPositiveInteger(rank, "TargetTypeRef array rank", childSnapshotPath(path, "rank"));
            }
            return {
                children: [{ type: element, path: childSnapshotPath(path, "element") }],
                build: (snapshots) => Object.freeze({
                    kind: "array",
                    element: getTargetTypeRefSnapshot(element, childSnapshotPath(path, "element"), snapshots),
                    ...(rank === undefined ? {} : { rank }),
                }),
            };
        }
        case "tuple": {
            const source = type;
            assertExactOwnFields(source, ["kind", "elements"], "tuple TargetTypeRef", path);
            const elements = captureTargetTypeRefArray(source.elements, childSnapshotPath(path, "elements"));
            return {
                children: targetTypeRefChildren(elements, childSnapshotPath(path, "elements")),
                build: (snapshots) => Object.freeze({
                    kind: "tuple",
                    elements: getTargetTypeRefSnapshotArray(elements, childSnapshotPath(path, "elements"), snapshots),
                }),
            };
        }
        case "pointer": {
            const source = type;
            assertExactOwnFields(source, ["kind", "pointee", "mutability"], "pointer TargetTypeRef", path);
            const pointee = source.pointee;
            const mutability = source.mutability;
            if (mutability !== undefined) {
                assertPointerMutability(mutability, childSnapshotPath(path, "mutability"));
            }
            return {
                children: [{ type: pointee, path: childSnapshotPath(path, "pointee") }],
                build: (snapshots) => Object.freeze({
                    kind: "pointer",
                    pointee: getTargetTypeRefSnapshot(pointee, childSnapshotPath(path, "pointee"), snapshots),
                    ...(mutability === undefined ? {} : { mutability }),
                }),
            };
        }
        case "function-pointer": {
            const source = type;
            assertExactOwnFields(source, ["kind", "args", "result", "abi"], "function-pointer TargetTypeRef", path);
            const args = captureTargetTypeRefArray(source.args, childSnapshotPath(path, "args"));
            const result = source.result;
            const sourceAbi = source.abi;
            const abi = sourceAbi === undefined
                ? undefined
                : captureStringArray(sourceAbi, "TargetTypeRef function-pointer ABI", childSnapshotPath(path, "abi"));
            return {
                children: [
                    ...targetTypeRefChildren(args, childSnapshotPath(path, "args")),
                    { type: result, path: childSnapshotPath(path, "result") },
                ],
                build: (snapshots) => Object.freeze({
                    kind: "function-pointer",
                    args: getTargetTypeRefSnapshotArray(args, childSnapshotPath(path, "args"), snapshots),
                    result: getTargetTypeRefSnapshot(result, childSnapshotPath(path, "result"), snapshots),
                    ...(abi === undefined ? {} : { abi }),
                }),
            };
        }
        case "opaque": {
            const source = type;
            assertExactOwnFields(source, ["kind", "id"], "opaque TargetTypeRef", path);
            const id = source.id;
            assertString(id, "TargetTypeRef opaque id", childSnapshotPath(path, "id"));
            return { children: [], build: () => Object.freeze({ kind: "opaque", id }) };
        }
        case "associated-type": {
            const source = type;
            assertExactOwnFields(source, ["kind", "owner", "name"], "associated-type TargetTypeRef", path);
            const owner = source.owner;
            const name = source.name;
            assertString(name, "TargetTypeRef associated type name", childSnapshotPath(path, "name"));
            return {
                children: [{ type: owner, path: childSnapshotPath(path, "owner") }],
                build: (snapshots) => Object.freeze({
                    kind: "associated-type",
                    owner: getTargetTypeRefSnapshot(owner, childSnapshotPath(path, "owner"), snapshots),
                    name,
                }),
            };
        }
        case "lifetime": {
            const source = type;
            assertExactOwnFields(source, ["kind", "name"], "lifetime TargetTypeRef", path);
            const name = source.name;
            assertString(name, "TargetTypeRef lifetime name", childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "lifetime", name }) };
        }
        case "target-specific": {
            const source = type;
            assertExactOwnFields(source, ["kind", "target", "name", "value"], "target-specific TargetTypeRef", path);
            const target = source.target;
            const name = source.name;
            const value = source.value;
            assertString(target, "TargetTypeRef target", childSnapshotPath(path, "target"));
            assertString(name, "TargetTypeRef name", childSnapshotPath(path, "name"));
            return {
                children: [],
                build: () => Object.freeze({
                    kind: "target-specific",
                    target,
                    name,
                    ...snapshotTargetOwnedOpaqueIdentity(value),
                }),
            };
        }
        default:
            throw unknownKindError("TargetTypeRef", actualKind, path);
    }
}
function captureOptionalTargetTypeRefArray(types, path) {
    return types === undefined ? undefined : captureTargetTypeRefArray(types, path);
}
function captureTargetTypeRefArray(types, path) {
    assertArray(types, "TargetTypeRef array", path);
    const captured = [];
    const length = types.length;
    for (let index = 0; index < length; index += 1) {
        captured.push(types[index]);
    }
    return Object.freeze(captured);
}
function targetTypeRefChildren(types, path) {
    if (types === undefined) {
        return [];
    }
    const children = [];
    for (let index = 0; index < types.length; index += 1) {
        children.push({ type: types[index], path: indexedSnapshotPath(path, index) });
    }
    return children;
}
function getTargetTypeRefSnapshotArray(types, path, snapshots) {
    const result = [];
    for (let index = 0; index < types.length; index += 1) {
        result.push(getTargetTypeRefSnapshot(types[index], indexedSnapshotPath(path, index), snapshots));
    }
    return Object.freeze(result);
}
function getTargetTypeRefSnapshot(type, path, snapshots) {
    assertRecord(type, "TargetTypeRef", path);
    const snapshot = snapshots.get(type);
    if (snapshot === undefined) {
        throw new Error(`TargetTypeRef snapshot at '${formatSnapshotPath(path)}' was not completed before its parent.`);
    }
    return snapshot;
}
// target-specific.value is target-owned opaque identity: preserve it exactly and never inspect, clone, or freeze it.
function snapshotTargetOwnedOpaqueIdentity(value) {
    return value === undefined ? {} : { value };
}
export function snapshotTargetOperationFact(operation) {
    return snapshotTargetOperation(operation, createSnapshotPath("target operation fact"));
}
export function snapshotSelectedTargetSignatureFact(selection, cache = createCheckedOperationRequestSnapshotCache()) {
    return snapshotSelectedTargetSignature(selection, createSnapshotPath("selected target signature fact"), cache);
}
function snapshotTargetOperation(operation, path) {
    assertRecord(operation, "TargetOperationFact", path);
    assertExactOwnFields(operation, ["operationId", "operationKind", "targetOperation", "resultType", "evidence", "provenance"], "TargetOperationFact", path);
    const operationId = operation.operationId;
    const operationKind = operation.operationKind;
    const targetOperation = operation.targetOperation;
    const resultType = operation.resultType;
    const evidence = operation.evidence;
    const provenance = operation.provenance;
    assertString(operationId, "TargetOperationFact operationId", childSnapshotPath(path, "operationId"));
    assertTargetOperationKind(operationKind, childSnapshotPath(path, "operationKind"));
    assertString(targetOperation, "TargetOperationFact targetOperation", childSnapshotPath(path, "targetOperation"));
    return Object.freeze({
        operationId,
        operationKind,
        targetOperation,
        ...(resultType === undefined ? {} : {
            resultType: snapshotTargetTypeRef(resultType, childSnapshotPath(path, "resultType")),
        }),
        ...(evidence === undefined ? {} : {
            evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
        }),
        ...(provenance === undefined ? {} : {
            provenance: snapshotOperationProvenance(provenance, childSnapshotPath(path, "provenance")),
        }),
    });
}
function snapshotOperationProvenance(provenance, path) {
    assertRecord(provenance, "TargetOperationProvenance", path);
    assertExactOwnFields(provenance, ["providerDeclaration", "sourceExpression", "sourceReceiver", "sourceCallee", "sourceSelectedSymbol", "sourceSelectedDeclaration", "sourceSelectedSignature", "sourceResultType", "sourceReceiverType", "sourceOptionalChain", "sourceAccessMode", "sourceCallCallee"], "TargetOperationProvenance", path);
    const providerDeclaration = provenance.providerDeclaration;
    const sourceExpression = provenance.sourceExpression;
    const sourceReceiver = provenance.sourceReceiver;
    const sourceCallee = provenance.sourceCallee;
    const sourceSelectedSymbol = provenance.sourceSelectedSymbol;
    const sourceSelectedDeclaration = provenance.sourceSelectedDeclaration;
    const sourceSelectedSignature = provenance.sourceSelectedSignature;
    const sourceResultType = provenance.sourceResultType;
    const sourceReceiverType = provenance.sourceReceiverType;
    const sourceOptionalChain = provenance.sourceOptionalChain;
    const sourceAccessMode = provenance.sourceAccessMode;
    const sourceCallCallee = provenance.sourceCallCallee;
    for (const [field, value] of [
        ["sourceExpression", sourceExpression],
        ["sourceReceiver", sourceReceiver],
        ["sourceCallee", sourceCallee],
        ["sourceSelectedSymbol", sourceSelectedSymbol],
        ["sourceSelectedDeclaration", sourceSelectedDeclaration],
        ["sourceSelectedSignature", sourceSelectedSignature],
        ["sourceResultType", sourceResultType],
        ["sourceReceiverType", sourceReceiverType],
    ]) {
        if (value !== undefined) {
            assertRecord(value, `TargetOperationProvenance ${field}`, childSnapshotPath(path, field));
        }
    }
    if (sourceOptionalChain !== undefined) {
        assertBoolean(sourceOptionalChain, "TargetOperationProvenance sourceOptionalChain", childSnapshotPath(path, "sourceOptionalChain"));
    }
    if (sourceAccessMode !== undefined) {
        assertCheckedAccessMode(sourceAccessMode, childSnapshotPath(path, "sourceAccessMode"));
    }
    if (sourceCallCallee !== undefined) {
        assertBoolean(sourceCallCallee, "TargetOperationProvenance sourceCallCallee", childSnapshotPath(path, "sourceCallCallee"));
    }
    return Object.freeze({
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
        ...(sourceExpression === undefined ? {} : { sourceExpression }),
        ...(sourceReceiver === undefined ? {} : { sourceReceiver }),
        ...(sourceCallee === undefined ? {} : { sourceCallee }),
        ...(sourceSelectedSymbol === undefined ? {} : { sourceSelectedSymbol }),
        ...(sourceSelectedDeclaration === undefined ? {} : { sourceSelectedDeclaration }),
        ...(sourceSelectedSignature === undefined ? {} : { sourceSelectedSignature }),
        ...(sourceResultType === undefined ? {} : { sourceResultType }),
        ...(sourceReceiverType === undefined ? {} : { sourceReceiverType }),
        ...(sourceOptionalChain === undefined ? {} : { sourceOptionalChain }),
        ...(sourceAccessMode === undefined ? {} : { sourceAccessMode }),
        ...(sourceCallCallee === undefined ? {} : { sourceCallCallee }),
    });
}
function assertCheckedCallKind(value, path) {
    if (value !== "call" && value !== "construct") {
        throw new Error(`Invalid CheckedCallMappingRequest at '${formatSnapshotPath(path)}': callKind must be 'call' or 'construct'.`);
    }
}
function assertCheckedAccessMode(value, path) {
    if (value !== "read" && value !== "write" && value !== "read-write" && value !== "delete") {
        throw new Error(`Invalid checked access evidence at '${formatSnapshotPath(path)}': accessMode must be 'read', 'write', 'read-write', or 'delete'.`);
    }
}
function snapshotProviderDeclaration(declaration, path) {
    assertRecord(declaration, "ProviderDeclarationIdentity", path);
    assertExactOwnFields(declaration, ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "artifactFileName", "exportName", "exportId", "memberName", "memberKey", "memberId", "memberStatic", "signatureId", "targetIdentity"], "ProviderDeclarationIdentity", path);
    const providerId = declaration.providerId;
    const providerVersion = declaration.providerVersion;
    const providerModuleId = declaration.providerModuleId;
    const moduleSpecifier = declaration.moduleSpecifier;
    const artifactFileName = declaration.artifactFileName;
    const exportName = declaration.exportName;
    const exportId = declaration.exportId;
    const memberName = declaration.memberName;
    const memberKey = declaration.memberKey;
    const memberId = declaration.memberId;
    const memberStatic = declaration.memberStatic;
    const signatureId = declaration.signatureId;
    const targetIdentity = declaration.targetIdentity;
    assertString(providerId, "ProviderDeclarationIdentity providerId", childSnapshotPath(path, "providerId"));
    if (providerVersion !== undefined) {
        assertString(providerVersion, "ProviderDeclarationIdentity providerVersion", childSnapshotPath(path, "providerVersion"));
    }
    assertString(providerModuleId, "ProviderDeclarationIdentity providerModuleId", childSnapshotPath(path, "providerModuleId"));
    assertString(moduleSpecifier, "ProviderDeclarationIdentity moduleSpecifier", childSnapshotPath(path, "moduleSpecifier"));
    for (const [field, value] of [
        ["artifactFileName", artifactFileName],
        ["exportName", exportName],
        ["exportId", exportId],
        ["memberName", memberName],
        ["memberId", memberId],
        ["signatureId", signatureId],
    ]) {
        if (value !== undefined) {
            assertString(value, `ProviderDeclarationIdentity ${field}`, childSnapshotPath(path, field));
        }
    }
    if (memberStatic !== undefined) {
        assertBoolean(memberStatic, "ProviderDeclarationIdentity memberStatic", childSnapshotPath(path, "memberStatic"));
    }
    return Object.freeze({
        providerId,
        ...(providerVersion === undefined ? {} : { providerVersion }),
        providerModuleId,
        moduleSpecifier,
        ...(artifactFileName === undefined ? {} : { artifactFileName }),
        ...(exportName === undefined ? {} : { exportName }),
        ...(exportId === undefined ? {} : { exportId }),
        ...(memberName === undefined ? {} : { memberName }),
        ...(memberKey === undefined ? {} : {
            memberKey: snapshotProviderMemberKey(memberKey, childSnapshotPath(path, "memberKey")),
        }),
        ...(memberId === undefined ? {} : { memberId }),
        ...(memberStatic === undefined ? {} : { memberStatic }),
        ...(signatureId === undefined ? {} : { signatureId }),
        ...(targetIdentity === undefined ? {} : {
            targetIdentity: snapshotTargetTypeRef(targetIdentity, childSnapshotPath(path, "targetIdentity")),
        }),
    });
}
function snapshotProviderMemberKey(key, path) {
    assertRecord(key, "ProviderMemberKey", path);
    const actualKind = readDiscriminant(key, "ProviderMemberKey", path);
    const name = key.name;
    assertString(name, "ProviderMemberKey name", childSnapshotPath(path, "name"));
    switch (actualKind) {
        case "property-key":
            assertExactOwnFields(key, ["kind", "name"], "property ProviderMemberKey", path);
            return Object.freeze({ kind: "property-key", name });
        case "well-known-symbol":
            assertExactOwnFields(key, ["kind", "name"], "well-known-symbol ProviderMemberKey", path);
            assertProviderWellKnownSymbolName(name, childSnapshotPath(path, "name"));
            return Object.freeze({ kind: "well-known-symbol", name });
        default:
            throw unknownKindError("ProviderMemberKey", actualKind, path);
    }
}
function snapshotSelectedSourceTypeEvidence(evidence, path) {
    assertRecord(evidence, "SelectedSourceTypeEvidence", path);
    assertExactOwnFields(evidence, [
        "type",
        "symbol",
        "declaration",
        "selectedSymbol",
        "selectedDeclaration",
        "authoredTypeNode",
    ], "SelectedSourceTypeEvidence", path);
    return snapshotSelectedSourceTypeEvidenceFields(evidence, path);
}
function snapshotSelectedSourceTypeEvidenceFields(evidence, path) {
    const type = evidence.type;
    const symbol = evidence.symbol;
    const declaration = evidence.declaration;
    const selectedSymbol = evidence.selectedSymbol;
    const selectedDeclaration = evidence.selectedDeclaration;
    const authoredTypeNode = evidence.authoredTypeNode;
    assertRecord(type, "SelectedSourceTypeEvidence type", childSnapshotPath(path, "type"));
    for (const [field, value] of [
        ["symbol", symbol],
        ["declaration", declaration],
        ["selectedSymbol", selectedSymbol],
        ["selectedDeclaration", selectedDeclaration],
        ["authoredTypeNode", authoredTypeNode],
    ]) {
        if (value !== undefined) {
            assertRecord(value, `SelectedSourceTypeEvidence ${field}`, childSnapshotPath(path, field));
        }
    }
    return Object.freeze({
        type,
        ...(symbol === undefined ? {} : { symbol }),
        ...(declaration === undefined ? {} : { declaration }),
        ...(selectedSymbol === undefined ? {} : { selectedSymbol }),
        ...(selectedDeclaration === undefined ? {} : { selectedDeclaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    });
}
function snapshotSelectedSourceValueEvidence(evidence, path) {
    assertRecord(evidence, "SelectedSourceValueEvidence", path);
    assertExactOwnFields(evidence, [
        "expression",
        "type",
        "symbol",
        "declaration",
        "selectedSymbol",
        "selectedDeclaration",
        "authoredTypeNode",
    ], "SelectedSourceValueEvidence", path);
    const expression = evidence.expression;
    assertRecord(expression, "SelectedSourceValueEvidence expression", childSnapshotPath(path, "expression"));
    const typeEvidence = snapshotSelectedSourceTypeEvidenceFields(evidence, path);
    return Object.freeze({ expression, ...typeEvidence });
}
function snapshotMethodTypeArguments(arguments_) {
    const captured = captureArray(arguments_, "SourceSelectedMethodTypeArgument array", createSnapshotPath("selected method type arguments"));
    return Object.freeze(captured.map((argument, index) => {
        const path = indexedSnapshotPath(createSnapshotPath("selected method type arguments"), index);
        assertRecord(argument, "SourceSelectedMethodTypeArgument", path);
        assertExactOwnFields(argument, ["typeParameterName", "typeParameter", "selectedType", "explicitTypeNode"], "SourceSelectedMethodTypeArgument", path);
        const typeParameterName = argument.typeParameterName;
        const typeParameter = argument.typeParameter;
        const selectedType = argument.selectedType;
        const explicitTypeNode = argument.explicitTypeNode;
        assertString(typeParameterName, "SourceSelectedMethodTypeArgument typeParameterName", childSnapshotPath(path, "typeParameterName"));
        if (typeParameter !== undefined) {
            assertRecord(typeParameter, "SourceSelectedMethodTypeArgument typeParameter", childSnapshotPath(path, "typeParameter"));
        }
        assertRecord(selectedType, "SourceSelectedMethodTypeArgument selectedType", childSnapshotPath(path, "selectedType"));
        if (explicitTypeNode !== undefined) {
            assertRecord(explicitTypeNode, "SourceSelectedMethodTypeArgument explicitTypeNode", childSnapshotPath(path, "explicitTypeNode"));
        }
        return Object.freeze({
            typeParameterName,
            ...(typeParameter === undefined ? {} : { typeParameter }),
            selectedType,
            ...(explicitTypeNode === undefined ? {} : { explicitTypeNode }),
        });
    }));
}
function snapshotSelectedCallArgumentBindings(bindings, path, sourceArgumentCount, sourceParameterCount) {
    const captured = captureArray(bindings, "SourceSelectedCallArgumentBinding array", path);
    if (sourceArgumentCount !== undefined) {
        assertNonNegativeInteger(sourceArgumentCount, "source argument count", childSnapshotPath(path, "sourceArgumentCount"));
    }
    if (sourceParameterCount !== undefined) {
        assertNonNegativeInteger(sourceParameterCount, "source parameter count", childSnapshotPath(path, "sourceParameterCount"));
    }
    const snapshots = [];
    let expectedSourceArgumentIndex = 0;
    let activeSourceArgumentIndex;
    let activeSourceForm;
    let nextSpreadElementIndex = 0;
    let previousSourceParameterIndex = -1;
    for (let index = 0; index < captured.length; index += 1) {
        const bindingPath = indexedSnapshotPath(path, index);
        const binding = snapshotSelectedCallArgumentBinding(captured[index], bindingPath);
        if (binding.effectiveArgumentIndex !== index) {
            throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(bindingPath)}': effectiveArgumentIndex ${binding.effectiveArgumentIndex} must equal its canonical position ${index}.`);
        }
        if (binding.sourceArgumentIndex !== activeSourceArgumentIndex) {
            if (binding.sourceArgumentIndex !== expectedSourceArgumentIndex) {
                throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(childSnapshotPath(bindingPath, "sourceArgumentIndex"))}': expected the next authored source argument index ${expectedSourceArgumentIndex}, received ${binding.sourceArgumentIndex}.`);
            }
            activeSourceArgumentIndex = binding.sourceArgumentIndex;
            activeSourceForm = binding.sourceForm;
            expectedSourceArgumentIndex += 1;
            nextSpreadElementIndex = 0;
        }
        else if (activeSourceForm !== "spread-element" || binding.sourceForm !== "spread-element") {
            throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(bindingPath)}': only a fixed tuple spread may contribute multiple effective arguments for one authored source argument.`);
        }
        if (binding.sourceForm === "spread-element") {
            if (binding.spreadElementIndex !== nextSpreadElementIndex) {
                throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(childSnapshotPath(bindingPath, "spreadElementIndex"))}': expected contiguous tuple spread element index ${nextSpreadElementIndex}, received ${String(binding.spreadElementIndex)}.`);
            }
            nextSpreadElementIndex += 1;
        }
        if (binding.sourceParameterIndex < previousSourceParameterIndex) {
            throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(childSnapshotPath(bindingPath, "sourceParameterIndex"))}': selected source parameter indices must be monotonic in effective argument order.`);
        }
        if (sourceParameterCount !== undefined && binding.sourceParameterIndex >= sourceParameterCount) {
            throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(childSnapshotPath(bindingPath, "sourceParameterIndex"))}': selected source parameter index ${binding.sourceParameterIndex} is outside the ${sourceParameterCount}-parameter signature.`);
        }
        previousSourceParameterIndex = binding.sourceParameterIndex;
        snapshots.push(binding);
    }
    if (sourceArgumentCount !== undefined && expectedSourceArgumentIndex !== sourceArgumentCount) {
        throw new Error(`Invalid SourceSelectedCallArgumentBinding array at '${formatSnapshotPath(path)}': bindings cover ${expectedSourceArgumentIndex} authored source arguments, expected ${sourceArgumentCount}.`);
    }
    return Object.freeze(snapshots);
}
function snapshotSelectedCallArgumentBinding(binding, path) {
    assertRecord(binding, "SourceSelectedCallArgumentBinding", path);
    assertExactOwnFields(binding, [
        "sourceArgumentIndex",
        "effectiveArgumentIndex",
        "sourceForm",
        "spreadElementIndex",
        "sourceParameterIndex",
        "sourceParameterForm",
        "selectedArgumentType",
        "selectedParameterType",
    ], "SourceSelectedCallArgumentBinding", path);
    const sourceArgumentIndex = binding.sourceArgumentIndex;
    const effectiveArgumentIndex = binding.effectiveArgumentIndex;
    const sourceForm = binding.sourceForm;
    const spreadElementIndex = binding.spreadElementIndex;
    const sourceParameterIndex = binding.sourceParameterIndex;
    const sourceParameterForm = binding.sourceParameterForm;
    const selectedArgumentType = binding.selectedArgumentType;
    const selectedParameterType = binding.selectedParameterType;
    assertNonNegativeInteger(sourceArgumentIndex, "SourceSelectedCallArgumentBinding sourceArgumentIndex", childSnapshotPath(path, "sourceArgumentIndex"));
    assertNonNegativeInteger(effectiveArgumentIndex, "SourceSelectedCallArgumentBinding effectiveArgumentIndex", childSnapshotPath(path, "effectiveArgumentIndex"));
    assertCallConversionSourceForm(sourceForm, childSnapshotPath(path, "sourceForm"));
    if (sourceForm === "spread-element") {
        assertNonNegativeInteger(spreadElementIndex, "SourceSelectedCallArgumentBinding spreadElementIndex", childSnapshotPath(path, "spreadElementIndex"));
    }
    else if (spreadElementIndex !== undefined) {
        throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(path)}': spreadElementIndex is valid only for spread-element source form.`);
    }
    assertNonNegativeInteger(sourceParameterIndex, "SourceSelectedCallArgumentBinding sourceParameterIndex", childSnapshotPath(path, "sourceParameterIndex"));
    assertSourceCallParameterForm(sourceParameterForm, childSnapshotPath(path, "sourceParameterForm"));
    if ((sourceForm === "spread-sequence") !== (sourceParameterForm === "rest-sequence")) {
        throw new Error(`Invalid SourceSelectedCallArgumentBinding at '${formatSnapshotPath(path)}': spread-sequence source form and rest-sequence parameter form must occur together.`);
    }
    assertRecord(selectedArgumentType, "SourceSelectedCallArgumentBinding selectedArgumentType", childSnapshotPath(path, "selectedArgumentType"));
    assertRecord(selectedParameterType, "SourceSelectedCallArgumentBinding selectedParameterType", childSnapshotPath(path, "selectedParameterType"));
    return Object.freeze({
        sourceArgumentIndex,
        effectiveArgumentIndex,
        sourceForm,
        ...(spreadElementIndex === undefined ? {} : { spreadElementIndex }),
        sourceParameterIndex,
        sourceParameterForm,
        selectedArgumentType,
        selectedParameterType,
    });
}
function selectedCallArgumentBindingsEqual(left, right) {
    return left.sourceArgumentIndex === right.sourceArgumentIndex
        && left.effectiveArgumentIndex === right.effectiveArgumentIndex
        && left.sourceForm === right.sourceForm
        && left.spreadElementIndex === right.spreadElementIndex
        && left.sourceParameterIndex === right.sourceParameterIndex
        && left.sourceParameterForm === right.sourceParameterForm
        && left.selectedArgumentType === right.selectedArgumentType
        && left.selectedParameterType === right.selectedParameterType;
}
function snapshotArgumentConversionSlots(slots, path, cache) {
    const captured = captureArray(slots, "TargetCallArgumentConversionSlot array", path);
    const snapshots = captured.map((slot, index) => {
        const slotPath = indexedSnapshotPath(path, index);
        assertRecord(slot, "TargetCallArgumentConversionSlot", slotPath);
        assertExactOwnFields(slot, ["sourceArgumentIndex", "sourceForm", "spreadElementIndex", "targetParameterIndex", "targetForm"], "TargetCallArgumentConversionSlot", slotPath);
        const cached = cache?.targetCallArgumentConversionSlots.get(slot);
        if (cached !== undefined) {
            return cached;
        }
        const sourceArgumentIndex = slot.sourceArgumentIndex;
        const sourceForm = slot.sourceForm;
        const spreadElementIndex = slot.spreadElementIndex;
        const targetParameterIndex = slot.targetParameterIndex;
        const targetForm = slot.targetForm;
        assertNonNegativeInteger(sourceArgumentIndex, "TargetCallArgumentConversionSlot sourceArgumentIndex", childSnapshotPath(slotPath, "sourceArgumentIndex"));
        assertCallConversionSourceForm(sourceForm, childSnapshotPath(slotPath, "sourceForm"));
        assertNonNegativeInteger(targetParameterIndex, "TargetCallArgumentConversionSlot targetParameterIndex", childSnapshotPath(slotPath, "targetParameterIndex"));
        assertCallConversionTargetForm(targetForm, childSnapshotPath(slotPath, "targetForm"));
        if (sourceForm === "spread-element") {
            assertNonNegativeInteger(spreadElementIndex, "TargetCallArgumentConversionSlot spreadElementIndex", childSnapshotPath(slotPath, "spreadElementIndex"));
        }
        else if (spreadElementIndex !== undefined) {
            throw new Error(`Invalid TargetCallArgumentConversionSlot at '${formatSnapshotPath(slotPath)}': spreadElementIndex is valid only for spread-element source form.`);
        }
        const snapshot = Object.freeze({
            sourceArgumentIndex,
            sourceForm,
            ...(spreadElementIndex === undefined ? {} : { spreadElementIndex }),
            targetParameterIndex,
            targetForm,
        });
        cache?.targetCallArgumentConversionSlots.set(slot, snapshot);
        cache?.targetCallArgumentConversionSlots.set(snapshot, snapshot);
        return snapshot;
    });
    snapshots.sort(compareTargetCallArgumentConversionSlots);
    return Object.freeze(snapshots);
}
function snapshotSignatureParameters(parameters) {
    const captured = captureArray(parameters, "SourceSelectedSignatureParameter array", createSnapshotPath("selected signature parameters"));
    return Object.freeze(captured.map((parameter, index) => snapshotSignatureParameter(parameter, indexedSnapshotPath(createSnapshotPath("selected signature parameters"), index))));
}
function snapshotSignatureParameter(parameter, path) {
    assertRecord(parameter, "SourceSelectedSignatureParameter", path);
    assertExactOwnFields(parameter, ["parameterIndex", "parameterName", "parameterSymbol", "parameterDeclaration", "selectedType", "authoredTypeNode", "acceptsOmission", "rest"], "SourceSelectedSignatureParameter", path);
    const parameterIndex = parameter.parameterIndex;
    const parameterName = parameter.parameterName;
    const parameterSymbol = parameter.parameterSymbol;
    const parameterDeclaration = parameter.parameterDeclaration;
    const selectedType = parameter.selectedType;
    const authoredTypeNode = parameter.authoredTypeNode;
    const acceptsOmission = parameter.acceptsOmission;
    const rest = parameter.rest;
    assertNonNegativeInteger(parameterIndex, "SourceSelectedSignatureParameter parameterIndex", childSnapshotPath(path, "parameterIndex"));
    assertString(parameterName, "SourceSelectedSignatureParameter parameterName", childSnapshotPath(path, "parameterName"));
    assertRecord(parameterSymbol, "SourceSelectedSignatureParameter parameterSymbol", childSnapshotPath(path, "parameterSymbol"));
    if (parameterDeclaration !== undefined) {
        assertRecord(parameterDeclaration, "SourceSelectedSignatureParameter parameterDeclaration", childSnapshotPath(path, "parameterDeclaration"));
    }
    assertRecord(selectedType, "SourceSelectedSignatureParameter selectedType", childSnapshotPath(path, "selectedType"));
    if (authoredTypeNode !== undefined) {
        assertRecord(authoredTypeNode, "SourceSelectedSignatureParameter authoredTypeNode", childSnapshotPath(path, "authoredTypeNode"));
    }
    assertBoolean(acceptsOmission, "SourceSelectedSignatureParameter acceptsOmission", childSnapshotPath(path, "acceptsOmission"));
    assertBoolean(rest, "SourceSelectedSignatureParameter rest", childSnapshotPath(path, "rest"));
    return Object.freeze({
        parameterIndex,
        parameterName,
        parameterSymbol,
        ...(parameterDeclaration === undefined ? {} : { parameterDeclaration }),
        selectedType,
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        acceptsOmission,
        rest,
    });
}
function snapshotEvidenceArray(evidence, path) {
    const captured = captureArray(evidence, "ExtensionEvidence array", path);
    return Object.freeze(captured.map((item, index) => {
        const itemPath = indexedSnapshotPath(path, index);
        assertRecord(item, "ExtensionEvidence", itemPath);
        assertExactOwnFields(item, ["message", "details"], "ExtensionEvidence", itemPath);
        const message = item.message;
        const details = item.details;
        assertString(message, "ExtensionEvidence message", childSnapshotPath(itemPath, "message"));
        return Object.freeze({
            message,
            ...(details === undefined ? {} : { details }),
        });
    }));
}
function snapshotDiagnostic(diagnostic, path) {
    assertRecord(diagnostic, "ExtensionDiagnostic", path);
    assertExactOwnFields(diagnostic, ["extensionId", "extensionCode", "numericCode", "publicCode", "category", "message", "nodeOrSpan", "evidence", "identity"], "ExtensionDiagnostic", path);
    const extensionId = diagnostic.extensionId;
    const extensionCode = diagnostic.extensionCode;
    const numericCode = diagnostic.numericCode;
    const publicCode = diagnostic.publicCode;
    const category = diagnostic.category;
    const message = diagnostic.message;
    const nodeOrSpan = diagnostic.nodeOrSpan;
    const evidence = diagnostic.evidence;
    const identity = diagnostic.identity;
    assertString(extensionId, "ExtensionDiagnostic extensionId", childSnapshotPath(path, "extensionId"));
    assertString(extensionCode, "ExtensionDiagnostic extensionCode", childSnapshotPath(path, "extensionCode"));
    assertPositiveInteger(numericCode, "ExtensionDiagnostic numericCode", childSnapshotPath(path, "numericCode"));
    if (publicCode !== undefined) {
        assertString(publicCode, "ExtensionDiagnostic publicCode", childSnapshotPath(path, "publicCode"));
    }
    if (category !== "error" && category !== "warning" && category !== "suggestion") {
        throw invalidEnumValueError("ExtensionDiagnostic category", category, childSnapshotPath(path, "category"));
    }
    assertString(message, "ExtensionDiagnostic message", childSnapshotPath(path, "message"));
    if (identity !== undefined) {
        assertString(identity, "ExtensionDiagnostic identity", childSnapshotPath(path, "identity"));
    }
    return Object.freeze({
        extensionId,
        extensionCode,
        numericCode,
        ...(publicCode === undefined ? {} : { publicCode }),
        category,
        message,
        ...(nodeOrSpan === undefined ? {} : { nodeOrSpan }),
        ...(evidence === undefined ? {} : {
            evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
        }),
        ...(identity === undefined ? {} : { identity }),
    });
}
function createSnapshotPath(root) {
    return { segment: root };
}
function childSnapshotPath(parent, property) {
    return { parent, segment: `.${property}` };
}
function indexedSnapshotPath(parent, index) {
    return { parent, segment: `[${index}]` };
}
function formatSnapshotPath(path) {
    const segments = [];
    let current = path;
    while (current !== undefined) {
        segments.push(current.segment);
        current = current.parent;
    }
    segments.reverse();
    return segments.join("");
}
function assertRecord(value, valueName, path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a non-array object.`);
    }
}
function assertArray(value, valueName, path) {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected an array.`);
    }
}
function captureArray(value, valueName, path) {
    assertArray(value, valueName, path);
    const captured = [];
    const length = value.length;
    for (let index = 0; index < length; index += 1) {
        captured.push(value[index]);
    }
    return Object.freeze(captured);
}
function captureStringArray(value, valueName, path) {
    const captured = captureArray(value, valueName, path);
    for (let index = 0; index < captured.length; index += 1) {
        assertString(captured[index], `${valueName} entry`, indexedSnapshotPath(path, index));
    }
    return captured;
}
function assertString(value, valueName, path) {
    if (typeof value !== "string") {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a string.`);
    }
}
function assertNonNegativeInteger(value, valueName, path) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a non-negative safe integer.`);
    }
}
function assertPositiveInteger(value, valueName, path) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a positive safe integer.`);
    }
}
function assertExactOwnFields(value, allowedFields, valueName, path) {
    const allowed = new Set(allowedFields);
    for (const field of Object.keys(value)) {
        if (!allowed.has(field)) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': unsupported field '${field}'.`);
        }
    }
}
function assertCallConversionSourceForm(value, path) {
    if (value !== "value" && value !== "spread-element" && value !== "spread-sequence") {
        throw invalidEnumValueError("TargetCallArgumentConversionSlot sourceForm", value, path);
    }
}
function assertCallConversionTargetForm(value, path) {
    if (value !== "parameter" && value !== "params-element" && value !== "params-sequence") {
        throw invalidEnumValueError("TargetCallArgumentConversionSlot targetForm", value, path);
    }
}
function assertSourceCallParameterForm(value, path) {
    if (value !== "parameter" && value !== "rest-element" && value !== "rest-sequence") {
        throw invalidEnumValueError("SourceSelectedCallArgumentBinding sourceParameterForm", value, path);
    }
}
function compareTargetCallArgumentConversionSlots(left, right) {
    const leftKey = targetCallArgumentConversionSlotSortKey(left);
    const rightKey = targetCallArgumentConversionSlotSortKey(right);
    for (let index = 0; index < leftKey.length; index += 1) {
        const difference = leftKey[index] - rightKey[index];
        if (difference !== 0) {
            return difference;
        }
    }
    return 0;
}
function targetCallArgumentConversionSlotSortKey(slot) {
    const sourceFormRank = slot.sourceForm === "value"
        ? 0
        : slot.sourceForm === "spread-element"
            ? 1
            : 2;
    const targetFormRank = slot.targetForm === "parameter"
        ? 0
        : slot.targetForm === "params-element"
            ? 1
            : 2;
    return [slot.sourceArgumentIndex, sourceFormRank, slot.spreadElementIndex ?? -1, slot.targetParameterIndex, targetFormRank];
}
function assertBoolean(value, valueName, path) {
    if (typeof value !== "boolean") {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a boolean.`);
    }
}
function readDiscriminant(value, valueName, path) {
    const kind = value.kind;
    if (typeof kind !== "string") {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(childSnapshotPath(path, "kind"))}': expected a string.`);
    }
    return kind;
}
function unknownKindError(valueName, kind, path) {
    return new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': unknown kind '${kind}'.`);
}
function assertTargetOperationKind(value, path) {
    switch (value) {
        case "property":
        case "method":
        case "indexer":
        case "operator":
        case "constructor":
        case "iteration":
            return;
        default:
            throw new Error(typeof value === "string"
                ? `Invalid TargetOperationFact operationKind at '${formatSnapshotPath(path)}': unknown kind '${value}'.`
                : `Invalid TargetOperationFact operationKind at '${formatSnapshotPath(path)}': expected a string.`);
    }
}
function assertTargetMemberKind(value, path) {
    switch (value) {
        case "method":
        case "constructor":
        case "property":
        case "field":
        case "indexer":
        case "event":
        case "operator":
            return;
        default:
            throw invalidEnumValueError("TargetMember kind", value, path);
    }
}
function assertArgumentPassingMode(value, path) {
    switch (value) {
        case "by-value":
        case "byref-readonly":
        case "byref-readwrite":
        case "byref-writeonly-must-init":
        case "borrow-shared":
        case "borrow-mut":
        case "move":
            return;
        default:
            throw invalidEnumValueError("TargetParameter passingMode", value, path);
    }
}
function assertTargetTypeParameterVariance(value, path) {
    switch (value) {
        case "in":
        case "out":
        case "invariant":
        case "target-defined":
            return;
        default:
            throw invalidEnumValueError("TargetTypeParameter variance", value, path);
    }
}
function assertPointerMutability(value, path) {
    switch (value) {
        case "const":
        case "mut":
        case "target-defined":
            return;
        default:
            throw invalidEnumValueError("TargetTypeRef pointer mutability", value, path);
    }
}
function assertSourcePrimitiveKind(value, path) {
    switch (value) {
        case "bool":
        case "char":
        case "int8":
        case "uint8":
        case "int16":
        case "uint16":
        case "int32":
        case "uint32":
        case "int64":
        case "uint64":
        case "native-int":
        case "native-uint":
        case "float16":
        case "float32":
        case "float64":
        case "decimal":
        case "int128":
        case "uint128":
            return;
        default:
            throw invalidEnumValueError("TargetTypeRef source primitive name", value, path);
    }
}
function assertProviderWellKnownSymbolName(value, path) {
    switch (value) {
        case "asyncIterator":
        case "hasInstance":
        case "isConcatSpreadable":
        case "iterator":
        case "match":
        case "matchAll":
        case "replace":
        case "search":
        case "species":
        case "split":
        case "toPrimitive":
        case "toStringTag":
        case "unscopables":
            return;
        default:
            throw invalidEnumValueError("ProviderMemberKey well-known symbol name", value, path);
    }
}
function invalidEnumValueError(valueName, value, path) {
    return new Error(typeof value === "string"
        ? `Invalid ${valueName} at '${formatSnapshotPath(path)}': unknown value '${value}'.`
        : `Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a string.`);
}
//# sourceMappingURL=checked-operation-value-snapshot.js.map