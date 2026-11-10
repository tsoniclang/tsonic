export function entrypointManifestMatches(manifest, expected) {
  const actual = Object.keys(manifest.exports ?? {}).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((entry, index) => entry === wanted[index]);
}

export function forbiddenPublicExportNames(sourceText, names) {
  return names.filter((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`, "u").test(sourceText)
  );
}

export function evaluatePublicExportInventory({
  manifest,
  expectedEntrypoints,
  sourceTextByEntrypoint = new Map(),
  forbiddenNamesByEntrypoint = new Map(),
}) {
  const findings = [];
  if (!entrypointManifestMatches(manifest, expectedEntrypoints)) {
    findings.push(Object.freeze({
      ruleId: "ARCH-API-001",
      source: "package.json",
      target: undefined,
      reason: "Package export entrypoints differ from the approved audience manifest.",
    }));
  }
  for (const [entrypoint, names] of forbiddenNamesByEntrypoint) {
    const exposed = forbiddenPublicExportNames(
      sourceTextByEntrypoint.get(entrypoint) ?? "",
      names,
    );
    if (exposed.length > 0) {
      findings.push(Object.freeze({
        ruleId: "ARCH-API-001",
        source: entrypoint,
        target: undefined,
        reason: `Public entrypoint exposes private symbols: ${exposed.sort().join(", ")}.`,
      }));
    }
  }
  return Object.freeze(findings.sort((left, right) =>
    left.source.localeCompare(right.source)
  ));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
