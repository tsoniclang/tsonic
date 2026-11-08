export const defaultSourceFlowLimits = Object.freeze({
    maximumPoints: 262144,
    maximumEdges: 1048576,
    maximumSteps: 4194304,
    maximumDepth: 256,
});
export class SourceFlowFailure extends Error {
    constructor(message, source, resource) {
        super(message);
        this.source = source;
        this.resource = resource === undefined ? undefined : Object.freeze(resource);
    }
}
export function sourceFlowLimits(limits) {
    const selected = { ...defaultSourceFlowLimits, ...limits };
    for (const [name, value] of Object.entries(selected)) {
        const maximum = defaultSourceFlowLimits[name];
        if (!Number.isSafeInteger(value) || value <= 0 || maximum === undefined || value > maximum) {
            throw new SourceFlowFailure(`Source flow requires a positive finite ${name} no greater than its bounded default.`, undefined);
        }
    }
    return Object.freeze(selected);
}
export function createSourceFlowBudget(limits, subject) {
    let steps = 0;
    return {
        step(source) {
            steps += 1;
            if (steps > limits.maximumSteps)
                throw new SourceFlowFailure("Source flow exceeds its finite work budget.", source, { subject, dimension: "maximumSteps", limit: limits.maximumSteps });
        },
        steps: () => steps,
    };
}
//# sourceMappingURL=resources.js.map