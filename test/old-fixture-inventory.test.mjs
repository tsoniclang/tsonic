import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOldSuiteInventoryReport,
  formatOldSuiteInventoryCounts,
  oldFixturePath,
  oldSuitePortInventory,
  oldSuiteRequiredSeedFixturePaths,
  validateOldSuitePortEntry,
} from "./old-suite-inventory/inventory.mjs";

const oldFixtureSource = "/home/jeswin/temp/tsonic-20260618-210710/test/fixtures";

const oldTsonicFixtureNames = [
  "action-func-callbacks",
  "advanced-generics-tsn7414",
  "anonymous-object-type-literal",
  "array-constructor",
  "array-destructuring",
  "array-double",
  "array-index-dotnet",
  "array-literal",
  "array-multidimensional",
  "array-spread",
  "array-type-emission",
  "arrow-contextual-advanced",
  "arrow-function",
  "arrow-inference",
  "arrow-return-object-literal",
  "asinterface-dotnet",
  "aspnetcore-dotnet",
  "async-basic",
  "async-bidirectional-generator",
  "async-higher-order",
  "async-ops-uses-map",
  "async-union-object-literal-return",
  "attributes-basic",
  "attributes-comprehensive",
  "await-task-dotnet",
  "barrel-reexports",
  "bidirectional-generator",
  "boolean-context-locals-dotnet",
  "cast-exemption-as-number",
  "cast-precedence",
  "char-invalid-tsn7418",
  "char-primitive",
  "class-basic",
  "class-constructor",
  "class-field-inference",
  "class-inheritance",
  "class-static-members",
  "closures",
  "clr-string-indexer-dotnet",
  "collections",
  "conditional-types",
  "continuewith-return-task-dotnet",
  "core-intrinsics-provenance",
  "date-not-global",
  "default-param-int-to-double",
  "defaultof-intrinsic",
  "delegate-types-comprehensive",
  "deterministic-typing-ergonomics",
  "dictionaries",
  "discriminant-equality",
  "dotnet-disallowed-js-builtins",
  "dotnet-test-command",
  "efcore-linq-async-dotnet",
  "efcore-precompile-queries-dotnet",
  "efcore-sqlite-dotnet",
  "extension-methods-dotnet",
  "extension-methods-system",
  "file-io",
  "finite-number-int-narrowing-reject",
  "first-next-ignored",
  "function-basic",
  "function-types-in-collections",
  "functions-returning-functions",
  "generator-different-treturn",
  "generator-return-value",
  "generic-chains",
  "generic-complex-chain",
  "generic-constraints-object-struct",
  "generic-constraints-single",
  "generic-contextual",
  "generic-function-declaration-alias",
  "generic-function-declaration-tsn7432",
  "generic-function-import-alias",
  "generic-function-import-tsn7432",
  "generic-function-type-aliases",
  "generic-function-value",
  "generic-function-value-alias",
  "generic-function-value-contextual",
  "generic-function-value-default-export",
  "generic-function-value-let-reassign-tsn7432",
  "generic-function-value-multi-declarator",
  "generic-function-value-nested",
  "generic-function-value-tsn7432",
  "generic-inference",
  "generic-inheritance-chain",
  "generic-inheritance-concrete",
  "generic-inheritance-generic",
  "generic-int-substitution",
  "generic-interface-inheritance",
  "generic-method-in-class",
  "generic-method-standalone",
  "generic-multiple-constraints",
  "generic-nested-substitution",
  "generic-null-default",
  "hello-world",
  "implements-clr-interface",
  "implicit-int-to-double",
  "import-type-erase",
  "instanceof-narrowing",
  "integer-casting",
  "interface-with-functions",
  "js-string-array-returns",
  "js-surface-array-from-map-keys",
  "js-surface-boolean-tostring",
  "js-surface-hello",
  "js-surface-json-typed-parse",
  "js-surface-node-aliases",
  "js-surface-node-boolean-tostring",
  "js-surface-node-date-union",
  "js-surface-runtime-builtins",
  "json-bcl-roundtrip",
  "json-native-inline-stringify",
  "json-native-roundtrip",
  "json-native-typed-stringify",
  "linq-dotnet",
  "linq-queryable-dotnet",
  "map-set-not-in-globals",
  "mapped-types",
  "method-overload-specialization",
  "method-overload-specialization-dotnet-string",
  "method-overload-specialization-multiparam",
  "module-const-array-mutation",
  "module-constants",
  "multi-file",
  "multi-file-imports",
  "multi-file-types",
  "multi-module-generators",
  "namespace-imports",
  "native-array-push-mutation",
  "nested-generic-brands",
  "nested-object-rest-destructuring",
  "nested-scopes",
  "never-generic-arg-tsn7419",
  "nodejs-path-posix-join",
  "nodejs-surface-alias-coverage",
  "nodejs-surface-imports-negative",
  "nodejs-surface-module-graph",
  "nonpromise-then-allowed",
  "nullable-narrowing",
  "nullish-coalescing",
  "nullish-coalescing-threading",
  "object-literal-accessors",
  "object-literal-computed-const-keys",
  "object-literal-method-accessor-js",
  "object-literal-method-arguments-destructured-reject",
  "object-literal-method-arguments-index",
  "object-literal-method-arguments-index-reject",
  "object-literal-method-arguments-length",
  "object-literal-method-shorthand",
  "object-literal-method-super-reject",
  "object-literal-method-this",
  "object-literal-object",
  "object-prop-int-to-double",
  "object-prop-int-to-int",
  "optional-chaining",
  "optional-function-params",
  "optional-value-type-properties",
  "override-protected-internal",
  "param-modifiers",
  "parseint-int-narrowing-reject",
  "pointer-types",
  "promise-chain-reject-stable",
  "promise-constructor-task",
  "promise-void-resolve",
  "property-override-virtual",
  "readonly-array-property-mutation",
  "recursive-tree",
  "recursive-type-no-hang",
  "return-in-control-flow",
  "shadowing",
  "source-package-basic",
  "source-package-subpath",
  "source-package-surface-mismatch",
  "stackalloc-span",
  "struct-basic",
  "switch-statement",
  "task-then-disallowed",
  "ternary-int-branch",
  "ternary-int-threading",
  "top-level-code",
  "tuple-cast-exemption",
  "tuple-int-elements",
  "type-alias-int-to-double",
  "type-assertions",
  "unprovable-numeric-narrowing",
  "utility-types",
  "variable-decls",
  "with-reject-stable",
  "yield-compound-assignment",
  "yield-conditional-expression",
  "yield-control-conditions",
  "yield-for-condition-update",
  "yield-for-declaration-initializer",
  "yield-for-initializer-assignment",
  "yield-forof-forin-expression",
  "yield-nested-expression-lowering",
  "yield-return-expression",
  "yield-switch-case-test-tsn6101",
];

const oldTsonicFixturePaths = oldTsonicFixtureNames.map(oldFixturePath);

const requiredRecoveryGroups = {
  "control-flow": ["switch-statement", "return-in-control-flow", "shadowing"],
  "arrays-tuples": ["array-destructuring", "array-spread", "tuple-int-elements"],
  "bindings": ["nested-object-rest-destructuring", "object-literal-object", "object-literal-method-this"],
  "generics": ["generic-inference", "generic-nested-substitution", "generic-method-in-class"],
  "narrowing": ["instanceof-narrowing", "nullable-narrowing", "discriminant-equality"],
  "source-semantics": ["struct-basic", "attributes-comprehensive", "defaultof-intrinsic"],
  "target-interop": ["linq-dotnet", "extension-methods-dotnet", "implements-clr-interface"],
  "js-node-surfaces": ["js-surface-hello", "nodejs-surface-module-graph", "nodejs-path-posix-join"],
  "async-generators": ["async-basic", "generator-return-value", "yield-nested-expression-lowering"],
  "diagnostics": ["char-invalid-tsn7418", "never-generic-arg-tsn7419", "with-reject-stable"],
};

test("old Tsonic fixture inventory is fully tracked for clean-suite recovery", () => {
  assert.equal(oldFixtureSource.endsWith("/test/fixtures"), true);
  assert.equal(oldTsonicFixtureNames.length, 198);
  assert.equal(new Set(oldTsonicFixtureNames).size, oldTsonicFixtureNames.length);
  assert.deepEqual([...oldTsonicFixtureNames].sort(), oldTsonicFixtureNames);

  for (const [group, names] of Object.entries(requiredRecoveryGroups)) {
    for (const name of names) {
      assert.equal(
        oldTsonicFixtureNames.includes(name),
        true,
        `missing ${group} recovery fixture ${name}`,
      );
    }
  }
});

test("old suite port inventory entries have required classification fields", () => {
  for (const entry of oldSuitePortInventory) {
    assert.deepEqual(validateOldSuitePortEntry(entry), [], entry.oldPath);
  }

  const oldPaths = oldSuitePortInventory.map((entry) => entry.oldPath);
  assert.equal(new Set(oldPaths).size, oldPaths.length);

  const oldFixturePathSet = new Set(oldTsonicFixturePaths);
  for (const seedPath of oldSuiteRequiredSeedFixturePaths) {
    assert.equal(oldFixturePathSet.has(seedPath), true, `seed source missing from historical fixture inventory: ${seedPath}`);
  }
});

test("old suite seed fixtures are classified", () => {
  const classifiedOldPathSet = new Set(oldSuitePortInventory.map((entry) => entry.oldPath));

  for (const seedPath of oldSuiteRequiredSeedFixturePaths) {
    assert.equal(classifiedOldPathSet.has(seedPath), true, `seed fixture is unclassified: ${seedPath}`);
  }
});

test("old suite inventory report counts are deterministic", () => {
  const report = buildOldSuiteInventoryReport(oldTsonicFixturePaths);

  assert.deepEqual(report.counts, {
    total: 198,
    reused: 0,
    ported: 39,
    "replaced-by-stronger-test": 0,
    "invalid-stale-architecture": 3,
    deferred: 156,
    unclassified: 0,
  });

  assert.equal(formatOldSuiteInventoryCounts(report.counts), [
    "total: 198",
    "reused: 0",
    "ported: 39",
    "replaced-by-stronger-test: 0",
    "invalid-stale-architecture: 3",
    "deferred: 156",
    "unclassified: 0",
  ].join("\n"));
  assert.deepEqual(report.classifiedUnknownOldPaths, []);
});

test("old suite inventory reports unclassified entries", () => {
  const report = buildOldSuiteInventoryReport(oldTsonicFixturePaths);

  assert.equal(report.unclassifiedOldPaths.length, report.counts.unclassified);
  assert.deepEqual(report.unclassifiedOldPaths, []);
  assert.equal(report.classifiedOldPaths.includes("test/fixtures/action-func-callbacks/"), true);
  assert.equal(report.unclassifiedOldPaths.includes("test/fixtures/hello-world/"), false);
  assert.equal(report.unclassifiedOldPaths.includes("test/fixtures/array-literal/"), false);
  assert.equal(report.unclassifiedOldPaths.includes("test/fixtures/dotnet-test-command/"), false);
  assert.equal(report.unclassifiedOldPaths.includes("test/fixtures/top-level-code/"), false);
});
