const markerPrefix = "/*@tsts-provider-primitive:";
const markerSuffix = "*/";
export const providerSourcePrimitiveMarkerMaximumLength = markerPrefix.length + 16 + markerSuffix.length;
export function renderProviderSourcePrimitiveMarker(marker) {
    if (!Number.isSafeInteger(marker) || marker < 0) {
        throw new Error("Provider source-primitive marker must be a non-negative safe integer.");
    }
    return `${markerPrefix}${marker}${markerSuffix}`;
}
export function parseProviderSourcePrimitiveMarker(sourceText) {
    const match = /^\/\*@tsts-provider-primitive:(0|[1-9][0-9]{0,15})\*\//u.exec(sourceText);
    if (match === null)
        return undefined;
    const marker = Number(match[1]);
    return Number.isSafeInteger(marker) ? marker : undefined;
}
//# sourceMappingURL=provider-source-primitives.js.map