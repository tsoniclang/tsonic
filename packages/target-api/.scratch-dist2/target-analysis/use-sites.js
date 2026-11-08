export function targetUseSiteRef(subject, role, enclosingContract, specialization) {
    if (role.length === 0 || enclosingContract.length === 0) {
        throw new Error("A target use site requires non-empty role and enclosing-contract identities.");
    }
    return Object.freeze({
        subject,
        role,
        enclosingContract,
        ...(specialization === undefined ? {} : { specialization }),
    });
}
export function targetUseSiteIdentity(use) {
    return encodeIdentityParts([
        use.enclosingContract,
        use.specialization ?? "",
        use.role,
    ]);
}
function encodeIdentityParts(parts) {
    return parts.map((part) => `${part.length}:${part}`).join("|");
}
//# sourceMappingURL=use-sites.js.map