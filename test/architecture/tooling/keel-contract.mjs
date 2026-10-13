import { keelDigest } from "./keel-source-analysis.mjs";

export const keelCheckIds = Object.freeze(Array.from({ length: 12 }, (_unused, index) => `AC${index + 1}`));
export const keelTargetNames = Object.freeze(["tsonic-csharp", "tsonic-rust"]);
export const keelRoles = Object.freeze([
  "selection", "analysis", "syntax", "sealed-reader", "planner-invariant",
  "vocabulary", "orchestration",
]);

export const keelSkeletonFamilies = Object.freeze({
  source: ["extension", "profiles"],
  providers: ["builtins", "model", "runtime", "packages", "native"],
  "providers/native": ["model", "acquisition", "projection", "relations"],
  "target-model": ["configuration", "conversions", "identities", "metadata", "names", "operations", "project", "syntax", "records", "types"],
  policy: ["model", "identities", "constraints", "conversions", "ownership", "operations", "types"],
  "policy/operations": ["collections", "control-flow", "flow", "iteration", "js-values", "members", "numeric", "operators", "pointers", "resources", "safety", "source-profiles", "strings", "syntax", "typed-locations"],
  "policy/types": ["callables", "collections", "model", "objects", "project", "resolution", "storage"],
  analysis: ["program", "callables", "control-flow", "conversions", "declarations", "expected-types", "module-initialization", "names", "numeric", "objects", "operations", "project-types", "safety", "source-modules", "storage", "project", "source-evidence"],
  backend: ["planner", "target-ast", "artifact-model", "emission"],
  "backend/planner": ["artifacts", "bindings", "declarations", "expressions", "names", "objects", "program", "project", "safety", "statements", "types"],
  "backend/target-ast": ["syntax", "normalization"],
  print: ["project", "source"],
});

export const keelRootFamilies = Object.freeze([
  "public", "descriptor", "options", "compilation", "toolchain",
  "source", "providers", "target-model", "policy", "analysis", "backend", "print",
]);

export const keelNativeDifferences = Object.freeze([
  { path: "analysis/attributes", target: "tsonic-csharp", reason: "CLR custom attributes", evidence: "Keel §4.7" },
  { path: "target-model/lifetimes", target: "tsonic-rust", reason: "Rust lifetime vocabulary", evidence: "Keel §4.7" },
  { path: "analysis/ownership", target: "tsonic-rust", reason: "Native borrow checking", evidence: "Keel §4.7" },
  { path: "target-model/foundation", target: "tsonic-rust", reason: "core/alloc/std vocabulary", evidence: "Keel §4.7" },
  { path: "analysis/foundation", target: "tsonic-rust", reason: "core/alloc/std demand", evidence: "Keel §4.7" },
  { path: "backend/planner/foundation", target: "tsonic-rust", reason: "Native foundation imports", evidence: "Keel §4.7" },
  { path: "analysis/errors", target: "tsonic-rust", reason: "Native Result transport", evidence: "Keel §4.7" },
  { path: "analysis/reachability", target: "tsonic-rust", reason: "Native generated-item reachability", evidence: "Keel §4.7" },
]);

export const keelStorageStages = Object.freeze(["model", "graph", "scoped", "transport"]);

export function keelLayer(file) {
  if (!file.startsWith("src/")) return undefined;
  const suffix = file.slice(4);
  for (const candidate of ["backend/planner", "backend/target-ast", "backend/artifact-model", "backend/emission"]) {
    if (suffix.startsWith(`${candidate}/`)) return candidate;
  }
  const root = suffix.split("/")[0];
  return ["source", "providers", "target-model", "policy", "analysis", "print"].includes(root) ? root : undefined;
}

export function keelFinding(check, repo, file, subject, reason, evidence = {}) {
  if (!keelCheckIds.includes(check)) throw new Error(`Unknown Keel check '${check}'.`);
  const identity = { check, repo, file, subject, reason, evidence };
  return Object.freeze({ ...identity, id: keelDigest(JSON.stringify(identity)) });
}

export function sortKeelFindings(findings) {
  return Object.freeze([...findings].sort((left, right) =>
    Number(left.check.slice(2)) - Number(right.check.slice(2)) ||
    left.repo.localeCompare(right.repo) || left.file.localeCompare(right.file) ||
    left.subject.localeCompare(right.subject) || left.id.localeCompare(right.id)));
}

export function validateKeelDifferences(differences) {
  const seen = new Set();
  for (const entry of differences) {
    const key = `${entry.target}:${entry.path}`;
    if (!keelTargetNames.includes(entry.target) || !validPath(entry.path) ||
      typeof entry.reason !== "string" || entry.reason.length === 0 ||
      typeof entry.evidence !== "string" || entry.evidence.length === 0 || seen.has(key)) {
      throw new Error(`Invalid or duplicate native difference '${key}'.`);
    }
    seen.add(key);
  }
}

export function validPath(path) {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") &&
    !path.includes("\\") && !path.split("/").some(part =>
      part === ".." || part === "." || part.length === 0 || /[*?\[\]{}]/u.test(part));
}
