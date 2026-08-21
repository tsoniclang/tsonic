export const targetLayerNames = Object.freeze([
  "public-root",
  "public-provider-sdk",
  "descriptor",
  "compilation",
  "options",
  "source",
  "provider-model",
  "provider-implementation",
  "target-model",
  "policy",
  "analysis",
  "target-ast",
  "artifact-model",
  "planner",
  "emission",
  "backend-entrypoint",
  "printer",
  "toolchain",
]);

const allowedTargetLayerDependencies = Object.freeze({
  "public-root": ["descriptor", "options", "target-model"],
  "public-provider-sdk": ["provider-model", "provider-implementation", "target-model", "policy"],
  descriptor: ["compilation", "target-model", "toolchain"],
  compilation: ["backend-entrypoint", "options", "source", "provider-model", "provider-implementation", "target-model"],
  options: ["provider-model", "target-model"],
  source: ["provider-model", "target-model"],
  "provider-model": ["target-model"],
  "provider-implementation": ["source", "provider-model", "target-model", "policy"],
  "target-model": [],
  policy: ["source", "provider-model", "target-model"],
  analysis: ["source", "provider-model", "target-model", "policy"],
  "target-ast": ["target-model"],
  "artifact-model": ["target-model", "target-ast"],
  planner: ["analysis", "source", "provider-model", "target-model", "policy", "target-ast", "artifact-model"],
  emission: ["artifact-model", "printer"],
  "backend-entrypoint": ["analysis", "planner", "emission"],
  printer: ["target-ast", "artifact-model"],
  toolchain: ["options", "target-model"],
});

export const canonicalTargetLayerPolicies = Object.freeze(targetLayerNames.map((source) =>
  Object.freeze({
    source,
    allowed: new Set(allowedTargetLayerDependencies[source]),
    ruleId: targetLayerRuleId(source),
    reason: `Target layer '${source}' may depend only on its canonical lower-layer ownership set.`,
  })
));

export const canonicalTargetForbiddenDirectories = Object.freeze([
  "common",
  "compat",
  "helpers",
  "legacy",
  "misc",
  "plugin",
  "translate",
  "utils",
]);

export const canonicalTargetSourceRules = Object.freeze([
  sourceRule(
    "ARCH-TARGET-SESSION-001",
    (_file, source) => /\b(?:TargetBackend|TargetBackendContext|createBackend|createTsonicSemanticSession|compileTargetFromSemanticSession)\b/u.test(source),
    "Target product source must use the one compilation-session lifecycle.",
  ),
  sourceRule(
    "ARCH-TARGET-SOURCE-002",
    (_file, source) => /\b(?:TypeCheckerQueries|TypeShapeQueries)\b/u.test(source),
    "Target product source cannot retain wholesale source-checker query interfaces.",
  ),
  sourceRule(
    "ARCH-TARGET-SOURCE-001",
    (_file, source) => /\b(?:getResolvedSignature|getResolvedSymbol|getSymbolAtLocation|getPropertyOfType|getTypeAtLocation|getTypeFromTypeNode)\s*\(/u.test(source),
    "Target product source must consume narrow selected evidence and final-type queries.",
  ),
  sourceRule(
    "ARCH-TARGET-CONTEXT-001",
    (_file, source) => /\binterface\s+[A-Za-z0-9_]*PlanningContext\s+extends\b/u.test(source),
    "Planning contexts compose compile input and immutable target program; they do not inherit either.",
  ),
  sourceRule(
    "ARCH-TARGET-CONTEXT-002",
    (_file, source) => /\{\s*\.\.\.input\s*,\s*\.\.\.program\b/u.test(source),
    "Planning contexts cannot flatten compile input and target program into one namespace.",
  ),
  sourceRule(
    "ARCH-TARGET-CAPABILITY-001",
    (_file, source) => /\.createTargetContributions\s*(?:\?\.)?\s*\(/u.test(source),
    "Targets consume the host-captured capability contribution snapshot and cannot invoke capability callbacks.",
  ),
  sourceRule(
    "ARCH-TARGET-PROVIDER-001",
    (file, source) => (
      file.startsWith("src/backend/planner/") ||
      file.startsWith("src/descriptor/")
    ) && /\bcreate[A-Za-z0-9]*(?:Provider|Broker|WorkerClient)\s*\(/u.test(source),
    "Planning and descriptor layers cannot recreate target providers.",
  ),
  sourceRule(
    "ARCH-TARGET-EMISSION-001",
    (file, source) => file.startsWith("src/backend/emission/") &&
      /\bTargetCompileInput\b|from\s+["'](?:(?:\.\.\/)+source\/|@tsonic\/target-api\/source|[^"']*\/(?:policy|analysis|planner|providers|compilation)\/)/u.test(source),
    "Materializers consume only complete output plans and printers.",
  ),
  sourceRule(
    "ARCH-TARGET-SESSION-002",
    (file, source) => (
      file.startsWith("src/descriptor/") || file.startsWith("src/compilation/")
    ) && /\bWeakMap\s*</u.test(source),
    "Per-build target sessions cannot be transported through target-selection object identity.",
  ),
  sourceRule(
    "ARCH-TARGET-IDENTITY-001",
    (file, source) => (
      file.startsWith("src/policy/") || file.startsWith("src/analysis/")
    ) && /\b(?:artifactPath|outputIdentit(?:y|ies))\b/u.test(source),
    "Source semantics and target analysis cannot derive identity from physical output placement.",
  ),
  sourceRule(
    "ARCH-TARGET-LAYOUT-001",
    (file) => /^(?:src\/backend\/(?:artifacts\/|project-model\/|roslyn\/|rust-ast\/)|src\/print\/(?:cargo\/|csharp\/|rust\/)|src\/plugin\/)/u.test(file),
    "Target product source must use the canonical artifact-model, target-ast, printer, and host-owned composition boxes.",
  ),
]);

export function targetLayerPrefix(pathPrefix, layer) {
  requireTargetLayer(layer);
  return Object.freeze({
    layer,
    matches: (path) => path.startsWith(pathPrefix),
  });
}

export function targetLayerExact(paths, layer) {
  requireTargetLayer(layer);
  const values = new Set(paths);
  return Object.freeze({
    layer,
    matches: (path) => values.has(path),
  });
}

export function targetLayerPredicate(layer, matches) {
  requireTargetLayer(layer);
  return Object.freeze({ layer, matches });
}

export function targetRootPolicy(pathPrefix, allowed) {
  return Object.freeze({ prefix: pathPrefix, allowed: new Set(allowed) });
}

export function targetForbiddenPackage(prefix, targetName) {
  return Object.freeze({
    prefix,
    ruleId: "ARCH-TARGET-001",
    reason: `${targetName} target source cannot depend on sibling target package '${prefix}'.`,
  });
}

function requireTargetLayer(layer) {
  if (!targetLayerNames.includes(layer)) {
    throw new Error(`Unknown canonical target layer '${layer}'.`);
  }
}

function targetLayerRuleId(layer) {
  if (layer === "public-root" || layer === "public-provider-sdk") {
    return "ARCH-API-001";
  }
  if (layer === "provider-model" || layer === "provider-implementation") {
    return "ARCH-PROVIDER-001";
  }
  if (layer === "policy" || layer === "source" || layer === "target-model") {
    return "ARCH-POLICY-001";
  }
  if (layer === "analysis") {
    return "ARCH-ANALYSIS-001";
  }
  if (layer === "printer" || layer === "emission") {
    return "ARCH-PRINTER-001";
  }
  if (layer === "planner") {
    return "ARCH-PLANNER-001";
  }
  if (layer === "toolchain") {
    return "ARCH-TOOLCHAIN-001";
  }
  return "ARCH-TARGET-001";
}

function sourceRule(ruleId, matches, reason) {
  return Object.freeze({ ruleId, matches, reason });
}
