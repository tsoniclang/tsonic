import { getTargetIdValidationMessage, isValidTargetId, isValidTargetSurfaceId } from "./config.js";
export function createTargetRegistry(packs) {
    const byId = new Map();
    for (const pack of packs) {
        validateTargetPackContract(pack);
        if (!isValidTargetId(pack.id)) {
            throw new Error(getTargetIdValidationMessage(`Target pack id '${pack.id}'`));
        }
        if (byId.has(pack.id)) {
            throw new Error(`Duplicate target pack '${pack.id}'.`);
        }
        for (const ownership of pack.provider.moduleOwnership) {
            validateProviderModuleOwnershipPrefix(`Target pack '${pack.id}' provider module ownership prefix`, ownership.specifierPrefix);
        }
        for (const surface of pack.surfaces) {
            if (!isValidTargetSurfaceId(surface.id)) {
                throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' surface id '${surface.id}'`));
            }
            for (const requiredSurfaceId of surface.requiredSurfaces ?? []) {
                if (!isValidTargetSurfaceId(requiredSurfaceId)) {
                    throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' surface '${surface.id}' required surface id '${requiredSurfaceId}'`));
                }
            }
        }
        byId.set(pack.id, pack);
    }
    return Object.freeze({
        packs: Object.freeze([...byId.values()]),
        get(id) {
            return byId.get(id);
        },
    });
}
function validateTargetPackContract(pack) {
    if (pack.provider === undefined ||
        typeof pack.provider.id !== "string" ||
        pack.provider.id.length === 0 ||
        typeof pack.provider.displayName !== "string" ||
        !Array.isArray(pack.provider.moduleOwnership)) {
        throw new Error(`Target pack '${pack.id}' must declare one complete provider descriptor.`);
    }
    if (!Array.isArray(pack.surfaces)) {
        throw new Error(`Target pack '${pack.id}' must declare its surface list.`);
    }
    if (typeof pack.createCompilationSession !== "function") {
        throw new Error(`Target pack '${pack.id}' must declare one compilation-session factory.`);
    }
    if (typeof pack.createToolchain !== "function") {
        throw new Error(`Target pack '${pack.id}' must declare one toolchain factory.`);
    }
}
function validateProviderModuleOwnershipPrefix(subject, prefix) {
    if (prefix.length === 0 ||
        prefix.trim() !== prefix ||
        prefix.startsWith(".") ||
        prefix.includes("\\") ||
        prefix.includes("\0")) {
        throw new Error(`${subject} '${prefix}' must be a non-empty bare/package/URL-style ESM specifier prefix, not a relative or filesystem path.`);
    }
}
//# sourceMappingURL=registry.js.map