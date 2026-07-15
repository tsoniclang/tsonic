export const providerAncillaryDataLimits = Object.freeze({
    maxArrayEntries: 65_536,
    maxTotalEntries: 65_536,
    maxDepth: 64,
    maxStringCodeUnits: 65_536,
    maxTotalScalarCodeUnits: 262_144,
});
export const providerDeclarationModelLimits = Object.freeze({
    maxNestingDepth: 256,
    maxPhysicalNodeAndArrayEntries: 65_536,
    maxExpandedSemanticNodeAndArrayEntries: 65_536,
    maxStringCodeUnits: 65_536,
    maxPhysicalScalarCodeUnits: 4_194_304,
    maxExpandedSemanticScalarCodeUnits: 4_194_304,
});
export const providerDeclarationClosureLimits = Object.freeze({
    maxCandidates: 4_096,
    maxExports: 65_536,
    maxOwnerVisits: 65_536,
    maxReferences: 65_536,
    maxSnapshottedInputNodeAndCollectionEntries: 2_097_152,
    maxExpandedSemanticNodeAndArrayEntries: 1_048_576,
    maxSnapshottedInputScalarCodeUnits: 67_108_864,
    maxExpandedSemanticScalarCodeUnits: 67_108_864,
    maxDeclarationSourceCodeUnits: 67_108_864,
});
//# sourceMappingURL=provider-resource-limits.js.map