export const sharedLayerRules = Object.freeze([
  prefix("packages/target-api/src/", "target-api"),
  prefix("packages/source-core/src/", "source-core"),
  prefix("packages/js-source-profile/src/", "js-source-profile"),
  prefix("packages/host/src/", "host"),
  prefix("packages/cli/src/", "cli"),
  prefix("packages/create-tsonic/src/", "project-creator"),
]);

export const sharedLayerPolicies = Object.freeze([
  policy("target-api", [], "ARCH-SHARED-001", "The shared target API is the lowest Tsonic host contract and cannot depend on higher shared packages."),
  policy("source-core", ["target-api"], "ARCH-SHARED-001", "Portable source-core semantics may depend on the shared target API only."),
  policy("js-source-profile", ["source-core"], "ARCH-SHARED-001", "Canonical JavaScript source declarations and identities may consume shared source-core services but cannot depend on host or target packages."),
  policy("host", ["target-api", "source-core"], "ARCH-SHARED-001", "Host orchestration may consume shared contracts and source-core, not the CLI."),
  policy("cli", ["target-api", "source-core", "host"], "ARCH-SHARED-001", "The CLI composes host services but cannot become a lower-layer dependency."),
  policy("project-creator", [], "ARCH-SHARED-001", "The generic project creator may load an installed target contract dynamically but cannot statically depend on host or target implementation packages."),
]);

export const sharedPackageLayers = Object.freeze([
  Object.freeze({ prefix: "@tsonic/target-api", layer: "target-api" }),
  Object.freeze({ prefix: "@tsonic/source-core", layer: "source-core" }),
  Object.freeze({ prefix: "@tsonic/js-source-profile", layer: "js-source-profile" }),
  Object.freeze({ prefix: "@tsonic/host", layer: "host" }),
  Object.freeze({ prefix: "@tsonic/cli", layer: "cli" }),
]);

export const sharedForbiddenPackages = Object.freeze([
  "@tsonic/target-csharp",
  "@tsonic/target-rust",
  "@tsonic/target-python",
  "@tsonic/target-gpu",
  "@tsonic/csharp-runtime",
  "@tsonic/csharp-js",
  "@tsonic/csharp-nodejs",
  "@tsonic/rust-runtime",
  "@tsonic/rust-js",
  "@tsonic/rust-nodejs",
].map((prefixValue) => Object.freeze({
  prefix: prefixValue,
  ruleId: "ARCH-SHARED-001",
  reason: `Shared Tsonic source cannot depend on target-specific package '${prefixValue}'.`,
})));

export const sharedRootPolicies = Object.freeze([
  root("packages/create-tsonic/src/", [
    "packages/create-tsonic/src/index.ts",
    "packages/create-tsonic/src/run.ts",
    "packages/create-tsonic/src/scaffold.ts",
  ]),
  root("packages/cli/src/", [
    "packages/cli/src/index.ts",
    "packages/cli/src/output-publication.ts",
  ]),
  root("packages/host/src/", [
    "packages/host/src/build.ts",
    "packages/host/src/compiler-session.ts",
    "packages/host/src/declaration-package-inputs.ts",
    "packages/host/src/diagnostics.ts",
    "packages/host/src/index.ts",
    "packages/host/src/package-contract.ts",
    "packages/host/src/path-relation.ts",
    "packages/host/src/program-options.ts",
    "packages/host/src/project-config.ts",
    "packages/host/src/project-paths.ts",
    "packages/host/src/source-package-inputs.ts",
  ]),
  root("packages/source-core/src/", [
    "packages/source-core/src/identity.ts",
  ]),
  root("packages/js-source-profile/src/", [
    "packages/js-source-profile/src/index.ts",
    "packages/js-source-profile/src/type-library-contract.ts",
  ]),
  root("packages/target-api/src/", [
    "packages/target-api/src/artifacts.ts",
    "packages/target-api/src/config.ts",
    "packages/target-api/src/module-reference.ts",
    "packages/target-api/src/registry.ts",
    "packages/target-api/src/source-profile.ts",
    "packages/target-api/src/typescript-no-lib-utilities.ts",
  ]),
]);

export const sharedAllowedImplementationIndexes = new Set([
  "packages/cli/src/index.ts",
  "packages/create-tsonic/src/index.ts",
  "packages/js-source-profile/src/index.ts",
]);

export const sharedForbiddenDirectories = Object.freeze([
  "common",
  "helpers",
  "misc",
  "translate",
  "utils",
]);

function prefix(pathPrefix, layer) {
  return Object.freeze({
    layer,
    matches: (path) => path.startsWith(pathPrefix),
  });
}

function policy(source, allowed, ruleId, reason) {
  return Object.freeze({ source, allowed: new Set(allowed), ruleId, reason });
}

function root(prefixValue, allowed) {
  return Object.freeze({ prefix: prefixValue, allowed: new Set(allowed) });
}
