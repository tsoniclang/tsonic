import { ExtensionObservationPoint } from "./observations.js";
import { selectedTargetSignatureEquals, targetParameterEquals } from "./fact-value-equality.js";
import { isHostOwnedExtensionDiagnostic, markHostOwnedExtensionDiagnostic } from "./diagnostic-ownership.js";
const checkedOperationRequestSnapshotCacheBrand = Symbol("tsts.checked-operation-request-snapshot-cache");
const checkedOperationResponseSnapshots = new WeakMap();
const checkedOperationRequestSnapshotCacheStates = new WeakMap();
const canonicalTargetCallArgumentConversionSlots = new WeakSet();
const snapshotLimits = Object.freeze({
    maxDepth: 128,
    maxObjects: 16_384,
    maxTargetTypeRefObjects: 65_536,
    maxArrayElements: 65_536,
    maxOwnFields: 65_536,
    maxScalarCodeUnits: 1_048_576,
    maxWorkUnits: 2_000_000,
});
export function createCheckedOperationRequestSnapshotCache() {
    const cache = Object.freeze({
        [checkedOperationRequestSnapshotCacheBrand]: true,
    });
    checkedOperationRequestSnapshotCacheStates.set(cache, {
        selectedTargetSignatures: new WeakMap(),
        targetParameters: new WeakMap(),
        targetCallArgumentConversionSlots: new WeakMap(),
    });
    return cache;
}
function createCheckedOperationRequestSnapshotCacheTransaction(cache, path) {
    const state = checkedOperationRequestSnapshotCacheStates.get(cache);
    if (state === undefined) {
        throw new Error(`Invalid checked-operation snapshot cache at '${formatSnapshotPath(path)}': cache was not created by createCheckedOperationRequestSnapshotCache().`);
    }
    const selectedTargetSignatures = createTransactionalSnapshotCacheMap(state.selectedTargetSignatures);
    const targetParameters = createTransactionalSnapshotCacheMap(state.targetParameters);
    const targetCallArgumentConversionSlots = createTransactionalSnapshotCacheMap(state.targetCallArgumentConversionSlots);
    let committed = false;
    return {
        access: {
            selectedTargetSignatures: selectedTargetSignatures.view,
            targetParameters: targetParameters.view,
            targetCallArgumentConversionSlots: targetCallArgumentConversionSlots.view,
        },
        commit() {
            if (committed) {
                throw new Error("Checked-operation snapshot cache transaction was committed more than once.");
            }
            selectedTargetSignatures.assertCanCommit();
            targetParameters.assertCanCommit();
            targetCallArgumentConversionSlots.assertCanCommit();
            selectedTargetSignatures.commit();
            targetParameters.commit();
            targetCallArgumentConversionSlots.commit();
            committed = true;
        },
    };
}
function createTransactionalSnapshotCacheMap(base) {
    const staged = new WeakMap();
    const entries = [];
    return {
        view: {
            get(key) {
                return staged.get(key) ?? base.get(key);
            },
            set(key, value) {
                if (staged.has(key)) {
                    if (staged.get(key) !== value) {
                        throw new Error("Checked-operation snapshot cache transaction attempted conflicting values for one source object.");
                    }
                    return;
                }
                const existing = base.get(key);
                if (existing !== undefined) {
                    if (existing !== value) {
                        throw new Error("Checked-operation snapshot cache transaction attempted to replace a committed snapshot.");
                    }
                    return;
                }
                staged.set(key, value);
                entries.push([key, value]);
            },
        },
        assertCanCommit() {
            for (const [key, value] of entries) {
                const existing = base.get(key);
                if (existing !== undefined && existing !== value) {
                    throw new Error("Checked-operation snapshot cache transaction conflicted with a nested committed snapshot.");
                }
            }
        },
        commit() {
            for (const [key, value] of entries) {
                const existing = base.get(key);
                if (existing !== undefined && existing !== value) {
                    throw new Error("Checked-operation snapshot cache transaction conflicted with a nested committed snapshot.");
                }
                base.set(key, value);
            }
        },
    };
}
export function snapshotCheckedOperationRequest(observation, request, cache = createCheckedOperationRequestSnapshotCache()) {
    return snapshotCheckedOperationRequestWithMetrics(observation, request, cache).request;
}
export function snapshotCheckedOperationRequestWithMetrics(observation, request, cache = createCheckedOperationRequestSnapshotCache()) {
    const path = createSnapshotPath(`checked-operation request[${observation}]`);
    const cacheTransaction = createCheckedOperationRequestSnapshotCacheTransaction(cache, path);
    let snapshot;
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            snapshot = snapshotCallRequest(request, path);
            break;
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            snapshot = snapshotPropertyRequest(request, path);
            break;
        case ExtensionObservationPoint.mapCheckedElementAccess:
            snapshot = snapshotElementRequest(request, path);
            break;
        case ExtensionObservationPoint.mapCheckedOperator:
            snapshot = snapshotOperatorRequest(request, path);
            break;
        case ExtensionObservationPoint.mapCheckedIteration:
            snapshot = snapshotIterationRequest(request, path);
            break;
        case ExtensionObservationPoint.mapCheckedConversion:
            snapshot = snapshotConversionRequest(request, cacheTransaction.access, path);
            break;
        default:
            throw new Error(`Unsupported checked-operation observation '${String(observation)}'.`);
    }
    cacheTransaction.commit();
    return Object.freeze({
        request: snapshot,
        metrics: snapshotRequestMetrics(path.budget),
    });
}
function snapshotRequestMetrics(budget) {
    return Object.freeze({
        objectCount: budget.objectCount,
        targetTypeRefObjectCount: budget.targetTypeRefObjectCount,
        arrayElementCount: budget.arrayElementCount,
        ownFieldCount: budget.ownFieldCount,
        scalarCodeUnits: budget.scalarCodeUnits,
        workUnits: budget.workUnits,
    });
}
export function snapshotCheckedOperationResult(observation, result) {
    const path = createSnapshotPath(`checked-operation result[${observation}]`);
    assertRecord(result, "checked-operation result", path);
    const actualKind = readDiscriminant(result, "checked-operation result", path);
    switch (actualKind) {
        case "core": {
            const core = captureExactOwnFields(result, ["kind", "value"], "core checked-operation result", path);
            const value = core.value;
            return Object.freeze({
                kind: "core",
                value: snapshotCheckedOperationResponseAtPath(observation, value, childSnapshotPath(path, "value")),
            });
        }
        case "accept": {
            const accepted = captureExactOwnFields(result, ["kind", "value", "extensionId", "evidence"], "accepted checked-operation result", path);
            const value = accepted.value;
            const extensionId = accepted.extensionId;
            const evidence = accepted.evidence;
            assertString(extensionId, "accepted checked-operation result extensionId", childSnapshotPath(path, "extensionId"));
            return Object.freeze({
                kind: "accept",
                value: snapshotCheckedOperationResponseAtPath(observation, value, childSnapshotPath(path, "value")),
                extensionId,
                ...(evidence === undefined ? {} : {
                    evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
                }),
            });
        }
        case "reject": {
            const rejected = captureExactOwnFields(result, ["kind", "diagnostic", "extensionId"], "rejected checked-operation result", path);
            const diagnostic = rejected.diagnostic;
            const extensionId = rejected.extensionId;
            assertString(extensionId, "rejected checked-operation result extensionId", childSnapshotPath(path, "extensionId"));
            const diagnosticSnapshot = snapshotDiagnostic(diagnostic, childSnapshotPath(path, "diagnostic"));
            if (diagnosticSnapshot.extensionId !== extensionId) {
                throw new Error(`Invalid rejected checked-operation result at '${formatSnapshotPath(path)}': result extensionId '${extensionId}' does not match diagnostic extensionId '${diagnosticSnapshot.extensionId}'.`);
            }
            return Object.freeze({
                kind: "reject",
                diagnostic: diagnosticSnapshot,
                extensionId,
            });
        }
        case "missing-owner": {
            const missing = captureExactOwnFields(result, ["kind", "observation"], "missing-owner checked-operation result", path);
            assertMatchingCheckedOperationObservation(missing.observation, observation, childSnapshotPath(path, "observation"));
            return Object.freeze({ kind: "missing-owner", observation: missing.observation });
        }
        case "owner-deferred": {
            const deferred = captureExactOwnFields(result, ["kind", "observation", "extensionId"], "owner-deferred checked-operation result", path);
            assertMatchingCheckedOperationObservation(deferred.observation, observation, childSnapshotPath(path, "observation"));
            assertString(deferred.extensionId, "owner-deferred checked-operation result extensionId", childSnapshotPath(path, "extensionId"));
            return Object.freeze({ kind: "owner-deferred", observation: deferred.observation, extensionId: deferred.extensionId });
        }
        case "conflict": {
            const conflict = captureExactOwnFields(result, ["kind", "observation"], "conflicting checked-operation result", path);
            assertMatchingCheckedOperationObservation(conflict.observation, observation, childSnapshotPath(path, "observation"));
            return Object.freeze({ kind: "conflict", observation: conflict.observation });
        }
        default:
            throw unknownKindError("checked-operation result", actualKind, path);
    }
}
function snapshotCallRequest(request, path, includeTarget = true) {
    assertRecord(request, "CheckedCallMappingRequest", path);
    request = captureExactOwnFields(request, [
        "sourceOperationKind",
        "call",
        "callee",
        "arguments",
        "callKind",
        "sourceSelection",
        "sourceCallee",
        "sourceArguments",
        "sourceResult",
        "sourceReceiver",
        "sourceComposition",
        "chainRole",
        ...(includeTarget ? ["target"] : []),
    ], "CheckedCallMappingRequest", path);
    if (request.sourceOperationKind !== "call") {
        throw invalidEnumValueError("CheckedCallMappingRequest sourceOperationKind", request.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(request.call, "CheckedCallMappingRequest call", childSnapshotPath(path, "call"));
    assertOpaqueIdentitySubject(request.callee, "CheckedCallMappingRequest callee", childSnapshotPath(path, "callee"));
    const arguments_ = captureOpaqueIdentitySubjectArray(request.arguments, "CheckedCallMappingRequest arguments", childSnapshotPath(path, "arguments"));
    assertCheckedCallKind(request.callKind, childSnapshotPath(path, "callKind"));
    const sourceArguments = captureArray(request.sourceArguments, "CheckedCallMappingRequest sourceArguments", childSnapshotPath(path, "sourceArguments"));
    if (sourceArguments.length !== arguments_.length) {
        throw new Error(`Invalid CheckedCallMappingRequest at '${formatSnapshotPath(path)}': sourceArguments length ${sourceArguments.length} does not match arguments length ${arguments_.length}.`);
    }
    if (request.target !== undefined) {
        assertString(request.target, "CheckedCallMappingRequest target", childSnapshotPath(path, "target"));
    }
    const sourceSelection = snapshotSourceSelectedCallEvidence(request.sourceSelection, childSnapshotPath(path, "sourceSelection"), arguments_.length);
    return Object.freeze({
        sourceOperationKind: "call",
        call: request.call,
        callee: request.callee,
        arguments: arguments_,
        callKind: request.callKind,
        sourceSelection,
        sourceCallee: snapshotSelectedSourceValueEvidence(request.sourceCallee, childSnapshotPath(path, "sourceCallee")),
        sourceArguments: Object.freeze(sourceArguments.map((evidence, index) => snapshotSelectedSourceValueEvidence(evidence, indexedSnapshotPath(childSnapshotPath(path, "sourceArguments"), index)))),
        sourceResult: snapshotSelectedSourceValueEvidence(request.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(request.sourceReceiver === undefined ? {} : {
            sourceReceiver: snapshotSelectedSourceValueEvidence(request.sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        }),
        ...(request.sourceComposition === undefined ? {} : {
            sourceComposition: snapshotCheckedSourceCallCompositionEvidence(request.sourceComposition, arguments_.length, childSnapshotPath(path, "sourceComposition")),
        }),
        chainRole: snapshotSourceChainRole(request.chainRole, "call", childSnapshotPath(path, "chainRole")),
        ...(includeTarget && request.target !== undefined ? { target: request.target } : {}),
    });
}
function snapshotPropertyRequest(request, path, includeTarget = true) {
    assertRecord(request, "CheckedPropertyAccessMappingRequest", path);
    const accessMode = readOwnStringField(request, "accessMode", "CheckedPropertyAccessMappingRequest", path);
    assertCheckedAccessMode(accessMode, childSnapshotPath(path, "accessMode"));
    const commonFields = ["sourceOperationKind", "expression", "receiver", "propertyName", "accessMode", "use", "sourceReceiver", "chainRole", ...(includeTarget ? ["target"] : [])];
    const captured = captureExactOwnFields(request, accessMode === "write"
        ? [...commonFields, "sourceWriteType"]
        : accessMode === "read-write"
            ? [...commonFields, "sourceReadResult", "sourceWriteType"]
            : [...commonFields, "sourceReadResult"], "CheckedPropertyAccessMappingRequest", path);
    if (captured.sourceOperationKind !== "property-access") {
        throw invalidEnumValueError("CheckedPropertyAccessMappingRequest sourceOperationKind", captured.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(captured.expression, "CheckedPropertyAccessMappingRequest expression", childSnapshotPath(path, "expression"));
    assertOpaqueIdentitySubject(captured.receiver, "CheckedPropertyAccessMappingRequest receiver", childSnapshotPath(path, "receiver"));
    assertString(captured.propertyName, "CheckedPropertyAccessMappingRequest propertyName", childSnapshotPath(path, "propertyName"));
    assertCheckedAccessUse(captured.use, "CheckedPropertyAccessMappingRequest", childSnapshotPath(path, "use"));
    assertOptionalTarget(captured.target, "CheckedPropertyAccessMappingRequest", path);
    const sourceReceiver = snapshotSelectedSourceValueEvidence(captured.sourceReceiver, childSnapshotPath(path, "sourceReceiver"));
    const chainRole = snapshotSourceChainRole(captured.chainRole, "property-access", childSnapshotPath(path, "chainRole"));
    const base = {
        sourceOperationKind: "property-access",
        expression: captured.expression,
        receiver: captured.receiver,
        propertyName: captured.propertyName,
        sourceReceiver,
        ...(includeTarget && captured.target !== undefined ? { target: captured.target } : {}),
    };
    if (accessMode === "read") {
        const read = captured;
        return Object.freeze({
            ...base,
            accessMode: "read",
            use: read.use,
            sourceReadResult: snapshotSelectedSourceValueEvidence(read.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (captured.use !== "value") {
        throw invalidEnumValueError(`CheckedPropertyAccessMappingRequest ${accessMode} use`, captured.use, childSnapshotPath(path, "use"));
    }
    if (accessMode === "delete") {
        const deleteAccess = captured;
        return Object.freeze({
            ...base,
            accessMode: "delete",
            use: "value",
            sourceReadResult: snapshotSelectedSourceValueEvidence(deleteAccess.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (chainRole.kind !== "ordinary") {
        throw new Error(`Invalid CheckedPropertyAccessMappingRequest at '${formatSnapshotPath(childSnapshotPath(path, "chainRole"))}': ${accessMode} access cannot be an optional-chain participant.`);
    }
    if (accessMode === "write") {
        const write = captured;
        return Object.freeze({
            ...base,
            accessMode: "write",
            use: "value",
            sourceWriteType: snapshotSelectedSourceTypeEvidence(write.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
            chainRole,
        });
    }
    const readWrite = captured;
    return Object.freeze({
        ...base,
        accessMode: "read-write",
        use: "value",
        sourceReadResult: snapshotSelectedSourceValueEvidence(readWrite.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
        sourceWriteType: snapshotSelectedSourceTypeEvidence(readWrite.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
        chainRole,
    });
}
function snapshotElementRequest(request, path, includeTarget = true) {
    assertRecord(request, "CheckedElementAccessMappingRequest", path);
    const accessMode = readOwnStringField(request, "accessMode", "CheckedElementAccessMappingRequest", path);
    assertCheckedAccessMode(accessMode, childSnapshotPath(path, "accessMode"));
    const commonFields = ["sourceOperationKind", "expression", "receiver", "argument", "sourceArgument", "sourceSelectedElementIndex", "accessMode", "use", "sourceReceiver", "chainRole", ...(includeTarget ? ["target"] : [])];
    const captured = captureExactOwnFields(request, accessMode === "write"
        ? [...commonFields, "sourceWriteType"]
        : accessMode === "read-write"
            ? [...commonFields, "sourceReadResult", "sourceWriteType"]
            : [...commonFields, "sourceReadResult"], "CheckedElementAccessMappingRequest", path);
    if (captured.sourceOperationKind !== "element-access") {
        throw invalidEnumValueError("CheckedElementAccessMappingRequest sourceOperationKind", captured.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(captured.expression, "CheckedElementAccessMappingRequest expression", childSnapshotPath(path, "expression"));
    assertOpaqueIdentitySubject(captured.receiver, "CheckedElementAccessMappingRequest receiver", childSnapshotPath(path, "receiver"));
    assertOpaqueIdentitySubject(captured.argument, "CheckedElementAccessMappingRequest argument", childSnapshotPath(path, "argument"));
    assertCheckedAccessUse(captured.use, "CheckedElementAccessMappingRequest", childSnapshotPath(path, "use"));
    if (captured.sourceSelectedElementIndex !== undefined) {
        assertNonNegativeInteger(captured.sourceSelectedElementIndex, "CheckedElementAccessMappingRequest sourceSelectedElementIndex", childSnapshotPath(path, "sourceSelectedElementIndex"));
    }
    assertOptionalTarget(captured.target, "CheckedElementAccessMappingRequest", path);
    const sourceReceiver = snapshotSelectedSourceValueEvidence(captured.sourceReceiver, childSnapshotPath(path, "sourceReceiver"));
    const sourceArgument = snapshotSelectedSourceValueEvidence(captured.sourceArgument, childSnapshotPath(path, "sourceArgument"));
    const chainRole = snapshotSourceChainRole(captured.chainRole, "element-access", childSnapshotPath(path, "chainRole"));
    const base = {
        sourceOperationKind: "element-access",
        expression: captured.expression,
        receiver: captured.receiver,
        argument: captured.argument,
        sourceReceiver,
        sourceArgument,
        ...(captured.sourceSelectedElementIndex === undefined ? {} : { sourceSelectedElementIndex: captured.sourceSelectedElementIndex }),
        ...(includeTarget && captured.target !== undefined ? { target: captured.target } : {}),
    };
    if (accessMode === "read") {
        const read = captured;
        return Object.freeze({
            ...base,
            accessMode: "read",
            use: read.use,
            sourceReadResult: snapshotSelectedSourceValueEvidence(read.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (captured.use !== "value") {
        throw invalidEnumValueError(`CheckedElementAccessMappingRequest ${accessMode} use`, captured.use, childSnapshotPath(path, "use"));
    }
    if (accessMode === "delete") {
        const deleteAccess = captured;
        return Object.freeze({
            ...base,
            accessMode: "delete",
            use: "value",
            sourceReadResult: snapshotSelectedSourceValueEvidence(deleteAccess.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (chainRole.kind !== "ordinary") {
        throw new Error(`Invalid CheckedElementAccessMappingRequest at '${formatSnapshotPath(childSnapshotPath(path, "chainRole"))}': ${accessMode} access cannot be an optional-chain participant.`);
    }
    if (accessMode === "write") {
        const write = captured;
        return Object.freeze({
            ...base,
            accessMode: "write",
            use: "value",
            sourceWriteType: snapshotSelectedSourceTypeEvidence(write.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
            chainRole,
        });
    }
    const readWrite = captured;
    return Object.freeze({
        ...base,
        accessMode: "read-write",
        use: "value",
        sourceReadResult: snapshotSelectedSourceValueEvidence(readWrite.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
        sourceWriteType: snapshotSelectedSourceTypeEvidence(readWrite.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
        chainRole,
    });
}
function snapshotOperatorRequest(request, path, includeTarget = true) {
    assertRecord(request, "CheckedOperatorMappingRequest", path);
    const operatorKind = readOwnStringField(request, "operatorKind", "CheckedOperatorMappingRequest", path);
    const commonFields = ["sourceOperationKind", "operatorKind", "expression", "operator", "sourceResult", ...(includeTarget ? ["target"] : [])];
    request = captureExactOwnFields(request, operatorKind === "binary"
        ? [...commonFields, "left", "right", "sourceLeft", "sourceRight"]
        : [...commonFields, "operand", "sourceOperand"], "CheckedOperatorMappingRequest", path);
    if (request.sourceOperationKind !== "operator") {
        throw invalidEnumValueError("CheckedOperatorMappingRequest sourceOperationKind", request.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(request.expression, "CheckedOperatorMappingRequest expression", childSnapshotPath(path, "expression"));
    assertString(request.operator, "CheckedOperatorMappingRequest operator", childSnapshotPath(path, "operator"));
    if (request.target !== undefined) {
        assertString(request.target, "CheckedOperatorMappingRequest target", childSnapshotPath(path, "target"));
    }
    if (operatorKind === "binary") {
        const binary = request;
        assertCheckedBinaryOperatorToken(binary.operator, childSnapshotPath(path, "operator"));
        assertOpaqueIdentitySubject(binary.left, "CheckedOperatorMappingRequest left", childSnapshotPath(path, "left"));
        assertOpaqueIdentitySubject(binary.right, "CheckedOperatorMappingRequest right", childSnapshotPath(path, "right"));
        return Object.freeze({
            sourceOperationKind: "operator",
            operatorKind: "binary",
            expression: binary.expression,
            operator: binary.operator,
            left: binary.left,
            right: binary.right,
            sourceLeft: snapshotSelectedSourceValueEvidence(binary.sourceLeft, childSnapshotPath(path, "sourceLeft")),
            sourceRight: snapshotSelectedSourceValueEvidence(binary.sourceRight, childSnapshotPath(path, "sourceRight")),
            sourceResult: snapshotSelectedSourceValueEvidence(binary.sourceResult, childSnapshotPath(path, "sourceResult")),
            ...(includeTarget && binary.target !== undefined ? { target: binary.target } : {}),
        });
    }
    if (operatorKind !== "prefix-unary" && operatorKind !== "prefix-update" && operatorKind !== "postfix-update") {
        throw invalidEnumValueError("CheckedOperatorMappingRequest operatorKind", operatorKind, childSnapshotPath(path, "operatorKind"));
    }
    if (operatorKind === "prefix-unary") {
        const prefixUnary = request;
        assertOpaqueIdentitySubject(prefixUnary.operand, "CheckedOperatorMappingRequest operand", childSnapshotPath(path, "operand"));
        assertCheckedPrefixUnaryOperatorToken(prefixUnary.operator, childSnapshotPath(path, "operator"));
        return Object.freeze({
            sourceOperationKind: "operator",
            operatorKind: "prefix-unary",
            expression: prefixUnary.expression,
            operator: prefixUnary.operator,
            operand: prefixUnary.operand,
            sourceOperand: snapshotSelectedSourceValueEvidence(prefixUnary.sourceOperand, childSnapshotPath(path, "sourceOperand")),
            sourceResult: snapshotSelectedSourceValueEvidence(prefixUnary.sourceResult, childSnapshotPath(path, "sourceResult")),
            ...(includeTarget && prefixUnary.target !== undefined ? { target: prefixUnary.target } : {}),
        });
    }
    if (operatorKind === "prefix-update") {
        const prefixUpdate = request;
        assertOpaqueIdentitySubject(prefixUpdate.operand, "CheckedOperatorMappingRequest operand", childSnapshotPath(path, "operand"));
        assertCheckedUpdateOperatorToken(prefixUpdate.operator, childSnapshotPath(path, "operator"));
        return Object.freeze({
            sourceOperationKind: "operator",
            operatorKind: "prefix-update",
            expression: prefixUpdate.expression,
            operator: prefixUpdate.operator,
            operand: prefixUpdate.operand,
            sourceOperand: snapshotSelectedSourceValueEvidence(prefixUpdate.sourceOperand, childSnapshotPath(path, "sourceOperand")),
            sourceResult: snapshotSelectedSourceValueEvidence(prefixUpdate.sourceResult, childSnapshotPath(path, "sourceResult")),
            ...(includeTarget && prefixUpdate.target !== undefined ? { target: prefixUpdate.target } : {}),
        });
    }
    const postfixUpdate = request;
    assertOpaqueIdentitySubject(postfixUpdate.operand, "CheckedOperatorMappingRequest operand", childSnapshotPath(path, "operand"));
    assertCheckedUpdateOperatorToken(postfixUpdate.operator, childSnapshotPath(path, "operator"));
    return Object.freeze({
        sourceOperationKind: "operator",
        operatorKind: "postfix-update",
        expression: postfixUpdate.expression,
        operator: postfixUpdate.operator,
        operand: postfixUpdate.operand,
        sourceOperand: snapshotSelectedSourceValueEvidence(postfixUpdate.sourceOperand, childSnapshotPath(path, "sourceOperand")),
        sourceResult: snapshotSelectedSourceValueEvidence(postfixUpdate.sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(includeTarget && postfixUpdate.target !== undefined ? { target: postfixUpdate.target } : {}),
    });
}
function snapshotIterationRequest(request, path, includeTarget = true) {
    assertRecord(request, "CheckedIterationMappingRequest", path);
    request = captureExactOwnFields(request, ["sourceOperationKind", "statement", "expression", "initializer", "iterationKind", "mechanism", "sourceIterable", "sourceElement", ...(includeTarget ? ["target"] : [])], "CheckedIterationMappingRequest", path);
    if (request.sourceOperationKind !== "iteration") {
        throw invalidEnumValueError("CheckedIterationMappingRequest sourceOperationKind", request.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(request.statement, "CheckedIterationMappingRequest statement", childSnapshotPath(path, "statement"));
    assertOpaqueIdentitySubject(request.expression, "CheckedIterationMappingRequest expression", childSnapshotPath(path, "expression"));
    if (request.initializer !== undefined) {
        assertOpaqueIdentitySubject(request.initializer, "CheckedIterationMappingRequest initializer", childSnapshotPath(path, "initializer"));
    }
    assertCheckedIterationKind(request.iterationKind, childSnapshotPath(path, "iterationKind"));
    if (request.target !== undefined) {
        assertString(request.target, "CheckedIterationMappingRequest target", childSnapshotPath(path, "target"));
    }
    const base = {
        sourceOperationKind: "iteration",
        statement: request.statement,
        expression: request.expression,
        ...(request.initializer === undefined ? {} : { initializer: request.initializer }),
        sourceIterable: snapshotSelectedSourceValueEvidence(request.sourceIterable, childSnapshotPath(path, "sourceIterable")),
        sourceElement: snapshotSelectedSourceTypeEvidence(request.sourceElement, childSnapshotPath(path, "sourceElement")),
        ...(includeTarget && request.target !== undefined ? { target: request.target } : {}),
    };
    switch (request.iterationKind) {
        case "for-in":
            return Object.freeze({
                ...base,
                iterationKind: "for-in",
                mechanism: snapshotForInIterationMechanism(request.mechanism, childSnapshotPath(path, "mechanism")),
            });
        case "for-of":
            return Object.freeze({
                ...base,
                iterationKind: "for-of",
                mechanism: snapshotForOfIterationMechanism(request.mechanism, childSnapshotPath(path, "mechanism")),
            });
        case "for-await-of":
            return Object.freeze({
                ...base,
                iterationKind: "for-await-of",
                mechanism: snapshotForAwaitOfIterationMechanism(request.mechanism, childSnapshotPath(path, "mechanism")),
            });
    }
}
function snapshotConversionRequest(request, cache, path) {
    assertRecord(request, "CheckedConversionMappingRequest", path);
    const sourceOperationKind = readOwnStringField(request, "sourceOperationKind", "CheckedConversionMappingRequest", path);
    if (sourceOperationKind !== "conversion") {
        throw invalidEnumValueError("CheckedConversionMappingRequest sourceOperationKind", sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    const conversionKind = readOwnStringField(request, "conversionKind", "CheckedConversionMappingRequest", path);
    if (conversionKind === "call-argument") {
        const callRequest = captureExactOwnFields(request, [
            "sourceOperationKind",
            "expression",
            "source",
            "targetPlatform",
            "conversionKind",
            "target",
            "call",
            "slot",
            "targetParameter",
            "selectedSignature",
            "sourceBinding",
        ], "call-argument CheckedConversionMappingRequest", path);
        assertOpaqueIdentitySubject(callRequest.expression, "CheckedConversionMappingRequest expression", childSnapshotPath(path, "expression"));
        if (callRequest.targetPlatform !== undefined) {
            assertString(callRequest.targetPlatform, "CheckedConversionMappingRequest targetPlatform", childSnapshotPath(path, "targetPlatform"));
        }
        const base = {
            sourceOperationKind: "conversion",
            expression: callRequest.expression,
            source: snapshotSelectedSourceValueEvidence(callRequest.source, childSnapshotPath(path, "source")),
            ...(callRequest.targetPlatform === undefined ? {} : { targetPlatform: callRequest.targetPlatform }),
        };
        assertOpaqueIdentitySubject(callRequest.call, "call-argument CheckedConversionMappingRequest call", childSnapshotPath(path, "call"));
        const selectedSignature = snapshotSelectedTargetSignature(callRequest.selectedSignature, childSnapshotPath(path, "selectedSignature"), cache);
        const slot = cache.targetCallArgumentConversionSlots.get(callRequest.slot);
        if (slot === undefined) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "slot"))}': slot is not one of the selected target signature's canonical conversion slots.`);
        }
        const target = callRequest.target;
        const sourceTargetParameterType = readOwnDataField(callRequest.targetParameter, "type", "call-argument CheckedConversionMappingRequest targetParameter", childSnapshotPath(path, "targetParameter"));
        const originalCanonicalTarget = slot.targetForm === "params-element"
            ? readOwnStringField(sourceTargetParameterType, "kind", "call-argument target parameter type", childSnapshotPath(path, "targetParameter.type")) === "array"
                ? readOwnDataField(sourceTargetParameterType, "element", "array target parameter type", childSnapshotPath(path, "targetParameter.type"))
                : undefined
            : sourceTargetParameterType;
        if (originalCanonicalTarget === undefined || target !== originalCanonicalTarget) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "target"))}': target does not match the canonical selected target parameter conversion form.`);
        }
        const targetParameter = snapshotTargetParameter(callRequest.targetParameter, childSnapshotPath(path, "targetParameter"), cache);
        const canonicalTarget = slot.targetForm === "params-element"
            ? targetParameter.type.element
            : targetParameter.type;
        const sourceBinding = snapshotSelectedCallArgumentBinding(callRequest.sourceBinding, childSnapshotPath(path, "sourceBinding"));
        if (selectedSignature.sourceSelection.kind !== "applicable") {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(path)}': call-argument conversion requires an applicable selected source signature.`);
        }
        const canonicalSourceBinding = selectedSignature.sourceSelection.argumentBindings[sourceBinding.effectiveArgumentIndex];
        if (canonicalSourceBinding === undefined || !selectedCallArgumentBindingsEqual(canonicalSourceBinding, sourceBinding)) {
            throw new Error(`Invalid checked call-argument conversion at '${formatSnapshotPath(childSnapshotPath(path, "sourceBinding"))}': binding is not the canonical selected source argument binding at effective argument index ${sourceBinding.effectiveArgumentIndex}.`);
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
            call: callRequest.call,
            slot,
            targetParameter,
            selectedSignature,
            sourceBinding: canonicalSourceBinding,
        });
    }
    if (conversionKind !== "assertion") {
        throw invalidEnumValueError("CheckedConversionMappingRequest conversionKind", conversionKind, childSnapshotPath(path, "conversionKind"));
    }
    const assertionRequest = captureExactOwnFields(request, [
        "sourceOperationKind",
        "expression",
        "source",
        "targetPlatform",
        "conversionKind",
        "target",
        "assertionKind",
        "explicitTargetTypeNode",
    ], "assertion CheckedConversionMappingRequest", path);
    assertOpaqueIdentitySubject(assertionRequest.expression, "CheckedConversionMappingRequest expression", childSnapshotPath(path, "expression"));
    if (assertionRequest.targetPlatform !== undefined) {
        assertString(assertionRequest.targetPlatform, "CheckedConversionMappingRequest targetPlatform", childSnapshotPath(path, "targetPlatform"));
    }
    if (assertionRequest.assertionKind !== "as" && assertionRequest.assertionKind !== "angle-bracket" && assertionRequest.assertionKind !== "jsdoc") {
        throw invalidEnumValueError("assertion CheckedConversionMappingRequest assertionKind", assertionRequest.assertionKind, childSnapshotPath(path, "assertionKind"));
    }
    assertOpaqueIdentitySubject(assertionRequest.explicitTargetTypeNode, "assertion CheckedConversionMappingRequest explicitTargetTypeNode", childSnapshotPath(path, "explicitTargetTypeNode"));
    return Object.freeze({
        sourceOperationKind: "conversion",
        expression: assertionRequest.expression,
        source: snapshotSelectedSourceValueEvidence(assertionRequest.source, childSnapshotPath(path, "source")),
        ...(assertionRequest.targetPlatform === undefined ? {} : { targetPlatform: assertionRequest.targetPlatform }),
        conversionKind: "assertion",
        target: snapshotSelectedSourceTypeEvidence(assertionRequest.target, childSnapshotPath(path, "target")),
        assertionKind: assertionRequest.assertionKind,
        explicitTargetTypeNode: assertionRequest.explicitTargetTypeNode,
    });
}
export function snapshotCheckedOperationResponse(observation, response) {
    return snapshotCheckedOperationResponseAtPath(observation, response, createSnapshotPath(`checked-operation response[${observation}]`));
}
function snapshotCheckedOperationResponseAtPath(observation, response, path) {
    assertRecord(response, "checked-operation response", path);
    if (checkedOperationResponseSnapshots.get(response) === observation) {
        return response;
    }
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall: {
            const call = response;
            const kind = readDiscriminant(call, "checked call mapping response", path);
            if (kind === "source") {
                captureExactOwnFields(call, ["kind"], "source checked call mapping response", path);
                return checkedOperationResponseSnapshot(observation, Object.freeze({ kind: "source" }));
            }
            if (kind !== "target") {
                throw unknownKindError("checked call mapping response", kind, path);
            }
            const targetCall = captureExactOwnFields(call, ["kind", "selectedSignature", "argumentConversions"], "target checked call mapping response", path);
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
            const conversion = captureExactOwnFields(response, ["convertedType", "operation", "providerDeclaration"], "checked conversion mapping response", path);
            const convertedType = conversion.convertedType;
            const operation = conversion.operation;
            const providerDeclaration = conversion.providerDeclaration;
            return checkedOperationResponseSnapshot(observation, Object.freeze({
                ...(convertedType === undefined ? {} : {
                    convertedType: snapshotTargetTypeRef(convertedType, childSnapshotPath(path, "convertedType")),
                }),
                ...(operation === undefined ? {} : {
                    operation: snapshotTargetOperationProposal(operation, childSnapshotPath(path, "operation")),
                }),
                ...(providerDeclaration === undefined ? {} : {
                    providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
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
    result = captureExactOwnFields(result, ["operation", "resultType", "providerDeclaration"], "CheckedOperationMappingResult", path);
    const operation = result.operation;
    const resultType = result.resultType;
    const providerDeclaration = result.providerDeclaration;
    return Object.freeze({
        operation: snapshotTargetOperationProposal(operation, childSnapshotPath(path, "operation")),
        ...(resultType === undefined ? {} : {
            resultType: snapshotTargetTypeRef(resultType, childSnapshotPath(path, "resultType")),
        }),
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
    });
}
function snapshotTargetSignatureSelection(selection, path, cache) {
    assertRecord(selection, "TargetSignatureSelection", path);
    selection = captureExactOwnFields(selection, ["member", "targetTypeArguments", "providerDeclaration"], "TargetSignatureSelection", path);
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
    const sourceSelectionObject = selection;
    selection = captureExactOwnFields(selection, [
        "member",
        "targetTypeArguments",
        "providerDeclaration",
        "argumentConversions",
        "sourceCallKind",
        "sourceSelection",
        "sourceCallee",
        "sourceArguments",
        "sourceResult",
        "sourceReceiver",
        "sourceChainRole",
    ], "SelectedTargetSignatureFact", path);
    const cached = cache.selectedTargetSignatures.get(sourceSelectionObject);
    const targetSelection = snapshotTargetSignatureSelection({
        member: selection.member,
        ...(selection.targetTypeArguments === undefined ? {} : { targetTypeArguments: selection.targetTypeArguments }),
        ...(selection.providerDeclaration === undefined ? {} : { providerDeclaration: selection.providerDeclaration }),
    }, path, cache);
    const argumentConversions = snapshotArgumentConversionSlots(selection.argumentConversions, childSnapshotPath(path, "argumentConversions"), cache);
    const sourceCallKind = selection.sourceCallKind;
    const sourceSelection = selection.sourceSelection;
    const sourceCallee = selection.sourceCallee;
    const sourceArguments = selection.sourceArguments;
    const sourceResult = selection.sourceResult;
    const sourceReceiver = selection.sourceReceiver;
    assertCheckedCallKind(sourceCallKind, childSnapshotPath(path, "sourceCallKind"));
    const capturedSourceArguments = captureArray(sourceArguments, "SelectedTargetSignatureFact sourceArguments", childSnapshotPath(path, "sourceArguments"));
    const sourceSelectionSnapshot = snapshotSourceSelectedCallEvidence(sourceSelection, childSnapshotPath(path, "sourceSelection"), capturedSourceArguments.length);
    const snapshot = Object.freeze({
        member: targetSelection.member,
        argumentConversions,
        ...(targetSelection.targetTypeArguments === undefined ? {} : { targetTypeArguments: targetSelection.targetTypeArguments }),
        ...(targetSelection.providerDeclaration === undefined ? {} : { providerDeclaration: targetSelection.providerDeclaration }),
        sourceCallKind,
        sourceSelection: sourceSelectionSnapshot,
        sourceCallee: snapshotSelectedSourceValueEvidence(sourceCallee, childSnapshotPath(path, "sourceCallee")),
        sourceArguments: Object.freeze(capturedSourceArguments.map((evidence, index) => snapshotSelectedSourceValueEvidence(evidence, indexedSnapshotPath(childSnapshotPath(path, "sourceArguments"), index)))),
        sourceResult: snapshotSelectedSourceValueEvidence(sourceResult, childSnapshotPath(path, "sourceResult")),
        ...(sourceReceiver === undefined ? {} : {
            sourceReceiver: snapshotSelectedSourceValueEvidence(sourceReceiver, childSnapshotPath(path, "sourceReceiver")),
        }),
        sourceChainRole: snapshotSourceChainRole(selection.sourceChainRole, "call", childSnapshotPath(path, "sourceChainRole")),
    });
    if (cached !== undefined) {
        if (!selectedTargetSignatureEquals(cached, snapshot)) {
            throw new Error(`Invalid SelectedTargetSignatureFact at '${formatSnapshotPath(path)}': source object changed after its reusable snapshot was committed.`);
        }
        return cached;
    }
    cache.selectedTargetSignatures.set(sourceSelectionObject, snapshot);
    cache.selectedTargetSignatures.set(snapshot, snapshot);
    return snapshot;
}
function snapshotTargetMember(member, path, cache) {
    assertRecord(member, "TargetMember", path);
    member = captureExactOwnFields(member, ["id", "sourceName", "targetName", "kind", "static", "parameters", "returnType", "typeParameters", "overloadGroup", "providerDeclaration"], "TargetMember", path);
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
    const typeParameterSnapshots = typeParameters === undefined
        ? undefined
        : snapshotTargetTypeParameterArray(typeParameters, childSnapshotPath(path, "typeParameters"));
    if (typeParameterSnapshots !== undefined) {
        const seenNames = new Set();
        for (const parameter of typeParameterSnapshots) {
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
        ...(typeParameterSnapshots === undefined ? {} : {
            typeParameters: typeParameterSnapshots,
        }),
        ...(overloadGroup === undefined ? {} : { overloadGroup }),
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
    });
}
function snapshotTargetParameter(parameter, path, cache) {
    assertRecord(parameter, "TargetParameter", path);
    const sourceParameterObject = parameter;
    parameter = captureExactOwnFields(parameter, ["name", "type", "passingMode", "optional", "paramsArray"], "TargetParameter", path);
    const cached = cache?.targetParameters.get(sourceParameterObject);
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
    if (cached !== undefined) {
        if (!targetParameterEquals(cached, snapshot)) {
            throw new Error(`Invalid TargetParameter at '${formatSnapshotPath(path)}': source object changed after its reusable snapshot was committed.`);
        }
        return cached;
    }
    cache?.targetParameters.set(sourceParameterObject, snapshot);
    cache?.targetParameters.set(snapshot, snapshot);
    return snapshot;
}
function snapshotTargetTypeParameter(parameter, path) {
    assertRecord(parameter, "TargetTypeParameter", path);
    parameter = captureExactOwnFields(parameter, ["name", "constraints", "variance"], "TargetTypeParameter", path);
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
            const implementsConstraint = captureExactOwnFields(constraint, ["kind", "contract", "typeArguments"], "implements TargetConstraint", path);
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
            const lifetime = captureExactOwnFields(constraint, ["kind", "name"], "lifetime TargetConstraint", path);
            const name = lifetime.name;
            assertString(name, "TargetConstraint lifetime name", childSnapshotPath(path, "name"));
            return Object.freeze({ kind: "lifetime", name });
        }
        case "target-specific": {
            const targetConstraint = captureExactOwnFields(constraint, ["kind", "target", "name", "payloadId"], "target-specific TargetConstraint", path);
            const target = targetConstraint.target;
            const name = targetConstraint.name;
            const payloadId = targetConstraint.payloadId;
            assertString(target, "TargetConstraint target", childSnapshotPath(path, "target"));
            assertString(name, "TargetConstraint name", childSnapshotPath(path, "name"));
            if (payloadId !== undefined) {
                assertString(payloadId, "TargetConstraint payloadId", childSnapshotPath(path, "payloadId"));
            }
            return Object.freeze({
                kind: "target-specific",
                target,
                name,
                ...(payloadId === undefined ? {} : { payloadId }),
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
    return snapshotTargetTypeRefGraph(captured, path);
}
function snapshotTargetTypeRef(type, path) {
    const snapshots = snapshotTargetTypeRefGraph([type], path, true);
    const snapshot = snapshots[0];
    if (snapshot === undefined) {
        throw new Error("TargetTypeRef snapshot traversal did not produce a root snapshot.");
    }
    return snapshot;
}
function snapshotTargetTypeRefGraph(roots, path, rootPathIsValue = false) {
    path = targetTypeRefSnapshotPath(path);
    const snapshots = path.budget.targetTypeRefSnapshots;
    const capturedTypes = new WeakMap();
    const activePaths = new WeakMap();
    const stack = [];
    for (let index = roots.length - 1; index >= 0; index -= 1) {
        const root = roots[index];
        if (root !== undefined) {
            stack.push({
                stage: "enter",
                type: root,
                path: rootPathIsValue ? path : indexedSnapshotPath(path, index),
            });
        }
    }
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
    const result = [];
    for (let index = 0; index < roots.length; index += 1) {
        const root = roots[index];
        const snapshot = root === undefined ? undefined : snapshots.get(root);
        if (snapshot === undefined) {
            throw new Error(`TargetTypeRef snapshot traversal did not produce root ${index}.`);
        }
        result.push(snapshot);
    }
    return Object.freeze(result);
}
function captureTargetTypeRef(type, path) {
    const actualKind = readDiscriminant(type, "TargetTypeRef", path);
    switch (actualKind) {
        case "source-primitive": {
            const source = captureExactOwnFields(type, ["kind", "name"], "source-primitive TargetTypeRef", path);
            const name = source.name;
            assertSourcePrimitiveKind(name, childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "source-primitive", name }) };
        }
        case "source-global": {
            const source = captureExactOwnFields(type, ["kind", "name", "typeArguments"], "source-global TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "id", "typeArguments"], "target-named TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "name"], "type-parameter TargetTypeRef", path);
            const name = source.name;
            assertString(name, "TargetTypeRef type parameter name", childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "type-parameter", name }) };
        }
        case "array": {
            const source = captureExactOwnFields(type, ["kind", "element", "rank"], "array TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "elements"], "tuple TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "pointee", "mutability"], "pointer TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "args", "result", "abi"], "function-pointer TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "id"], "opaque TargetTypeRef", path);
            const id = source.id;
            assertString(id, "TargetTypeRef opaque id", childSnapshotPath(path, "id"));
            return { children: [], build: () => Object.freeze({ kind: "opaque", id }) };
        }
        case "associated-type": {
            const source = captureExactOwnFields(type, ["kind", "owner", "name"], "associated-type TargetTypeRef", path);
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
            const source = captureExactOwnFields(type, ["kind", "name"], "lifetime TargetTypeRef", path);
            const name = source.name;
            assertString(name, "TargetTypeRef lifetime name", childSnapshotPath(path, "name"));
            return { children: [], build: () => Object.freeze({ kind: "lifetime", name }) };
        }
        case "target-specific": {
            const source = captureExactOwnFields(type, ["kind", "target", "name", "payloadId"], "target-specific TargetTypeRef", path);
            const target = source.target;
            const name = source.name;
            const payloadId = source.payloadId;
            assertString(target, "TargetTypeRef target", childSnapshotPath(path, "target"));
            assertString(name, "TargetTypeRef name", childSnapshotPath(path, "name"));
            if (payloadId !== undefined) {
                assertString(payloadId, "TargetTypeRef payloadId", childSnapshotPath(path, "payloadId"));
            }
            return {
                children: [],
                build: () => Object.freeze({
                    kind: "target-specific",
                    target,
                    name,
                    ...(payloadId === undefined ? {} : { payloadId }),
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
    return captureArray(types, "TargetTypeRef array", path);
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
export function snapshotTargetOperationFact(operation) {
    return snapshotTargetOperation(operation, createSnapshotPath("target operation fact"));
}
export function snapshotSelectedTargetSignatureFact(selection, cache = createCheckedOperationRequestSnapshotCache()) {
    const path = createSnapshotPath("selected target signature fact");
    const cacheTransaction = createCheckedOperationRequestSnapshotCacheTransaction(cache, path);
    const snapshot = snapshotSelectedTargetSignature(selection, path, cacheTransaction.access);
    cacheTransaction.commit();
    return snapshot;
}
export function snapshotCanonicalIdentityFact(value) {
    const path = createSnapshotPath("canonical identity fact");
    assertRecord(value, "ExtensionCanonicalIdentity", path);
    value = captureExactOwnFields(value, [
        "kind",
        "id",
        "packageName",
        "packageVersion",
        "subpath",
        "exportName",
        "importKind",
        "canonicalSymbolId",
    ], "ExtensionCanonicalIdentity", path);
    assertCanonicalIdentityKind(value.kind, childSnapshotPath(path, "kind"));
    assertString(value.id, "ExtensionCanonicalIdentity id", childSnapshotPath(path, "id"));
    assertOptionalString(value.packageName, "ExtensionCanonicalIdentity packageName", childSnapshotPath(path, "packageName"));
    assertOptionalString(value.packageVersion, "ExtensionCanonicalIdentity packageVersion", childSnapshotPath(path, "packageVersion"));
    assertOptionalString(value.subpath, "ExtensionCanonicalIdentity subpath", childSnapshotPath(path, "subpath"));
    assertOptionalString(value.exportName, "ExtensionCanonicalIdentity exportName", childSnapshotPath(path, "exportName"));
    if (value.importKind !== undefined) {
        assertExtensionImportKind(value.importKind, childSnapshotPath(path, "importKind"));
    }
    assertOptionalString(value.canonicalSymbolId, "ExtensionCanonicalIdentity canonicalSymbolId", childSnapshotPath(path, "canonicalSymbolId"));
    return Object.freeze({
        kind: value.kind,
        id: value.id,
        ...(value.packageName === undefined ? {} : { packageName: value.packageName }),
        ...(value.packageVersion === undefined ? {} : { packageVersion: value.packageVersion }),
        ...(value.subpath === undefined ? {} : { subpath: value.subpath }),
        ...(value.exportName === undefined ? {} : { exportName: value.exportName }),
        ...(value.importKind === undefined ? {} : { importKind: value.importKind }),
        ...(value.canonicalSymbolId === undefined ? {} : { canonicalSymbolId: value.canonicalSymbolId }),
    });
}
export function snapshotSourcePrimitiveFact(value) {
    const path = createSnapshotPath("source primitive fact");
    assertRecord(value, "SourcePrimitiveFact", path);
    value = captureExactOwnFields(value, ["kind", "signed", "width", "runtimeBase"], "SourcePrimitiveFact", path);
    assertSourcePrimitiveKind(value.kind, childSnapshotPath(path, "kind"));
    if (value.signed !== undefined) {
        assertBoolean(value.signed, "SourcePrimitiveFact signed", childSnapshotPath(path, "signed"));
    }
    if (value.width !== undefined) {
        assertPositiveInteger(value.width, "SourcePrimitiveFact width", childSnapshotPath(path, "width"));
    }
    assertSourcePrimitiveRuntimeBase(value.runtimeBase, childSnapshotPath(path, "runtimeBase"));
    return Object.freeze({
        kind: value.kind,
        ...(value.signed === undefined ? {} : { signed: value.signed }),
        ...(value.width === undefined ? {} : { width: value.width }),
        runtimeBase: value.runtimeBase,
    });
}
export function snapshotArgumentPassingFact(value) {
    const path = createSnapshotPath("argument passing fact");
    assertRecord(value, "ArgumentPassingFact", path);
    value = captureExactOwnFields(value, ["mode", "targetExpression"], "ArgumentPassingFact", path);
    assertArgumentPassingMode(value.mode, childSnapshotPath(path, "mode"));
    if (value.targetExpression !== undefined) {
        assertOpaqueIdentitySubject(value.targetExpression, "ArgumentPassingFact targetExpression", childSnapshotPath(path, "targetExpression"));
    }
    return Object.freeze({
        mode: value.mode,
        ...(value.targetExpression === undefined ? {} : { targetExpression: value.targetExpression }),
    });
}
export function snapshotFunctionPointerFact(value) {
    const path = createSnapshotPath("function pointer fact");
    assertRecord(value, "FunctionPointerFact", path);
    value = captureExactOwnFields(value, ["parameters", "result", "abi"], "FunctionPointerFact", path);
    const parameters = captureOpaqueIdentitySubjectArray(value.parameters, "FunctionPointerFact parameters", childSnapshotPath(path, "parameters"));
    assertOpaqueIdentitySubject(value.result, "FunctionPointerFact result", childSnapshotPath(path, "result"));
    const abi = captureStringArray(value.abi, "FunctionPointerFact abi", childSnapshotPath(path, "abi"));
    return Object.freeze({ parameters: Object.freeze([...parameters]), result: value.result, abi: Object.freeze([...abi]) });
}
export function snapshotPointerFact(value) {
    const path = createSnapshotPath("pointer fact");
    assertRecord(value, "PointerFact", path);
    value = captureExactOwnFields(value, ["pointee", "mutability", "unsafeRequired"], "PointerFact", path);
    assertOpaqueIdentitySubject(value.pointee, "PointerFact pointee", childSnapshotPath(path, "pointee"));
    assertSourcePointerMutability(value.mutability, childSnapshotPath(path, "mutability"));
    assertBoolean(value.unsafeRequired, "PointerFact unsafeRequired", childSnapshotPath(path, "unsafeRequired"));
    return Object.freeze({ pointee: value.pointee, mutability: value.mutability, unsafeRequired: value.unsafeRequired });
}
export function snapshotStructFact(value) {
    const path = createSnapshotPath("struct fact");
    assertRecord(value, "StructFact", path);
    value = captureExactOwnFields(value, ["valueType", "fields"], "StructFact", path);
    assertBoolean(value.valueType, "StructFact valueType", childSnapshotPath(path, "valueType"));
    return Object.freeze({
        valueType: value.valueType,
        ...(value.fields === undefined ? {} : {
            fields: snapshotFieldFactArray(value.fields, childSnapshotPath(path, "fields")),
        }),
    });
}
export function snapshotFieldFactValue(value) {
    return snapshotFieldFact(value, createSnapshotPath("field fact"));
}
export function snapshotAttributeFact(value) {
    const path = createSnapshotPath("attribute fact");
    assertRecord(value, "AttributeFact", path);
    value = captureExactOwnFields(value, ["target", "attributeName", "arguments"], "AttributeFact", path);
    assertOpaqueIdentitySubject(value.target, "AttributeFact target", childSnapshotPath(path, "target"));
    assertString(value.attributeName, "AttributeFact attributeName", childSnapshotPath(path, "attributeName"));
    const arguments_ = value.arguments === undefined
        ? undefined
        : captureOpaqueIdentitySubjectArray(value.arguments, "AttributeFact arguments", childSnapshotPath(path, "arguments"));
    return Object.freeze({
        target: value.target,
        attributeName: value.attributeName,
        ...(arguments_ === undefined ? {} : { arguments: Object.freeze([...arguments_]) }),
    });
}
export function snapshotDefaultValueFact(value) {
    const path = createSnapshotPath("default value fact");
    assertRecord(value, "DefaultValueFact", path);
    value = captureExactOwnFields(value, ["type"], "DefaultValueFact", path);
    assertOpaqueIdentitySubject(value.type, "DefaultValueFact type", childSnapshotPath(path, "type"));
    return Object.freeze({ type: value.type });
}
export function snapshotTargetBindingFact(value) {
    return snapshotTargetBindingFactAtPath(value, createSnapshotPath("target binding fact"));
}
function snapshotTargetBindingFactAtPath(value, path) {
    assertRecord(value, "TargetBindingFact", path);
    value = captureExactOwnFields(value, [
        "id",
        "sourceName",
        "targetName",
        "target",
        "kind",
        "typeParameters",
        "members",
        "implementedContracts",
    ], "TargetBindingFact", path);
    assertString(value.id, "TargetBindingFact id", childSnapshotPath(path, "id"));
    assertString(value.sourceName, "TargetBindingFact sourceName", childSnapshotPath(path, "sourceName"));
    assertString(value.targetName, "TargetBindingFact targetName", childSnapshotPath(path, "targetName"));
    assertString(value.target, "TargetBindingFact target", childSnapshotPath(path, "target"));
    assertTargetBindingKind(value.kind, childSnapshotPath(path, "kind"));
    return Object.freeze({
        id: value.id,
        sourceName: value.sourceName,
        targetName: value.targetName,
        target: value.target,
        kind: value.kind,
        ...(value.typeParameters === undefined ? {} : {
            typeParameters: snapshotTargetTypeParameterArray(value.typeParameters, childSnapshotPath(path, "typeParameters")),
        }),
        ...(value.members === undefined ? {} : {
            members: snapshotTargetMemberArray(value.members, childSnapshotPath(path, "members")),
        }),
        ...(value.implementedContracts === undefined ? {} : {
            implementedContracts: snapshotTargetConstraintArray(value.implementedContracts, childSnapshotPath(path, "implementedContracts")),
        }),
    });
}
export function snapshotInstantiatedTargetTypeFact(value) {
    const path = createSnapshotPath("instantiated target type fact");
    assertRecord(value, "InstantiatedTargetTypeFact", path);
    value = captureExactOwnFields(value, ["targetType", "typeArguments", "resolvedTypeArguments"], "InstantiatedTargetTypeFact", path);
    const typeArguments = captureOpaqueIdentitySubjectArray(value.typeArguments, "InstantiatedTargetTypeFact typeArguments", childSnapshotPath(path, "typeArguments"));
    if (value.resolvedTypeArguments !== undefined && value.resolvedTypeArguments.length !== typeArguments.length) {
        throw new Error(`Invalid InstantiatedTargetTypeFact at '${formatSnapshotPath(path)}': resolved target type argument count must equal source type argument count.`);
    }
    return Object.freeze({
        targetType: snapshotTargetBindingFactAtPath(value.targetType, childSnapshotPath(path, "targetType")),
        typeArguments: Object.freeze([...typeArguments]),
        ...(value.resolvedTypeArguments === undefined ? {} : {
            resolvedTypeArguments: snapshotTargetTypeRefArray(value.resolvedTypeArguments, childSnapshotPath(path, "resolvedTypeArguments")),
        }),
    });
}
export function snapshotContextualTargetTypeFact(value) {
    const path = createSnapshotPath("contextual target type fact");
    assertRecord(value, "ContextualTargetTypeFact", path);
    value = captureExactOwnFields(value, ["type", "targetType"], "ContextualTargetTypeFact", path);
    assertOpaqueIdentitySubject(value.type, "ContextualTargetTypeFact type", childSnapshotPath(path, "type"));
    return Object.freeze({
        type: value.type,
        ...(value.targetType === undefined ? {} : {
            targetType: snapshotTargetTypeRef(value.targetType, childSnapshotPath(path, "targetType")),
        }),
    });
}
export function snapshotFlowStateFact(value) {
    const path = createSnapshotPath("flow state fact");
    assertRecord(value, "FlowStateFact", path);
    value = captureExactOwnFields(value, ["state", "targetCompiler", "evidence"], "FlowStateFact", path);
    assertFlowState(value.state, childSnapshotPath(path, "state"));
    assertOptionalString(value.targetCompiler, "FlowStateFact targetCompiler", childSnapshotPath(path, "targetCompiler"));
    return Object.freeze({
        state: value.state,
        ...(value.targetCompiler === undefined ? {} : { targetCompiler: value.targetCompiler }),
        ...(value.evidence === undefined ? {} : {
            evidence: snapshotEvidenceArray(value.evidence, childSnapshotPath(path, "evidence")),
        }),
    });
}
export function snapshotRuntimeCarrierFact(value) {
    const path = createSnapshotPath("runtime carrier fact");
    assertRecord(value, "RuntimeCarrierFact", path);
    value = captureExactOwnFields(value, ["carrier", "requiresAllocation", "provenance"], "RuntimeCarrierFact", path);
    if (value.requiresAllocation !== undefined) {
        assertBoolean(value.requiresAllocation, "RuntimeCarrierFact requiresAllocation", childSnapshotPath(path, "requiresAllocation"));
    }
    return Object.freeze({
        carrier: snapshotTargetTypeRef(value.carrier, childSnapshotPath(path, "carrier")),
        ...(value.requiresAllocation === undefined ? {} : { requiresAllocation: value.requiresAllocation }),
        ...(value.provenance === undefined ? {} : {
            provenance: snapshotRuntimeCarrierProvenance(value.provenance, childSnapshotPath(path, "provenance")),
        }),
    });
}
export function snapshotTargetConversionFact(value) {
    return snapshotTargetConversionFactAtPath(value, createSnapshotPath("target conversion fact"));
}
export function snapshotTargetCallArgumentConversionFact(value) {
    const path = createSnapshotPath("target call argument conversion fact");
    assertRecord(value, "TargetCallArgumentConversionFact", path);
    value = captureExactOwnFields(value, ["slot", "call", "sourceBinding", "convertedType", "operation"], "TargetCallArgumentConversionFact", path);
    assertOpaqueIdentitySubject(value.call, "TargetCallArgumentConversionFact call", childSnapshotPath(path, "call"));
    const slot = snapshotSingleArgumentConversionSlot(value.slot, childSnapshotPath(path, "slot"));
    const sourceBinding = snapshotSelectedCallArgumentBinding(value.sourceBinding, childSnapshotPath(path, "sourceBinding"));
    assertConversionSlotMatchesSourceBinding(slot, sourceBinding, path);
    return Object.freeze({
        slot,
        call: value.call,
        sourceBinding,
        ...snapshotTargetConversionFactFields(value, path),
    });
}
export function snapshotTargetCallArgumentPassingFact(value) {
    const path = createSnapshotPath("target call argument passing fact");
    assertRecord(value, "TargetCallArgumentPassingFact", path);
    value = captureExactOwnFields(value, [
        "mode",
        "targetExpression",
        "slot",
        "call",
        "sourceBinding",
        "targetParameter",
        "selectedSignature",
    ], "TargetCallArgumentPassingFact", path);
    assertArgumentPassingMode(value.mode, childSnapshotPath(path, "mode"));
    if (value.targetExpression !== undefined) {
        assertOpaqueIdentitySubject(value.targetExpression, "TargetCallArgumentPassingFact targetExpression", childSnapshotPath(path, "targetExpression"));
    }
    assertOpaqueIdentitySubject(value.call, "TargetCallArgumentPassingFact call", childSnapshotPath(path, "call"));
    const slot = snapshotSingleArgumentConversionSlot(value.slot, childSnapshotPath(path, "slot"));
    const sourceBinding = snapshotSelectedCallArgumentBinding(value.sourceBinding, childSnapshotPath(path, "sourceBinding"));
    assertConversionSlotMatchesSourceBinding(slot, sourceBinding, path);
    return Object.freeze({
        mode: value.mode,
        ...(value.targetExpression === undefined ? {} : { targetExpression: value.targetExpression }),
        slot,
        call: value.call,
        sourceBinding,
        targetParameter: snapshotTargetParameter(value.targetParameter, childSnapshotPath(path, "targetParameter")),
        ...(value.selectedSignature === undefined ? {} : {
            selectedSignature: snapshotProviderDeclaration(value.selectedSignature, childSnapshotPath(path, "selectedSignature")),
        }),
    });
}
export function snapshotProviderVirtualDeclarationFact(value) {
    return snapshotProviderVirtualDeclarationFactAtPath(value, createSnapshotPath("provider virtual declaration fact"));
}
export function snapshotProviderTypeFamilyFact(value) {
    const path = createSnapshotPath("provider type family fact");
    assertRecord(value, "ProviderTypeFamilyFact", path);
    value = captureExactOwnFields(value, ["exportName", "variants"], "ProviderTypeFamilyFact", path);
    assertString(value.exportName, "ProviderTypeFamilyFact exportName", childSnapshotPath(path, "exportName"));
    const variants = captureArray(value.variants, "ProviderTypeFamilyVariantFact array", childSnapshotPath(path, "variants"));
    if (variants.length === 0) {
        throw new Error(`Invalid ProviderTypeFamilyFact at '${formatSnapshotPath(path)}': variants must not be empty.`);
    }
    const seenArities = new Set();
    const snapshots = variants.map((variant, index) => {
        const snapshot = snapshotProviderTypeFamilyVariantFact(variant, indexedSnapshotPath(childSnapshotPath(path, "variants"), index));
        if (seenArities.has(snapshot.sourceTypeArgumentCount)) {
            throw new Error(`Invalid ProviderTypeFamilyFact at '${formatSnapshotPath(path)}': duplicate source type argument count ${snapshot.sourceTypeArgumentCount}.`);
        }
        seenArities.add(snapshot.sourceTypeArgumentCount);
        return snapshot;
    });
    snapshots.sort((left, right) => left.sourceTypeArgumentCount - right.sourceTypeArgumentCount);
    return Object.freeze({ exportName: value.exportName, variants: Object.freeze(snapshots) });
}
export function snapshotAssociatedTypeFact(value) {
    const path = createSnapshotPath("associated type fact");
    assertRecord(value, "AssociatedTypeFact", path);
    value = captureExactOwnFields(value, ["owner", "name", "value"], "AssociatedTypeFact", path);
    assertOpaqueIdentitySubject(value.owner, "AssociatedTypeFact owner", childSnapshotPath(path, "owner"));
    assertString(value.name, "AssociatedTypeFact name", childSnapshotPath(path, "name"));
    assertOpaqueIdentitySubject(value.value, "AssociatedTypeFact value", childSnapshotPath(path, "value"));
    return Object.freeze({ owner: value.owner, name: value.name, value: value.value });
}
export function snapshotConstGenericFact(value) {
    const path = createSnapshotPath("const generic fact");
    assertRecord(value, "ConstGenericFact", path);
    value = captureExactOwnFields(value, ["name", "value"], "ConstGenericFact", path);
    assertString(value.name, "ConstGenericFact name", childSnapshotPath(path, "name"));
    if (typeof value.value !== "string"
        && typeof value.value !== "number"
        && typeof value.value !== "bigint"
        && typeof value.value !== "boolean") {
        throw new Error(`Invalid ConstGenericFact at '${formatSnapshotPath(childSnapshotPath(path, "value"))}': expected string, number, bigint, or boolean.`);
    }
    if (typeof value.value === "number" && !Number.isFinite(value.value)) {
        throw new Error(`Invalid ConstGenericFact at '${formatSnapshotPath(childSnapshotPath(path, "value"))}': numeric constants must be finite.`);
    }
    return Object.freeze({ name: value.name, value: value.value });
}
function snapshotFieldFact(value, path) {
    assertRecord(value, "FieldFact", path);
    value = captureExactOwnFields(value, ["name", "type", "readonly"], "FieldFact", path);
    assertString(value.name, "FieldFact name", childSnapshotPath(path, "name"));
    assertOpaqueIdentitySubject(value.type, "FieldFact type", childSnapshotPath(path, "type"));
    if (value.readonly !== undefined) {
        assertBoolean(value.readonly, "FieldFact readonly", childSnapshotPath(path, "readonly"));
    }
    return Object.freeze({
        name: value.name,
        type: value.type,
        ...(value.readonly === undefined ? {} : { readonly: value.readonly }),
    });
}
function snapshotFieldFactArray(values, path) {
    const captured = captureArray(values, "FieldFact array", path);
    return Object.freeze(captured.map((value, index) => snapshotFieldFact(value, indexedSnapshotPath(path, index))));
}
function snapshotTargetMemberArray(values, path) {
    const captured = captureArray(values, "TargetMember array", path);
    return Object.freeze(captured.map((value, index) => snapshotTargetMember(value, indexedSnapshotPath(path, index))));
}
function snapshotRuntimeCarrierProvenance(value, path) {
    assertRecord(value, "RuntimeCarrierProvenance", path);
    value = captureExactOwnFields(value, [
        "sourceType",
        "sourceTypeReference",
        "sourceSymbol",
        "providerDeclaration",
    ], "RuntimeCarrierProvenance", path);
    for (const [field, subject] of [
        ["sourceType", value.sourceType],
        ["sourceTypeReference", value.sourceTypeReference],
        ["sourceSymbol", value.sourceSymbol],
    ]) {
        if (subject !== undefined) {
            assertOpaqueIdentitySubject(subject, `RuntimeCarrierProvenance ${field}`, childSnapshotPath(path, field));
        }
    }
    return Object.freeze({
        ...(value.sourceType === undefined ? {} : { sourceType: value.sourceType }),
        ...(value.sourceTypeReference === undefined ? {} : { sourceTypeReference: value.sourceTypeReference }),
        ...(value.sourceSymbol === undefined ? {} : { sourceSymbol: value.sourceSymbol }),
        ...(value.providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(value.providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
    });
}
function snapshotTargetConversionFactAtPath(value, path) {
    assertRecord(value, "TargetConversionFact", path);
    value = captureExactOwnFields(value, ["convertedType", "operation"], "TargetConversionFact", path);
    return Object.freeze(snapshotTargetConversionFactFields(value, path));
}
function snapshotTargetConversionFactFields(value, path) {
    return {
        ...(value.convertedType === undefined ? {} : {
            convertedType: snapshotTargetTypeRef(value.convertedType, childSnapshotPath(path, "convertedType")),
        }),
        ...(value.operation === undefined ? {} : {
            operation: snapshotTargetOperation(value.operation, childSnapshotPath(path, "operation")),
        }),
    };
}
function snapshotSingleArgumentConversionSlot(value, path) {
    const snapshot = snapshotArgumentConversionSlots([value], path)[0];
    if (snapshot === undefined) {
        throw new Error(`TargetCallArgumentConversionSlot snapshot at '${formatSnapshotPath(path)}' was not produced.`);
    }
    return snapshot;
}
export function snapshotTargetCallArgumentConversionSlot(value) {
    return snapshotSingleArgumentConversionSlot(value, createSnapshotPath("TargetCallArgumentConversionSlot"));
}
function assertConversionSlotMatchesSourceBinding(slot, binding, path) {
    if (slot.sourceArgumentIndex !== binding.sourceArgumentIndex
        || slot.sourceForm !== binding.sourceForm
        || slot.spreadElementIndex !== binding.spreadElementIndex) {
        throw new Error(`Invalid call argument fact at '${formatSnapshotPath(path)}': target slot and selected source binding identify different authored arguments.`);
    }
}
function snapshotProviderTypeFamilyVariantFact(value, path) {
    assertRecord(value, "ProviderTypeFamilyVariantFact", path);
    value = captureExactOwnFields(value, ["sourceTypeArgumentCount", "declaration", "targetBinding"], "ProviderTypeFamilyVariantFact", path);
    assertNonNegativeInteger(value.sourceTypeArgumentCount, "ProviderTypeFamilyVariantFact sourceTypeArgumentCount", childSnapshotPath(path, "sourceTypeArgumentCount"));
    return Object.freeze({
        sourceTypeArgumentCount: value.sourceTypeArgumentCount,
        declaration: snapshotProviderVirtualDeclarationFactAtPath(value.declaration, childSnapshotPath(path, "declaration")),
        ...(value.targetBinding === undefined ? {} : {
            targetBinding: snapshotTargetBindingFactAtPath(value.targetBinding, childSnapshotPath(path, "targetBinding")),
        }),
    });
}
function snapshotProviderVirtualDeclarationFactAtPath(value, path) {
    const snapshot = snapshotProviderDeclaration(value, path);
    if (snapshot.providerVersion === undefined || snapshot.artifactFileName === undefined) {
        throw new Error(`Invalid ProviderVirtualDeclarationFact at '${formatSnapshotPath(path)}': providerVersion and artifactFileName are required.`);
    }
    return Object.freeze({
        providerId: snapshot.providerId,
        providerVersion: snapshot.providerVersion,
        providerModuleId: snapshot.providerModuleId,
        moduleSpecifier: snapshot.moduleSpecifier,
        artifactFileName: snapshot.artifactFileName,
        ...(snapshot.exportName === undefined ? {} : { exportName: snapshot.exportName }),
        ...(snapshot.exportId === undefined ? {} : { exportId: snapshot.exportId }),
        ...(snapshot.memberName === undefined ? {} : { memberName: snapshot.memberName }),
        ...(snapshot.memberKey === undefined ? {} : { memberKey: snapshot.memberKey }),
        ...(snapshot.memberId === undefined ? {} : { memberId: snapshot.memberId }),
        ...(snapshot.memberStatic === undefined ? {} : { memberStatic: snapshot.memberStatic }),
        ...(snapshot.signatureId === undefined ? {} : { signatureId: snapshot.signatureId }),
        ...(snapshot.targetIdentity === undefined ? {} : { targetIdentity: snapshot.targetIdentity }),
    });
}
function snapshotTargetOperation(operation, path) {
    assertRecord(operation, "TargetOperationFact", path);
    operation = captureExactOwnFields(operation, ["operationId", "operationKind", "targetOperation", "resultType", "evidence", "provenance"], "TargetOperationFact", path);
    const proposal = snapshotTargetOperationProposal({
        operationId: operation.operationId,
        operationKind: operation.operationKind,
        targetOperation: operation.targetOperation,
        ...(operation.evidence === undefined ? {} : { evidence: operation.evidence }),
    }, path);
    const provenance = operation.provenance;
    return Object.freeze({
        ...proposal,
        ...(operation.resultType === undefined ? {} : {
            resultType: snapshotTargetTypeRef(operation.resultType, childSnapshotPath(path, "resultType")),
        }),
        provenance: snapshotOperationProvenance(provenance, childSnapshotPath(path, "provenance")),
    });
}
function snapshotTargetOperationProposal(operation, path) {
    assertRecord(operation, "TargetOperationProposal", path);
    operation = captureExactOwnFields(operation, ["operationId", "operationKind", "targetOperation", "evidence"], "TargetOperationProposal", path);
    const operationId = operation.operationId;
    const operationKind = operation.operationKind;
    const targetOperation = operation.targetOperation;
    const evidence = operation.evidence;
    assertString(operationId, "TargetOperationProposal operationId", childSnapshotPath(path, "operationId"));
    assertTargetOperationKind(operationKind, childSnapshotPath(path, "operationKind"));
    assertString(targetOperation, "TargetOperationProposal targetOperation", childSnapshotPath(path, "targetOperation"));
    return Object.freeze({
        operationId,
        operationKind,
        targetOperation,
        ...(evidence === undefined ? {} : {
            evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
        }),
    });
}
function snapshotOperationProvenance(provenance, path) {
    assertRecord(provenance, "TargetOperationProvenance", path);
    provenance = captureExactOwnFields(provenance, ["providerDeclaration", "sourceOperation"], "TargetOperationProvenance", path);
    const providerDeclaration = provenance.providerDeclaration;
    return Object.freeze({
        ...(providerDeclaration === undefined ? {} : {
            providerDeclaration: snapshotProviderDeclaration(providerDeclaration, childSnapshotPath(path, "providerDeclaration")),
        }),
        sourceOperation: snapshotTargetOperationSourceProvenance(provenance.sourceOperation, childSnapshotPath(path, "sourceOperation")),
    });
}
function snapshotTargetOperationSourceProvenance(sourceOperation, path) {
    assertRecord(sourceOperation, "TargetOperationSourceProvenance", path);
    const kind = readOwnStringField(sourceOperation, "sourceOperationKind", "TargetOperationSourceProvenance", path);
    switch (kind) {
        case "call":
            return snapshotCallRequest(sourceOperation, path, false);
        case "property-access":
            return snapshotPropertyRequest(sourceOperation, path, false);
        case "element-access":
            return snapshotElementRequest(sourceOperation, path, false);
        case "operator":
            return snapshotOperatorRequest(sourceOperation, path, false);
        case "iteration":
            return snapshotIterationRequest(sourceOperation, path, false);
        case "conversion":
            return snapshotConversionSourceOperation(sourceOperation, path);
        default:
            throw unknownKindError("TargetOperationSourceProvenance", kind, path);
    }
}
function snapshotConversionSourceOperation(sourceOperation, path) {
    const conversionKind = readOwnStringField(sourceOperation, "conversionKind", "conversion TargetOperationSourceProvenance", path);
    if (conversionKind === "assertion") {
        const assertionOperation = captureExactOwnFields(sourceOperation, [
            "sourceOperationKind",
            "conversionKind",
            "expression",
            "source",
            "target",
            "assertionKind",
            "explicitTargetTypeNode",
        ], "assertion TargetOperationSourceProvenance", path);
        assertOpaqueIdentitySubject(assertionOperation.expression, "assertion source operation expression", childSnapshotPath(path, "expression"));
        assertOpaqueIdentitySubject(assertionOperation.explicitTargetTypeNode, "assertion source operation explicitTargetTypeNode", childSnapshotPath(path, "explicitTargetTypeNode"));
        if (assertionOperation.assertionKind !== "as" && assertionOperation.assertionKind !== "angle-bracket" && assertionOperation.assertionKind !== "jsdoc") {
            throw invalidEnumValueError("assertion source operation assertionKind", assertionOperation.assertionKind, childSnapshotPath(path, "assertionKind"));
        }
        return Object.freeze({
            sourceOperationKind: "conversion",
            conversionKind: "assertion",
            expression: assertionOperation.expression,
            source: snapshotSelectedSourceValueEvidence(assertionOperation.source, childSnapshotPath(path, "source")),
            target: snapshotSelectedSourceTypeEvidence(assertionOperation.target, childSnapshotPath(path, "target")),
            assertionKind: assertionOperation.assertionKind,
            explicitTargetTypeNode: assertionOperation.explicitTargetTypeNode,
        });
    }
    if (conversionKind !== "call-argument") {
        throw invalidEnumValueError("TargetOperationSourceProvenance conversionKind", conversionKind, childSnapshotPath(path, "conversionKind"));
    }
    const callOperation = captureExactOwnFields(sourceOperation, [
        "sourceOperationKind",
        "conversionKind",
        "expression",
        "source",
        "call",
        "slot",
        "sourceBinding",
    ], "call-argument TargetOperationSourceProvenance", path);
    assertOpaqueIdentitySubject(callOperation.expression, "call-argument source operation expression", childSnapshotPath(path, "expression"));
    assertOpaqueIdentitySubject(callOperation.call, "call-argument source operation call", childSnapshotPath(path, "call"));
    const slot = snapshotArgumentConversionSlots([callOperation.slot], childSnapshotPath(path, "slot"))[0];
    if (slot === undefined) {
        throw new Error(`Invalid call-argument source operation at '${formatSnapshotPath(path)}': missing conversion slot.`);
    }
    const sourceBinding = snapshotSelectedCallArgumentBinding(callOperation.sourceBinding, childSnapshotPath(path, "sourceBinding"));
    if (slot.sourceArgumentIndex !== sourceBinding.sourceArgumentIndex
        || slot.sourceForm !== sourceBinding.sourceForm
        || slot.spreadElementIndex !== sourceBinding.spreadElementIndex) {
        throw new Error(`Invalid call-argument source operation at '${formatSnapshotPath(path)}': conversion slot does not match source binding.`);
    }
    return Object.freeze({
        sourceOperationKind: "conversion",
        conversionKind: "call-argument",
        expression: callOperation.expression,
        source: snapshotSelectedSourceValueEvidence(callOperation.source, childSnapshotPath(path, "source")),
        call: callOperation.call,
        slot,
        sourceBinding,
    });
}
function snapshotSourceSelectedCallEvidence(evidence, path, sourceArgumentCount) {
    assertRecord(evidence, "SourceSelectedCallEvidence", path);
    const kind = readDiscriminant(evidence, "SourceSelectedCallEvidence", path);
    if (kind === "untyped") {
        assertExactOwnFields(evidence, ["kind"], "untyped SourceSelectedCallEvidence", path);
        return Object.freeze({ kind: "untyped" });
    }
    if (kind !== "applicable") {
        throw unknownKindError("SourceSelectedCallEvidence", kind, path);
    }
    const applicable = captureExactOwnFields(evidence, [
        "kind",
        "signature",
        "declaration",
        "methodTypeArguments",
        "parameters",
        "argumentBindings",
    ], "applicable SourceSelectedCallEvidence", path);
    assertOpaqueIdentitySubject(applicable.signature, "SourceSelectedCallEvidence signature", childSnapshotPath(path, "signature"));
    if (applicable.declaration !== undefined) {
        assertOpaqueIdentitySubject(applicable.declaration, "SourceSelectedCallEvidence declaration", childSnapshotPath(path, "declaration"));
    }
    const parameters = snapshotSignatureParameters(applicable.parameters, childSnapshotPath(path, "parameters"));
    return Object.freeze({
        kind: "applicable",
        signature: applicable.signature,
        ...(applicable.declaration === undefined ? {} : { declaration: applicable.declaration }),
        methodTypeArguments: snapshotMethodTypeArguments(applicable.methodTypeArguments, childSnapshotPath(path, "methodTypeArguments")),
        parameters,
        argumentBindings: snapshotSelectedCallArgumentBindings(applicable.argumentBindings, childSnapshotPath(path, "argumentBindings"), sourceArgumentCount, parameters.length),
    });
}
function snapshotSourceChainRole(role, participant, path) {
    assertRecord(role, "CheckedSourceChainRole", path);
    const kind = readDiscriminant(role, "CheckedSourceChainRole", path);
    if (kind === "ordinary") {
        const ordinary = captureExactOwnFields(role, ["kind", "participant"], "ordinary CheckedSourceChainRole", path);
        if (ordinary.participant !== participant) {
            throw invalidEnumValueError("CheckedSourceChainRole participant", ordinary.participant, childSnapshotPath(path, "participant"));
        }
        return Object.freeze({ kind: "ordinary", participant });
    }
    if (kind !== "optional-chain") {
        throw unknownKindError("CheckedSourceChainRole", kind, path);
    }
    const optional = captureExactOwnFields(role, ["kind", "participant", "position", "boundary"], "optional-chain CheckedSourceChainRole", path);
    if (optional.participant !== participant) {
        throw invalidEnumValueError("CheckedSourceChainRole participant", optional.participant, childSnapshotPath(path, "participant"));
    }
    if (optional.position !== "root" && optional.position !== "continuation") {
        throw invalidEnumValueError("CheckedSourceChainRole position", optional.position, childSnapshotPath(path, "position"));
    }
    if (optional.boundary !== "nested" && optional.boundary !== "outermost") {
        throw invalidEnumValueError("CheckedSourceChainRole boundary", optional.boundary, childSnapshotPath(path, "boundary"));
    }
    return Object.freeze({
        kind: "optional-chain",
        participant,
        position: optional.position,
        boundary: optional.boundary,
    });
}
function snapshotForInIterationMechanism(mechanism, path) {
    assertRecord(mechanism, "for-in iteration mechanism", path);
    mechanism = captureExactOwnFields(mechanism, ["kind"], "for-in iteration mechanism", path);
    if (mechanism.kind !== "property-key-enumeration") {
        throw invalidEnumValueError("for-in iteration mechanism kind", mechanism.kind, childSnapshotPath(path, "kind"));
    }
    return Object.freeze({ kind: "property-key-enumeration" });
}
function snapshotForOfIterationMechanism(mechanism, path) {
    assertRecord(mechanism, "for-of iteration mechanism", path);
    const kind = readDiscriminant(mechanism, "for-of iteration mechanism", path);
    if (kind !== "union") {
        return snapshotForOfAtomicIterationMechanism(mechanism, path);
    }
    const union = captureExactOwnFields(mechanism, ["kind", "alternatives"], "union for-of iteration mechanism", path);
    const alternatives = captureArray(union.alternatives, "for-of iteration alternatives", childSnapshotPath(path, "alternatives"));
    if (alternatives.length === 0) {
        throw new Error(`Invalid union for-of iteration mechanism at '${formatSnapshotPath(path)}': alternatives must not be empty.`);
    }
    const snapshots = alternatives.map((alternative, index) => snapshotForOfAtomicIterationMechanism(alternative, indexedSnapshotPath(childSnapshotPath(path, "alternatives"), index)));
    return Object.freeze({
        kind: "union",
        alternatives: freezeNonEmptySnapshotAlternatives(snapshots, "for-of", path),
    });
}
function snapshotForOfAtomicIterationMechanism(mechanism, path) {
    assertRecord(mechanism, "atomic for-of iteration mechanism", path);
    const kind = readDiscriminant(mechanism, "atomic for-of iteration mechanism", path);
    switch (kind) {
        case "synchronous-iterator-protocol": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative", "protocol"], "synchronous for-of iteration mechanism", path);
            return Object.freeze({
                kind,
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
                protocol: snapshotIterationProtocolEvidence(selected.protocol, childSnapshotPath(path, "protocol")),
            });
        }
        case "array-like-index": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative", "selectedIndex"], "array-like for-of iteration mechanism", path);
            return Object.freeze({
                kind,
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
                selectedIndex: snapshotSelectedSourceTypeEvidence(selected.selectedIndex, childSnapshotPath(path, "selectedIndex")),
            });
        }
        case "string-code-unit-index": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative"], "string for-of iteration mechanism", path);
            return Object.freeze({
                kind,
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
            });
        }
        case "untyped-dynamic-iteration": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative"], "untyped-dynamic for-of iteration mechanism", path);
            return Object.freeze({
                kind,
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
            });
        }
        default:
            throw unknownKindError("atomic for-of iteration mechanism", kind, path);
    }
}
function freezeNonEmptySnapshotAlternatives(alternatives, iterationKind, path) {
    const first = alternatives[0];
    if (first === undefined) {
        throw new Error(`Invalid union ${iterationKind} iteration mechanism at '${formatSnapshotPath(path)}': alternatives must not be empty.`);
    }
    return Object.freeze([first, ...alternatives.slice(1)]);
}
function snapshotForAwaitOfIterationMechanism(mechanism, path) {
    assertRecord(mechanism, "for-await-of iteration mechanism", path);
    const kind = readDiscriminant(mechanism, "for-await-of iteration mechanism", path);
    if (kind !== "union") {
        return snapshotForAwaitOfAtomicIterationMechanism(mechanism, path);
    }
    const union = captureExactOwnFields(mechanism, ["kind", "alternatives"], "union for-await-of iteration mechanism", path);
    const alternatives = captureArray(union.alternatives, "for-await-of iteration alternatives", childSnapshotPath(path, "alternatives"));
    if (alternatives.length === 0) {
        throw new Error(`Invalid union for-await-of iteration mechanism at '${formatSnapshotPath(path)}': alternatives must not be empty.`);
    }
    const snapshots = alternatives.map((alternative, index) => snapshotForAwaitOfAtomicIterationMechanism(alternative, indexedSnapshotPath(childSnapshotPath(path, "alternatives"), index)));
    return Object.freeze({
        kind: "union",
        alternatives: freezeNonEmptySnapshotAlternatives(snapshots, "for-await-of", path),
    });
}
function snapshotForAwaitOfAtomicIterationMechanism(mechanism, path) {
    assertRecord(mechanism, "atomic for-await-of iteration mechanism", path);
    const kind = readDiscriminant(mechanism, "atomic for-await-of iteration mechanism", path);
    switch (kind) {
        case "asynchronous-iterator-protocol": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative", "protocol"], "asynchronous-iterator-protocol iteration mechanism", path);
            const sourceAlternative = snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative"));
            const protocol = snapshotIterationProtocolEvidence(selected.protocol, childSnapshotPath(path, "protocol"));
            return Object.freeze({ kind: "asynchronous-iterator-protocol", sourceAlternative, protocol });
        }
        case "synchronous-iterator-adapted-to-async": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative", "protocol"], "synchronous-iterator-adapted-to-async iteration mechanism", path);
            return Object.freeze({
                kind: "synchronous-iterator-adapted-to-async",
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
                protocol: snapshotIterationProtocolEvidence(selected.protocol, childSnapshotPath(path, "protocol")),
            });
        }
        case "array-like-index-adapted-to-async": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative", "selectedIndex"], "array-like for-await-of iteration mechanism", path);
            return Object.freeze({
                kind,
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
                selectedIndex: snapshotSelectedSourceTypeEvidence(selected.selectedIndex, childSnapshotPath(path, "selectedIndex")),
            });
        }
        case "string-code-unit-index-adapted-to-async": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative"], "string-code-unit-index-adapted-to-async for-await-of iteration mechanism", path);
            return Object.freeze({
                kind: "string-code-unit-index-adapted-to-async",
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
            });
        }
        case "untyped-dynamic-iteration": {
            const selected = captureExactOwnFields(mechanism, ["kind", "sourceAlternative"], "untyped-dynamic for-await-of iteration mechanism", path);
            return Object.freeze({
                kind: "untyped-dynamic-iteration",
                sourceAlternative: snapshotSelectedSourceTypeEvidence(selected.sourceAlternative, childSnapshotPath(path, "sourceAlternative")),
            });
        }
        default:
            throw unknownKindError("atomic for-await-of iteration mechanism", kind, path);
    }
}
function snapshotIterationProtocolEvidence(protocol, path) {
    assertRecord(protocol, "SelectedSourceIterationProtocolEvidence", path);
    const resolutionKind = readOwnStringField(protocol, "resolutionKind", "SelectedSourceIterationProtocolEvidence", path);
    if (resolutionKind === "known-iterable-instantiation") {
        const known = captureExactOwnFields(protocol, ["resolutionKind", "iterationTypes", "iterableTarget", "iterableDeclarations"], "known-iterable SelectedSourceIterationProtocolEvidence", path);
        return Object.freeze({
            resolutionKind: "known-iterable-instantiation",
            iterationTypes: snapshotSelectedSourceIterationTypes(known.iterationTypes, childSnapshotPath(path, "iterationTypes")),
            iterableTarget: snapshotSelectedSourceTypeEvidence(known.iterableTarget, childSnapshotPath(path, "iterableTarget")),
            iterableDeclarations: Object.freeze(captureOpaqueIdentitySubjectArray(known.iterableDeclarations, "iteration protocol iterable declarations", childSnapshotPath(path, "iterableDeclarations"))),
        });
    }
    if (resolutionKind !== "selected-iterator-member") {
        throw unknownKindError("SelectedSourceIterationProtocolEvidence", resolutionKind, path);
    }
    const selected = captureExactOwnFields(protocol, ["resolutionKind", "iterationTypes", "iteratorMethod", "iteratorType"], "selected-member SelectedSourceIterationProtocolEvidence", path);
    return Object.freeze({
        resolutionKind: "selected-iterator-member",
        iterationTypes: snapshotSelectedSourceIterationTypes(selected.iterationTypes, childSnapshotPath(path, "iterationTypes")),
        iteratorMethod: snapshotIterationProtocolMemberEvidence(selected.iteratorMethod, childSnapshotPath(path, "iteratorMethod")),
        iteratorType: snapshotSelectedSourceTypeEvidence(selected.iteratorType, childSnapshotPath(path, "iteratorType")),
    });
}
function snapshotSelectedSourceIterationTypes(iterationTypes, path) {
    assertRecord(iterationTypes, "SelectedSourceIterationTypes", path);
    iterationTypes = captureExactOwnFields(iterationTypes, ["yieldType", "returnType", "nextType"], "SelectedSourceIterationTypes", path);
    return Object.freeze({
        ...(iterationTypes.yieldType === undefined
            ? {}
            : { yieldType: snapshotSelectedSourceTypeEvidence(iterationTypes.yieldType, childSnapshotPath(path, "yieldType")) }),
        ...(iterationTypes.returnType === undefined
            ? {}
            : { returnType: snapshotSelectedSourceTypeEvidence(iterationTypes.returnType, childSnapshotPath(path, "returnType")) }),
        ...(iterationTypes.nextType === undefined
            ? {}
            : { nextType: snapshotSelectedSourceTypeEvidence(iterationTypes.nextType, childSnapshotPath(path, "nextType")) }),
    });
}
function snapshotIterationProtocolMemberEvidence(member, path) {
    assertRecord(member, "SelectedSourceIterationProtocolMemberEvidence", path);
    member = captureExactOwnFields(member, ["symbol", "valueDeclaration", "declarations", "type"], "SelectedSourceIterationProtocolMemberEvidence", path);
    assertOpaqueIdentitySubject(member.symbol, "iteration protocol member symbol", childSnapshotPath(path, "symbol"));
    if (member.valueDeclaration !== undefined) {
        assertOpaqueIdentitySubject(member.valueDeclaration, "iteration protocol member value declaration", childSnapshotPath(path, "valueDeclaration"));
    }
    assertOpaqueIdentitySubject(member.type, "iteration protocol member type", childSnapshotPath(path, "type"));
    return Object.freeze({
        symbol: member.symbol,
        ...(member.valueDeclaration === undefined ? {} : { valueDeclaration: member.valueDeclaration }),
        declarations: Object.freeze(captureOpaqueIdentitySubjectArray(member.declarations, "iteration protocol member declarations", childSnapshotPath(path, "declarations"))),
        type: member.type,
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
function assertCheckedIterationKind(value, path) {
    if (value !== "for-in" && value !== "for-of" && value !== "for-await-of") {
        throw invalidEnumValueError("CheckedIterationMappingRequest iterationKind", value, path);
    }
}
function assertOptionalTarget(target, valueName, path) {
    if (target !== undefined) {
        assertString(target, `${valueName} target`, childSnapshotPath(path, "target"));
    }
}
function assertCheckedAccessUse(value, valueName, path) {
    if (value !== "value" && value !== "call-callee") {
        throw invalidEnumValueError(`${valueName} use`, value, path);
    }
}
function assertCheckedPrefixUnaryOperatorToken(value, path) {
    if (value !== "+" && value !== "-" && value !== "~" && value !== "!" && value !== "typeof" && value !== "void" && value !== "delete") {
        throw invalidEnumValueError("CheckedOperatorMappingRequest prefix-unary operator", value, path);
    }
}
function assertCheckedUpdateOperatorToken(value, path) {
    if (value !== "++" && value !== "--") {
        throw invalidEnumValueError("CheckedOperatorMappingRequest update operator", value, path);
    }
}
function assertCheckedBinaryOperatorToken(value, path) {
    const valid = value === "**" || value === "*" || value === "/" || value === "%" || value === "+" || value === "-"
        || value === "<<" || value === ">>" || value === ">>>"
        || value === "<" || value === ">" || value === "<=" || value === ">=" || value === "instanceof" || value === "in"
        || value === "==" || value === "!=" || value === "===" || value === "!=="
        || value === "&" || value === "^" || value === "|" || value === "&&" || value === "||" || value === "??"
        || value === "=" || value === "+=" || value === "-=" || value === "*=" || value === "**=" || value === "/=" || value === "%="
        || value === "<<=" || value === ">>=" || value === ">>>=" || value === "&=" || value === "^=" || value === "|="
        || value === "&&=" || value === "||=" || value === "??=" || value === ",";
    if (!valid) {
        throw invalidEnumValueError("CheckedOperatorMappingRequest binary operator", value, path);
    }
}
function assertMatchingCheckedOperationObservation(value, expected, path) {
    if (value !== expected) {
        throw new Error(`Invalid checked-operation result at '${formatSnapshotPath(path)}': expected observation '${expected}', received '${String(value)}'.`);
    }
}
function snapshotProviderDeclaration(declaration, path) {
    assertRecord(declaration, "ProviderDeclarationIdentity", path);
    declaration = captureExactOwnFields(declaration, ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "artifactFileName", "exportName", "exportId", "memberName", "memberKey", "memberId", "memberStatic", "signatureId", "targetIdentity"], "ProviderDeclarationIdentity", path);
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
    switch (actualKind) {
        case "property-key": {
            const propertyKey = captureExactOwnFields(key, ["kind", "name"], "property ProviderMemberKey", path);
            const name = propertyKey.name;
            assertString(name, "ProviderMemberKey name", childSnapshotPath(path, "name"));
            return Object.freeze({ kind: "property-key", name });
        }
        case "well-known-symbol": {
            const symbolKey = captureExactOwnFields(key, ["kind", "name"], "well-known-symbol ProviderMemberKey", path);
            const name = symbolKey.name;
            assertString(name, "ProviderMemberKey name", childSnapshotPath(path, "name"));
            assertProviderWellKnownSymbolName(name, childSnapshotPath(path, "name"));
            return Object.freeze({ kind: "well-known-symbol", name });
        }
        default:
            throw unknownKindError("ProviderMemberKey", actualKind, path);
    }
}
function snapshotSelectedSourceTypeEvidence(evidence, path) {
    assertRecord(evidence, "SelectedSourceTypeEvidence", path);
    evidence = captureExactOwnFields(evidence, [
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
    assertOpaqueIdentitySubject(type, "SelectedSourceTypeEvidence type", childSnapshotPath(path, "type"));
    for (const [field, value] of [
        ["symbol", symbol],
        ["declaration", declaration],
        ["selectedSymbol", selectedSymbol],
        ["selectedDeclaration", selectedDeclaration],
        ["authoredTypeNode", authoredTypeNode],
    ]) {
        if (value !== undefined) {
            assertOpaqueIdentitySubject(value, `SelectedSourceTypeEvidence ${field}`, childSnapshotPath(path, field));
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
    evidence = captureExactOwnFields(evidence, [
        "expression",
        "type",
        "symbol",
        "declaration",
        "selectedSymbol",
        "selectedDeclaration",
        "authoredTypeNode",
    ], "SelectedSourceValueEvidence", path);
    const expression = evidence.expression;
    assertOpaqueIdentitySubject(expression, "SelectedSourceValueEvidence expression", childSnapshotPath(path, "expression"));
    const typeEvidence = snapshotSelectedSourceTypeEvidenceFields(evidence, path);
    return Object.freeze({
        expression,
        ...typeEvidence,
    });
}
function snapshotCheckedSourceCallCompositionEvidence(evidence, argumentCount, path) {
    assertRecord(evidence, "CheckedSourceCallCompositionEvidence", path);
    const captured = captureExactOwnFields(evidence, ["argumentEvidence"], "CheckedSourceCallCompositionEvidence", path);
    const argumentEvidence = captureArray(captured.argumentEvidence, "CheckedSourceCallArgumentCompositionEvidence array", childSnapshotPath(path, "argumentEvidence"));
    if (argumentEvidence.length !== argumentCount) {
        throw new Error(`Invalid CheckedSourceCallCompositionEvidence at '${formatSnapshotPath(path)}': argumentEvidence length ${argumentEvidence.length} does not match call argument length ${argumentCount}.`);
    }
    return Object.freeze({
        argumentEvidence: Object.freeze(argumentEvidence.map((argument, index) => snapshotCheckedSourceCallArgumentCompositionEvidence(argument, indexedSnapshotPath(childSnapshotPath(path, "argumentEvidence"), index)))),
    });
}
function snapshotCheckedSourceCallArgumentCompositionEvidence(evidence, path) {
    if (evidence === undefined) {
        return undefined;
    }
    assertRecord(evidence, "CheckedSourceCallArgumentCompositionEvidence", path);
    const kindDescriptor = Object.getOwnPropertyDescriptor(evidence, "kind");
    if (kindDescriptor === undefined || !("value" in kindDescriptor)) {
        throw new Error(`Invalid CheckedSourceCallArgumentCompositionEvidence at '${formatSnapshotPath(path)}': kind must be an own data property.`);
    }
    if (kindDescriptor.value === "authored-literal") {
        const captured = captureExactOwnFields(evidence, ["kind", "literal"], "CheckedSourceCallArgumentCompositionEvidence", path);
        return Object.freeze({
            kind: "authored-literal",
            literal: snapshotCheckedSourceAuthoredLiteralEvidence(captured.literal, childSnapshotPath(path, "literal")),
        });
    }
    if (kindDescriptor.value === "inline-function") {
        const captured = captureExactOwnFields(evidence, ["kind", "function"], "CheckedSourceCallArgumentCompositionEvidence", path);
        return Object.freeze({
            kind: "inline-function",
            function: snapshotCheckedSourceInlineFunctionEvidence(captured.function, childSnapshotPath(path, "function")),
        });
    }
    throw new Error(`Invalid CheckedSourceCallArgumentCompositionEvidence at '${formatSnapshotPath(path)}': unknown kind '${String(kindDescriptor.value)}'.`);
}
function snapshotCheckedSourceAuthoredLiteralEvidence(literal, path) {
    assertRecord(literal, "CheckedSourceAuthoredLiteralEvidence", path);
    const kindDescriptor = Object.getOwnPropertyDescriptor(literal, "kind");
    if (kindDescriptor === undefined || !("value" in kindDescriptor)) {
        throw new Error(`Invalid CheckedSourceAuthoredLiteralEvidence at '${formatSnapshotPath(path)}': kind must be an own data property.`);
    }
    const kind = kindDescriptor.value;
    if (kind === "null") {
        captureExactOwnFields(literal, ["kind"], "CheckedSourceAuthoredLiteralEvidence", path);
        return Object.freeze({ kind });
    }
    if (kind !== "string" && kind !== "number" && kind !== "bigint" && kind !== "boolean") {
        throw new Error(`Invalid CheckedSourceAuthoredLiteralEvidence at '${formatSnapshotPath(path)}': unknown kind '${String(kind)}'.`);
    }
    const captured = captureExactOwnFields(literal, ["kind", "value"], "CheckedSourceAuthoredLiteralEvidence", path);
    if (kind === "boolean") {
        if (typeof captured.value !== "boolean") {
            throw new Error(`Invalid CheckedSourceAuthoredLiteralEvidence at '${formatSnapshotPath(path)}': boolean value is required.`);
        }
        return Object.freeze({ kind, value: captured.value });
    }
    assertString(captured.value, `CheckedSourceAuthoredLiteralEvidence ${kind} value`, childSnapshotPath(path, "value"));
    return Object.freeze({ kind, value: captured.value });
}
function snapshotCheckedSourceInlineFunctionEvidence(evidence, path) {
    assertRecord(evidence, "CheckedSourceInlineFunctionEvidence", path);
    const captured = captureExactOwnFields(evidence, ["expression", "parameters", "returns", "operations"], "CheckedSourceInlineFunctionEvidence", path);
    assertOpaqueIdentitySubject(captured.expression, "CheckedSourceInlineFunctionEvidence expression", childSnapshotPath(path, "expression"));
    const parameters = captureArray(captured.parameters, "CheckedSourceInlineFunctionParameterEvidence array", childSnapshotPath(path, "parameters"));
    const returns = captureArray(captured.returns, "CheckedSourceInlineFunctionReturnEvidence array", childSnapshotPath(path, "returns"));
    const operations = captureArray(captured.operations, "CheckedSourceInlineOperation array", childSnapshotPath(path, "operations"));
    return Object.freeze({
        expression: captured.expression,
        parameters: Object.freeze(parameters.map((parameter, index) => {
            const parameterPath = indexedSnapshotPath(childSnapshotPath(path, "parameters"), index);
            assertRecord(parameter, "CheckedSourceInlineFunctionParameterEvidence", parameterPath);
            const fields = captureExactOwnFields(parameter, ["declaration", "symbol"], "CheckedSourceInlineFunctionParameterEvidence", parameterPath);
            assertOpaqueIdentitySubject(fields.declaration, "CheckedSourceInlineFunctionParameterEvidence declaration", childSnapshotPath(parameterPath, "declaration"));
            assertOpaqueIdentitySubject(fields.symbol, "CheckedSourceInlineFunctionParameterEvidence symbol", childSnapshotPath(parameterPath, "symbol"));
            return Object.freeze({ declaration: fields.declaration, symbol: fields.symbol });
        })),
        returns: Object.freeze(returns.map((returned, index) => snapshotCheckedSourceInlineFunctionReturnEvidence(returned, indexedSnapshotPath(childSnapshotPath(path, "returns"), index)))),
        operations: Object.freeze(operations.map((operation, index) => snapshotCheckedSourceInlineOperation(operation, indexedSnapshotPath(childSnapshotPath(path, "operations"), index)))),
    });
}
function snapshotCheckedSourceInlineFunctionReturnEvidence(returned, path) {
    assertRecord(returned, "CheckedSourceInlineFunctionReturnEvidence", path);
    const captured = captureExactOwnFields(returned, ["expression"], "CheckedSourceInlineFunctionReturnEvidence", path);
    assertOpaqueIdentitySubject(captured.expression, "CheckedSourceInlineFunctionReturnEvidence expression", childSnapshotPath(path, "expression"));
    return Object.freeze({ expression: captured.expression });
}
function snapshotCheckedSourceInlineOperation(operation, path) {
    assertRecord(operation, "CheckedSourceInlineOperation", path);
    const kind = readOwnStringField(operation, "sourceOperationKind", "CheckedSourceInlineOperation", path);
    switch (kind) {
        case "call":
            return snapshotCallRequest(operation, path, false);
        case "property-access":
            return snapshotCheckedSourceInlinePropertyOperation(operation, path);
        case "element-access":
            return snapshotElementRequest(operation, path, false);
        case "operator":
            return snapshotOperatorRequest(operation, path, false);
        case "iteration":
            return snapshotIterationRequest(operation, path, false);
        case "conversion":
            return snapshotCheckedSourceInlineAssertionOperation(operation, path);
        default:
            throw invalidEnumValueError("CheckedSourceInlineOperation sourceOperationKind", kind, childSnapshotPath(path, "sourceOperationKind"));
    }
}
function snapshotCheckedSourceInlinePropertyOperation(operation, path) {
    const accessMode = readOwnStringField(operation, "accessMode", "CheckedSourceInlinePropertyOperation", path);
    assertCheckedAccessMode(accessMode, childSnapshotPath(path, "accessMode"));
    const commonFields = ["sourceOperationKind", "expression", "receiver", "accessMode", "use", "sourceReceiver", "chainRole"];
    const captured = captureExactOwnFields(operation, accessMode === "write"
        ? [...commonFields, "sourceWriteType"]
        : accessMode === "read-write"
            ? [...commonFields, "sourceReadResult", "sourceWriteType"]
            : [...commonFields, "sourceReadResult"], "CheckedSourceInlinePropertyOperation", path);
    if (captured.sourceOperationKind !== "property-access") {
        throw invalidEnumValueError("CheckedSourceInlinePropertyOperation sourceOperationKind", captured.sourceOperationKind, childSnapshotPath(path, "sourceOperationKind"));
    }
    assertOpaqueIdentitySubject(captured.expression, "CheckedSourceInlinePropertyOperation expression", childSnapshotPath(path, "expression"));
    assertOpaqueIdentitySubject(captured.receiver, "CheckedSourceInlinePropertyOperation receiver", childSnapshotPath(path, "receiver"));
    assertCheckedAccessUse(captured.use, "CheckedSourceInlinePropertyOperation", childSnapshotPath(path, "use"));
    const sourceReceiver = snapshotSelectedSourceValueEvidence(captured.sourceReceiver, childSnapshotPath(path, "sourceReceiver"));
    const chainRole = snapshotSourceChainRole(captured.chainRole, "property-access", childSnapshotPath(path, "chainRole"));
    const base = {
        sourceOperationKind: "property-access",
        expression: captured.expression,
        receiver: captured.receiver,
        sourceReceiver,
    };
    if (accessMode === "read") {
        const read = captured;
        return Object.freeze({
            ...base,
            accessMode: "read",
            use: read.use,
            sourceReadResult: snapshotSelectedSourceValueEvidence(read.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (captured.use !== "value") {
        throw invalidEnumValueError(`CheckedSourceInlinePropertyOperation ${accessMode} use`, captured.use, childSnapshotPath(path, "use"));
    }
    if (accessMode === "delete") {
        const deleteAccess = captured;
        return Object.freeze({
            ...base,
            accessMode: "delete",
            use: "value",
            sourceReadResult: snapshotSelectedSourceValueEvidence(deleteAccess.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
            chainRole,
        });
    }
    if (chainRole.kind !== "ordinary") {
        throw new Error(`Invalid CheckedSourceInlinePropertyOperation at '${formatSnapshotPath(childSnapshotPath(path, "chainRole"))}': ${accessMode} access cannot be an optional-chain participant.`);
    }
    if (accessMode === "write") {
        const write = captured;
        return Object.freeze({
            ...base,
            accessMode: "write",
            use: "value",
            sourceWriteType: snapshotSelectedSourceTypeEvidence(write.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
            chainRole,
        });
    }
    const readWrite = captured;
    return Object.freeze({
        ...base,
        accessMode: "read-write",
        use: "value",
        sourceReadResult: snapshotSelectedSourceValueEvidence(readWrite.sourceReadResult, childSnapshotPath(path, "sourceReadResult")),
        sourceWriteType: snapshotSelectedSourceTypeEvidence(readWrite.sourceWriteType, childSnapshotPath(path, "sourceWriteType")),
        chainRole,
    });
}
function snapshotCheckedSourceInlineAssertionOperation(operation, path) {
    const captured = captureExactOwnFields(operation, [
        "sourceOperationKind",
        "conversionKind",
        "expression",
        "source",
        "target",
        "assertionKind",
        "explicitTargetTypeNode",
    ], "CheckedSourceInlineAssertionOperation", path);
    if (captured.conversionKind !== "assertion") {
        throw invalidEnumValueError("CheckedSourceInlineAssertionOperation conversionKind", captured.conversionKind, childSnapshotPath(path, "conversionKind"));
    }
    assertOpaqueIdentitySubject(captured.expression, "CheckedSourceInlineAssertionOperation expression", childSnapshotPath(path, "expression"));
    assertOpaqueIdentitySubject(captured.explicitTargetTypeNode, "CheckedSourceInlineAssertionOperation explicitTargetTypeNode", childSnapshotPath(path, "explicitTargetTypeNode"));
    if (captured.assertionKind !== "as" && captured.assertionKind !== "angle-bracket" && captured.assertionKind !== "jsdoc") {
        throw invalidEnumValueError("CheckedSourceInlineAssertionOperation assertionKind", captured.assertionKind, childSnapshotPath(path, "assertionKind"));
    }
    return Object.freeze({
        sourceOperationKind: "conversion",
        conversionKind: "assertion",
        expression: captured.expression,
        source: snapshotSelectedSourceValueEvidence(captured.source, childSnapshotPath(path, "source")),
        target: snapshotSelectedSourceTypeEvidence(captured.target, childSnapshotPath(path, "target")),
        assertionKind: captured.assertionKind,
        explicitTargetTypeNode: captured.explicitTargetTypeNode,
    });
}
function snapshotMethodTypeArguments(arguments_, path) {
    const captured = captureArray(arguments_, "SourceSelectedMethodTypeArgument array", path);
    return Object.freeze(captured.map((argument, index) => {
        const argumentPath = indexedSnapshotPath(path, index);
        assertRecord(argument, "SourceSelectedMethodTypeArgument", argumentPath);
        argument = captureExactOwnFields(argument, ["typeParameterName", "typeParameter", "selectedType", "explicitTypeNode"], "SourceSelectedMethodTypeArgument", argumentPath);
        const typeParameterName = argument.typeParameterName;
        const typeParameter = argument.typeParameter;
        const selectedType = argument.selectedType;
        const explicitTypeNode = argument.explicitTypeNode;
        assertString(typeParameterName, "SourceSelectedMethodTypeArgument typeParameterName", childSnapshotPath(argumentPath, "typeParameterName"));
        if (typeParameter !== undefined) {
            assertOpaqueIdentitySubject(typeParameter, "SourceSelectedMethodTypeArgument typeParameter", childSnapshotPath(argumentPath, "typeParameter"));
        }
        assertOpaqueIdentitySubject(selectedType, "SourceSelectedMethodTypeArgument selectedType", childSnapshotPath(argumentPath, "selectedType"));
        if (explicitTypeNode !== undefined) {
            assertOpaqueIdentitySubject(explicitTypeNode, "SourceSelectedMethodTypeArgument explicitTypeNode", childSnapshotPath(argumentPath, "explicitTypeNode"));
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
    binding = captureExactOwnFields(binding, [
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
    assertOpaqueIdentitySubject(selectedArgumentType, "SourceSelectedCallArgumentBinding selectedArgumentType", childSnapshotPath(path, "selectedArgumentType"));
    assertOpaqueIdentitySubject(selectedParameterType, "SourceSelectedCallArgumentBinding selectedParameterType", childSnapshotPath(path, "selectedParameterType"));
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
function targetCallArgumentConversionSlotsEqual(left, right) {
    return left.sourceArgumentIndex === right.sourceArgumentIndex
        && left.sourceForm === right.sourceForm
        && left.spreadElementIndex === right.spreadElementIndex
        && left.targetParameterIndex === right.targetParameterIndex
        && left.targetForm === right.targetForm;
}
function snapshotArgumentConversionSlots(slots, path, cache) {
    const captured = captureArray(slots, "TargetCallArgumentConversionSlot array", path);
    const snapshots = captured.map((slot, index) => {
        const slotPath = indexedSnapshotPath(path, index);
        if (canonicalTargetCallArgumentConversionSlots.has(slot)) {
            cache?.targetCallArgumentConversionSlots.set(slot, slot);
            return slot;
        }
        assertRecord(slot, "TargetCallArgumentConversionSlot", slotPath);
        const sourceSlotObject = slot;
        slot = captureExactOwnFields(slot, ["sourceArgumentIndex", "sourceForm", "spreadElementIndex", "targetParameterIndex", "targetForm"], "TargetCallArgumentConversionSlot", slotPath);
        const cached = cache?.targetCallArgumentConversionSlots.get(sourceSlotObject);
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
        canonicalTargetCallArgumentConversionSlots.add(snapshot);
        if (cached !== undefined) {
            if (!targetCallArgumentConversionSlotsEqual(cached, snapshot)) {
                throw new Error(`Invalid TargetCallArgumentConversionSlot at '${formatSnapshotPath(slotPath)}': source object changed after its reusable snapshot was committed.`);
            }
            return cached;
        }
        cache?.targetCallArgumentConversionSlots.set(sourceSlotObject, snapshot);
        cache?.targetCallArgumentConversionSlots.set(snapshot, snapshot);
        return snapshot;
    });
    snapshots.sort(compareTargetCallArgumentConversionSlots);
    return Object.freeze(snapshots);
}
function snapshotSignatureParameters(parameters, path) {
    const captured = captureArray(parameters, "SourceSelectedSignatureParameter array", path);
    return Object.freeze(captured.map((parameter, index) => snapshotSignatureParameter(parameter, indexedSnapshotPath(path, index))));
}
function snapshotSignatureParameter(parameter, path) {
    assertRecord(parameter, "SourceSelectedSignatureParameter", path);
    parameter = captureExactOwnFields(parameter, ["parameterIndex", "parameterName", "parameterSymbol", "parameterDeclaration", "selectedType", "authoredTypeNode", "acceptsOmission", "rest"], "SourceSelectedSignatureParameter", path);
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
    assertOpaqueIdentitySubject(parameterSymbol, "SourceSelectedSignatureParameter parameterSymbol", childSnapshotPath(path, "parameterSymbol"));
    if (parameterDeclaration !== undefined) {
        assertOpaqueIdentitySubject(parameterDeclaration, "SourceSelectedSignatureParameter parameterDeclaration", childSnapshotPath(path, "parameterDeclaration"));
    }
    assertOpaqueIdentitySubject(selectedType, "SourceSelectedSignatureParameter selectedType", childSnapshotPath(path, "selectedType"));
    if (authoredTypeNode !== undefined) {
        assertOpaqueIdentitySubject(authoredTypeNode, "SourceSelectedSignatureParameter authoredTypeNode", childSnapshotPath(path, "authoredTypeNode"));
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
    const detailsState = path.budget.immutableDataState;
    return Object.freeze(captured.map((item, index) => {
        const itemPath = indexedSnapshotPath(path, index);
        assertRecord(item, "ExtensionEvidence", itemPath);
        item = captureExactOwnFields(item, ["message", "details"], "ExtensionEvidence", itemPath);
        const message = item.message;
        const details = item.details;
        assertString(message, "ExtensionEvidence message", childSnapshotPath(itemPath, "message"));
        return Object.freeze({
            message,
            ...(details === undefined ? {} : {
                details: snapshotImmutableData(details, childSnapshotPath(itemPath, "details"), detailsState),
            }),
        });
    }));
}
function createImmutableDataSnapshotState() {
    return {
        active: new WeakMap(),
        completed: new WeakMap(),
    };
}
function snapshotImmutableData(value, path, state) {
    if (value === undefined || value === null || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`Invalid immutable data at '${formatSnapshotPath(path)}': numbers must be finite.`);
        }
        return value;
    }
    if (typeof value === "string") {
        assertString(value, "immutable data string", path);
        return value;
    }
    if (typeof value !== "object") {
        throw new Error(`Invalid immutable data at '${formatSnapshotPath(path)}': expected undefined, null, boolean, finite number, string, array, or plain record.`);
    }
    const completed = state.completed.get(value);
    if (completed !== undefined) {
        return completed;
    }
    const firstPath = state.active.get(value);
    if (firstPath !== undefined) {
        throw new Error(`Invalid immutable data at '${formatSnapshotPath(path)}': cycle references '${formatSnapshotPath(firstPath)}'.`);
    }
    state.active.set(value, path);
    try {
        if (Array.isArray(value)) {
            const captured = captureArray(value, "immutable data array", path);
            const snapshot = Object.freeze(captured.map((entry, index) => snapshotImmutableData(entry, indexedSnapshotPath(path, index), state)));
            state.completed.set(value, snapshot);
            return snapshot;
        }
        assertRecord(value, "immutable data record", path);
        const descriptors = path.budget.recordDescriptors.get(value);
        if (descriptors === undefined) {
            throw new Error(`Invalid immutable data record at '${formatSnapshotPath(path)}': record descriptors were not retained.`);
        }
        const snapshot = Object.create(null);
        const keys = [...descriptors.keys()].sort();
        for (const key of keys) {
            const descriptor = descriptors.get(key);
            if (descriptor === undefined || !("value" in descriptor)) {
                throw new Error(`Invalid immutable data at '${formatSnapshotPath(childSnapshotPath(path, key))}': expected an enumerable data property.`);
            }
            Object.defineProperty(snapshot, key, {
                value: snapshotImmutableData(descriptor.value, childSnapshotPath(path, key), state),
                enumerable: true,
                configurable: false,
                writable: false,
            });
        }
        Object.freeze(snapshot);
        state.completed.set(value, snapshot);
        return snapshot;
    }
    finally {
        state.active.delete(value);
    }
}
function snapshotDiagnostic(diagnostic, path) {
    const hostOwned = isHostOwnedExtensionDiagnostic(diagnostic);
    assertRecord(diagnostic, "ExtensionDiagnostic", path);
    diagnostic = captureExactOwnFields(diagnostic, ["extensionId", "extensionCode", "numericCode", "publicCode", "category", "message", "nodeOrSpan", "evidence", "identity"], "ExtensionDiagnostic", path);
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
    const nodeOrSpanSnapshot = nodeOrSpan === undefined
        ? undefined
        : snapshotDiagnosticNodeOrSpan(nodeOrSpan, childSnapshotPath(path, "nodeOrSpan"));
    if (identity !== undefined) {
        assertString(identity, "ExtensionDiagnostic identity", childSnapshotPath(path, "identity"));
    }
    const snapshot = Object.freeze({
        extensionId,
        extensionCode,
        numericCode,
        ...(publicCode === undefined ? {} : { publicCode }),
        category,
        message,
        ...(nodeOrSpanSnapshot === undefined ? {} : { nodeOrSpan: nodeOrSpanSnapshot }),
        ...(evidence === undefined ? {} : {
            evidence: snapshotEvidenceArray(evidence, childSnapshotPath(path, "evidence")),
        }),
        ...(identity === undefined ? {} : { identity }),
    });
    return hostOwned ? markHostOwnedExtensionDiagnostic(snapshot) : snapshot;
}
function snapshotDiagnosticNodeOrSpan(value, path) {
    assertOpaqueIdentitySubject(value, "ExtensionDiagnostic nodeOrSpan", path);
    if (!Reflect.has(value, "sourceFile")) {
        return value;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 || !keys.includes("pos") || !keys.includes("end") || keys.some((key) => typeof key !== "string")) {
        throw new Error(`Invalid ExtensionDiagnosticSourceSpan at '${formatSnapshotPath(path)}': source spans must contain exactly sourceFile, pos, and end own data properties.`);
    }
    assertRecord(value, "ExtensionDiagnosticSourceSpan", path);
    const span = captureExactOwnFields(value, ["sourceFile", "pos", "end"], "ExtensionDiagnosticSourceSpan", path);
    assertOpaqueIdentitySubject(span.sourceFile, "ExtensionDiagnosticSourceSpan sourceFile", childSnapshotPath(path, "sourceFile"));
    assertNonNegativeInteger(span.pos, "ExtensionDiagnosticSourceSpan pos", childSnapshotPath(path, "pos"));
    assertNonNegativeInteger(span.end, "ExtensionDiagnosticSourceSpan end", childSnapshotPath(path, "end"));
    if (span.end < span.pos) {
        throw new Error(`Invalid ExtensionDiagnosticSourceSpan at '${formatSnapshotPath(path)}': end must not precede pos.`);
    }
    return Object.freeze({ sourceFile: span.sourceFile, pos: span.pos, end: span.end });
}
function createSnapshotPath(root) {
    return {
        segment: root,
        depth: 0,
        budget: {
            objectCount: 0,
            targetTypeRefObjectCount: 0,
            arrayElementCount: 0,
            ownFieldCount: 0,
            scalarCodeUnits: 0,
            workUnits: 0,
            recordDescriptors: new WeakMap(),
            arrayValues: new WeakMap(),
            targetTypeRefSnapshots: new WeakMap(),
            immutableDataState: createImmutableDataSnapshotState(),
            chargedObjects: new WeakSet(),
            chargedTargetTypeRefObjects: new WeakSet(),
            chargedOpaqueSubjects: new WeakSet(),
        },
    };
}
function childSnapshotPath(parent, property) {
    return nestedSnapshotPath(parent, `.${property}`);
}
function indexedSnapshotPath(parent, index) {
    return nestedSnapshotPath(parent, `[${index}]`);
}
function nestedSnapshotPath(parent, segment) {
    const depth = parent.depth + 1;
    if (parent.resourceClass !== "target-type-ref" && depth > snapshotLimits.maxDepth) {
        throw new Error(`Checked-operation snapshot exceeds maximum nesting depth ${snapshotLimits.maxDepth} at '${formatSnapshotPath(parent)}${segment}'.`);
    }
    chargeSnapshotWork(parent, 1, "path traversal");
    return {
        parent,
        segment,
        depth,
        budget: parent.budget,
        ...(parent.resourceClass === undefined ? {} : { resourceClass: parent.resourceClass }),
    };
}
function targetTypeRefSnapshotPath(path) {
    return path.resourceClass === "target-type-ref"
        ? path
        : { ...path, resourceClass: "target-type-ref" };
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
    if (path.budget.recordDescriptors.has(value)) {
        return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected Object.prototype or null prototype.`);
    }
    chargeSnapshotObject(path, value, valueName);
    const descriptors = new Map();
    const keys = Reflect.ownKeys(value);
    chargeSnapshotOwnFields(path, keys.length, valueName);
    for (const key of keys) {
        if (typeof key !== "string") {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': symbol fields are unsupported.`);
        }
        chargeSnapshotScalarCodeUnits(path, key.length, `${valueName} field name`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': own field '${key}' disappeared during snapshot validation.`);
        }
        if (!("value" in descriptor)) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': own field '${key}' must be a data property; accessors are unsupported.`);
        }
        if (!descriptor.enumerable) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': hidden own field '${key}' is unsupported.`);
        }
        descriptors.set(key, descriptor);
    }
    path.budget.recordDescriptors.set(value, descriptors);
}
function assertArray(value, valueName, path) {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected an array.`);
    }
    if (path.budget.arrayValues.has(value)) {
        return;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': array subclasses and custom array prototypes are unsupported.`);
    }
    chargeSnapshotObject(path, value, valueName);
    const keys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': array length must be an own non-negative safe-integer data property.`);
    }
    const length = lengthDescriptor.value;
    chargeSnapshotArrayElements(path, length, valueName);
    if (keys.length !== length + 1) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': arrays must be dense and contain no extra or symbol fields.`);
    }
    const captured = [];
    for (let index = 0; index < length; index += 1) {
        const key = String(index);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(indexedSnapshotPath(path, index))}': sparse array entries are unsupported.`);
        }
        if (!("value" in descriptor)) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(indexedSnapshotPath(path, index))}': array accessors are unsupported.`);
        }
        if (!descriptor.enumerable) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(indexedSnapshotPath(path, index))}': hidden array entries are unsupported.`);
        }
        captured.push(descriptor.value);
    }
    for (const key of keys) {
        if (typeof key !== "string") {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': symbol fields on arrays are unsupported.`);
        }
        if (key === "length") {
            continue;
        }
        const numericIndex = Number(key);
        if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= length || String(numericIndex) !== key) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': unsupported array field '${key}'.`);
        }
    }
    path.budget.arrayValues.set(value, Object.freeze(captured));
}
function captureArray(value, valueName, path) {
    assertArray(value, valueName, path);
    const captured = path.budget.arrayValues.get(value);
    if (captured === undefined) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': validated array snapshot was not retained.`);
    }
    return captured;
}
function captureStringArray(value, valueName, path) {
    const captured = captureArray(value, valueName, path);
    for (let index = 0; index < captured.length; index += 1) {
        assertString(captured[index], `${valueName} entry`, indexedSnapshotPath(path, index));
    }
    return captured;
}
function captureOpaqueIdentitySubjectArray(value, valueName, path) {
    const captured = captureArray(value, valueName, path);
    for (let index = 0; index < captured.length; index += 1) {
        assertOpaqueIdentitySubject(captured[index], `${valueName} entry`, indexedSnapshotPath(path, index));
    }
    return captured;
}
function assertString(value, valueName, path) {
    if (typeof value !== "string") {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected a string.`);
    }
    chargeSnapshotScalarCodeUnits(path, value.length, valueName);
}
function assertOptionalString(value, valueName, path) {
    if (value !== undefined) {
        assertString(value, valueName, path);
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
    assertRecord(value, valueName, path);
    const allowed = new Set(allowedFields);
    const descriptors = path.budget.recordDescriptors.get(value);
    if (descriptors === undefined) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': record descriptors were not retained.`);
    }
    for (const field of descriptors.keys()) {
        if (!allowed.has(field)) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': unsupported field '${field}'.`);
        }
    }
}
function captureExactOwnFields(value, allowedFields, valueName, path) {
    assertExactOwnFields(value, allowedFields, valueName, path);
    const descriptors = path.budget.recordDescriptors.get(value);
    if (descriptors === undefined) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': record descriptors were not retained.`);
    }
    const captured = Object.create(null);
    for (const [field, descriptor] of descriptors) {
        if (!("value" in descriptor)) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(childSnapshotPath(path, field))}': expected a data property.`);
        }
        Object.defineProperty(captured, field, {
            value: descriptor.value,
            enumerable: true,
            configurable: false,
            writable: false,
        });
    }
    return Object.freeze(captured);
}
function assertOpaqueIdentitySubject(value, valueName, path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': expected an opaque identity subject object.`);
    }
    if (!path.budget.chargedOpaqueSubjects.has(value)) {
        chargeSnapshotObject(path, value, valueName);
        path.budget.chargedOpaqueSubjects.add(value);
    }
}
function chargeSnapshotObject(path, value, valueName) {
    if (path.resourceClass === "target-type-ref") {
        if (path.budget.chargedTargetTypeRefObjects.has(value)) {
            return;
        }
        path.budget.chargedTargetTypeRefObjects.add(value);
        path.budget.targetTypeRefObjectCount += 1;
        chargeSnapshotWork(path, 1, valueName);
        if (path.budget.targetTypeRefObjectCount > snapshotLimits.maxTargetTypeRefObjects) {
            throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': target type graph exceeds maximum object count ${snapshotLimits.maxTargetTypeRefObjects}.`);
        }
        return;
    }
    if (path.budget.chargedObjects.has(value)) {
        return;
    }
    path.budget.chargedObjects.add(value);
    path.budget.objectCount += 1;
    chargeSnapshotWork(path, 1, valueName);
    if (path.budget.objectCount > snapshotLimits.maxObjects) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': snapshot exceeds maximum object count ${snapshotLimits.maxObjects}.`);
    }
}
function chargeSnapshotArrayElements(path, count, valueName) {
    if (count > snapshotLimits.maxArrayElements) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': array length ${count} exceeds per-array limit ${snapshotLimits.maxArrayElements}.`);
    }
    path.budget.arrayElementCount += count;
    chargeSnapshotWork(path, count, valueName);
    if (path.budget.arrayElementCount > snapshotLimits.maxArrayElements) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': snapshot exceeds aggregate array-entry limit ${snapshotLimits.maxArrayElements}.`);
    }
}
function chargeSnapshotOwnFields(path, count, valueName) {
    path.budget.ownFieldCount += count;
    chargeSnapshotWork(path, count, valueName);
    if (path.budget.ownFieldCount > snapshotLimits.maxOwnFields) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': snapshot exceeds aggregate own-field limit ${snapshotLimits.maxOwnFields}.`);
    }
}
function chargeSnapshotScalarCodeUnits(path, count, valueName) {
    path.budget.scalarCodeUnits += count;
    chargeSnapshotWork(path, count, valueName);
    if (path.budget.scalarCodeUnits > snapshotLimits.maxScalarCodeUnits) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': snapshot exceeds aggregate string-code-unit limit ${snapshotLimits.maxScalarCodeUnits}.`);
    }
}
function chargeSnapshotWork(path, count, valueName) {
    path.budget.workUnits += count;
    if (path.budget.workUnits > snapshotLimits.maxWorkUnits) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(path)}': snapshot exceeds aggregate work-unit limit ${snapshotLimits.maxWorkUnits}.`);
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
    return readOwnStringField(value, "kind", valueName, path);
}
function readOwnStringField(value, field, valueName, path) {
    const fieldValue = readOwnDataField(value, field, valueName, path);
    if (typeof fieldValue !== "string") {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(childSnapshotPath(path, field))}': expected a string.`);
    }
    assertString(fieldValue, `${valueName} ${field}`, childSnapshotPath(path, field));
    return fieldValue;
}
function readOwnDataField(value, field, valueName, path) {
    assertRecord(value, valueName, path);
    const descriptor = path.budget.recordDescriptors.get(value)?.get(field);
    if (descriptor === undefined || !("value" in descriptor)) {
        throw new Error(`Invalid ${valueName} at '${formatSnapshotPath(childSnapshotPath(path, field))}': expected an own data property.`);
    }
    return descriptor.value;
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
                ? `Invalid TargetOperationProposal operationKind at '${formatSnapshotPath(path)}': unknown kind '${value}'.`
                : `Invalid TargetOperationProposal operationKind at '${formatSnapshotPath(path)}': expected a string.`);
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
function assertCanonicalIdentityKind(value, path) {
    switch (value) {
        case "module":
        case "package":
        case "export":
        case "local-alias":
        case "symbol":
        case "type":
        case "signature":
        case "instantiated-type":
            return;
        default:
            throw invalidEnumValueError("ExtensionCanonicalIdentity kind", value, path);
    }
}
function assertExtensionImportKind(value, path) {
    switch (value) {
        case "type":
        case "value":
        case "namespace":
        case "unknown":
            return;
        default:
            throw invalidEnumValueError("ExtensionCanonicalIdentity importKind", value, path);
    }
}
function assertSourcePrimitiveRuntimeBase(value, path) {
    switch (value) {
        case "boolean":
        case "number":
        case "bigint":
        case "string":
        case "object":
            return;
        default:
            throw invalidEnumValueError("SourcePrimitiveFact runtimeBase", value, path);
    }
}
function assertSourcePointerMutability(value, path) {
    switch (value) {
        case "readonly":
        case "readwrite":
        case "target-defined":
            return;
        default:
            throw invalidEnumValueError("PointerFact mutability", value, path);
    }
}
function assertTargetBindingKind(value, path) {
    switch (value) {
        case "class":
        case "struct":
        case "interface":
        case "trait":
        case "enum":
        case "delegate":
        case "function":
        case "opaque":
            return;
        default:
            throw invalidEnumValueError("TargetBindingFact kind", value, path);
    }
}
function assertFlowState(value, path) {
    switch (value) {
        case "moved":
        case "borrowed-shared":
        case "borrowed-mut":
        case "initialized":
        case "uninitialized":
        case "target-validation-required":
            return;
        default:
            throw invalidEnumValueError("FlowStateFact state", value, path);
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