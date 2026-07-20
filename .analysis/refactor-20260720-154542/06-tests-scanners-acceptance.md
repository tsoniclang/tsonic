# 06 — Tests, Scanners, And Acceptance Checklist

Date: 2026-07-20. Status: proposed proof contract. Applies to every cleanup
step in `05-cleanup-plan.md` and to every feature afterward.

## Per-Layer Test Contract

| Layer | Required proof |
|---|---|
| L1 TSTS compiler | oracle/differential tests against pinned TS-Go behavior for every new or changed selection contract; never approximate TypeScript expectations |
| L2 Extension API | contract tests: evidence request → exact checker decision → finalized fact; deferral/replay order; atomic commit and rollback |
| L3 Shared Tsonic | composition tests: ownership intersection rejection, contribution freezing/validation, one-session behavior, artifact ledger validation |
| L4 Specific | provider declaration positive tests; selected-identity/overload proofs; missing-evidence negative tests; finalized-fact proofs; generated-output golden tests; runtime behavior tests |

A complete provider-backed executable operation such as `readFileSync`
requires all seven proofs:

1. provider declaration positive test;
2. overload/selected-identity proof;
3. missing-fact or unsupported negative test;
4. finalized-fact proof;
5. generated C# proof;
6. runtime/build proof;
7. capability-ledger entry.

The inventory itself is metadata, not proof. Other feature kinds use an
applicability matrix rather than pretending every feature has a provider or
runtime:

| Feature kind | Minimum required proof |
|---|---|
| Compiler-only source behavior | L1 positive and negative; exact diagnostic where rejected |
| Layer-2 extension contract | neutral producer/consumer request, finalization, idempotence, rollback, and missing-evidence proof |
| Shared Layer-3 capability | fake-target/plugin composition positive and conflict/isolation negative |
| Provider-backed target operation | all seven `readFileSync` proofs |
| Backend-only syntax lowering | source → finalized input → generated target syntax; build when target syntax validity is observable |
| Runtime public API | provider reachability or explicit internal/reject disposition plus runtime/oracle proof |
| Artifact/toolchain contract | descriptor validation, missing/conflict negative, generated project consumption |

Every non-applicable proof field requires a reason. A missing reason is an
inventory failure.

Example: `../csharp-nodejs/csharp/test/Tsonic.CSharp.Node.Tests/fs/readFileSync.tests.cs:5`
(runtime unit proof) plus `test/cli-build/nodejs-provider-package-modules-path-fs.test.mjs:372`
(full CLI/generated-C# proof).

## Fail-Closed Proof Obligations

- Invalid TypeScript is rejected by TSTS with no target rescue
  (`readFileSync(123, "utf8")` → source diagnostic, zero artifacts).
- Valid source with an unmapped target operation fails with the exact
  provider/signature identity and missing capability.
- Missing selected evidence defers during checking and rejects during
  finalization; no source-spelling recovery exists to test.
- Source-core identities survive alias, namespace, and re-export paths through
  compiler/provider identity. Struct and attribute facts bind to their exact
  selected subjects; comments, local spellings, and same-named declarations
  cannot change the result.

## Machine-Readable Ledger Evidence

Every ledger evidence row carries:

```ts
interface CapabilityEvidence {
    testId: string;       // stable test identity, not a path glob
    file: string;         // exact existing file
    suite: string;        // owning suite/runner
    layer: "L1" | "L2" | "L3" | "L4" | "toolchain";
    polarity: "positive" | "negative";
    observable: string;   // what behavior proves the capability
    applicability: "required" | "not-applicable";
    notApplicableReason?: string;
    toolchainRequirement?: string; // e.g. dotnet SDK, node runtime
}
```

Validation must independently verify: the file exists; the named test exists;
the test is in the runner; it passed in the current run; its layer and
polarity match the row. Nonexistent evidence paths degrade the row below
`complete` automatically (current snapshot: 328 rows, 320 `complete`, with 10
positive and 9 negative stale paths to re-prove — see `04` §19).

## Scanner Requirements

- Roots derived from workspace/package inventory, not hardcoded lists.
- Classifications attach to individual occurrences with reasons, never to
  whole files.
- Structural bans where possible (import-graph rules), not regex-only rules.
- Documentation examples are compiled.
- Missing ledger evidence is a scanner error.
- Generated output and all runtime/package roots are scanned.
- Every TSTS gap (37-issue register) is an explicit tracked issue with a
  closure gate; standing "TSTS contract gap" classifications expire.
- Deleted fact keys / reselection call sites have zero-occurrence scans after
  cleanup steps 4 and 6.
- Source-core scans reject module/export spelling policy, multi-subject fact
  fallback, and shared public builder-state/terminal fact keys.
- No count-based blessing: a test that passes by updating a number when a new
  cast/branch appears is a defect, not a gate.

## Mutation And Differential Proofs

- **Observation-order mutation** (step 5 exit): permute checker observation
  order; chosen carriers must not change.
- **Fact-authority mutation** (step 4 exit): remove a fact classified as a
  mirror; no consumer may compile against it, while complementary C# payload
  facts remain required by their exact operation identities.
- **Ownership mutation** (step 2 exit): introduce overlapping module claims in
  a fixture; composition must reject.
- **Evidence mutation** (step 10 exit): point a ledger row at a nonexistent
  test; validation must degrade the row.
- **Oracle differential** (step 9): JS/Node behavior matrices against real
  Node/ECMAScript outcomes for the §17/§18 cases
  (`(1e20).toString()`, `new Date("bad").getTime()`, typed-array
  `subarray` aliasing, sparse-array holes, `WeakMap` missing values,
  array-callback captured length, `JSON.stringify({x: undefined, y: NaN})`,
  `path.normalize`, `Buffer.slice` sharing, `realpathSync`, `URL`, assert
  deep equality).
- **RegExp retained-contract differential** (step 9): every pattern admitted
  by the closed C# subset remains equal to the Node oracle, and unsupported
  valid ECMAScript plus .NET-only syntax remain deterministic rejects.

## Acceptance Checklist

Per step (from `05`): the step's exit gate passes, its deletions are verified
gone by scan, its focused tests run green, and the work lands on the active
branch with a clean tree.

Final acceptance (all of `05` complete):

- [ ] `docs/architecture/**` tracked and is the only claimed authority;
      `.analysis` contains investigations only.
- [ ] Canonical inventory aggregate and generated reports regenerate cleanly;
      zero unclassified public items;
      every row has a disposition.
- [ ] One semantic session in `compileProject`; no preliminary scan, no
      runtime AST rescan.
- [ ] Ownership intersections rejected at composition with a diagnostic.
- [ ] One fact authority per meaning; no custom/standard precedence anywhere;
      deleted keys absent from source and generated output.
- [ ] Lifecycle order enforced: prerequisites → retained operations → target
      policy during finalization → atomic operation/payload commit → aggregate
      target plans → seal → backend; observation-order mutation test green.
- [ ] Backend input is frozen `FinalizedTargetProgram`; zero checker
      re-entry, zero name inference, zero shadow AST mirrors.
- [ ] Provider models validate completely; contradictory/duplicate rows
      rejected; no fabricated operations.
- [ ] Source-core re-export identity uses normal compiler/provider identity;
      struct and terminal attribute facts have one exact subject/owner and no
      spelling or subject-fallback path.
- [ ] Runtime artifact ledger closed: existence/hash/dependency proven before
      emission; structured diagnostics only.
- [ ] `tsonic.json` carries no open MSBuild/NuGet/publish/AOT build knobs;
      retained framework/assembly/provider options are proven semantic inputs,
      not native project configuration; user-owned `.csproj` mode is intact.
- [ ] JS/Node oracle matrices green; every public runtime API dispositioned.
- [ ] Ledger evidence machine-validated against executed tests; stale rows
      degraded and re-proven or removed.
- [ ] Scanners per-occurrence, workspace-derived, structural where possible;
      zero whole-file blessings.
- [ ] Full parallel suite runs from clean committed heads only after focused
      architecture proofs: `npm test` in `tsonic`, `npm test` in
      `tsonic-csharp`, `npm test` in `csharp-nodejs`, `dotnet test` in
      `csharp-js`, and applicable `csharp-runtime`/downstream project gates.
      Reports contain exact shard and test counts with zero failures and zero
      unexpected skips/todos.
- [ ] No dual paths: every superseded abstraction, fallback, compatibility
      route, and stale doc deleted in the same change that replaced it.
