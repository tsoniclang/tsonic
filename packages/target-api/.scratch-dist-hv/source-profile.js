export const tsonicSourceProfileVirtualDirectory = ".tsonic/source-profiles";
export function targetSourceProfileDeclaration(fileName, text) {
    return { fileName, text };
}
export function normalizeTargetSourceProfileSegment(value) {
    return encodeURIComponent(value).replace(/%/gu, "_").replace(/\./gu, "_");
}
export function isTsonicSourceProfileDeclarationPath(fileName, ownerId) {
    const normalizedFileName = normalizePath(fileName);
    const directory = normalizePath(tsonicSourceProfileVirtualDirectory);
    if (ownerId === undefined) {
        return normalizedFileName.includes(`/${directory}/`) ||
            normalizedFileName.startsWith(`${directory}/`);
    }
    const ownerSegment = normalizeTargetSourceProfileSegment(ownerId);
    return normalizedFileName.includes(`/${directory}/${ownerSegment}/`) ||
        normalizedFileName.startsWith(`${directory}/${ownerSegment}/`);
}
function normalizePath(value) {
    return value.split("\\").join("/").replace(/\/+$/u, "");
}
//# sourceMappingURL=source-profile.js.map