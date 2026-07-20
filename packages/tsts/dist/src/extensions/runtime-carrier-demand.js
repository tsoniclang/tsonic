import { ExtensionObservationPoint } from "./observations.js";
export function checkedOperationRuntimeCarrierDemands(observation, request) {
    const sourceOrigin = checkedOperationSourceOrigin(observation, request);
    const demands = new Map();
    const add = (type, sourceTypeReference, sourceSymbol) => {
        let demand = demands.get(type);
        if (demand === undefined) {
            demand = {
                type,
                sourceOrigin,
                sourceTypeReferences: new Set(),
                sourceSymbols: new Set(),
            };
            demands.set(type, demand);
        }
        if (sourceTypeReference !== undefined) {
            demand.sourceTypeReferences.add(sourceTypeReference);
        }
        if (sourceSymbol !== undefined) {
            demand.sourceSymbols.add(sourceSymbol);
        }
    };
    const addTypeEvidence = (evidence) => {
        if (evidence !== undefined) {
            add(evidence.type, evidence.authoredTypeNode, evidence.symbol);
        }
    };
    const addValueEvidence = (evidence) => {
        addTypeEvidence(evidence);
    };
    const addCallSelection = (selection) => {
        if (selection.kind !== "applicable") {
            return;
        }
        for (const argument of selection.methodTypeArguments) {
            add(argument.selectedType, argument.explicitTypeNode);
        }
        for (const parameter of selection.parameters) {
            add(parameter.selectedType, parameter.authoredTypeNode);
        }
        for (const binding of selection.argumentBindings) {
            add(binding.selectedArgumentType);
            add(binding.selectedParameterType);
        }
    };
    const addSelectedSignature = (selection) => {
        addCallSelection(selection.sourceSelection);
        addValueEvidence(selection.sourceCallee);
        for (const argument of selection.sourceArguments) {
            addValueEvidence(argument);
        }
        addValueEvidence(selection.sourceResult);
        addValueEvidence(selection.sourceReceiver);
    };
    const addIterationProtocol = (protocol) => {
        addTypeEvidence(protocol.iterationTypes.yieldType);
        addTypeEvidence(protocol.iterationTypes.returnType);
        addTypeEvidence(protocol.iterationTypes.nextType);
        if (protocol.resolutionKind === "known-iterable-instantiation") {
            addTypeEvidence(protocol.iterableTarget);
            return;
        }
        add(protocol.iteratorMethod.type, undefined, protocol.iteratorMethod.symbol);
        addTypeEvidence(protocol.iteratorType);
    };
    const addForOfAtomic = (mechanism) => {
        addTypeEvidence(mechanism.sourceAlternative);
        switch (mechanism.kind) {
            case "synchronous-iterator-protocol":
                addIterationProtocol(mechanism.protocol);
                return;
            case "array-like-index":
                addTypeEvidence(mechanism.selectedIndex);
                return;
            case "string-code-unit-index":
            case "untyped-dynamic-iteration":
                return;
        }
    };
    const addForOf = (mechanism) => {
        if (mechanism.kind === "union") {
            for (const alternative of mechanism.alternatives) {
                addForOfAtomic(alternative);
            }
            return;
        }
        addForOfAtomic(mechanism);
    };
    const addForAwaitOfAtomic = (mechanism) => {
        addTypeEvidence(mechanism.sourceAlternative);
        switch (mechanism.kind) {
            case "asynchronous-iterator-protocol":
            case "synchronous-iterator-adapted-to-async":
                addIterationProtocol(mechanism.protocol);
                return;
            case "array-like-index-adapted-to-async":
                addTypeEvidence(mechanism.selectedIndex);
                return;
            case "string-code-unit-index-adapted-to-async":
            case "untyped-dynamic-iteration":
                return;
        }
    };
    const addForAwaitOf = (mechanism) => {
        if (mechanism.kind === "union") {
            for (const alternative of mechanism.alternatives) {
                addForAwaitOfAtomic(alternative);
            }
            return;
        }
        addForAwaitOfAtomic(mechanism);
    };
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall: {
            const call = request;
            addCallSelection(call.sourceSelection);
            addValueEvidence(call.sourceCallee);
            for (const argument of call.sourceArguments) {
                addValueEvidence(argument);
            }
            addValueEvidence(call.sourceResult);
            addValueEvidence(call.sourceReceiver);
            break;
        }
        case ExtensionObservationPoint.mapCheckedPropertyAccess: {
            const property = request;
            addValueEvidence(property.sourceReceiver);
            addValueEvidence(property.sourceReadResult);
            addTypeEvidence(property.sourceWriteType);
            break;
        }
        case ExtensionObservationPoint.mapCheckedElementAccess: {
            const element = request;
            addValueEvidence(element.sourceReceiver);
            addValueEvidence(element.sourceArgument);
            addValueEvidence(element.sourceReadResult);
            addTypeEvidence(element.sourceWriteType);
            break;
        }
        case ExtensionObservationPoint.mapCheckedOperator: {
            const operator = request;
            addValueEvidence(operator.sourceResult);
            if (operator.operatorKind === "binary") {
                addValueEvidence(operator.sourceLeft);
                addValueEvidence(operator.sourceRight);
            }
            else {
                addValueEvidence(operator.sourceOperand);
            }
            break;
        }
        case ExtensionObservationPoint.mapCheckedIteration: {
            const iteration = request;
            addValueEvidence(iteration.sourceIterable);
            addTypeEvidence(iteration.sourceElement);
            if (iteration.iterationKind === "for-of") {
                addForOf(iteration.mechanism);
            }
            else if (iteration.iterationKind === "for-await-of") {
                addForAwaitOf(iteration.mechanism);
            }
            break;
        }
        case ExtensionObservationPoint.mapCheckedConversion: {
            const conversion = request;
            addValueEvidence(conversion.source);
            if (conversion.conversionKind === "assertion") {
                add(conversion.target.type, conversion.explicitTargetTypeNode, conversion.target.symbol);
            }
            else {
                add(conversion.sourceBinding.selectedArgumentType);
                add(conversion.sourceBinding.selectedParameterType);
                addSelectedSignature(conversion.selectedSignature);
            }
            break;
        }
    }
    return Object.freeze([...demands.values()].map((demand) => Object.freeze({
        type: demand.type,
        sourceOrigin: demand.sourceOrigin,
        ...(demand.sourceTypeReferences.size === 1
            ? { sourceTypeReference: demand.sourceTypeReferences.values().next().value }
            : {}),
        ...(demand.sourceSymbols.size === 1
            ? { sourceSymbol: demand.sourceSymbols.values().next().value }
            : {}),
    })));
}
function checkedOperationSourceOrigin(observation, request) {
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            return request.call;
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedElementAccess:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedOperator:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedIteration:
            return request.statement;
        case ExtensionObservationPoint.mapCheckedConversion:
            return request.expression;
    }
}
//# sourceMappingURL=runtime-carrier-demand.js.map