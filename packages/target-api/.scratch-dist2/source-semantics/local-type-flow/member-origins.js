export function sourceTypeDescriptorMemberOriginsEqual(left, right) {
    if (left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case "declared": return right.kind === "declared" && left.declaration === right.declaration;
        case "class-prototype": return right.kind === "class-prototype" && left.owner === right.owner;
        case "mapped": return right.kind === "mapped" && left.owner === right.owner && sourceTypeDescriptorMemberKeysEqual(left.key, right.key);
    }
}
export function sourceTypeDescriptorMemberKeysEqual(left, right) {
    if (left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case "string": return right.kind === "string" && left.value === right.value;
        case "number": return right.kind === "number" && Object.is(left.value, right.value);
        case "unique-symbol": return right.kind === "unique-symbol" && left.declaration === right.declaration;
    }
}
export function freezeSourceTypeDescriptorMemberOrigin(origin) {
    return origin.kind === "mapped" ? Object.freeze({ ...origin, key: Object.freeze({ ...origin.key }) })
        : Object.freeze({ ...origin });
}
//# sourceMappingURL=member-origins.js.map