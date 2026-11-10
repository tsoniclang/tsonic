export function classifyFiles(files, rules) {
  const classifications = new Map();
  const findings = [];
  for (const file of [...files].sort()) {
    const matches = rules.filter((rule) => rule.matches(file));
    if (matches.length !== 1) {
      findings.push(Object.freeze({
        ruleId: "ARCH-CLASSIFICATION-001",
        source: file,
        target: undefined,
        reason: matches.length === 0
          ? "Product source file has no architectural layer."
          : `Product source file matches multiple layers: ${matches.map((entry) => entry.layer).join(", ")}.`,
      }));
      continue;
    }
    classifications.set(file, matches[0].layer);
  }
  return Object.freeze({
    classifications,
    findings: Object.freeze(findings),
  });
}

export function prefixLayer(prefix, layer) {
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return Object.freeze({
    layer,
    matches: (path) => path.startsWith(normalized),
  });
}

export function exactLayer(paths, layer) {
  const exact = new Set(paths);
  return Object.freeze({
    layer,
    matches: (path) => exact.has(path),
  });
}
