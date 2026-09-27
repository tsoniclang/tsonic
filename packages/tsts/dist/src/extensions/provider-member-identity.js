export function getProviderMemberSurfaceKey(member) {
    switch (member.kind) {
        case "constructor":
            return "constructor";
        case "indexer":
            return "indexer";
        case "method":
        case "property":
        case "field":
        case "intrinsic":
            return JSON.stringify([member.static === true, propertyKey(member.name)]);
    }
}
function propertyKey(name) {
    if (typeof name !== "string" && name.kind === "well-known-symbol")
        return ["well-known-symbol", name.name];
    const text = typeof name === "string" ? name : name.kind === "number-literal" ? String(name.value) : name.text;
    return ["property-key", text];
}
//# sourceMappingURL=provider-member-identity.js.map