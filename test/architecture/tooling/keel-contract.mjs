import { keelDigest } from "./keel-source-analysis.mjs";

export const keelCheckIds = Object.freeze(Array.from({ length: 12 }, (_unused, index) => `AC${index + 1}`));
export const keelTargetNames = Object.freeze(["tsonic-csharp", "tsonic-rust"]);
export const keelWorkspaceRepositories = Object.freeze([
  "tsonic", "tsonic-csharp", "tsonic-rust", "tsts-legacy",
  "csharp-runtime", "csharp-js", "csharp-nodejs", "rust-runtime", "rust-js", "rust-nodejs",
  "express", "tsumo-rust", "csharp-pudding", "rust-pudding", "tsumo-csharp",
]);
export const keelRoles = Object.freeze([
  "selection", "analysis", "syntax", "sealed-reader", "planner-invariant",
  "vocabulary", "orchestration", "provider-metadata",
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
  { path: "policy/operations/provider-selection", target: "tsonic-rust",
    reason: "Checked native operation/export identity rows from rustdoc correspond to CLR member-relation selection in C# policy/operations/members/selection; both targets keep this decision in policy.",
    evidence: "C399; tsonic-rust/src/policy/operations/provider-selection.ts:28,37,62; tsonic-csharp/src/policy/operations/members/selection/call-selection.ts:68,property-selection.ts:60,element-selection.ts:63,value-selection.ts:21" },
  { path: "providers/native/model/normalization", target: "tsonic-rust", tree: "test",
    reason: "Rust's raw rustdoc owner tests normalize trait defaults, associated types and impl generic arguments; C# validates a structured CLR model with provider contract tests. Both current source owners are providers/native/model/normalization after CH15; this test-only native-input difference cannot excuse source asymmetry.",
    evidence: "C399/C401; Rust test/providers/native/model/normalization/default-methods.test.mjs:1,implementation-bindings.test.mjs:1 and src/providers/native/model/rustdoc-schema.ts:13; C# CH15 b7bc297c src/providers/native/model/normalization/entry.ts:10,20 and test/providers/native/projection/declarations/dotnet-provider-contract.test.mjs:1; b4 contract/entry.ts is historical, not a required folder" },
  { path: "providers/native/model", target: "tsonic-rust", tree: "test",
    reason: "Rust model-owner tests exercise raw rustdoc JSON and its native normalization; C# exercises the structured CLR model under native projection/target-binding contract tests rather than fabricating rustdoc fixtures.",
    evidence: "C399/C401; tsonic-rust/test/providers/native/model/normalization/default-methods.test.mjs:1,implementation-bindings.test.mjs:1; tsonic-csharp/test/providers/native/projection/declarations/dotnet-provider-contract.test.mjs:1; source contracts: Rust src/providers/native/model/rustdoc-schema.ts:13 and C# CH15 b7bc297c src/providers/native/model/normalization/entry.ts:10,20" },
  { path: "providers/native/session", target: "tsonic-rust",
    reason: "Rust owns a rustdoc worker, separate Cargo/std registries and snapshot leases with one seal/close lifecycle; C# composes registered CLR data providers and resolves their structured model contract in providers/native/projection/provider.ts on CH15.",
    evidence: "C399/C401/C404; Rust src/providers/native/session.ts:60,69,149,153,163 and acquisition/worker-client.ts:44,124; C# CH15 b7bc297c src/providers/native/projection/provider.ts:117,124,230; b4 native/provider.ts is historical" },
  { path: "analysis/attributes", target: "tsonic-csharp", reason: "CLR custom attributes", evidence: "Keel §4.7" },
  { path: "target-model/lifetimes", target: "tsonic-rust", reason: "Rust lifetime vocabulary", evidence: "Keel §4.7" },
  { path: "analysis/ownership", target: "tsonic-rust", reason: "Native borrow checking", evidence: "Keel §4.7" },
  { path: "target-model/foundation", target: "tsonic-rust", reason: "core/alloc/std vocabulary", evidence: "Keel §4.7" },
  { path: "analysis/foundation", target: "tsonic-rust", reason: "core/alloc/std demand", evidence: "Keel §4.7" },
  { path: "analysis/errors", target: "tsonic-rust", reason: "Native Result transport", evidence: "Keel §4.7" },
  { path: "analysis/reachability", target: "tsonic-rust", reason: "Native generated-item reachability", evidence: "Keel §4.7" },
  { path: "policy/operations/members/abi", target: "tsonic-rust",
    reason: "Rust native call ABI: per-parameter passing modes (owned, shared or mutable borrow), conversion shapes and their validation records for native callees. CLR calls pass arguments by the declared parameter type, selected in C# policy/operations/members/call-arguments.ts; there is no separate ABI layer.",
    evidence: "Claude takeover 2026-10-22; tsonic-rust/src/policy/operations/members/abi/source-modes.ts:3, validation.ts:22,240; tsonic-csharp/src/policy/operations/members/call-arguments.ts:3" },
  { path: "policy/operations/resources", target: "tsonic-csharp",
    reason: "CLR resource disposal: the C# policy selects the IDisposable/IAsyncDisposable disposal operation for using declarations (S11-04, Resources/ResourceStacks.cs). Rust disposal is native Drop plus the completion transport in analysis/errors and control_flow.rs, with no per-construct disposal selection.",
    evidence: "Claude takeover 2026-10-22; tsonic-csharp/src/policy/operations/resources/management.ts:10; docs/architecture/csharp-rust-structure.md S11-04" },
  { path: "backend/planner/objects/polymorphism", target: "tsonic-rust",
    reason: "Rust has no class inheritance: project class hierarchies are planned as traits, forwarders, construction layers and receiver aliases. C# plans native CLR classes and inheritance under backend/planner/declarations/classes.",
    evidence: "Claude takeover 2026-10-22; tsonic-rust/src/backend/planner/objects/polymorphism/traits.ts:33,137, forwarders.ts:33,51; tsonic-csharp/src/backend/planner/declarations/classes/" },
  { path: "analysis/project", target: "tsonic-rust",
    reason: "Rust runtime-reference plans, binary-crate dispatch demand and emission, and binary hooks for the Cargo binary target. The C# runtime project and its references are composed by providers/runtime and compilation/project.ts (C-0485) without a cross-construct project analysis.",
    evidence: "Claude takeover 2026-10-22; tsonic-rust/src/analysis/project/classification.ts:45, binary-dispatch-demand.ts:25; tsonic-csharp/src/compilation/project.ts" },
  { path: "providers/packages/materialization", target: "tsonic-rust",
    reason: "Rust provider packages declare carrier, conversion and operation rows with generic parameters that are materialized into Rust carriers before analysis (C-0477). C# packages contribute CLR assemblies whose members are projected by providers/native/projection.",
    evidence: "Claude takeover 2026-10-22; tsonic-rust/src/providers/packages/materialization/carriers.ts:13,233; tsonic-csharp/src/providers/native/projection/" },
  { path: "fixtures/dotnet-provider", target: "tsonic-csharp", tree: "test",
    reason: "Native provider fixtures are .NET class-library projects compiled to CLR assemblies for reflection acquisition (19 .csproj projects). Rust native provider fixtures are Cargo crates acquired through rustc/rustdoc, under fixtures/crates.",
    evidence: "Claude takeover 2026-10-22; tsonic-csharp/scripts/test/build-dotnet-provider-fixtures.mjs:29,33; tsonic-csharp/test/fixtures/dotnet-provider/attributes/AttributeProviderFixture.csproj; tsonic-rust/test/helpers/rust-session-paths.mjs:7" },
  { path: "fixtures/crates", target: "tsonic-rust", tree: "test",
    reason: "Native provider fixtures are Cargo library crates acquired through rustc/rustdoc (13 Cargo.toml crates). C# native provider fixtures are .NET projects compiled to CLR assemblies, under fixtures/dotnet-provider.",
    evidence: "Claude takeover 2026-10-22; tsonic-rust/test/helpers/rust-session-paths.mjs:7; tsonic-rust/test/fixtures/crates/acme_dispatch/Cargo.toml; tsonic-csharp/scripts/test/build-dotnet-provider-fixtures.mjs:29" },
]);

export const keelNativeContentDifferences = Object.freeze([
  { path: "providers/native/acquisition", reason: ".NET reflection versus rustc/rustdoc acquisition", evidence: "Keel §4.7" },
  { path: "backend/target-ast/syntax", reason: "Roslyn-shaped versus Rust-native syntax", evidence: "Keel §4.7" },
]);

export const keelRemovedResponsibilities = Object.freeze([
  "analysis/facts", "analysis/expressions", "analysis/operations/provider", "analysis/resources", "analysis/runtime",
  "backend/planner/liveness", "backend/target-ast/inspection", "target-model/facts",
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
      entry.tree !== undefined && entry.tree !== "src" && entry.tree !== "test" ||
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
