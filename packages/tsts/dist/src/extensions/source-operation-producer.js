import { ExtensionObservationPoint } from "./observations.js";
/** Host-only subject boundary for one retained source operation. */
export function checkedSourceCallReadableSubjects(operation) {
    const subjects = new Set();
    const add = (subject) => {
        if (subject !== undefined) {
            subjects.add(subject);
        }
    };
    const addType = (evidence) => {
        add(evidence.type);
        add(evidence.symbol);
        add(evidence.declaration);
        add(evidence.selectedSymbol);
        add(evidence.selectedDeclaration);
        add(evidence.authoredTypeNode);
    };
    const addValue = (evidence) => {
        add(evidence.expression);
        addType(evidence);
    };
    const addSelection = (sourceOperation) => {
        if (sourceOperation.sourceSelection.kind !== "applicable") {
            return;
        }
        add(sourceOperation.sourceSelection.signature);
        add(sourceOperation.sourceSelection.declaration);
        for (const argument of sourceOperation.sourceSelection.methodTypeArguments) {
            add(argument.typeParameter);
            add(argument.selectedType);
            add(argument.explicitTypeNode);
        }
        for (const parameter of sourceOperation.sourceSelection.parameters) {
            add(parameter.parameterSymbol);
            add(parameter.parameterDeclaration);
            add(parameter.selectedType);
            add(parameter.authoredTypeNode);
        }
        for (const binding of sourceOperation.sourceSelection.argumentBindings) {
            add(binding.selectedArgumentType);
            add(binding.selectedParameterType);
        }
    };
    const addCall = (sourceOperation) => {
        add(sourceOperation.call);
        add(sourceOperation.callee);
        sourceOperation.arguments.forEach(add);
        addSelection(sourceOperation);
        addValue(sourceOperation.sourceCallee);
        sourceOperation.sourceArguments.forEach(addValue);
        addValue(sourceOperation.sourceResult);
        if (sourceOperation.sourceReceiver !== undefined) {
            addValue(sourceOperation.sourceReceiver);
        }
    };
    const addAccess = (sourceOperation) => {
        add(sourceOperation.expression);
        add(sourceOperation.receiver);
        addValue(sourceOperation.sourceReceiver);
        if (sourceOperation.accessMode !== "write") {
            addValue(sourceOperation.sourceReadResult);
        }
        if (sourceOperation.accessMode === "write" || sourceOperation.accessMode === "read-write") {
            addType(sourceOperation.sourceWriteType);
        }
        if (sourceOperation.sourceOperationKind === "element-access") {
            add(sourceOperation.argument);
            addValue(sourceOperation.sourceArgument);
        }
    };
    const addIterationProtocol = (protocol) => {
        addTypeIfPresent(protocol.iterationTypes.yieldType);
        addTypeIfPresent(protocol.iterationTypes.returnType);
        addTypeIfPresent(protocol.iterationTypes.nextType);
        if (protocol.resolutionKind === "known-iterable-instantiation") {
            addType(protocol.iterableTarget);
            protocol.iterableDeclarations.forEach(add);
            return;
        }
        add(protocol.iteratorMethod.symbol);
        add(protocol.iteratorMethod.valueDeclaration);
        protocol.iteratorMethod.declarations.forEach(add);
        add(protocol.iteratorMethod.type);
        addType(protocol.iteratorType);
    };
    const addTypeIfPresent = (evidence) => {
        if (evidence !== undefined) {
            addType(evidence);
        }
    };
    const addIterationMechanism = (mechanism) => {
        if (mechanism.kind === "union") {
            mechanism.alternatives.forEach(addIterationMechanism);
            return;
        }
        addType(mechanism.sourceAlternative);
        switch (mechanism.kind) {
            case "synchronous-iterator-protocol":
            case "asynchronous-iterator-protocol":
            case "synchronous-iterator-adapted-to-async":
                addIterationProtocol(mechanism.protocol);
                return;
            case "array-like-index":
            case "array-like-index-adapted-to-async":
                addType(mechanism.selectedIndex);
                return;
            case "string-code-unit-index":
            case "string-code-unit-index-adapted-to-async":
            case "untyped-dynamic-iteration":
                return;
        }
    };
    const addInlineOperation = (sourceOperation) => {
        switch (sourceOperation.sourceOperationKind) {
            case "call":
                addCall(sourceOperation);
                return;
            case "property-access":
            case "element-access":
                addAccess(sourceOperation);
                return;
            case "operator":
                add(sourceOperation.expression);
                addValue(sourceOperation.sourceResult);
                if (sourceOperation.operatorKind === "binary") {
                    add(sourceOperation.left);
                    add(sourceOperation.right);
                    addValue(sourceOperation.sourceLeft);
                    addValue(sourceOperation.sourceRight);
                }
                else {
                    add(sourceOperation.operand);
                    addValue(sourceOperation.sourceOperand);
                }
                return;
            case "iteration":
                add(sourceOperation.statement);
                add(sourceOperation.expression);
                add(sourceOperation.initializer);
                addValue(sourceOperation.sourceIterable);
                addType(sourceOperation.sourceElement);
                if (sourceOperation.iterationKind !== "for-in") {
                    addIterationMechanism(sourceOperation.mechanism);
                }
                return;
            case "conversion":
                add(sourceOperation.expression);
                addValue(sourceOperation.source);
                addType(sourceOperation.target);
                add(sourceOperation.explicitTargetTypeNode);
                return;
        }
    };
    addCall(operation);
    for (const argument of operation.sourceArguments) {
        if (argument.composition?.kind !== "inline-function") {
            continue;
        }
        const inlineFunction = argument.composition.function;
        add(inlineFunction.expression);
        for (const parameter of inlineFunction.parameters) {
            add(parameter.declaration);
            add(parameter.symbol);
        }
        for (const returned of inlineFunction.returns) {
            add(returned.expression);
        }
        inlineFunction.operations.forEach(addInlineOperation);
    }
    return subjects;
}
export const completeCheckedSourceCallProduction = Object.freeze({ kind: "complete" });
export const deferCheckedSourceCallProduction = Object.freeze({ kind: "defer" });
export function rejectCheckedSourceCallProduction(diagnostic) {
    return Object.freeze({ kind: "reject", diagnostic });
}
//# sourceMappingURL=source-operation-producer.js.map