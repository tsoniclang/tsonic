export function snapshotSourceStorageCallbackEffects(value, selected, budget) {
    if (!Array.isArray(value) || selected.selection !== "resolved")
        return undefined;
    const effects = [];
    const positions = new Set();
    for (let index = 0; index < value.length; index += 1) {
        if (!budget.row() || !budget.step())
            return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        const element = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
        if (element === null || typeof element !== "object")
            return undefined;
        const fields = Object.getOwnPropertyDescriptors(element);
        if (Reflect.ownKeys(fields).some(key => key !== "parameterIndex" && key !== "timing" && key !== "inputs" && key !== "rejection") ||
            Object.values(fields).some(field => !("value" in field)))
            return undefined;
        const parameterIndex = fields.parameterIndex?.value;
        const timing = fields.timing?.value;
        const rejection = fields.rejection?.value;
        if (typeof parameterIndex !== "number" || !Number.isSafeInteger(parameterIndex) || parameterIndex < 0 ||
            positions.has(parameterIndex) || timing !== "synchronous" && timing !== "deferred" ||
            !selected.parameters.some(parameter => parameter.parameterIndex === parameterIndex) ||
            rejection !== undefined && (typeof rejection !== "number" || !Number.isSafeInteger(rejection) || rejection < 0))
            return undefined;
        positions.add(parameterIndex);
        const supplied = fields.inputs?.value;
        const inputs = [];
        if (supplied !== undefined) {
            if (!Array.isArray(supplied))
                return undefined;
            const parameters = new Set();
            for (let ordinal = 0; ordinal < supplied.length; ordinal += 1) {
                if (!budget.row() || !budget.step())
                    return undefined;
                const entry = Object.getOwnPropertyDescriptor(supplied, ordinal);
                const value = entry !== undefined && "value" in entry ? entry.value : undefined;
                if (value === null || typeof value !== "object")
                    return undefined;
                const properties = Object.getOwnPropertyDescriptors(value);
                if (Reflect.ownKeys(properties).some(key => key !== "parameterIndex" && key !== "from" && key !== "sourceParameterIndex") ||
                    Object.values(properties).some(property => !("value" in property)))
                    return undefined;
                const input = properties.parameterIndex?.value;
                const from = properties.from?.value;
                const sourceParameterIndex = properties.sourceParameterIndex?.value;
                if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0 || parameters.has(input) ||
                    from !== "receiver-element" && from !== "argument-element" && from !== "receiver-rejection" ||
                    from !== "argument-element" && sourceParameterIndex !== undefined ||
                    from === "argument-element" && (typeof sourceParameterIndex !== "number" || !Number.isSafeInteger(sourceParameterIndex) ||
                        !selected.parameters.some(parameter => parameter.parameterIndex === sourceParameterIndex)))
                    return undefined;
                parameters.add(input);
                inputs.push(Object.freeze({ parameterIndex: input, from,
                    ...(from === "argument-element" ? { sourceParameterIndex: sourceParameterIndex } : {}) }));
            }
        }
        effects.push(Object.freeze({ parameterIndex, timing, ...(rejection === undefined ? {} : { rejection }),
            ...(supplied === undefined ? {} : { inputs: Object.freeze(inputs) }) }));
    }
    return Object.freeze(effects);
}
export function snapshotSourceStorageCallEffect(value, selected, 
/** The receiver expression of a member call (sourceStorageCallReceiver). */
receiver, budget) {
    const reject = () => {
        budget.reject("Source storage call effects require an exact checked allocation or unique checked scalar inputs.");
        return undefined;
    };
    if (!budget.row() || typeof value !== "object" || value === null)
        return reject();
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => key !== "resultAlias" && key !== "resultAllocation" && key !== "resumeReceiver"))
        return reject();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some(descriptor => !("value" in descriptor)))
        return reject();
    const alias = descriptors.resultAlias?.value;
    const allocation = descriptors.resultAllocation?.value;
    const resumeReceiver = descriptors.resumeReceiver?.value;
    if (resumeReceiver !== undefined && (resumeReceiver !== true || receiver === undefined ||
        selected.selection !== "resolved"))
        return reject();
    if (allocation !== undefined && (alias !== undefined || allocation !== selected.call || selected.selection !== "resolved"))
        return reject();
    const bindingCounts = new Map();
    for (const binding of selected.bindings) {
        if (!budget.step())
            return undefined;
        const previous = bindingCounts.get(binding.sourceArgumentIndex);
        bindingCounts.set(binding.sourceArgumentIndex, {
            count: (previous?.count ?? 0) + 1,
            scalar: binding.sourceForm === "value" && binding.sourceParameterForm === "parameter",
        });
    }
    const admitted = new Map();
    const admit = (node) => { admitted.set(node, (admitted.get(node) ?? 0) + 1); };
    for (const [argumentIndex, argument] of selected.arguments.entries()) {
        if (!budget.step())
            return undefined;
        const binding = bindingCounts.get(argumentIndex);
        if (binding?.count === 1 && binding.scalar)
            admit(argument);
    }
    if (receiver !== undefined)
        admit(receiver);
    const input = (node) => admitted.get(node) === 1;
    if (alias !== undefined && !input(alias))
        return reject();
    return Object.freeze({
        ...(alias === undefined ? {} : { resultAlias: alias }),
        ...(allocation === undefined ? {} : { resultAllocation: allocation }),
        ...(resumeReceiver === undefined ? {} : { resumeReceiver }),
    });
}
//# sourceMappingURL=call-effects.js.map