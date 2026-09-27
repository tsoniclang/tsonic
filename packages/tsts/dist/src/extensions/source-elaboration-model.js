export const defaultSourceElaborationLimits = Object.freeze({
    maximumRounds: 1024,
    maximumRequests: 65_536,
    maximumReferences: 262_144,
    maximumDependencies: 262_144,
    maximumAnchorDepth: 2048,
    maximumDataRows: 4_194_304,
    maximumDataCodeUnits: 64 * 1024 * 1024,
});
export function snapshotSourceElaborationLimits(value) {
    if (value === null || typeof value !== "object" ||
        Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
        throw new Error("Source elaboration limits must be a plain data record.");
    }
    const fields = Object.keys(defaultSourceElaborationLimits);
    if (Reflect.ownKeys(value).length !== fields.length) {
        throw new Error("Source elaboration limits require exactly the complete budget family.");
    }
    const result = {};
    for (const field of fields) {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        const selected = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
        if (typeof selected !== "number" || !Number.isSafeInteger(selected) || selected < 1) {
            throw new Error(`Source elaboration limit '${field}' must be a positive finite safe integer.`);
        }
        result[field] = selected;
    }
    return Object.freeze(result);
}
//# sourceMappingURL=source-elaboration-model.js.map