export function createExtensionConditionalCapture() {
    const steps = [];
    let complete = true;
    let parametersUsed = 0;
    const capture = {
        get complete() { return complete; },
        get steps() { return Object.freeze([...steps]); },
        record(root, branch, selectedNode, mapper) {
            if (!complete)
                return;
            if (root?.node === undefined || steps.length >= 1_024 ||
                root.outerTypeParameters.length + root.inferTypeParameters.length > 8_192 - parametersUsed) {
                complete = false;
                return;
            }
            const parameters = [];
            for (const parameter of [...root.outerTypeParameters, ...root.inferTypeParameters]) {
                if (parameter === undefined) {
                    complete = false;
                    return;
                }
                if (!parameters.includes(parameter))
                    parameters.push(parameter);
            }
            parametersUsed += parameters.length;
            steps.push(Object.freeze({ conditional: root.node, branch, selectedNode,
                parameters: Object.freeze(parameters), mapper }));
        },
    };
    return Object.freeze(capture);
}
//# sourceMappingURL=conditional-evidence.js.map