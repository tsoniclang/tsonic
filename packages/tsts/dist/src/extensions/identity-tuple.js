export function encodeIdentityTuple(parts) {
    return JSON.stringify(parts.map((part) => {
        if (part === undefined) {
            return ["undefined"];
        }
        if (typeof part !== "number") {
            return [typeof part, part];
        }
        if (Number.isNaN(part)) {
            return ["number", "NaN"];
        }
        if (part === Number.POSITIVE_INFINITY) {
            return ["number", "+Infinity"];
        }
        if (part === Number.NEGATIVE_INFINITY) {
            return ["number", "-Infinity"];
        }
        if (Object.is(part, -0)) {
            return ["number", "-0"];
        }
        return ["number", part];
    }));
}
//# sourceMappingURL=identity-tuple.js.map