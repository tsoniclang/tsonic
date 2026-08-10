import { Type_Target, TypeFlagsNever } from "../types.js";
export const sourceIterationEvidenceLimits = Object.freeze({
    maxUnionAlternatives: 4_096,
    maxUnionDepth: 64,
});
export function freezeExtensionCheckedIterationSelection(selection) {
    switch (selection.iterationKind) {
        case "for-in":
            return Object.freeze({
                iterationKind: selection.iterationKind,
                sourceIterableType: selection.sourceIterableType,
                sourceElementType: selection.sourceElementType,
                mechanism: Object.freeze({ kind: "property-key-enumeration" }),
            });
        case "for-of":
            return Object.freeze({
                iterationKind: selection.iterationKind,
                sourceIterableType: selection.sourceIterableType,
                sourceElementType: selection.sourceElementType,
                mechanism: freezeForOfIterationMechanism(selection.mechanism),
            });
        case "for-await-of":
            return Object.freeze({
                iterationKind: selection.iterationKind,
                sourceIterableType: selection.sourceIterableType,
                sourceElementType: selection.sourceElementType,
                mechanism: freezeForAwaitOfIterationMechanism(selection.mechanism),
            });
    }
}
export function freezeExtensionCheckedYieldStarResult(result, asynchronous) {
    return Object.freeze({
        sourceIterableType: result.sourceIterableType,
        iterationTypes: Object.freeze({ ...result.iterationTypes }),
        mechanism: asynchronous
            ? freezeForAwaitOfIterationMechanism(result.mechanism)
            : freezeForOfIterationMechanism(result.mechanism),
    });
}
function hasIterationTypes(iterationTypes) {
    return iterationTypes.yieldType !== undefined
        || iterationTypes.returnType !== undefined
        || iterationTypes.nextType !== undefined;
}
function snapshotIterationTypes(iterationTypes) {
    return {
        yieldType: iterationTypes.yieldType,
        returnType: iterationTypes.returnType,
        nextType: iterationTypes.nextType,
    };
}
export function extensionIterationTypesMatch(left, right) {
    return left.yieldType === right.yieldType
        && left.returnType === right.returnType
        && left.nextType === right.nextType;
}
export function captureKnownIterableInstantiation(capture, sourceIterableType, iterationTypes) {
    if (sourceIterableType === undefined || !hasIterationTypes(iterationTypes)) {
        return;
    }
    const iterableTargetType = Type_Target(sourceIterableType);
    if (iterableTargetType === undefined) {
        return;
    }
    const iterableSymbol = iterableTargetType.symbol;
    const protocol = {
        resolutionKind: "known-iterable-instantiation",
        sourceIterableType,
        iterationTypes: snapshotIterationTypes(iterationTypes),
        iterableTargetType,
        iterableSymbol,
        iterableValueDeclaration: iterableSymbol?.ValueDeclaration,
        iterableDeclarations: iterableSymbol?.Declarations?.slice() ?? [],
    };
    capture.mechanism = {
        kind: "synchronous-iterator-protocol",
        sourceIterableType,
        protocol,
    };
}
export function captureSelectedIteratorMember(capture, sourceIterableType, iteratorMethodSymbol, iteratorMethodType, iteratorType, iterationTypes) {
    if (sourceIterableType === undefined
        || iteratorMethodSymbol === undefined
        || iteratorMethodType === undefined
        || iteratorType === undefined
        || !hasIterationTypes(iterationTypes)) {
        return;
    }
    const protocol = {
        resolutionKind: "selected-iterator-member",
        sourceIterableType,
        iterationTypes: snapshotIterationTypes(iterationTypes),
        iteratorMethodSymbol,
        iteratorMethodValueDeclaration: iteratorMethodSymbol.ValueDeclaration,
        iteratorMethodDeclarations: iteratorMethodSymbol.Declarations?.slice() ?? [],
        iteratorMethodType,
        iteratorType,
    };
    capture.mechanism = {
        kind: "synchronous-iterator-protocol",
        sourceIterableType,
        protocol,
    };
}
function withFinalIterationTypes(protocol, iterationTypes) {
    if (protocol.resolutionKind === "known-iterable-instantiation") {
        return {
            resolutionKind: protocol.resolutionKind,
            sourceIterableType: protocol.sourceIterableType,
            iterationTypes: snapshotIterationTypes(iterationTypes),
            iterableTargetType: protocol.iterableTargetType,
            iterableSymbol: protocol.iterableSymbol,
            iterableValueDeclaration: protocol.iterableValueDeclaration,
            iterableDeclarations: protocol.iterableDeclarations,
        };
    }
    return {
        resolutionKind: protocol.resolutionKind,
        sourceIterableType: protocol.sourceIterableType,
        iterationTypes: snapshotIterationTypes(iterationTypes),
        iteratorMethodSymbol: protocol.iteratorMethodSymbol,
        iteratorMethodValueDeclaration: protocol.iteratorMethodValueDeclaration,
        iteratorMethodDeclarations: protocol.iteratorMethodDeclarations,
        iteratorMethodType: protocol.iteratorMethodType,
        iteratorType: protocol.iteratorType,
    };
}
export function setExtensionProtocolMechanismKind(capture, kind, iterationTypes) {
    const mechanism = capture.mechanism;
    if (mechanism === undefined || mechanism.kind === "union") {
        return;
    }
    if (mechanism.kind !== "synchronous-iterator-protocol") {
        capture.mechanism = undefined;
        return;
    }
    const protocol = withFinalIterationTypes(mechanism.protocol, iterationTypes);
    if (kind === "asynchronous-iterator-protocol") {
        capture.mechanism = { kind, sourceIterableType: mechanism.sourceIterableType, protocol };
        return;
    }
    if (kind === "synchronous-iterator-adapted-to-async") {
        capture.mechanism = { kind, sourceIterableType: mechanism.sourceIterableType, protocol };
        return;
    }
    capture.mechanism = { kind, sourceIterableType: mechanism.sourceIterableType, protocol };
}
function isForOfAtomicIterationMechanism(mechanism) {
    return mechanism.kind === "synchronous-iterator-protocol"
        || mechanism.kind === "array-like-index"
        || mechanism.kind === "string-code-unit-index"
        || mechanism.kind === "untyped-dynamic-iteration";
}
function isForAwaitOfAtomicIterationMechanism(mechanism) {
    return mechanism.kind === "asynchronous-iterator-protocol"
        || mechanism.kind === "synchronous-iterator-adapted-to-async"
        || mechanism.kind === "array-like-index-adapted-to-async"
        || mechanism.kind === "string-code-unit-index-adapted-to-async"
        || mechanism.kind === "untyped-dynamic-iteration";
}
export function isForOfIterationMechanism(mechanism) {
    return mechanism.kind === "union"
        ? mechanism.alternatives.every(isForOfAtomicIterationMechanism)
        : isForOfAtomicIterationMechanism(mechanism);
}
export function isForAwaitOfIterationMechanism(mechanism) {
    return mechanism.kind === "union"
        ? mechanism.alternatives.every(isForAwaitOfAtomicIterationMechanism)
        : isForAwaitOfAtomicIterationMechanism(mechanism);
}
function appendForOfAlternatives(destination, mechanism) {
    const alternatives = mechanism.kind === "union" ? mechanism.alternatives : [mechanism];
    for (const alternative of alternatives) {
        if (!isForOfAtomicIterationMechanism(alternative)) {
            return false;
        }
        destination.push(alternative);
    }
    return true;
}
function appendForAwaitOfAlternatives(destination, mechanism) {
    const alternatives = mechanism.kind === "union" ? mechanism.alternatives : [mechanism];
    for (const alternative of alternatives) {
        if (!isForAwaitOfAtomicIterationMechanism(alternative)) {
            return false;
        }
        destination.push(alternative);
    }
    return true;
}
export function combineExtensionProtocolMechanisms(capture, children, forAwaitOf) {
    if (capture.budget.exhausted || children.some((child) => child.mechanism === undefined)) {
        capture.mechanism = undefined;
        return;
    }
    if (forAwaitOf) {
        const alternatives = [];
        for (const child of children) {
            if (!appendForAwaitOfAlternatives(alternatives, child.mechanism)) {
                capture.mechanism = undefined;
                return;
            }
        }
        capture.mechanism = alternatives.length === 1
            ? alternatives[0]
            : alternatives.length === 0
                ? undefined
                : { kind: "union", alternatives: [alternatives[0], ...alternatives.slice(1)] };
        return;
    }
    const alternatives = [];
    for (const child of children) {
        if (!appendForOfAlternatives(alternatives, child.mechanism)) {
            capture.mechanism = undefined;
            return;
        }
    }
    capture.mechanism = alternatives.length === 1
        ? alternatives[0]
        : alternatives.length === 0
            ? undefined
            : { kind: "union", alternatives: [alternatives[0], ...alternatives.slice(1)] };
}
export function createChildExtensionIterationCapture(capture) {
    return { budget: capture.budget, mechanism: undefined };
}
function setFallbackMechanism(capture, alternatives, forAwaitOf) {
    if (capture.budget.exhausted || alternatives.length === 0) {
        capture.mechanism = undefined;
        return;
    }
    if (forAwaitOf) {
        const typed = [];
        for (const alternative of alternatives) {
            if (!isForAwaitOfAtomicIterationMechanism(alternative)) {
                capture.mechanism = undefined;
                return;
            }
            typed.push(alternative);
        }
        capture.mechanism = typed.length === 1
            ? typed[0]
            : { kind: "union", alternatives: [typed[0], ...typed.slice(1)] };
        return;
    }
    const typed = [];
    for (const alternative of alternatives) {
        if (!isForOfAtomicIterationMechanism(alternative)) {
            capture.mechanism = undefined;
            return;
        }
        typed.push(alternative);
    }
    capture.mechanism = typed.length === 1
        ? typed[0]
        : { kind: "union", alternatives: [typed[0], ...typed.slice(1)] };
}
export function captureExtensionArrayOrStringIteration(capture, forAwaitOf, arrayType, selectedIndexType, stringType) {
    const alternatives = [];
    if (stringType !== undefined) {
        alternatives.push(forAwaitOf
            ? { kind: "string-code-unit-index-adapted-to-async", sourceIterableType: stringType }
            : { kind: "string-code-unit-index", sourceIterableType: stringType });
    }
    if (arrayType !== undefined && selectedIndexType !== undefined && (arrayType.flags & TypeFlagsNever) === 0) {
        alternatives.push(forAwaitOf
            ? { kind: "array-like-index-adapted-to-async", sourceIterableType: arrayType, selectedIndexType }
            : { kind: "array-like-index", sourceIterableType: arrayType, selectedIndexType });
    }
    setFallbackMechanism(capture, alternatives, forAwaitOf);
}
export function createExtensionIterationProtocolSelectionCapture() {
    return {
        budget: {
            remainingUnionAlternatives: sourceIterationEvidenceLimits.maxUnionAlternatives,
            exhausted: false,
        },
        mechanism: undefined,
    };
}
export function createExtensionForInIterationSelection(sourceIterableType, sourceElementType) {
    return Object.freeze({
        iterationKind: "for-in",
        sourceIterableType,
        sourceElementType,
        mechanism: Object.freeze({ kind: "property-key-enumeration" }),
    });
}
function freezeForOfIterationMechanism(mechanism) {
    if (mechanism.kind === "union") {
        const alternatives = [
            freezeForOfAtomicIterationMechanism(mechanism.alternatives[0]),
            ...mechanism.alternatives.slice(1).map(freezeForOfAtomicIterationMechanism),
        ];
        return Object.freeze({
            kind: "union",
            alternatives: Object.freeze(alternatives),
        });
    }
    return freezeForOfAtomicIterationMechanism(mechanism);
}
function freezeForAwaitOfIterationMechanism(mechanism) {
    if (mechanism.kind === "union") {
        const alternatives = [
            freezeForAwaitOfAtomicIterationMechanism(mechanism.alternatives[0]),
            ...mechanism.alternatives.slice(1).map(freezeForAwaitOfAtomicIterationMechanism),
        ];
        return Object.freeze({
            kind: "union",
            alternatives: Object.freeze(alternatives),
        });
    }
    return freezeForAwaitOfAtomicIterationMechanism(mechanism);
}
function freezeForOfAtomicIterationMechanism(mechanism) {
    switch (mechanism.kind) {
        case "synchronous-iterator-protocol":
            return Object.freeze({
                kind: mechanism.kind,
                sourceIterableType: mechanism.sourceIterableType,
                protocol: freezeSelectedIterationProtocol(mechanism.protocol),
            });
        case "array-like-index":
            return Object.freeze({ ...mechanism });
        case "string-code-unit-index":
            return Object.freeze({ ...mechanism });
        case "untyped-dynamic-iteration":
            return Object.freeze({ ...mechanism });
    }
}
function freezeForAwaitOfAtomicIterationMechanism(mechanism) {
    switch (mechanism.kind) {
        case "asynchronous-iterator-protocol":
        case "synchronous-iterator-adapted-to-async":
            return Object.freeze({
                kind: mechanism.kind,
                sourceIterableType: mechanism.sourceIterableType,
                protocol: freezeSelectedIterationProtocol(mechanism.protocol),
            });
        case "array-like-index-adapted-to-async":
            return Object.freeze({ ...mechanism });
        case "string-code-unit-index-adapted-to-async":
            return Object.freeze({ ...mechanism });
        case "untyped-dynamic-iteration":
            return Object.freeze({ ...mechanism });
    }
}
function freezeSelectedIterationProtocol(protocol) {
    const iterationTypes = Object.freeze({ ...protocol.iterationTypes });
    if (protocol.resolutionKind === "known-iterable-instantiation") {
        return Object.freeze({
            resolutionKind: protocol.resolutionKind,
            sourceIterableType: protocol.sourceIterableType,
            iterationTypes,
            iterableTargetType: protocol.iterableTargetType,
            iterableSymbol: protocol.iterableSymbol,
            iterableValueDeclaration: protocol.iterableValueDeclaration,
            iterableDeclarations: Object.freeze([...protocol.iterableDeclarations]),
        });
    }
    return Object.freeze({
        resolutionKind: protocol.resolutionKind,
        sourceIterableType: protocol.sourceIterableType,
        iterationTypes,
        iteratorMethodSymbol: protocol.iteratorMethodSymbol,
        iteratorMethodValueDeclaration: protocol.iteratorMethodValueDeclaration,
        iteratorMethodDeclarations: Object.freeze([...protocol.iteratorMethodDeclarations]),
        iteratorMethodType: protocol.iteratorMethodType,
        iteratorType: protocol.iteratorType,
    });
}
//# sourceMappingURL=iteration-evidence.js.map