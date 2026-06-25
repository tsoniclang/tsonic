export const oldProductUnitStatuses = Object.freeze([
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
]);

export const oldProductUnitCapabilityMappingStatuses = Object.freeze([
  "reviewed",
  "deferred-derived",
]);

export const oldProductUnitFeatureAreas = Object.freeze([
  "cli",
  "host-config",
  "package-model",
  "frontend",
  "source-semantics",
  "surface-provider",
  "target-provider",
  "csharp-backend",
  "toolchain",
  "diagnostic",
]);

export const oldProductUnitReportCountKeys = Object.freeze([
  "total",
  "ported",
  "replaced-by-stronger-test",
  "invalid-stale-architecture",
  "deferred",
  "unclassified",
]);

const oldProductUnitHistoricalTestFileTuples = Object.freeze([
  ["packages/cli/src/cli/parser.test.ts", 52],
  ["packages/cli/src/commands/add-common.test.ts", 9],
  ["packages/cli/src/commands/add-common/generated-bindings.test.ts", 1],
  ["packages/cli/src/commands/add-deps.test.ts", 5],
  ["packages/cli/src/commands/add-npm-cases/package-manifest-transitive.test.ts", 2],
  ["packages/cli/src/commands/add-npm-cases/package-manifest.test.ts", 6],
  ["packages/cli/src/commands/add-npm.test.ts", 0],
  ["packages/cli/src/commands/build-cases/local-package-ownership.test.ts", 5],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-1.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-2.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-3.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-2.test.ts", 3],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-4.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-1.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-2.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-5.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-2.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-3.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-6.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-2.test.ts", 4],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-3.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-7.test.ts", 0],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-1.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-2.test.ts", 2],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-3.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-4.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8-cases/part-5.test.ts", 1],
  ["packages/cli/src/commands/build-cases/native-library-port-regressions-8.test.ts", 0],
  ["packages/cli/src/commands/build-cases/ref-dirs.test.ts", 5],
  ["packages/cli/src/commands/build-native-lib.test.ts", 1],
  ["packages/cli/src/commands/build-no-generate.test.ts", 1],
  ["packages/cli/src/commands/build-source-package.test.ts", 3],
  ["packages/cli/src/commands/build.test.ts", 0],
  ["packages/cli/src/commands/init.test.ts", 12],
  ["packages/cli/src/commands/restore-cases/external-types.test.ts", 2],
  ["packages/cli/src/commands/restore-cases/nuget-bindings.test.ts", 3],
  ["packages/cli/src/commands/restore-cases/runtime-dlls.test.ts", 4],
  ["packages/cli/src/commands/restore.test.ts", 0],
  ["packages/cli/src/commands/run-build-regressions.test.ts", 3],
  ["packages/cli/src/commands/test-command.test.ts", 1],
  ["packages/cli/src/config-cases/resolve-basics.test.ts", 13],
  ["packages/cli/src/config-cases/resolve-output-options.test.ts", 18],
  ["packages/cli/src/config-cases/resolve-surfaces.test.ts", 6],
  ["packages/cli/src/config.test.ts", 0],
  ["packages/cli/src/dotnet/nuget-config.test.ts", 3],
  ["packages/cli/src/package-manifests/bindings-cases/discovery-and-overlay.test.ts", 7],
  ["packages/cli/src/package-manifests/bindings-cases/manifest-resolution.test.ts", 8],
  ["packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts", 5],
  ["packages/cli/src/package-manifests/bindings.test.ts", 0],
  ["packages/cli/src/surface/profiles.test.ts", 15],
  ["packages/cli/src/test-cli-bin.test.ts", 1],
  ["packages/frontend/src/lowering/plan-builders.test.ts", 19],
  ["packages/frontend/src/program/creation-cases/authoritative-type-roots.test.ts", 3],
  ["packages/frontend/src/program/creation-cases/core-type-checking.test.ts", 3],
  ["packages/frontend/src/program/creation-cases/module-bindings.test.ts", 8],
  ["packages/frontend/src/program/creation-cases/package-resolution.test.ts", 5],
  ["packages/frontend/src/program/creation-cases/tsts-source-program.test.ts", 3],
  ["packages/frontend/src/program/creation.test.ts", 0],
  ["packages/frontend/src/program/entrypoint-scope.test.ts", 2],
  ["packages/frontend/src/program/package-roots.test.ts", 8],
  ["packages/frontend/src/program/program-input-discovery.test.ts", 13],
  ["packages/frontend/src/resolver/namespace.test.ts", 9],
  ["packages/frontend/src/source-frontend/source-semantic-boundary.test.ts", 25],
  ["packages/frontend/src/source-frontend/tsts-source-program.test.ts", 4],
  ["packages/frontend/src/surface/profiles.test.ts", 14],
  ["packages/frontend/src/tsonic-extension/numeric-primitives.test.ts", 2],
  ["packages/frontend/src/tsonic-extension/source-semantics.test.ts", 27],
  ["packages/frontend/src/types/diagnostic.test.ts", 10],
  ["packages/frontend/src/types/result.test.ts", 15],
  ["packages/frontend/src/validator-cases/any-and-object-literals.test.ts", 28],
  ["packages/frontend/src/validator-cases/generic-validation.test.ts", 20],
  ["packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts", 24],
  ["packages/frontend/src/validator-cases/utility-types.test.ts", 29],
  ["packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts", 6],
  ["packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts", 1],
  ["packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts", 4],
  ["packages/frontend/src/validator-maximus-cases/feature-gating.test.ts", 2],
  ["packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts", 2],
  ["packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts", 5],
  ["packages/frontend/src/validator-maximus-cases/type-syntax.test.ts", 3],
  ["packages/frontend/src/validator.maximus.test.ts", 0],
  ["packages/frontend/src/validator.test.ts", 0],
  ["packages/targets/csharp/backend/src/dotnet.test.ts", 2],
  ["packages/targets/csharp/backend/src/program-generator.test.ts", 3],
  ["packages/targets/csharp/backend/src/project-generator.test.ts", 9],
  ["packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts", 3],
  ["packages/targets/csharp/emitter/src/rendering/expressions.test.ts", 23],
  ["packages/targets/csharp/emitter/src/rendering/external-bindings.test.ts", 2],
  ["packages/targets/csharp/emitter/src/rendering/module.test.ts", 17],
  ["packages/targets/csharp/emitter/src/rendering/statements.test.ts", 3],
]);

export const oldProductUnitHistoricalTestFiles = Object.freeze(
  oldProductUnitHistoricalTestFileTuples.map(([oldPath]) => oldPath),
);

const oldProductUnitStaleProofByOldPath = new Map([
  ...reviewedOldProductUnitStaleMappings([
    "packages/cli/src/commands/add-deps.test.ts",
    "packages/cli/src/commands/add-npm-cases/package-manifest-transitive.test.ts",
    "packages/cli/src/commands/add-npm-cases/package-manifest.test.ts",
    "packages/cli/src/commands/add-npm.test.ts",
    "packages/cli/src/commands/restore-cases/external-types.test.ts",
    "packages/cli/src/commands/restore-cases/runtime-dlls.test.ts",
    "packages/cli/src/commands/restore.test.ts",
  ], [
    "host.package.composition",
    "host.project.package-discovery",
    "provider.module.missing-provider-diagnostic",
    "provider.module.no-file-backed-fallback",
    "provider.module.virtual-import",
    "provider.virtual-module.no-fallback",
    "provider.virtual-module.ownership",
  ],
  "Old add/restore package tests targeted generated package manifests and dependency install side effects. Current proof is host.package.composition plus host.project.package-discovery selecting provider-owned virtual imports; provider.module.missing-provider-diagnostic and provider.virtual-module.no-fallback fail closed instead of falling back to legacy package-root or generated declaration files."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/cli/src/commands/restore-cases/nuget-bindings.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/discovery-and-overlay.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/manifest-resolution.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts",
    "packages/cli/src/package-manifests/bindings.test.ts",
  ], [
    "host.package.composition",
    "host.project.package-discovery",
    "provider.module.no-file-backed-fallback",
    "provider.module.virtual-import",
    "provider.virtual-module.no-fallback",
    "provider.virtual-module.ownership",
    "provider.virtual-module.target-identity",
  ],
  "Old binding-file manifest tests treated generated bindings and overlay metadata as semantic input. Current proof is provider-owned virtual imports with explicit target identity, host.package.composition, provider.module.no-file-backed-fallback, and provider.virtual-module.no-fallback so missing provider facts are diagnostics rather than file-backed fallback semantics."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/lowering/plan-builders.test.ts",
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.csharp.project-sdk-emit",
    "backend.fail-closed-facts",
    "tsts.consumer-queries",
    "tsts.parse-bind-check",
  ],
  "Old frontend lowering plan-builder tests targeted a pre-provider lowering layer. Current proof is TSTS parse/bind/check plus stable consumer queries feeding finalized facts to the C# AST/project emitters; backend.fail-closed-facts rejects missing facts instead of re-inferring semantics in the backend."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
    "packages/frontend/src/validator-maximus-cases/dictionary-and-object-literal.test.ts",
  ], [
    "backend.fail-closed-facts",
    "carrier.object-shape",
    "compat.any.dynamic-get",
    "compat.object.no-dynamic-access",
    "expression.object-literal",
    "tsts.consumer-queries",
    "tsts.parse-bind-check",
  ],
  "Old validator object/any tests encoded frontend-era dynamic compatibility assumptions. Current proof is TSTS-owned checking plus explicit object-shape and compat carrier capabilities; backend.fail-closed-facts and compat.object.no-dynamic-access prevent object/any fallback unless compat.any.dynamic-get is an explicit capability."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-cases/generic-validation.test.ts",
    "packages/frontend/src/validator-maximus-cases/generic-function-values.test.ts",
  ], [
    "backend.fail-closed-facts",
    "diagnostic.ts-invalid-not-rescued",
    "tsts.consumer-queries",
    "tsts.generic-inference",
    "tsts.parse-bind-check",
    "type.generic.provider-target-arguments",
  ],
  "Old generic validator tests relied on a frontend validator deciding target generic behavior. Current proof is TSTS generic inference exposed through consumer queries, then provider target type-argument facts; backend.fail-closed-facts rejects calls without finalized type.generic.provider-target-arguments."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-cases/parameters-and-dict-keys.test.ts",
    "packages/frontend/src/validator-maximus-cases/deterministic-typing.test.ts",
    "packages/frontend/src/validator-maximus-cases/feature-gating.test.ts",
    "packages/frontend/src/validator.maximus.test.ts",
    "packages/frontend/src/validator.test.ts",
  ], [
    "backend.fail-closed-facts",
    "diagnostic.ts-invalid-not-rescued",
    "tsts.consumer-queries",
    "tsts.no-target-overrides",
    "tsts.parse-bind-check",
  ],
  "Old validator aggregate tests are stale as architecture because they made the frontend validator the source of target legality. Current proof is TSTS parse/bind/check, no target override rescue for invalid TypeScript, stable consumer queries for facts, and backend.fail-closed-facts for target-specific blockers."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-cases/utility-types.test.ts",
  ], [
    "backend.fail-closed-facts",
    "tsts.consumer-queries",
    "tsts.parse-bind-check",
    "type.utility",
  ],
  "Old utility-type validator tests targeted frontend-owned target lowering of TypeScript utility types. Current proof treats utility types as TSTS-owned erased type facts exposed through consumer queries; backend.fail-closed-facts prevents backend reconstruction of utility semantics."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
  ], [
    "backend.fail-closed-facts",
    "carrier.array",
    "expression.literal.string-number-boolean",
    "operation.array.literal",
    "tsts.consumer-queries",
    "tsts.parse-bind-check",
  ],
  "Old array/literal validator tests mixed source inference with target carrier decisions in frontend validation. Current proof keeps TSTS parse/check and literal facts separate from provider-selected array carriers; operation.array.literal and backend.fail-closed-facts control target emission."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-maximus-cases/json-static-safety.test.ts",
  ], [
    "backend.fail-closed-facts",
    "runtime.no-reflection-semantics",
    "surface.js.math-json-regexp",
    "tsts.consumer-queries",
    "tsts.parse-bind-check",
  ],
  "Old JSON static-safety validator tests predated the no-reflection runtime contract. Current proof is TSTS-owned source checking plus selected JS surface JSON facts and runtime.no-reflection-semantics; backend.fail-closed-facts prevents generated reflection or metadata fallback."),
  ...reviewedOldProductUnitStaleMappings([
    "packages/frontend/src/validator-maximus-cases/type-syntax.test.ts",
  ], [
    "backend.fail-closed-facts",
    "diagnostic.ts-invalid-not-rescued",
    "tsts.no-target-overrides",
    "tsts.parse-bind-check",
  ],
  "Old type-syntax validator tests made extension validation part of TypeScript legality. Current proof is TSTS parse/bind/check plus tsts.no-target-overrides and diagnostic.ts-invalid-not-rescued, so target extensions cannot rescue or reinterpret invalid TypeScript syntax."),
]);

const oldProductUnitOldEvidenceRole = "regression-evidence-only";

const oldProductUnitPortedProofByOldPath = new Map([
  ["packages/cli/src/cli/parser.test.ts", Object.freeze({
    capabilityIds: freezeSortedStrings([
      "host.config.project-load",
      "host.package.composition",
    ]),
    newPath: "test/cli-build/target-config.test.mjs",
    reason:
      "Ported to current CLI command-contract tests: help, targets, build, unknown-command rejection, missing --project value diagnostics, and default tsonic.json project loading. Legacy add/restore/test-command breadth is intentionally not resurrected.",
  })],
  ["packages/cli/src/config.test.ts", Object.freeze({
    capabilityIds: freezeSortedStrings([
      "host.config.project-load",
      "host.config.target-selection",
      "host.project.target-selection",
    ]),
    newPath: "test/cli-build/target-config.test.mjs",
    reason:
      "Ported to current strict tsonic.json config tests: entryPoint/rootDir/outDir/targets are accepted, legacy output/rootNamespace/target-level namespace and TypeScript path-mapping fields are rejected, and target options are delegated to the selected target pack.",
  })],
  ["packages/cli/src/config-cases/resolve-basics.test.ts", Object.freeze({
    capabilityIds: freezeSortedStrings([
      "host.config.project-load",
      "host.config.target-selection",
      "host.project.target-selection",
    ]),
    newPath: "test/cli-build/target-config.test.mjs",
    reason:
      "Ported to current target-selection tests: missing/unknown/duplicate target ids and unsupported target fields are diagnosed before compiler or backend work starts.",
  })],
  ["packages/cli/src/config-cases/resolve-surfaces.test.ts", Object.freeze({
    capabilityIds: freezeSortedStrings([
      "host.config.surface-selection",
      "host.project.surface-extension-composition",
      "host.project.surface-selection",
      "runtime.csharp.js",
      "surface.js.array-methods",
    ]),
    newPath: "test/cli/surface-composition.test.mjs",
    reason:
      "Ported to current surface-selection tests: selected target-owned surfaces compose provider/surface extensions and runtime artifacts, while unknown, duplicate, missing-dependency, stale, and unselected surfaces fail closed.",
  })],
]);

const oldProductUnitReviewedDeferredCapabilityIdsByOldPath = new Map([
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/cli/src/commands/build.test.ts",
  ], [
    "backend.csharp.project-sdk-emit",
    "host.config.project-load",
    "host.package.composition",
    "host.project.provider-composition",
    "toolchain.csharp.build-run",
  ]),
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/cli/src/surface/profiles.test.ts",
  ], [
    "host.config.surface-selection",
    "host.project.surface-extension-composition",
    "host.project.surface-selection",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.console",
    "surface.node.fs-path-process",
  ]),
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/frontend/src/surface/profiles.test.ts",
  ], [
    "host.config.surface-selection",
    "host.project.surface-extension-composition",
    "host.project.surface-selection",
    "runtime.csharp.js",
    "surface.js.array-methods",
    "surface.js.console",
    "surface.node.fs-path-process",
  ]),
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
  ], [
    "source-core.target-alias-consumption",
    "source.marker.attribute",
    "source.marker.out-ref-inref",
    "source.primitive.configured-type",
    "source.primitive.numeric",
    "tsts.no-target-overrides",
  ]),
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
  ], [
    "source-core.lang.portable-intrinsics",
    "source-core.lang.portable-intrinsics.attribute",
    "source-core.lang.portable-intrinsics.field",
    "source-core.lang.portable-intrinsics.inref",
    "source-core.lang.portable-intrinsics.out",
    "source-core.lang.portable-intrinsics.ref",
    "source-core.module.single-owner",
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source-core.target-alias-consumption",
    "source.marker.attribute",
    "source.marker.field",
    "source.marker.out-ref-inref",
    "source.primitive.configured-type",
    "source.primitive.numeric",
    "target.csharp.core-lang-intrinsics",
    "tsts.no-target-overrides",
  ]),
  ...reviewedOldProductUnitDeferredCapabilityMapping([
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
  ], [
    "backend.ast.only",
    "backend.csharp.ast-expression",
    "backend.csharp.ast-statement",
    "backend.csharp.no-direct-semantic-string-output",
    "backend.csharp.printer",
    "backend.no-semantic-strings",
  ]),
]);

const oldProductUnitLedgerEvidenceCapabilityIdsByOldPath = new Map([
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/targets/csharp/emitter/src/rendering/architecture-boundary.test.ts",
  ], [
    "backend.csharp.ast-statement",
    "backend.csharp.printer",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/cli/src/commands/restore-cases/runtime-dlls.test.ts",
    "packages/cli/src/package-manifests/bindings-cases/runtime-overrides-and-validation.test.ts",
  ], [
    "backend.csharp.runtime-artifacts",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/frontend/src/validator-cases/any-and-object-literals.test.ts",
  ], [
    "carrier.any-tsvalue",
    "compat.any.call-construct",
    "compat.any.dynamic-set",
    "compat.any.property",
    "compat.any.typed-boundary-cast",
    "compat.mode.compat",
    "compat.mode.strict-native",
    "compat.prototype-mutation",
    "compat.proxy-eval-function-with",
    "diagnostic.dynamic-strict-mode",
    "diagnostic.missing-target-fact",
    "diagnostic.strict-mode-slow-op",
    "runtime.dynamic.carrier",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/cli/src/commands/restore.test.ts",
  ], [
    "diagnostic.missing-provider-fact",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/cli/src/package-manifests/bindings.test.ts",
  ], [
    "diagnostic.missing-provider-fact",
    "provider.virtual-module.source-shape",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/frontend/src/lowering/plan-builders.test.ts",
    "packages/frontend/src/validator-maximus-cases/feature-gating.test.ts",
  ], [
    "diagnostic.missing-target-fact",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/frontend/src/validator-maximus-cases/array-and-literal-inference.test.ts",
  ], [
    "expression.literal.bigint-regex-template",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/frontend/src/tsonic-extension/source-semantics.test.ts",
  ], [
    "source-core.lang.portable-intrinsics",
    "source-core.lang.portable-intrinsics.attribute",
    "source-core.lang.portable-intrinsics.field",
    "source-core.lang.portable-intrinsics.inref",
    "source-core.lang.portable-intrinsics.out",
    "source-core.lang.portable-intrinsics.ref",
    "source-core.module.single-owner",
    "source-core.out.storage-binding",
    "source-core.ref.parameter-mode",
    "source-core.target-alias-consumption",
    "source.marker.field",
    "source.primitive.configured-type",
    "target.csharp.core-lang-intrinsics",
  ]),
  ...oldProductUnitLedgerEvidenceCapabilityMapping([
    "packages/frontend/src/tsonic-extension/numeric-primitives.test.ts",
  ], [
    "source-core.target-alias-consumption",
    "source.primitive.configured-type",
  ]),
]);

export const oldProductUnitPortInventory = Object.freeze(
  oldProductUnitHistoricalTestFileTuples.map(([oldPath, testDeclarations]) => withOldProductUnitCapabilityProof(oldPath, testDeclarations)),
);

const oldProductUnitStatusSet = new Set(oldProductUnitStatuses);
const oldProductUnitCapabilityMappingStatusSet = new Set(oldProductUnitCapabilityMappingStatuses);
const oldProductUnitFeatureAreaSet = new Set(oldProductUnitFeatureAreas);

function freezeSortedStrings(values) {
  return Object.freeze([...new Set(values)].sort());
}

function reviewedOldProductUnitStaleMappings(oldPaths, replacementCapabilityIds, replacementCapabilityPath) {
  const frozenReplacementCapabilityIds = freezeSortedStrings(replacementCapabilityIds);
  const proof = Object.freeze({
    capabilityIds: frozenReplacementCapabilityIds,
    replacementCapabilityIds: frozenReplacementCapabilityIds,
    replacementCapabilityPath,
  });

  return oldPaths.map((oldPath) => [oldPath, proof]);
}

function reviewedOldProductUnitDeferredCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldProductUnitLedgerEvidenceCapabilityMapping(oldPaths, capabilityIds) {
  const frozenCapabilityIds = freezeSortedStrings(capabilityIds);
  return oldPaths.map((oldPath) => [oldPath, frozenCapabilityIds]);
}

function oldProductUnitCapabilityIdsWithLedgerEvidence(oldPath, capabilityIds) {
  const ledgerEvidenceCapabilityIds = oldProductUnitLedgerEvidenceCapabilityIdsByOldPath.get(oldPath);
  if (ledgerEvidenceCapabilityIds === undefined) {
    return capabilityIds;
  }

  return freezeSortedStrings([...capabilityIds, ...ledgerEvidenceCapabilityIds]);
}

function withOldProductUnitCapabilityProof(oldPath, testDeclarations) {
  const status = oldProductUnitStatusFor(oldPath);
  const staleProof = status === "invalid-stale-architecture"
    ? oldProductUnitStaleProofFor(oldPath)
    : undefined;
  const portedProof = status === "ported"
    ? oldProductUnitPortedProofFor(oldPath)
    : undefined;
  const reviewedDeferredCapabilityIds = oldProductUnitReviewedDeferredCapabilityIdsByOldPath.get(oldPath);

  return Object.freeze({
    oldPath,
    testDeclarations,
    status,
    featureArea: oldProductUnitFeatureAreaFor(oldPath),
    owner: oldProductUnitOwnerFor(oldPath),
    oldEvidenceRole: oldProductUnitOldEvidenceRole,
    capabilityMappingStatus: staleProof !== undefined || portedProof !== undefined || reviewedDeferredCapabilityIds !== undefined
      ? "reviewed"
      : "deferred-derived",
    capabilityIds: oldProductUnitCapabilityIdsWithLedgerEvidence(
      oldPath,
      staleProof?.capabilityIds ??
        portedProof?.capabilityIds ??
        reviewedDeferredCapabilityIds ??
        freezeSortedStrings(oldProductUnitCapabilityIdsFor(oldPath)),
    ),
    ...(portedProof?.newPath === undefined ? {} : { newPath: portedProof.newPath }),
    reason: oldProductUnitReasonFor(oldPath),
    ...(staleProof === undefined ? {} : {
      replacementCapabilityIds: staleProof.replacementCapabilityIds,
      replacementCapabilityPath: staleProof.replacementCapabilityPath,
    }),
  });
}

function oldProductUnitPortedProofFor(oldPath) {
  const portedProof = oldProductUnitPortedProofByOldPath.get(oldPath);
  if (portedProof === undefined) {
    throw new Error(`missing current proof for ported old product unit entry ${oldPath}`);
  }

  return portedProof;
}

function oldProductUnitStaleProofFor(oldPath) {
  const staleProof = oldProductUnitStaleProofByOldPath.get(oldPath);
  if (staleProof === undefined) {
    throw new Error(`missing replacement capability path for stale old product unit entry ${oldPath}`);
  }

  return staleProof;
}

function oldProductUnitStatusFor(oldPath) {
  if (oldProductUnitPortedProofByOldPath.has(oldPath)) {
    return "ported";
  }

  if (
    oldPath.includes("/package-manifests/bindings") ||
    oldPath.includes("/add-npm") ||
    oldPath.includes("/add-deps") ||
    oldPath.includes("/restore") ||
    oldPath.includes("/lowering/") ||
    oldPath.includes("/validator")
  ) {
    return "invalid-stale-architecture";
  }

  return "deferred";
}

function oldProductUnitFeatureAreaFor(oldPath) {
  if (oldPath.includes("/config")) {
    return "host-config";
  }
  if (oldPath.includes("/package-manifests/") || oldPath.includes("/add-") || oldPath.includes("/restore")) {
    return "package-model";
  }
  if (oldPath.includes("/surface/")) {
    return "surface-provider";
  }
  if (oldPath.includes("/tsonic-extension/") || oldPath.includes("/source-frontend/")) {
    return "source-semantics";
  }
  if (oldPath.includes("/program/") || oldPath.includes("/resolver/") || oldPath.includes("/validator") || oldPath.includes("/lowering/")) {
    return "frontend";
  }
  if (oldPath.includes("/targets/csharp/backend/")) {
    return "toolchain";
  }
  if (oldPath.includes("/targets/csharp/emitter/")) {
    return "csharp-backend";
  }
  if (oldPath.includes("/dotnet/")) {
    return "target-provider";
  }
  if (oldPath.includes("/types/")) {
    return "diagnostic";
  }

  return "cli";
}

function oldProductUnitOwnerFor(oldPath) {
  switch (oldProductUnitFeatureAreaFor(oldPath)) {
    case "host-config":
      return "Tsonic host config";
    case "package-model":
      return "provider/package composition";
    case "frontend":
      return "TSTS public API integration";
    case "source-semantics":
      return "source/core provider";
    case "surface-provider":
      return "surface providers";
    case "target-provider":
      return "target provider";
    case "csharp-backend":
      return "C# backend AST";
    case "toolchain":
      return "C# toolchain";
    case "diagnostic":
      return "diagnostics and result model";
    default:
      return "Tsonic CLI";
  }
}

function oldProductUnitCapabilityIdsFor(oldPath) {
  const ids = new Set();
  const featureArea = oldProductUnitFeatureAreaFor(oldPath);

  switch (featureArea) {
    case "host-config":
      ids.add("host.config.project-load");
      ids.add("host.config.target-selection");
      ids.add("host.config.surface-selection");
      ids.add("host.project.target-selection");
      ids.add("host.project.surface-selection");
      break;
    case "package-model":
      ids.add("host.package.composition");
      ids.add("provider.virtual-module.ownership");
      ids.add("provider.virtual-module.no-fallback");
      break;
    case "frontend":
      ids.add("tsts.parse-bind-check");
      ids.add("tsts.consumer-queries");
      ids.add("backend.fail-closed-facts");
      break;
    case "source-semantics":
      ids.add("tsts.no-target-overrides");
      ids.add("source.primitive.numeric");
      ids.add("source.marker.out-ref-inref");
      ids.add("source.marker.attribute");
      break;
    case "surface-provider":
      ids.add("host.config.surface-selection");
      ids.add("host.project.surface-selection");
      ids.add("host.project.surface-extension-composition");
      ids.add("surface.js.console");
      ids.add("surface.node.fs-path-process");
      break;
    case "target-provider":
      ids.add("native.dotnet.assembly-model");
      ids.add("provider.virtual-module.target-identity");
      break;
    case "csharp-backend":
      ids.add("backend.ast.only");
      ids.add("backend.no-semantic-strings");
      ids.add("backend.csharp.no-direct-semantic-string-output");
      ids.add("backend.csharp.ast-expression");
      break;
    case "toolchain":
      ids.add("toolchain.csharp.project");
      ids.add("toolchain.csharp.build-run");
      break;
    case "diagnostic":
      ids.add("diagnostic.source-spans");
      ids.add("diagnostic.evidence");
      break;
    default:
      ids.add("host.config.project-load");
      ids.add("host.package.composition");
  }

  if (oldPath.includes("build")) {
    ids.add("host.project.provider-composition");
    ids.add("toolchain.csharp.build-run");
    ids.add("backend.csharp.project-sdk-emit");
  }
  if (oldPath.includes("native-library") || oldPath.includes("dotnet")) {
    ids.add("native.dotnet.type-model");
    ids.add("operation.call.provider-selected-method");
  }
  if (oldPath.includes("bindings")) {
    ids.add("provider.module.no-file-backed-fallback");
  }
  if (oldPath.includes("surface")) {
    ids.add("surface.js.array-methods");
    ids.add("runtime.csharp.js");
  }
  if (oldPath.includes("any") || oldPath.includes("object-literal")) {
    ids.add("compat.any.dynamic-get");
    ids.add("carrier.object-shape");
  }
  if (oldPath.includes("generic")) {
    ids.add("diagnostic.ts-invalid-not-rescued");
    ids.add("tsts.generic-inference");
    ids.add("type.generic.provider-target-arguments");
  }
  if (oldPath.includes("utility")) {
    ids.add("type.utility");
  }
  if (oldPath.includes("array")) {
    ids.add("carrier.array");
    ids.add("operation.array.literal");
  }

  return [...ids].sort();
}

function oldProductUnitReasonFor(oldPath) {
  const portedProof = oldProductUnitPortedProofByOldPath.get(oldPath);
  if (portedProof !== undefined) {
    return portedProof.reason;
  }

  if (oldProductUnitStatusFor(oldPath) === "invalid-stale-architecture") {
    return "Old unit test targets legacy frontend, package manifest, or binding-file architecture; replacement must be capability-ledger coverage against TSTS/provider/fact boundaries.";
  }

  return "Old product unit test is mandatory regression evidence and remains deferred until the matching capability batch ports it to the current TSTS/provider/backend architecture.";
}

function createOldProductUnitCounts(total) {
  return {
    total,
    ported: 0,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 0,
    deferred: 0,
    unclassified: 0,
  };
}

function createOldProductUnitCapabilityMappingCounts() {
  return {
    reviewed: 0,
    "deferred-derived": 0,
  };
}

function validateOldProductUnitStringArrayField(errors, entry, fieldName) {
  const values = entry[fieldName];
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${fieldName} must be a non-empty array`);
    return false;
  }

  let valuesAreValid = true;
  let previousValue = undefined;
  const seenValues = new Set();
  let isSorted = true;

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${fieldName} must contain non-empty strings`);
      valuesAreValid = false;
      continue;
    }

    if (previousValue !== undefined && previousValue > value) {
      isSorted = false;
    }
    previousValue = value;
    seenValues.add(value);
  }

  if (seenValues.size !== values.length) {
    errors.push(`${fieldName} must not contain duplicate strings`);
    valuesAreValid = false;
  }

  if (!isSorted) {
    errors.push(`${fieldName} must be sorted`);
    valuesAreValid = false;
  }

  return valuesAreValid;
}

export function validateOldProductUnitPortEntry(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }

  const errors = [];

  if (typeof entry.oldPath !== "string" || entry.oldPath.length === 0) {
    errors.push("oldPath must be a non-empty string");
  } else if (!entry.oldPath.startsWith("packages/") || entry.oldPath.startsWith("/")) {
    errors.push("oldPath must be a relative packages/ path");
  }

  if (!Number.isInteger(entry.testDeclarations) || entry.testDeclarations < 0) {
    errors.push("testDeclarations must be a non-negative integer");
  }

  if (entry.newPath !== undefined) {
    if (typeof entry.newPath !== "string" || entry.newPath.length === 0) {
      errors.push("newPath must be a non-empty string when present");
    } else if (entry.newPath.startsWith("/")) {
      errors.push("newPath must be relative when present");
    }
  }

  if (
    (entry.status === "ported" || entry.status === "replaced-by-stronger-test") &&
    (typeof entry.newPath !== "string" || entry.newPath.length === 0)
  ) {
    errors.push("ported and replaced entries must name a current-architecture newPath");
  }

  if (!oldProductUnitStatusSet.has(entry.status)) {
    errors.push(`status must be one of ${oldProductUnitStatuses.join(", ")}`);
  }

  if (!oldProductUnitFeatureAreaSet.has(entry.featureArea)) {
    errors.push(`featureArea must be one of ${oldProductUnitFeatureAreas.join(", ")}`);
  }

  if (entry.oldEvidenceRole !== oldProductUnitOldEvidenceRole) {
    errors.push(`oldEvidenceRole must be ${oldProductUnitOldEvidenceRole}`);
  }

  if (!oldProductUnitCapabilityMappingStatusSet.has(entry.capabilityMappingStatus)) {
    errors.push(`capabilityMappingStatus must be one of ${oldProductUnitCapabilityMappingStatuses.join(", ")}`);
  }

  if (entry.status !== "deferred" && entry.capabilityMappingStatus !== "reviewed") {
    errors.push("ported, replaced, and stale entries must use reviewed capability mappings");
  }

  const capabilityIdsAreValid = validateOldProductUnitStringArrayField(errors, entry, "capabilityIds");

  if (entry.status === "invalid-stale-architecture") {
    const replacementCapabilityIdsAreValid = validateOldProductUnitStringArrayField(errors, entry, "replacementCapabilityIds");
    if (typeof entry.replacementCapabilityPath !== "string" || entry.replacementCapabilityPath.length === 0) {
      errors.push("replacementCapabilityPath must be a non-empty string for stale entries");
    }

    if (capabilityIdsAreValid && replacementCapabilityIdsAreValid) {
      for (const capabilityId of entry.replacementCapabilityIds) {
        if (!entry.capabilityIds.includes(capabilityId)) {
          errors.push("replacementCapabilityIds must be included in capabilityIds");
          break;
        }
      }
    }
  } else {
    if (entry.replacementCapabilityIds !== undefined) {
      errors.push("replacementCapabilityIds is only valid for stale entries");
    }
    if (entry.replacementCapabilityPath !== undefined) {
      errors.push("replacementCapabilityPath is only valid for stale entries");
    }
  }

  if (typeof entry.owner !== "string" || entry.owner.length === 0) {
    errors.push("owner must be a non-empty string");
  }

  if (typeof entry.reason !== "string" || entry.reason.length === 0) {
    errors.push("reason must be a non-empty string");
  }

  return errors;
}

export function buildOldProductUnitInventoryReport(historicalOldPaths, inventoryEntries = oldProductUnitPortInventory) {
  const historicalPaths = [...new Set(historicalOldPaths)].sort();
  const historicalPathSet = new Set(historicalPaths);
  const classifiedOldPathSet = new Set();
  const classifiedUnknownOldPathSet = new Set();
  const counts = createOldProductUnitCounts(historicalPaths.length);
  const capabilityMappingCounts = createOldProductUnitCapabilityMappingCounts();
  const validationProofHoles = [];

  for (const entry of inventoryEntries) {
    validationProofHoles.push(...oldProductUnitInventoryValidationProofHoles(entry));

    if (!historicalPathSet.has(entry.oldPath)) {
      classifiedUnknownOldPathSet.add(entry.oldPath);
      continue;
    }

    if (classifiedOldPathSet.has(entry.oldPath)) {
      continue;
    }

    counts[entry.status] += 1;
    if (Object.hasOwn(capabilityMappingCounts, entry.capabilityMappingStatus)) {
      capabilityMappingCounts[entry.capabilityMappingStatus] += 1;
    }
    classifiedOldPathSet.add(entry.oldPath);
  }

  const unclassifiedOldPaths = historicalPaths.filter((oldPath) => !classifiedOldPathSet.has(oldPath));
  counts.unclassified = unclassifiedOldPaths.length;
  const proofHoles = oldProductUnitInventoryProofHoles(
    unclassifiedOldPaths,
    classifiedUnknownOldPathSet,
    validationProofHoles,
  );

  return Object.freeze({
    rules: Object.freeze({
      unclassifiedOldInventoryIsImpossible: true,
      classifiedInventoryPathsMustBeHistorical: true,
      entriesMustPassValidation: true,
      entriesRequireExplicitCapabilityIds: true,
      staleEntriesRequireReplacementCapabilities: true,
    }),
    classificationStatus: proofHoles.length === 0 ? "complete" : "hole",
    counts: Object.freeze(counts),
    capabilityMappingCounts: Object.freeze(capabilityMappingCounts),
    validationErrorCount: validationProofHoles.length,
    classifiedOldPaths: Object.freeze([...classifiedOldPathSet].sort()),
    classifiedUnknownOldPaths: Object.freeze([...classifiedUnknownOldPathSet].sort()),
    unclassifiedOldPaths: Object.freeze(unclassifiedOldPaths),
    proofHoles: Object.freeze(proofHoles),
  });
}

function oldProductUnitInventoryValidationProofHoles(entry) {
  const oldPath = typeof entry?.oldPath === "string" && entry.oldPath.length > 0
    ? entry.oldPath
    : "<unknown>";
  return validateOldProductUnitPortEntry(entry).map((error) => Object.freeze({
    oldPath,
    proofHole: "old-inventory-validation",
    error,
  }));
}

function oldProductUnitInventoryProofHoles(unclassifiedOldPaths, classifiedUnknownOldPathSet, validationProofHoles) {
  return [
    ...validationProofHoles,
    ...unclassifiedOldPaths.map((oldPath) => Object.freeze({
      oldPath,
      proofHole: "unclassified-old-inventory",
    })),
    ...[...classifiedUnknownOldPathSet].sort().map((oldPath) => Object.freeze({
      oldPath,
      proofHole: "classified-unknown-old-inventory",
    })),
  ];
}

export function countOldProductUnitDeclarations(inventoryEntries = oldProductUnitPortInventory) {
  return inventoryEntries.reduce((total, entry) => total + entry.testDeclarations, 0);
}

export function formatOldProductUnitInventoryCounts(counts) {
  return oldProductUnitReportCountKeys.map((key) => `${key}: ${counts[key]}`).join("\n");
}
