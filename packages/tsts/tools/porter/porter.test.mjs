import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  authoredFacadePathSet,
  buildGeneratedArtifactStatus,
  buildExternalFacadeMap,
  buildLargeFileSplitStatus,
  buildStatus,
  collectVerifyFailures,
  expectedTsPath,
  matchGlob,
  policyFor,
  renderExpectedGeneratedArtifacts,
  renderExternalFacadeModules,
  renderStub,
  renderUnitGroup,
  renderStatusMarkdown,
  repoRoot,
  resolveRepo,
  scanTsUnits,
  verifyStatus,
  writeTextSafely,
} from "./porter.mjs";
import {
  buildAstGeneratedArtifactStatus,
  buildAstGeneratedFiles,
  buildGeneratedAstSkips,
  emitKinds,
  parseGoFlagFile,
  writeAstGenerated,
} from "./ast-generator.mjs";
import { AstSchema } from "./ast-schema-model.mjs";
import {
  buildDiagnosticsGeneratedArtifactStatus,
  buildDiagnosticsGeneratedFiles,
  collectDiagnosticsArtifactFailures,
  emitMessages,
  parseCatalog,
  writeDiagnosticsGenerated,
} from "./diagnostics-generator.mjs";
import {
  buildBundledGeneratedArtifactStatus,
  buildExpectedBundledArtifacts,
  collectBundledArtifactFailures,
  writeBundledGenerated,
} from "../bundled/generate-bundled.mjs";

const baseConfig = {
  goModulePath: "github.com/microsoft/typescript-go",
  primaryUnitKinds: ["constGroup", "func", "method", "type", "varGroup"],
  tsRoot: "packages/tsts/src",
  policies: [
    { match: "**/*_test.go", category: "test", reason: "test reason" },
    { match: "**/*_generated.go", category: "generated", reason: "generated reason" },
  ],
  overrides: [
    { match: "internal/jsnum/**", category: "manual-required", reason: "manual reason" },
  ],
  tsFilePolicies: [
    { match: "packages/tsts/src/internal/ls/**", category: "forbidden-source", reason: "ls forbidden" },
    { match: "packages/tsts/src/internal/lsp/**", category: "forbidden-source", reason: "lsp forbidden" },
    { match: "packages/tsts/src/**/*fourslash*", category: "forbidden-source", reason: "fourslash forbidden" },
    { match: "packages/tsts/src/**/*.ts", category: "requires-tsgo-unit", reason: "metadata required" },
  ],
  largeFileLineThreshold: 5000,
  largeFileSplitPlan: {
    schemaVersion: 1,
    files: {},
  },
};

test("matchGlob supports recursive and single-segment patterns", () => {
  assert.equal(matchGlob("internal/jsnum/**", "internal/jsnum/jsnum.go"), true);
  assert.equal(matchGlob("internal/jsnum/**", "internal/jsnum/sub/a.go"), true);
  assert.equal(matchGlob("**/*_test.go", "internal/debug/debug_test.go"), true);
  assert.equal(matchGlob("internal/*/debug.go", "internal/debug/nested/debug.go"), false);
  assert.equal(matchGlob("internal/*/debug.go", "internal/foo/debug.go"), true);
});

test("policyFor applies generated and explicit overrides before default literal ports", () => {
  assert.equal(policyFor(baseConfig, "internal/jsnum/jsnum.go", false).category, "manual-required");
  assert.equal(policyFor(baseConfig, "internal/debug/debug_test.go", false).category, "test");
  assert.equal(policyFor(baseConfig, "internal/ast/ast_generated.go", true).category, "generated");
  assert.equal(policyFor(baseConfig, "internal/debug/debug.go", false).category, "literal-port");
});

test("policyFor lets explicit inactive policies exclude generated LS/LSP files", () => {
  const policy = policyFor({
    ...baseConfig,
    policies: [
      { match: "internal/lsp/**", category: "out-of-scope", active: false, reason: "lsp excluded" },
    ],
  }, "internal/lsp/lsproto/lsp_generated.go", true);

  assert.equal(policy.category, "out-of-scope");
  assert.equal(policy.active, false);
});

test("expectedTsPath uses semantic large-file split plans without repeating source path metadata", () => {
  const unit = unitRecord({
    id: "m::internal/checker/checker.go::method::Checker.checkSourceFile",
    kind: "method",
    qualifiedName: "Checker.checkSourceFile",
    goPath: "internal/checker/checker.go",
  });
  const snapshot = snapshotWith([fileRecord({
    path: "internal/checker/checker.go",
    lineCount: 6000,
    units: [unit],
  })]);
  const config = {
    ...baseConfig,
    largeFileSplitPlan: {
      schemaVersion: 1,
      files: {
        "internal/checker/checker.go": {
          targetRoot: "packages/tsts/src/internal/checker/checker",
          reason: "test semantic split plan",
          targets: [
            {
              file: "source-files.ts",
              description: "Source-file checking methods",
              declarations: ["method::Checker.checkSourceFile"],
            },
          ],
        },
      },
    },
  };
  const splitStatus = buildLargeFileSplitStatus(config, snapshot);
  assert.equal(
    expectedTsPath(config, unit, splitStatus),
    "packages/tsts/src/internal/checker/checker/source-files.ts",
  );
});

test("buildStatus reports missing, stale, orphan, parse-error, unitless, and untracked TS files", () => {
  const snapshot = snapshotWith([
    fileRecord({
      path: "internal/debug/debug.go",
      units: [unitRecord({
        id: "m::internal/debug/debug.go::func::Fail",
        kind: "func",
        qualifiedName: "Fail",
        goPath: "internal/debug/debug.go",
        sigHash: "sig-1",
        bodyHash: "body-1",
      })],
    }),
    fileRecord({
      path: "internal/core/doc.go",
      units: [],
    }),
    fileRecord({
      path: "internal/bad/bad.go",
      units: [],
      parseError: "expected declaration",
    }),
  ]);
  const status = buildStatus(baseConfig, snapshot, {
    fileCount: 2,
    files: [
      { path: "packages/tsts/src/internal/debug/debug.ts", metadataCount: 1 },
      { path: "packages/tsts/src/internal/debug/helper.ts", metadataCount: 0 },
      { path: "packages/tsts/src/internal/ls/service.ts", metadataCount: 1 },
    ],
    units: [
      {
        id: "m::internal/debug/debug.go::func::Fail",
        path: "packages/tsts/src/internal/debug/debug.ts",
        status: "implemented",
        sigHash: "sig-1",
        bodyHash: "old-body",
      },
      {
        id: "m::internal/debug/debug.go::func::Gone",
        path: "packages/tsts/src/internal/debug/debug.ts",
        status: "implemented",
        sigHash: "sig",
        bodyHash: "body",
      },
    ],
  });

  assert.equal(status.counts.portable, 1);
  assert.equal(status.counts.stale, 1);
  assert.equal(status.counts.orphan, 1);
  assert.equal(status.counts.parseErrors, 1);
  assert.equal(status.counts.unitlessGoFiles, 1);
  assert.equal(status.counts.untrackedTsFiles, 1);
  assert.equal(status.counts.forbiddenTsFiles, 1);
  assert.match(renderStatusMarkdown(status), /Coverage Diagnostics/);
});

test("renderStatusMarkdown reports largest missing modules from missing rows only", () => {
  const snapshot = snapshotWith([
    fileRecord({
      path: "internal/checker/checker.go",
      units: [unitRecord({
        id: "m::internal/checker/checker.go::func::Implemented",
        kind: "func",
        qualifiedName: "Implemented",
        goPath: "internal/checker/checker.go",
        sigHash: "sig-1",
        bodyHash: "body-1",
      })],
    }),
    fileRecord({
      path: "internal/parser/parser.go",
      units: [unitRecord({
        id: "m::internal/parser/parser.go::func::Missing",
        kind: "func",
        qualifiedName: "Missing",
        goPath: "internal/parser/parser.go",
        sigHash: "sig-2",
        bodyHash: "body-2",
      })],
    }),
  ]);
  const status = buildStatus(baseConfig, snapshot, {
    fileCount: 1,
    files: [{ path: "packages/tsts/src/internal/checker/checker.ts", metadataCount: 1 }],
    units: [{
      id: "m::internal/checker/checker.go::func::Implemented",
      path: "packages/tsts/src/internal/checker/checker.ts",
      status: "implemented",
      sigHash: "sig-1",
      bodyHash: "body-1",
    }],
  });
  const markdown = renderStatusMarkdown(status);

  assert.match(markdown, /\| internal\/parser \| 1 \|/);
  assert.doesNotMatch(markdown, /\| internal\/checker \| 1 \|/);
});

test("large-file split plans must cover every declaration exactly once", () => {
  const sourceMethod = unitRecord({
    id: "m::internal/checker/checker.go::method::Checker.checkSourceFile",
    kind: "method",
    name: "checkSourceFile",
    qualifiedName: "Checker.checkSourceFile",
    receiver: "Checker",
    goPath: "internal/checker/checker.go",
  });
  const typeMethod = unitRecord({
    id: "m::internal/checker/checker.go::method::Checker.getTypeOfNode",
    kind: "method",
    name: "getTypeOfNode",
    qualifiedName: "Checker.getTypeOfNode",
    receiver: "Checker",
    goPath: "internal/checker/checker.go",
  });
  const orphanMethod = unitRecord({
    id: "m::internal/checker/checker.go::method::Checker.resolveName",
    kind: "method",
    name: "resolveName",
    qualifiedName: "Checker.resolveName",
    receiver: "Checker",
    goPath: "internal/checker/checker.go",
  });
  const config = {
    ...baseConfig,
    largeFileSplitPlan: {
      schemaVersion: 1,
      files: {
        "internal/checker/checker.go": {
          targetRoot: "packages/tsts/src/internal/checker/checker",
          targets: [
            {
              file: "source-files.ts",
              description: "Source-file checking",
              declarations: ["method::Checker.checkSourceFile", "method::Checker.gone"],
            },
            {
              file: "types.ts",
              description: "Type queries",
              matchers: [{ kind: "method", receiver: "Checker", nameRegex: "^getType" }],
            },
            {
              file: "duplicate-types.ts",
              description: "Duplicate type queries",
              declarations: ["method::Checker.getTypeOfNode"],
            },
          ],
        },
      },
    },
  };
  const splitStatus = buildLargeFileSplitStatus(config, snapshotWith([fileRecord({
    path: "internal/checker/checker.go",
    lineCount: 6000,
    units: [sourceMethod, typeMethod, orphanMethod],
  })]));

  assert.equal(splitStatus.requiredFileCount, 1);
  assert.equal(splitStatus.files[0].assigned, 2);
  assert.equal(splitStatus.files[0].unassigned, 1);
  assert.ok(splitStatus.issues.some((issue) => issue.kind === "stale-declaration"));
  assert.ok(splitStatus.issues.some((issue) => issue.kind === "duplicate-assignment"));
  assert.ok(splitStatus.issues.some((issue) => issue.kind === "unassigned-declaration"));
  assert.deepEqual(
    collectVerifyFailures({ counts: { ...emptyCounts(), largeFileSplitFailures: splitStatus.failureCount }, generatedArtifacts: emptyGeneratedArtifacts() }, {}),
    [`${splitStatus.failureCount} large-file split plan failures`],
  );
});

test("large-file split plans reject random line/chunk target names", () => {
  const unit = unitRecord({
    id: "m::internal/parser/parser.go::func::ParseSourceFile",
    kind: "func",
    name: "ParseSourceFile",
    qualifiedName: "ParseSourceFile",
    goPath: "internal/parser/parser.go",
  });
  const splitStatus = buildLargeFileSplitStatus({
    ...baseConfig,
    largeFileSplitPlan: {
      schemaVersion: 1,
      files: {
        "internal/parser/parser.go": {
          targetRoot: "packages/tsts/src/internal/parser/parser",
          targets: [
            {
              file: "part-001.ts",
              description: "Invalid line-range style split",
              declarations: ["func::ParseSourceFile"],
            },
          ],
        },
      },
    },
  }, snapshotWith([fileRecord({ path: "internal/parser/parser.go", lineCount: 6000, units: [unit] })]));

  assert.ok(splitStatus.issues.some((issue) => issue.kind === "random-split-target"));
});

test("buildStatus excludes inactive LS/LSP/fourslash policies from active porter coverage", () => {
  const config = {
    ...baseConfig,
    largeFileSplitPlan: { schemaVersion: 1, files: {} },
    policies: [
      { match: "internal/ls/**", category: "out-of-scope", active: false, reason: "ls excluded" },
      { match: "internal/lsp/**", category: "out-of-scope", active: false, reason: "lsp excluded" },
      { match: "**/*fourslash*", category: "out-of-scope", active: false, reason: "fourslash excluded" },
    ],
  };
  const status = buildStatus(config, snapshotWith([
    fileRecord({
      path: "internal/ls/service.go",
      units: [unitRecord({
        id: "m::internal/ls/service.go::func::NewService",
        kind: "func",
        qualifiedName: "NewService",
        goPath: "internal/ls/service.go",
      })],
    }),
    fileRecord({
      path: "internal/lsp/server.go",
      units: [unitRecord({
        id: "m::internal/lsp/server.go::type::Server",
        kind: "type",
        qualifiedName: "Server",
        goPath: "internal/lsp/server.go",
      })],
    }),
  ]), { fileCount: 0, files: [], units: [] });

  assert.equal(status.counts.portable, 0);
  assert.equal(status.counts.excluded, 2);
  assert.equal(status.counts.missing, 0);
  assert.deepEqual(collectVerifyFailures(status, { "strict-port": true }), []);
});

test("buildStatus excludes exact inactive unit policies without counting their TS stubs", () => {
  const id = "m::internal/execute/tsc.go::func::fmtMain";
  const config = {
    ...baseConfig,
    unitPolicies: [
      {
        id,
        category: "out-of-scope",
        active: false,
        reason: "formatter command path excluded",
      },
    ],
  };
  const status = buildStatus(config, snapshotWith([
    fileRecord({
      path: "internal/execute/tsc.go",
      units: [unitRecord({
        id,
        kind: "func",
        qualifiedName: "fmtMain",
        goPath: "internal/execute/tsc.go",
        sigHash: "sig-1",
        bodyHash: "body-1",
      })],
    }),
  ]), {
    fileCount: 1,
    files: [{ path: "packages/tsts/src/internal/execute/tsc.ts", metadataCount: 1 }],
    units: [{
      id,
      kind: "func",
      path: "packages/tsts/src/internal/execute/tsc.ts",
      status: "stub",
      sigHash: "sig-1",
      bodyHash: "body-1",
      hasUnimplThrow: true,
    }],
  });

  assert.equal(status.counts.portable, 0);
  assert.equal(status.counts.excluded, 1);
  assert.equal(status.counts.stubbed, 0);
  assert.equal(status.counts.missing, 0);
  assert.equal(status.rows[0].status, "excluded");
  assert.equal(status.rows[0].reason, "formatter command path excluded");
  assert.deepEqual(collectVerifyFailures(status, { "strict-port": true }), []);
});

test("buildStatus excludes generated and Go test units from production scaffold coverage", () => {
  const status = buildStatus(baseConfig, snapshotWith([
    fileRecord({
      path: "internal/ast/ast_generated.go",
      generated: true,
      units: [unitRecord({
        id: "m::internal/ast/ast_generated.go::type::Node",
        kind: "type",
        qualifiedName: "Node",
        goPath: "internal/ast/ast_generated.go",
      })],
    }),
    fileRecord({
      path: "internal/debug/debug_test.go",
      units: [unitRecord({
        id: "m::internal/debug/debug_test.go::func::TestDebug",
        kind: "func",
        qualifiedName: "TestDebug",
        goPath: "internal/debug/debug_test.go",
      })],
    }),
  ]), { fileCount: 0, files: [], units: [] });

  assert.equal(status.counts.portable, 0);
  assert.equal(status.counts.excluded, 2);
  assert.equal(status.counts.missing, 0);
  assert.deepEqual(collectVerifyFailures(status, { "strict-port": true }), []);
});

test("renderUnitGroup treats references to excluded LS/LSP types as opaque boundary types", () => {
  const config = {
    ...baseConfig,
    policies: [
      { match: "internal/ls/**", category: "out-of-scope", active: false, reason: "ls excluded" },
      { match: "internal/lsp/**", category: "out-of-scope", active: false, reason: "lsp excluded" },
    ],
  };
  const formatCodeSettings = unitRecord({
    id: "m::internal/ls/lsutil/formatcodeoptions.go::type::FormatCodeSettings",
    kind: "type",
    name: "FormatCodeSettings",
    qualifiedName: "FormatCodeSettings",
    goPath: "internal/ls/lsutil/formatcodeoptions.go",
    typeKind: "struct",
  });
  const withFormatCodeSettings = unitRecord({
    id: "m::internal/format/api.go::func::WithFormatCodeSettings",
    kind: "func",
    name: "WithFormatCodeSettings",
    qualifiedName: "WithFormatCodeSettings",
    goPath: "internal/format/api.go",
    parameters: [
      { names: ["options"], type: selectorType("lsutil", "FormatCodeSettings") },
    ],
  });
  const text = renderUnitGroup(
    config,
    snapshotWith([
      fileRecord({
        path: "internal/ls/lsutil/formatcodeoptions.go",
        importPath: "github.com/microsoft/typescript-go/internal/ls/lsutil",
        packageName: "lsutil",
        units: [formatCodeSettings],
      }),
      fileRecord({
        path: "internal/format/api.go",
        importPath: "github.com/microsoft/typescript-go/internal/format",
        packageName: "format",
        imports: [{ name: "lsutil", path: "github.com/microsoft/typescript-go/internal/ls/lsutil" }],
        units: [withFormatCodeSettings],
      }),
    ]),
    "packages/tsts/src/internal/format/api.ts",
    [withFormatCodeSettings],
  );

  assert.doesNotMatch(text, /from ".*internal\/ls/);
  assert.match(text, /import type \{ GoUnresolved \}/);
  assert.ok(text.includes('options: GoUnresolved<"github.com/microsoft/typescript-go/internal/ls/lsutil.FormatCodeSettings">'));
});

test("verifyStatus fails hard on coverage and metadata defects", () => {
  const status = {
    counts: {
      parseErrors: 1,
      duplicateGoIDs: 1,
      duplicateTsIDs: 1,
      orphan: 1,
      forbiddenTsFiles: 1,
      untrackedTsFiles: 1,
      stale: 1,
      missing: 1,
    },
    generatedArtifacts: {
      missing: [{ path: "packages/tsts/src/go/compat.ts" }],
      stale: [{ path: "packages/tsts/src/go/io.ts" }],
      orphan: [{ path: "packages/tsts/src/go/old.ts" }],
      untracked: [{ path: "packages/tsts/src/go/manual.ts" }],
      invalid: [{ path: "packages/tsts/src/go/bad.ts" }],
    },
  };
  assert.deepEqual(collectVerifyFailures(status, { "strict-port": true }), [
    "1 Go parse errors",
    "1 duplicate Go IDs",
    "1 duplicate TS IDs",
    "1 orphan TS units",
    "1 forbidden TS files",
    "1 TS files without @tsgo-unit metadata",
    "1 stale TS units",
    "1 missing generated artifacts",
    "1 stale generated artifacts",
    "1 orphan generated artifacts",
    "1 untracked generated artifacts",
    "1 invalid generated artifacts",
    "1 missing Go units",
  ]);
});

test("scanTsUnits records files with and without metadata", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tsts-porter-"));
  try {
    mkdirSync(path.join(root, "internal/debug"), { recursive: true });
    writeFileSync(
      path.join(root, "internal/debug/debug.ts"),
      '/** @tsgo-unit {"id":"m::internal/debug/debug.go::func::Fail","kind":"func","status":"stub","sigHash":"s","bodyHash":"b"} */\nexport {}\n',
    );
    writeFileSync(path.join(root, "internal/debug/helper.ts"), "export const helper = true;\n");
    const result = scanTsUnits(root);
    assert.equal(result.fileCount, 2);
    assert.equal(result.units.length, 1);
    assert.equal(result.files.find((file) => file.path.endsWith("debug.ts")).metadataCount, 1);
    assert.equal(result.files.find((file) => file.path.endsWith("helper.ts")).metadataCount, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeTextSafely refuses to overwrite edited files without force", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const target = path.join(root, "draft.json");
    assert.equal(writeTextSafely(target, "one\n", { label: "test artifact" }), "written");
    assert.equal(writeTextSafely(target, "one\n", { label: "test artifact" }), "unchanged");
    assert.throws(
      () => writeTextSafely(target, "two\n", { label: "test artifact" }),
      /refusing to overwrite existing test artifact/,
    );
    assert.equal(writeTextSafely(target, "two\n", { label: "test artifact", force: true }), "written");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renderStub rejects non-portable unit kinds", () => {
  assert.throws(
    () => renderStub(unitRecord({ kind: "importGroup" })),
    /cannot render scaffold for non-portable Go unit kind 'importGroup'/,
  );
});

test("renderUnitGroup emits typed generic method skeletons with Go result tuples", () => {
  const orderedMapType = unitRecord({
    id: "m::internal/collections/ordered_map.go::type::OrderedMap",
    kind: "type",
    name: "OrderedMap",
    qualifiedName: "OrderedMap",
    goPath: "internal/collections/ordered_map.go",
    typeKind: "struct",
    typeParameterDetails: [
      { name: "K", constraint: identType("comparable") },
      { name: "V", constraint: identType("any") },
    ],
    members: [
      { kind: "field", name: "keys", typeExpr: sliceType(identType("K")) },
      { kind: "field", name: "mp", typeExpr: mapType(identType("K"), identType("V")) },
    ],
  });
  const getMethod = unitRecord({
    id: "m::internal/collections/ordered_map.go::method::OrderedMap.Get",
    kind: "method",
    name: "Get",
    qualifiedName: "OrderedMap.Get",
    receiver: "OrderedMap",
    receiverMode: "pointer",
    receiverType: pointerType(instantiationType(identType("OrderedMap"), [identType("K"), identType("V")])),
    goPath: "internal/collections/ordered_map.go",
    parameters: [{ names: ["key"], type: identType("K") }],
    results: [{ type: identType("V") }, { type: identType("bool") }],
  });
  const text = renderUnitGroup(
    baseConfig,
    snapshotWith([fileRecord({ path: "internal/collections/ordered_map.go", units: [orderedMapType, getMethod] })]),
    "packages/tsts/src/internal/collections/ordered_map.ts",
    [orderedMapType, getMethod],
  );
  assert.match(text, /import type \{ bool \} from "@tsonic\/core\/types\.js";/);
  assert.match(text, /import type \{ GoComparable, GoMap, GoPtr, GoSlice \}/);
  assert.match(text, /export interface OrderedMap<K extends GoComparable = unknown, V = unknown>/);
  assert.match(text, /export function OrderedMap_Get<K, V>\(receiver: GoPtr<OrderedMap<K, V>>, key: K\): \[V, bool\]/);
});

test("renderUnitGroup emits higher-order function and inline interface signatures", () => {
  const nodeAssert = unitRecord({
    id: "m::internal/debug/debug.go::func::FailBadSyntaxKind",
    kind: "func",
    name: "FailBadSyntaxKind",
    qualifiedName: "FailBadSyntaxKind",
    goPath: "internal/debug/debug.go",
    parameters: [
      {
        names: ["node"],
        type: interfaceType([
          { kind: "method", name: "KindString", typeExpr: funcType([], [{ type: identType("string") }]) },
        ]),
      },
      { names: ["message"], type: identType("any"), variadic: true },
    ],
  });
  const diffFunc = unitRecord({
    id: "m::internal/collections/ordered_map.go::func::DiffOrderedMapsFunc",
    kind: "func",
    name: "DiffOrderedMapsFunc",
    qualifiedName: "DiffOrderedMapsFunc",
    goPath: "internal/collections/ordered_map.go",
    typeParameterDetails: [
      { name: "K", constraint: identType("comparable") },
      { name: "V", constraint: identType("any") },
    ],
    parameters: [
      { names: ["equalValues"], type: funcType([{ names: ["a"], type: identType("V") }, { names: ["b"], type: identType("V") }], [{ type: identType("bool") }]) },
      { names: ["onAdded"], type: funcType([{ names: ["key"], type: identType("K") }, { names: ["value"], type: identType("V") }], []) },
    ],
  });
  const debugText = renderUnitGroup(
    baseConfig,
    snapshotWith([fileRecord({ path: "internal/debug/debug.go", units: [nodeAssert] })]),
    "packages/tsts/src/internal/debug/debug.ts",
    [nodeAssert],
  );
  const diffText = renderUnitGroup(
    baseConfig,
    snapshotWith([fileRecord({ path: "internal/collections/ordered_map.go", units: [diffFunc] })]),
    "packages/tsts/src/internal/collections/ordered_map.ts",
    [diffFunc],
  );
  assert.match(debugText, /node: \{ KindString: \(\) => string \}, \.\.\.message: Array<unknown>/);
  assert.match(diffText, /equalValues: \(a: V, b: V\) => bool/);
  assert.match(diffText, /onAdded: \(key: K, value: V\) => void/);
});

test("renderUnitGroup resolves Go external types through generated facades", () => {
  const diagnosticWriter = unitRecord({
    id: "m::internal/diagnosticwriter/diagnosticwriter.go::func::WriteFlattenedDiagnosticMessage",
    kind: "func",
    name: "WriteFlattenedDiagnosticMessage",
    qualifiedName: "WriteFlattenedDiagnosticMessage",
    goPath: "internal/diagnosticwriter/diagnosticwriter.go",
    parameters: [
      { names: ["writer"], type: selectorType("io", "Writer") },
      { names: ["opts"], type: sliceType(selectorType("json", "Options")), variadic: true },
    ],
  });
  const snapshot = snapshotWith([
    fileRecord({
      path: "internal/diagnosticwriter/diagnosticwriter.go",
      importPath: "github.com/microsoft/typescript-go/internal/diagnosticwriter",
      imports: [
        { path: "io" },
        { name: "json", path: "github.com/go-json-experiment/json" },
      ],
      units: [diagnosticWriter],
    }),
  ]);
  const text = renderUnitGroup(
    baseConfig,
    snapshot,
    "packages/tsts/src/internal/diagnosticwriter/diagnosticwriter.ts",
    [diagnosticWriter],
  );

  assert.match(text, /import type \{ Writer \} from "\.\.\/\.\.\/go\/io\.js";/);
  assert.match(text, /import type \{ Options \} from "\.\.\/\.\.\/go\/github\.com\/go-json-experiment\/json\.js";/);
  assert.match(text, /writer: Writer/);
  assert.match(text, /\.\.\.opts: Options\[\]/);
  assert.doesNotMatch(text, /GoExternal/);
});

test("renderUnitGroup imports symbols from semantic split targets", () => {
  const checkerType = unitRecord({
    id: "m::internal/checker/checker.go::type::Checker",
    kind: "type",
    name: "Checker",
    qualifiedName: "Checker",
    goPath: "internal/checker/checker.go",
    typeKind: "struct",
  });
  const emitResolverFactory = unitRecord({
    id: "m::internal/checker/emitresolver.go::func::NewEmitResolver",
    kind: "func",
    name: "NewEmitResolver",
    qualifiedName: "NewEmitResolver",
    goPath: "internal/checker/emitresolver.go",
    parameters: [
      { names: ["checker"], type: selectorType("checker", "Checker") },
    ],
  });
  const config = {
    ...baseConfig,
    largeFileSplitPlan: {
      schemaVersion: 1,
      files: {
        "internal/checker/checker.go": {
          targetRoot: "packages/tsts/src/internal/checker/checker",
          targets: [
            {
              file: "state.ts",
              description: "Checker state",
              declarations: ["type::Checker"],
            },
          ],
        },
      },
    },
  };
  const snapshot = snapshotWith([
    fileRecord({
      path: "internal/checker/checker.go",
      importPath: "github.com/microsoft/typescript-go/internal/checker",
      lineCount: 6000,
      units: [checkerType],
    }),
    fileRecord({
      path: "internal/checker/emitresolver.go",
      importPath: "github.com/microsoft/typescript-go/internal/checker",
      imports: [{ name: "checker", path: "github.com/microsoft/typescript-go/internal/checker" }],
      units: [emitResolverFactory],
    }),
  ]);
  const splitStatus = buildLargeFileSplitStatus(config, snapshot);
  const text = renderUnitGroup(
    config,
    snapshot,
    "packages/tsts/src/internal/checker/emitresolver.ts",
    [emitResolverFactory],
    { largeFileSplits: splitStatus },
  );

  assert.match(text, /import type \{ Checker \} from "\.\/checker\/state\.js";/);
  assert.doesNotMatch(text, /from "\.\/checker\.js"/);
});

test("renderUnitGroup uses extractor-provided inferred value types", () => {
  const kindType = unitRecord({
    id: "m::internal/ast/kind_generated.go::type::Kind",
    kind: "type",
    name: "Kind",
    qualifiedName: "Kind",
    goPath: "internal/ast/kind_generated.go",
    typeKind: "named",
    typeExpression: identType("int32"),
  });
  const values = unitRecord({
    id: "m::internal/api/proto.go::constGroup::handlePrefixProject+limit",
    kind: "constGroup",
    name: "handlePrefixProject+limit",
    qualifiedName: "handlePrefixProject+limit",
    goPath: "internal/api/proto.go",
    valueSpecs: [
      { names: ["handlePrefixProject"], values: ["'p'"], inferredValueTypes: [identType("rune")] },
      { names: ["limit"], values: ["iota * 4"], inferredValueTypes: [identType("int")] },
    ],
  });
  const kindBounds = unitRecord({
    id: "m::internal/ast/kind_generated.go::constGroup::KindEqualsToken+KindFirstAssignment",
    kind: "constGroup",
    name: "KindEqualsToken+KindFirstAssignment",
    qualifiedName: "KindEqualsToken+KindFirstAssignment",
    goPath: "internal/ast/kind_generated.go",
    valueSpecs: [
      { names: ["KindEqualsToken"], type: identType("Kind"), values: ["iota"], inferredValueTypes: [identType("int")] },
      { names: ["KindFirstAssignment"], values: ["KindEqualsToken"] },
    ],
  });
  const channels = unitRecord({
    id: "m::internal/scanner/scanner.go::varGroup::done+factory+err",
    kind: "varGroup",
    name: "done+factory+err",
    qualifiedName: "done+factory+err",
    goPath: "internal/scanner/scanner.go",
    valueSpecs: [
      { names: ["done"], values: ["make(chan int)"], inferredValueTypes: [channelType(identType("int"))] },
      { names: ["factory"], values: ["func(x int) string { return \"\" }"], inferredValueTypes: [funcType([{ names: ["x"], type: identType("int") }], [{ type: identType("string") }])] },
      { names: ["err"], values: ["errors.New(\"boom\")"], inferredValueTypes: [identType("error")] },
    ],
  });
  const text = renderUnitGroup(
    baseConfig,
    snapshotWith([fileRecord({ path: "internal/api/proto.go", importPath: "github.com/microsoft/typescript-go/internal/ast", units: [kindType, values, kindBounds, channels] })]),
    "packages/tsts/src/internal/ast/kind_generated.ts",
    [kindType, values, kindBounds, channels],
  );

  assert.match(text, /export const handlePrefixProject: GoRune = undefined as never;/);
  assert.match(text, /export const limit: int = undefined as never;/);
  assert.match(text, /export const KindEqualsToken: Kind = undefined as never;/);
  assert.match(text, /export const KindFirstAssignment: Kind = undefined as never;/);
  assert.match(text, /export let done: GoChan<int, "bidirectional"> = undefined as never;/);
  assert.match(text, /export let factory: \(x: int\) => string = undefined as never;/);
  assert.match(text, /export let err: GoError = undefined as never;/);
});

test("renderExternalFacadeModules generates canonical facade modules for observed externals", () => {
  const unit = unitRecord({
    id: "m::internal/json/json.go::func::MarshalWrite",
    kind: "func",
    name: "MarshalWrite",
    qualifiedName: "MarshalWrite",
    goPath: "internal/json/json.go",
    parameters: [
      { names: ["writer"], type: selectorType("io", "Writer") },
      { names: ["option"], type: selectorType("json", "Options") },
    ],
    externalRefs: [
      { importPath: "path/filepath", package: "filepath", name: "Join", role: "call", count: 1 },
      { importPath: "os", package: "os", name: "PathSeparator", role: "value", count: 1 },
    ],
  });
  const snapshot = snapshotWith([
    fileRecord({
      path: "internal/json/json.go",
      importPath: "github.com/microsoft/typescript-go/internal/json",
      imports: [
        { path: "io" },
        { name: "json", path: "github.com/go-json-experiment/json" },
      ],
      units: [unit],
    }),
  ]);

  const facades = buildExternalFacadeMap(baseConfig, snapshot);
  assert.equal(facades.get("io.Writer").tsModule, "go/io.ts");
  assert.equal(facades.get("github.com/go-json-experiment/json.Options").tsModule, "go/github.com/go-json-experiment/json.ts");
  assert.equal(facades.get("path/filepath.Join").kind, "functionValue");
  assert.equal(facades.get("os.PathSeparator").kind, "value");

  const modules = renderExternalFacadeModules(baseConfig, snapshot);
  assert.match(modules.get("go/io.ts"), /export interface Writer/);
  assert.match(modules.get("go/io.ts"), /Write\(p: GoSlice<byte>\): \[int, GoError\]/);
  assert.match(modules.get("go/time.ts"), /export type Duration = long;/);
  assert.match(modules.get("go/github.com/go-json-experiment/json.ts"), /export interface Options/);
  assert.match(modules.get("go/path/filepath.ts"), /export function Join\(\.\.\.args: Array<unknown>\): unknown/);
  assert.match(modules.get("go/os.ts"), /export const PathSeparator: unknown = undefined as never;/);
  assert.doesNotMatch(modules.get("go/github.com/go-json-experiment/json.ts"), /GoExternal/);
});

test("renderExpectedGeneratedArtifacts embeds deterministic generated metadata", () => {
  const snapshot = snapshotWith([]);
  const artifacts = renderExpectedGeneratedArtifacts(baseConfig, snapshot);
  const compat = artifacts.get("packages/tsts/src/go/compat.ts");
  assert.match(compat, /^\/\/ Code generated by TSTS porter\. DO NOT EDIT\./);
  assert.match(compat, /\/\/ @tsgo-generated {"schemaVersion":1,"kind":"go-compat","generator":"porter:facades","sourceRevision":"abc123","path":"go\/compat\.ts","contentHash":"[a-f0-9]{64}"}/);
  assert.match(compat, /export class GoStructMap<K, V> implements Map<K, V>/);
  assert.match(compat, /export function NewGoStructMap<K, V>\(\): GoMap<K, V>/);
});

test("buildGeneratedArtifactStatus catches missing, stale, orphan, untracked, and invalid generated files", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const config = { ...baseConfig, tsRoot: path.relative(repoRoot, path.join(root, "src")).split(path.sep).join("/") };
    const snapshot = snapshotWith([]);
    const generatedRoot = path.join(root, "src/go");
    mkdirSync(generatedRoot, { recursive: true });
    for (const [relativePath, text] of renderExpectedGeneratedArtifacts(config, snapshot)) {
      const targetPath = path.join(repoRoot, relativePath);
      mkdirSync(path.dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, text);
    }
    let clean = buildGeneratedArtifactStatus(config, snapshot);
    assert.deepEqual(clean, { missing: [], stale: [], orphan: [], untracked: [], invalid: [] });

    writeFileSync(
      path.join(generatedRoot, "compat.ts"),
      renderExpectedGeneratedArtifacts(config, snapshot).get(`${config.tsRoot}/go/compat.ts`).replace(/\n$/, "\nexport const edited = true;\n"),
    );
    writeFileSync(path.join(generatedRoot, "manual.ts"), "export const manual = true;\n");
    writeFileSync(path.join(generatedRoot, "bad.ts"), "// Code generated by TSTS porter. DO NOT EDIT.\n// @tsgo-generated {bad-json}\n\nexport {}\n");
    writeFileSync(path.join(generatedRoot, "orphan.ts"), renderExpectedGeneratedArtifacts(config, snapshot).get(`${config.tsRoot}/go/compat.ts`));
    rmSync(path.join(generatedRoot, "io.ts"), { force: true });

    const broken = buildGeneratedArtifactStatus(config, snapshot);
    assert.equal(broken.missing.length, 1);
    assert.equal(broken.stale.length, 1);
    assert.equal(broken.orphan.length, 1);
    assert.equal(broken.untracked.length, 1);
    assert.equal(broken.invalid.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bundled-generator catches missing, stale, orphan, untracked, and invalid generated files", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/bundled-test-"));
  try {
    const sourceRoot = path.relative(repoRoot, path.join(root, "vendor")).split(path.sep).join("/");
    const tsRoot = path.relative(repoRoot, path.join(root, "src")).split(path.sep).join("/");
    const libSource = path.join(root, "vendor/internal/bundled/libs");
    mkdirSync(libSource, { recursive: true });
    writeFileSync(path.join(libSource, "lib.one.d.ts"), "declare const one: 1;\n");
    const config = { ...baseConfig, sourceRoot, tsRoot };

    const missing = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.deepEqual(collectBundledArtifactFailures(missing), ["3 missing bundled artifacts"]);
    assert.equal(writeBundledGenerated(config, "rev"), 3);

    const clean = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.deepEqual(clean, { missing: [], stale: [], orphan: [], untracked: [], invalid: [] });
    const expected = buildExpectedBundledArtifacts(config, "rev");
    assert.match(expected.get(`${tsRoot}/internal/bundled/libs_generated.ts`), /"path":"internal\/bundled\/libs_generated\.ts"/);

    writeFileSync(
      path.join(root, "src/internal/bundled/embed_generated.ts"),
      expected.get(`${tsRoot}/internal/bundled/embed_generated.ts`).replace("declare const one: 1;", "declare const one: 2;"),
    );
    const stale = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.equal(stale.stale.length, 1);

    writeBundledGenerated(config, "rev");
    unlinkSync(path.join(root, "src/internal/bundled/libs/lib.one.d.ts"));
    const missingLib = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.equal(missingLib.missing.length, 1);

    writeBundledGenerated(config, "rev");
    writeFileSync(path.join(root, "src/internal/bundled/libs/extra.d.ts"), "not generated\n");
    const untracked = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.equal(untracked.untracked.length, 1);

    writeBundledGenerated(config, "rev");
    writeFileSync(
      path.join(root, "src/internal/bundled/libs/extra.d.ts"),
      '// Code generated by TSTS bundled generator. DO NOT EDIT.\n// @tsgo-generated {"schemaVersion":1,"kind":"bundled-generated","generator":"porter:bundled","sourceRevision":"rev","path":"internal/bundled/libs/extra.d.ts","contentHash":"x"}\n\n',
    );
    const orphan = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.equal(orphan.orphan.length, 1);

    writeBundledGenerated(config, "rev");
    writeFileSync(path.join(root, "src/internal/bundled/libs/extra.d.ts"), "// @tsgo-generated {bad-json}\n");
    const invalid = buildBundledGeneratedArtifactStatus(config, "rev");
    assert.equal(invalid.invalid.length, 1);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("authoredFacadeModules: authored modules are excluded from generation and exempt from generated checks", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const config = {
      ...baseConfig,
      tsRoot: path.relative(repoRoot, path.join(root, "src")).split(path.sep).join("/"),
      authoredFacadeModules: ["go/io.ts"],
    };
    const snapshot = snapshotWith([]);
    const generatedRoot = path.join(root, "src/go");
    mkdirSync(generatedRoot, { recursive: true });

    // The policy resolves "go/io.ts" to a full repo-relative path.
    assert.ok(authoredFacadePathSet(config).has(`${config.tsRoot}/go/io.ts`));

    // io.ts is excluded from the deterministic generated set (porter:facades will not regenerate it).
    const expected = renderExpectedGeneratedArtifacts(config, snapshot);
    assert.ok(!expected.has(`${config.tsRoot}/go/io.ts`));

    for (const [relativePath, text] of expected) {
      const targetPath = path.join(repoRoot, relativePath);
      mkdirSync(path.dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, text);
    }

    // A header-free authored io.ts is exempt: no missing/stale/orphan/untracked/invalid.
    writeFileSync(path.join(generatedRoot, "io.ts"), "export interface Writer { Write(p: number[]): [number, Error | undefined]; }\n");
    assert.deepEqual(buildGeneratedArtifactStatus(config, snapshot), { missing: [], stale: [], orphan: [], untracked: [], invalid: [] });

    // An authored module that still carries @tsgo-generated metadata is invalid (never both).
    writeFileSync(
      path.join(generatedRoot, "io.ts"),
      "// Code generated by TSTS porter. DO NOT EDIT.\n// @tsgo-generated {\"schemaVersion\":1,\"kind\":\"go-facade\",\"generator\":\"porter:facades\",\"path\":\"go/io.ts\",\"sourceRevision\":\"abc123\",\"contentHash\":\"x\"}\n\nexport {}\n",
    );
    const conflicted = buildGeneratedArtifactStatus(config, snapshot);
    assert.equal(conflicted.invalid.length, 1);
    assert.match(conflicted.invalid[0].reason, /Authored facade module must not carry @tsgo-generated/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ast-generator: Go flag const evaluation respects Go precedence and complement", () => {
  const source = [
    "package ast",
    "",
    "type SampleFlags uint32",
    "",
    "const (",
    "\tSampleFlagsNone      SampleFlags = 0",
    "\tSampleFlagsA         SampleFlags = 1 << 0",
    "\tSampleFlagsB         SampleFlags = 1 << 1",
    "\tSampleFlagsC         SampleFlags = 1 << 2",
    "\tSampleFlagsAll       SampleFlags = 1<<30 - 1 // trailing comment",
    "\tSampleFlagsAB                    = SampleFlagsA | SampleFlagsB",
    "\tSampleFlagsExcludesA             = SampleFlagsAll & ^SampleFlagsA",
    ")",
  ].join("\n");
  const consts = parseGoFlagFile(source, "SampleFlags").filter((entry) => entry.kind === "const");
  const byName = Object.fromEntries(consts.map((entry) => [entry.name, entry.value]));
  assert.equal(byName.SampleFlagsNone, 0);
  assert.equal(byName.SampleFlagsA, 1);
  assert.equal(byName.SampleFlagsC, 4);
  // Go binds `<<` tighter than `-`, so this is (1<<30)-1, NOT 1<<(30-1).
  assert.equal(byName.SampleFlagsAll, (1 << 30) - 1);
  assert.equal(byName.SampleFlagsAB, 3);
  // `& ^X` is bitwise-AND with the complement of X (uint32).
  assert.equal(byName.SampleFlagsExcludesA, (((1 << 30) - 1) & ~1) >>> 0);
});

test("ast-generator: kinds emit sequential values, markers, and a stringer", () => {
  const schema = {
    ast: {
      kinds: {
        elements: ["Unknown", "EndOfFile", { comment: "A group header" }, "Identifier"],
        markers: [{ name: "FirstNode", value: "Unknown" }],
      },
    },
  };
  const out = emitKinds(schema);
  assert.match(out, /export type Kind = short;/);
  assert.match(out, /export const KindUnknown: Kind = 0;/);
  assert.match(out, /export const KindEndOfFile: Kind = 1;/);
  assert.match(out, /\n\/\/ A group header\n/);
  // The comment-only element does not consume an enum index.
  assert.match(out, /export const KindIdentifier: Kind = 2;/);
  // Markers are aliases of an existing kind, not new values.
  assert.match(out, /export const KindFirstNode: Kind = KindUnknown;/);
  assert.match(out, /export function KindString\(kind: Kind\): string \{/);
});

function astFixtureConfig(root) {
  const rel = (target) => path.relative(repoRoot, target).split(path.sep).join("/");
  const schemaDir = path.join(root, "schema");
  mkdirSync(schemaDir, { recursive: true });
  writeFileSync(
    path.join(schemaDir, "ast.json"),
    JSON.stringify({ kinds: { elements: ["Unknown", "EndOfFile"], markers: [] }, bases: {}, nodes: { definitions: {}, aliases: {} } }),
  );
  writeFileSync(path.join(schemaDir, "nodeflags.go"), "package ast\n\ntype NodeFlags uint32\n\nconst (\n\tNodeFlagsNone NodeFlags = 0\n)\n");
  writeFileSync(path.join(schemaDir, "symbolflags.go"), "package ast\n\ntype SymbolFlags uint32\n\nconst (\n\tSymbolFlagsNone SymbolFlags = 0\n)\n");
  return {
    tsRoot: rel(path.join(root, "src")),
    astSchemaDir: rel(schemaDir),
    astGeneratedDir: "internal/ast/generated",
    astSchemaInputs: [
      rel(path.join(schemaDir, "ast.json")),
      rel(path.join(schemaDir, "nodeflags.go")),
      rel(path.join(schemaDir, "symbolflags.go")),
    ],
  };
}

const cleanAstStatus = { missing: [], stale: [], orphan: [], untracked: [], invalid: [] };

test("porter:ast --check detects missing/stale/orphan/untracked/invalid generated files", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const config = astFixtureConfig(root);
    const genDir = path.join(root, "src/internal/ast/generated");

    writeAstGenerated(config, "rev-fixture-1");
    assert.deepEqual(buildAstGeneratedArtifactStatus(config, "rev-fixture-1"), cleanAstStatus);

    // Missing.
    unlinkSync(path.join(genDir, "kinds.ts"));
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-1").missing.length, 1);
    writeAstGenerated(config, "rev-fixture-1", { force: true });

    // Stale.
    const kindsPath = path.join(genDir, "kinds.ts");
    writeFileSync(kindsPath, `${readFileSync(kindsPath, "utf8")}\nexport const sneaky = 1;\n`);
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-1").stale.length, 1);
    writeAstGenerated(config, "rev-fixture-1", { force: true });

    // Orphan: well-formed generated file no longer in the expected set.
    const expected = buildAstGeneratedFiles(config, "rev-fixture-1");
    writeFileSync(path.join(genDir, "orphan.ts"), expected.get("internal/ast/generated/kinds.ts"));
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-1").orphan.length, 1);
    unlinkSync(path.join(genDir, "orphan.ts"));

    // Untracked: file in the generated dir without @tsgo-generated metadata.
    writeFileSync(path.join(genDir, "loose.ts"), "export const loose = 1;\n");
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-1").untracked.length, 1);
    unlinkSync(path.join(genDir, "loose.ts"));

    // Invalid: @tsgo-generated metadata with the wrong kind/generator.
    writeFileSync(
      path.join(genDir, "wrongkind.ts"),
      '// Code generated\n// @tsgo-generated {"schemaVersion":1,"kind":"go-facade","generator":"porter:facades","path":"x","sourceRevision":"r","contentHash":"h"}\n\nexport {}\n',
    );
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-1").invalid.length, 1);
    unlinkSync(path.join(genDir, "wrongkind.ts"));

    assert.deepEqual(buildAstGeneratedArtifactStatus(config, "rev-fixture-1"), cleanAstStatus);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeAstGenerated honors the safe-write contract and --force", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const config = astFixtureConfig(root);
    const kindsPath = path.join(root, "src/internal/ast/generated/kinds.ts");
    writeAstGenerated(config, "rev-fixture-2");
    writeFileSync(kindsPath, `${readFileSync(kindsPath, "utf8")}\n// edited\n`);
    assert.throws(() => writeAstGenerated(config, "rev-fixture-2"), /refusing to overwrite/);
    writeAstGenerated(config, "rev-fixture-2", { force: true });
    assert.deepEqual(buildAstGeneratedArtifactStatus(config, "rev-fixture-2"), cleanAstStatus);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ast-generator: a schema input content change makes committed output stale", () => {
  const root = mkdtempSync(path.join(repoRoot, ".temp/porter-test-"));
  try {
    const config = astFixtureConfig(root);
    writeAstGenerated(config, "rev-fixture-3");
    assert.equal(buildAstGeneratedArtifactStatus(config, "rev-fixture-3").stale.length, 0);
    // Changing a declared schema input changes the schemaInputs digest in the header.
    writeFileSync(
      path.join(root, "schema/nodeflags.go"),
      "package ast\n\ntype NodeFlags uint32\n\nconst (\n\tNodeFlagsNone NodeFlags = 0\n\tNodeFlagsLet  NodeFlags = 1 << 0\n)\n",
    );
    assert.ok(buildAstGeneratedArtifactStatus(config, "rev-fixture-3").stale.length >= 1);
    assert.ok(existsSync(path.join(root, "src/internal/ast/generated/kinds.ts")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function snapshotWith(files) {
  return {
    sourceRoot: "/tmp/tsgo",
    gitRevision: "abc123",
    summary: {
      goFileCount: files.length,
      lineCount: files.reduce((sum, file) => sum + file.lineCount, 0),
      unitCount: files.reduce((sum, file) => sum + file.units.length, 0),
    },
    files,
  };
}

function emptyCounts() {
  return {
    parseErrors: 0,
    duplicateGoIDs: 0,
    duplicateTsIDs: 0,
    orphan: 0,
    forbiddenTsFiles: 0,
    untrackedTsFiles: 0,
    stale: 0,
    missing: 0,
    largeFileSplitFailures: 0,
  };
}

function emptyGeneratedArtifacts() {
  return { missing: [], stale: [], orphan: [], untracked: [], invalid: [] };
}

function fileRecord(overrides) {
  return {
    path: "internal/debug/debug.go",
    importPath: "github.com/microsoft/typescript-go/internal/debug",
    packageName: "debug",
    lineCount: 10,
    generated: false,
    units: [],
    featureCounts: {},
    ...overrides,
  };
}

function unitRecord(overrides) {
  const goPath = overrides?.goPath ?? "internal/debug/debug.go";
  const metadata = { goPath, ...(overrides?.metadata ?? {}) };
  const normalizedOverrides = { ...overrides };
  delete normalizedOverrides.goPath;
  delete normalizedOverrides.metadata;
  return {
    id: "m::internal/debug/debug.go::func::Fail",
    kind: "func",
    name: "Fail",
    qualifiedName: "Fail",
    generated: false,
    startLine: 1,
    endLine: 3,
    signature: "func Fail()",
    sigHash: "sig",
    bodyHash: "body",
    snippet: "func Fail() {}",
    nodeKindCounts: {},
    featureCounts: {},
    metadata,
    ...normalizedOverrides,
  };
}

function identType(name) {
  return { kind: "ident", name, text: name };
}

function selectorType(packageName, name) {
  return { kind: "selector", package: packageName, name, text: `${packageName}.${name}` };
}

function pointerType(element) {
  return { kind: "pointer", text: `*${element.text}`, element };
}

function sliceType(element) {
  return { kind: "slice", text: `[]${element.text}`, element };
}

function mapType(key, value) {
  return { kind: "map", text: `map[${key.text}]${value.text}`, key, value };
}

function channelType(element) {
  return { kind: "channel", text: `chan ${element.text}`, element, direction: "bidirectional" };
}

function instantiationType(element, typeArgs) {
  return { kind: "instantiation", text: `${element.text}[${typeArgs.map((arg) => arg.text).join(", ")}]`, element, typeArgs };
}

function funcType(parameters, results) {
  return { kind: "func", text: "func", parameters, results };
}

function interfaceType(members) {
  return { kind: "interface", text: "interface", members };
}

// ───────────────────────────────────────────────────────────────────────────
// AST node/data/factory/etc emitter tests (free-fn/adapter model).
// ───────────────────────────────────────────────────────────────────────────

test("ast-schema-model: alias derivation matches ast_generated.go (231 node + 71 union + 23 list)", () => {
  const ast = JSON.parse(readFileSync(resolveRepo("packages/tsts/schema/tsgo/ast.json"), "utf8"));
  const schema = new AstSchema(ast);
  const nodeAliasCount = schema.nodeNames().length
    + schema.nodeNames().reduce((acc, n) => acc + schema.instantiationAliasesOf(n).length, 0);
  assert.equal(nodeAliasCount, 231);
  assert.equal(Object.keys(schema.aliases).length, 71);
  assert.equal(Object.keys(schema.listAliases).length, 23);
});

test("ast-generator: Identifier_as_nodeData resolves FlowNodeData via promotion, not NodeDefault", () => {
  const files = buildAstGeneratedFiles(baseConfig, "rev-ast-1");
  const data = files.get("internal/ast/generated/data.ts");
  assert.ok(data.includes("export interface Identifier extends PrimaryExpressionBase, FlowNodeBase {"));
  // Promotion: Identifier embeds FlowNodeBase, so FlowNodeData -> FlowNodeBase_FlowNodeData.
  assert.match(data, /FlowNodeData: \(\) => FlowNodeBase_FlowNodeData\(receiver\),/);
  // No override -> NodeDefault for DeclarationData (Identifier has no DeclarationBase).
  assert.match(data, /DeclarationData: \(\) => NodeDefault_DeclarationData\(receiver\),/);
  // Leaf nodes still use NodeDefault for VisitEachChild.
  assert.match(data, /export function Identifier_as_nodeData\(receiver: GoPtr<Identifier>\): nodeData \{[\s\S]*?VisitEachChild: \(v\) => NodeDefault_VisitEachChild\(receiver, v\),/);
  // Child-bearing nodes get generated VisitEachChild rewrites.
  assert.match(data, /export function ExpressionStatement_VisitEachChild\(receiver: GoPtr<ExpressionStatement>, v: GoPtr<NodeVisitor>\): GoPtr<Node> \{\s*return Factory\.NodeFactory_UpdateExpressionStatement\(generatedVisitorFactory\(v\), receiver, generatedVisitNode\(v, receiver!\.Expression\) as GoPtr<Expression>\);\s*\}/);
  assert.match(data, /VisitEachChild: \(v\) => ExpressionStatement_VisitEachChild\(receiver, v\),/);
  // The brand carries the concrete receiver.
  assert.match(data, /\[goReceiverKey\]: receiver,/);
});

test("ast-generator: named concrete nodes expose their generated Name override", () => {
  const files = buildAstGeneratedFiles(baseConfig, "rev-ast-name");
  const data = files.get("internal/ast/generated/data.ts");
  assert.match(data, /export function ParameterDeclaration_Name\(receiver: GoPtr<ParameterDeclaration>\): GoPtr<Node> \{\s*return receiver!\.name;\s*\}/);
  assert.match(data, /Name: \(\) => ParameterDeclaration_Name\(receiver\),/);
});

test("ast-generator: NewIdentifier and AsIdentifier emit the faithful factory/cast", () => {
  const files = buildAstGeneratedFiles(baseConfig, "rev-ast-2");
  const factory = files.get("internal/ast/generated/factory.ts");
  assert.match(factory, /export interface NodeFactory \{[\s\S]*?AsNodeFactory\(\): GoPtr<NodeFactory>;/);
  assert.match(
    factory,
    /export function NewIdentifier\(receiver: GoPtr<NodeFactory>, text: string\): GoPtr<Node> \{[\s\S]*?return NodeFactory_newNode\(receiver, KindIdentifier, Identifier_as_nodeData\(data\)\);/,
  );
  const casts = files.get("internal/ast/generated/casts.ts");
  assert.match(casts, /export function AsIdentifier\(n: GoPtr<Node>\): GoPtr<Identifier> \{\s*return n!\.data\[goReceiverKey\] as GoPtr<Identifier>;/);
});

test("ast-schema-model: raw string lists are not children; node raw lists are GoPtr<Node>", () => {
  const ast = JSON.parse(readFileSync(resolveRepo("packages/tsts/schema/tsgo/ast.json"), "utf8"));
  const schema = new AstSchema(ast);
  // JSDocText.text is []string (raw) inherited from JSDocCommentBase -> not a child.
  const textField = schema.baseFields("JSDocCommentBase").find((f) => f.name === "text");
  assert.equal(textField.isChild(), false);
  assert.equal(textField.tsReference(), "GoSlice<string>");
});

test("ast-generator: multi-kind and type-parameter Is functions follow ast_generated.go", () => {
  const files = buildAstGeneratedFiles(baseConfig, "rev-ast-3");
  const predicates = files.get("internal/ast/generated/predicates.ts");
  // ForInOrOfStatement is multi-kind -> per-kind Is functions, no IsForInOrOfStatement.
  assert.ok(predicates.includes("export function IsForInStatement("));
  assert.ok(predicates.includes("export function IsForOfStatement("));
  assert.ok(!predicates.includes("export function IsForInOrOfStatement("));
  // Token is a type-parameter node -> a single IsToken switching over TokenSyntaxKind.
  assert.match(predicates, /export function IsToken\(node: GoPtr<Node>\): bool \{\s*switch \(node!\.Kind\)/);
});

test("ast-generator: generatedAstSkips records handWritten without visitEachChild deferral", () => {
  const skips = buildGeneratedAstSkips(baseConfig);
  assert.deepEqual(skips.handWritten, ["SourceFile"]);
  assert.deepEqual(skips.handWrittenVisitor, ["JSDocParameterOrPropertyTag"]);
  assert.deepEqual(skips.visitEachChildDeferred, []);
});

const SAMPLE_CATALOG = [
  "// Code generated by generate.go; DO NOT EDIT.",
  "",
  "package diagnostics",
  "",
  'var Unterminated_string_literal = &Message{code: 1002, category: CategoryError, key: "Unterminated_string_literal_1002", text: "Unterminated string literal."}',
  "",
  'var X_0_expected = &Message{code: 1005, category: CategoryError, key: "_0_expected_1005", text: "\'{0}\' expected."}',
  "",
  'var Module_declaration_names_may_only_use_or_quoted_strings = &Message{code: 1443, category: CategoryError, key: "Module_declaration_names_may_only_use_or_quoted_strings_1443", text: "Module declaration names may only use \' or \\" quoted strings."}',
  "",
  'var X_0_is_deprecated = &Message{code: 6385, category: CategorySuggestion, key: "_0_is_deprecated_6385", text: "\'{0}\' is deprecated.", reportsDeprecated: true}',
  "",
  'var Unreachable_code_detected = &Message{code: 7027, category: CategoryMessage, key: "Unreachable_code_detected_7027", text: "Unreachable code detected.", reportsUnnecessary: true}',
  "",
  "func keyToMessage(key Key) *Message {",
  "\tswitch key {",
  '\tcase "Unterminated_string_literal_1002":',
  "\t\treturn Unterminated_string_literal",
  "\tdefault:",
  "\t\treturn nil",
  "\t}",
  "}",
  "",
].join("\n");

function withSampleCatalog(run) {
  const dir = mkdtempSync(path.join(tmpdir(), "tsts-diag-catalog-"));
  const goPath = path.join(dir, "diagnostics_generated.go");
  writeFileSync(goPath, SAMPLE_CATALOG);
  // resolveRepo(path.resolve(...)) keeps absolute paths intact.
  const config = { tsRoot: "packages/tsts/src", diagnosticsCatalogInput: goPath };
  try {
    return run(config, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("diagnostics-generator: parseCatalog preserves code/category/key/text and bool fields exactly", () => {
  const records = parseCatalog(SAMPLE_CATALOG);
  assert.equal(records.length, 5);
  assert.deepEqual(records[0], {
    varName: "Unterminated_string_literal",
    code: 1002,
    category: "CategoryError",
    key: "Unterminated_string_literal_1002",
    text: "Unterminated string literal.",
    reportsUnnecessary: false,
    elidedInCompatibilityPyramid: false,
    reportsDeprecated: false,
  });
  // Go `\"` and `\\` escapes decode to the literal quote/backslash characters.
  assert.equal(
    records[2].text,
    `Module declaration names may only use ' or " quoted strings.`,
  );
  // Placeholder text round-trips.
  assert.equal(records[1].text, "'{0}' expected.");
  // Optional bool fields are parsed when present.
  assert.equal(records[3].reportsDeprecated, true);
  assert.equal(records[4].reportsUnnecessary, true);
});

test("diagnostics-generator: emitMessages renders faithful Message constants + keyToMessage", () => {
  const records = parseCatalog(SAMPLE_CATALOG);
  const body = emitMessages(records);
  // Each entry maps 1:1 to an exported Message const referencing the bare
  // category value constant.
  assert.match(
    body,
    /export const Unterminated_string_literal: Message = \{ code: 1002, category: CategoryError, key: "Unterminated_string_literal_1002", text: "Unterminated string literal\." \};/,
  );
  assert.ok(body.includes("const CategoryError: Category = 1;"));
  assert.ok(body.includes("const CategorySuggestion: Category = 2;"));
  assert.ok(body.includes("const CategoryMessage: Category = 3;"));
  assert.ok(!body.includes("const CategoryWarning: Category = 0;"));
  assert.ok(body.includes('import type { Category, Key, Message } from "../diagnostics.js";'));
  assert.ok(!body.includes("import {\n"));
  // Optional bool fields are emitted only when true, mirroring generate.go.
  assert.match(body, /text: "'\{0\}' is deprecated\.", reportsDeprecated: true \};/);
  assert.match(body, /text: "Unreachable code detected\.", reportsUnnecessary: true \};/);
  // keyToMessage maps key -> const, undefined default (Go nil).
  assert.match(body, /export function keyToMessage\(key: Key\): Message \| undefined \{/);
  assert.match(body, /case "Unterminated_string_literal_1002":\s*\n\s*return Unterminated_string_literal;/);
  assert.match(body, /default:\s*\n\s*return undefined;/);
});

test("diagnostics-generator: buildDiagnosticsGeneratedFiles embeds deterministic generated metadata", () => {
  withSampleCatalog((config) => {
    const files = buildDiagnosticsGeneratedFiles(config, "rev-diag-1");
    const text = files.get("internal/diagnostics/generated/messages.ts");
    assert.ok(text.startsWith("// Code generated by TSTS diagnostics generator. DO NOT EDIT.\n"));
    const metaMatch = /^\/\/ @tsgo-generated (\{.*\})$/m.exec(text);
    assert.ok(metaMatch, "expected @tsgo-generated metadata line");
    const metadata = JSON.parse(metaMatch[1]);
    assert.equal(metadata.kind, "diagnostics-generated");
    assert.equal(metadata.generator, "porter:diagnostics");
    assert.equal(metadata.sourceRevision, "rev-diag-1");
    assert.equal(metadata.inputs.length, 1);
    assert.ok(typeof metadata.contentHash === "string" && metadata.contentHash.length === 64);
    // Deterministic: same inputs produce byte-identical output.
    const again = buildDiagnosticsGeneratedFiles(config, "rev-diag-1");
    assert.equal(again.get("internal/diagnostics/generated/messages.ts"), text);
  });
});

test("diagnostics-generator: buildDiagnosticsGeneratedArtifactStatus detects missing/stale and writeDiagnosticsGenerated honors safe-write", () => {
  withSampleCatalog((sampleConfig) => {
    const tsRootAbs = mkdtempSync(path.join(tmpdir(), "tsts-diag-tsroot-"));
    const config = { ...sampleConfig, tsRoot: tsRootAbs };
    const messagesPath = path.join(tsRootAbs, "internal/diagnostics/generated/messages.ts");
    try {
      const missingStatus = buildDiagnosticsGeneratedArtifactStatus(config, "rev-diag-2");
      assert.ok(
        missingStatus.missing.length >= 1,
        "expected generated artifacts to be missing from the temp tsRoot",
      );

      writeDiagnosticsGenerated(config, "rev-diag-2", { force: true });
      const cleanStatus = buildDiagnosticsGeneratedArtifactStatus(config, "rev-diag-2");
      assert.equal(collectDiagnosticsArtifactFailures(cleanStatus).length, 0);

      writeFileSync(messagesPath, `${readFileSync(messagesPath, "utf8")}\n// stale edit\n`);
      const staleStatus = buildDiagnosticsGeneratedArtifactStatus(config, "rev-diag-2");
      assert.equal(staleStatus.stale.length, 1);
      assert.throws(
        () => writeDiagnosticsGenerated(config, "rev-diag-2", { force: false }),
        /refusing to overwrite existing diagnostics generated artifact/,
      );
      writeDiagnosticsGenerated(config, "rev-diag-2", { force: true });
      const restoredStatus = buildDiagnosticsGeneratedArtifactStatus(config, "rev-diag-2");
      assert.equal(collectDiagnosticsArtifactFailures(restoredStatus).length, 0);
    } finally {
      rmSync(tsRootAbs, { recursive: true, force: true });
    }
  });
});
