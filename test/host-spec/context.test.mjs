import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { before, test } from "node:test";
import { orderedDomain } from "./runner/assertions.mjs";
import { withSpecProject } from "./runner/project.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const source = resolve(repository, "packages/host/src");
const none = Object.freeze({ kind: "none" });
const dimensions = Object.freeze(["keys", "work", "rows", "depth"]);
let factory;

before(async () => {
  await withSpecProject([], async project => {
    const ownerFiles = (await readdir(resolve(source, "context"))).filter(name => name.endsWith(".ts")).sort();
    orderedDomain(ownerFiles, ["contract.ts", "failures.ts", "keys.ts", "program.ts", "question.ts",
      "register.ts", "resources.ts"], Object.is, "complete actual Context source domain");
    const probe = resolve(project.root, "binding.mts");
    await writeFile(probe, `import {contextFactory} from ${JSON.stringify(resolve(source, "context/register.js"))};
import type {ContextFactory} from ${JSON.stringify(resolve(source, "context/contract.js"))};
const exact: ContextFactory = contextFactory; void exact;\n`);
    const output = resolve(repository, ".temp/context-runtime");
    await rm(output, { recursive: true, force: true });
    const result = spawnSync(resolve(repository, "node_modules/.bin/tsgo"), ["--ignoreConfig", "--strict",
      "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--noUnusedLocals", "--noUnusedParameters",
      "--noImplicitReturns", "--noFallthroughCasesInSwitch", "--skipLibCheck", "false", "--noEmitOnError",
      "--module", "nodenext", "--target", "es2022", "--types", "node", "--declaration", "--listFiles",
      "--rootDir", repository, "--outDir", output, probe,
      ...ownerFiles.map(name => resolve(source, "context", name)), resolve(source, "model/contract.ts")], {
      cwd: repository, encoding: "utf8", timeout: 60_000, maxBuffer: 262_144,
    });
    assert.equal(result.error === undefined && result.signal === null, true, "fresh strict source compiler terminated");
    assert.equal(result.status, 0, result.stdout.slice(0, 16_384));
    assert.equal(result.stderr, "");
    const localInputs = result.stdout.split(/\r?\n/u).filter(path => path.startsWith(source));
    orderedDomain(localInputs.sort(), [...ownerFiles.map(name => resolve(source, "context", name)),
      resolve(source, "model/contract.ts")].sort(), Object.is, "complete isolated production input closure");
    const actual = await import(pathToFileURL(resolve(output, "packages/host/src/context/register.js")).href);
    orderedDomain(Object.keys(actual), ["contextFactory"], Object.is, "actual sole runtime export");
    factory = actual.contextFactory;
    assert.equal(Object.isFrozen(factory), true);
  });
});

function domain(name = "work", admission = "operation", changes = {}) {
  return Object.freeze({ name, admission, keyDimension: "keys", limits: Object.freeze(dimensions.map(dimension =>
    Object.freeze({ dimension, limit: changes[dimension] ?? 100_000n }))) });
}

function create(domains = [domain()]) {
  const context = factory.create(Object.freeze({ resourceDomains: Object.freeze(domains) }));
  const owner = Object.freeze({ programIdentity: context.programIdentity, owner: "mechanical" });
  const scope = context.resourceScope(domains[0].name, owner, none);
  return { context, owner, scope, providers: [] };
}

function register(harness, name, provider, {
  retention = "immutable", scope = harness.scope, declared = scope.domain,
  authenticate = input => ({ scope, parts: Object.freeze([input]) }),
} = {}) {
  const registration = harness.context.register({ owner: "mechanical", name, domain: declared, retention, authenticate });
  if (provider !== undefined) harness.providers.push(() => registration.provide(provider));
  return registration;
}

function connect(harness) {
  for (const provide of harness.providers.splice(0)) provide();
}

function seal(harness) {
  connect(harness);
  harness.context.sealRegistration();
}

function code(action, expected, owner) {
  let captured;
  assert.throws(action, error => {
    captured = error;
    return error instanceof Error && error.code === expected && (owner === undefined || error.owner === owner);
  }, expected);
  return captured;
}

function exhausted(action, dimension, limit, owner = "mechanical") {
  let failure;
  assert.throws(action, error => {
    failure = error;
    return error instanceof Error && error.kind === "compiler-resource-limit"
      && error.dimension === dimension && error.limit === limit;
  }, `${dimension} exact resource exhaustion`);
  const observed = factory.resourceLimitDiagnostic(failure);
  assert.equal(observed.kind, "present");
  assert.equal(observed.value, failure.diagnostic, "same canonical diagnostic identity");
  assert.equal(observed.value.code, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(observed.value.owner, owner);
  assert.equal(observed.value.site, none);
  orderedDomain(observed.value.evidence.map(entry => entry.name),
    ["domain", "dimension", "limit", "attempted"], Object.is, "complete failure evidence");
  assert.equal(Object.isFrozen(failure), true);
  for (const field of ["kind", "dimension", "limit", "diagnostic"]) {
    const descriptor = Object.getOwnPropertyDescriptor(failure, field);
    assert.equal(descriptor !== undefined && "value" in descriptor && descriptor.writable === false, true, field);
  }
  return failure;
}

function usage(context, dimension) {
  const rows = context.queryUsage.resources.filter(row => row.dimension === dimension);
  return rows.reduce((sum, row) => sum + row.charged, 0n);
}

function resourceRows(context, expected) {
  const rows = context.queryUsage.resources;
  orderedDomain(rows.map(row => row.dimension).sort(), [...expected].sort(), Object.is,
    "complete observed resource dimension domain");
  return rows;
}

test("complete immutable policies reject malformed, missing, sparse and accessor data before state", () => {
  const valid = domain();
  const bad = [null, undefined, {}, { resourceDomains: Object.freeze([valid]) },
    Object.freeze({ resourceDomains: [valid] }), Object.freeze({ resourceDomains: Object.freeze([,]) })];
  for (const value of bad) code(() => factory.create(value), "INVALID_CONTEXT_INPUT");
  let reads = 0;
  const accessor = Object.freeze({ get resourceDomains() { reads += 1; return []; } });
  code(() => factory.create(accessor), "INVALID_CONTEXT_INPUT");
  assert.equal(reads, 0);
  const domainCases = [null, {}, Object.freeze({ ...valid, name: "" }),
    Object.freeze({ ...valid, admission: "global" }), Object.freeze({ ...valid, keyDimension: "" }),
    Object.freeze({ ...valid, keyDimension: "absent" }), Object.freeze({ ...valid, limits: [] }),
    Object.freeze({ ...valid, limits: Object.freeze([,]) }),
    ...[null, {}, Object.freeze({ dimension: "", limit: 1n }),
      Object.freeze({ dimension: "keys", limit: -1n }), Object.freeze({ dimension: "keys", limit: 1 })]
      .map(limit => Object.freeze({ ...valid, limits: Object.freeze([limit]) })),
    Object.freeze({ ...valid, limits: Object.freeze([valid.limits[0], valid.limits[0]]) })];
  assert.equal(domainCases.length, 14, "complete malformed policy domain");
  for (const candidate of domainCases) code(() => create([candidate]), "INVALID_CONTEXT_INPUT");
  code(() => create([valid, valid]), "INVALID_CONTEXT_INPUT");
  const empty = factory.create(Object.freeze({ resourceDomains: Object.freeze([]) }));
  empty.sealRegistration(); empty.close(); empty.close();
});

test("registration seals the full registry before invocation and preserves actual handle authority", () => {
  const harness = create();
  let calls = 0;
  const first = register(harness, "first", input => { calls += 1; return input + 1; });
  const second = register(harness, "unused", undefined);
  code(() => harness.context.query(first.question, 1), "REGISTRATION_UNSEALED", "mechanical");
  code(() => register(harness, "first", () => 0), "DUPLICATE_QUESTION", "mechanical");
  connect(harness);
  code(() => register(harness, "after-connection", () => 0), "REGISTRATION_SEALED", "mechanical");
  code(() => first.provide(() => 0), "DUPLICATE_PROVIDER", "mechanical");
  code(() => harness.context.sealRegistration(), "MISSING_PROVIDER", "mechanical");
  assert.equal(calls, 0, "neither failed seal nor registration runs providers");
  code(() => second.provide(null), "INVALID_CONTEXT_INPUT");
  second.provide(() => "unused"); harness.context.sealRegistration();
  assert.equal(harness.context.query(first.question, 1), 2);
  assert.equal(harness.context.query(first.question, 1), 2);
  assert.equal(calls, 1);
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first.question), true);
  for (const fake of [{ ...first.question }, Object.create(first.question), null, () => 0]) {
    code(() => harness.context.query(fake, 1), "FOREIGN_QUESTION");
  }
  const foreign = create();
  code(() => foreign.context.query(first.question, 1), "FOREIGN_QUESTION");
  code(() => register(harness, "late", () => 0), "REGISTRATION_SEALED");
  code(() => first.provide(() => 0), "REGISTRATION_SEALED");
  code(() => harness.context.sealRegistration(), "REGISTRATION_SEALED");
  code(() => new harness.context.constructor(Symbol(), {}), "INVALID_CONTEXT_INPUT");
  harness.context.close(); harness.context.close();
  for (const action of [() => harness.context.query(first.question, 1), () => register(harness, "closed", () => 0),
    () => harness.context.sealRegistration(), () => harness.context.queryUsage,
    () => harness.context.resourceScope("work", harness.owner, none), () => first.provide(() => 0),
    () => harness.scope.charge("work", 1n)]) code(action, "CONTEXT_CLOSED");
  foreign.context.close();
});

test("definition data and captured domain are complete, not chosen from returned authentication scope", () => {
  const harness = create([domain("first"), domain("second")]);
  const valid = { owner: "mechanical", name: "valid", domain: "first", retention: "immutable",
    authenticate: () => ({ scope: harness.scope, parts: Object.freeze([]) }) };
  for (const definition of [null, {}, { ...valid, owner: "" }, { ...valid, name: "" },
    { ...valid, domain: "missing" }, { ...valid, retention: "forever" }, { ...valid, authenticate: 1 }]) {
    code(() => harness.context.register(definition), "INVALID_CONTEXT_INPUT");
  }
  let read = 0;
  code(() => harness.context.register({ ...valid, get domain() { read += 1; return "first"; } }), "INVALID_CONTEXT_INPUT");
  assert.equal(read, 0);
  const other = harness.context.resourceScope("second", harness.owner, none);
  const wrong = register(harness, "wrong", () => 0, { declared: "first", scope: other });
  const captured = harness.context.register(valid); captured.provide(() => 1);
  valid.domain = "missing"; valid.name = "changed"; valid.authenticate = () => { throw Error("mutated"); };
  seal(harness);
  code(() => harness.context.query(wrong.question, 1), "INVALID_RESOURCE_SCOPE");
  assert.equal(harness.context.query(captured.question, 0), 1);
  assert.equal(captured.question.name, "valid");
  harness.context.close();
});

test("authentication runs before hits; foreign/copied/getter/closed scopes never borrow authority", () => {
  const harness = create(); const other = create();
  const issued = new Set(); let authentications = 0; let calls = 0;
  const input = Object.freeze({ token: 1 }); issued.add(input);
  const question = register(harness, "issued", () => { calls += 1; return "answer"; }, {
    authenticate: value => {
      authentications += 1;
      if (!issued.has(value)) throw Error("not issued");
      return { scope: harness.scope, parts: Object.freeze(["same"]) };
    },
  });
  let supplied = harness.scope;
  const scopeQuestion = register(harness, "scope", () => 1, {
    authenticate: () => ({ scope: supplied, parts: Object.freeze([]) }),
  });
  const malformed = register(harness, "identity", () => 1, { authenticate: value => value });
  seal(harness);
  assert.equal(harness.context.query(question.question, input), "answer");
  assert.equal(harness.context.query(question.question, input), "answer");
  assert.throws(() => harness.context.query(question.question, Object.freeze({ token: 1 })), /not issued/u);
  assert.equal(calls, 1); assert.equal(authentications, 3);
  for (const scope of [other.scope, { ...harness.scope }, Object.create(harness.scope)]) {
    supplied = scope; code(() => harness.context.query(scopeQuestion.question, 0), "INVALID_RESOURCE_SCOPE");
  }
  let read = 0;
  for (const bad of [null, {}, { get scope() { read += 1; return harness.scope; }, parts: [] }]) {
    code(() => harness.context.query(malformed.question, bad), "INVALID_QUESTION_KEY");
  }
  assert.equal(read, 0);
  supplied = harness.scope;
  assert.equal(harness.context.query(scopeQuestion.question, 0), 1);
  harness.scope.close(); harness.scope.close();
  code(() => harness.context.query(scopeQuestion.question, 0), "INVALID_RESOURCE_SCOPE");
  code(() => harness.scope.charge("work", 0n), "INVALID_RESOURCE_SCOPE");
  harness.context.close(); other.context.close();
});

test("domain frames precede authentication, reject reentrancy and do not merge independent domains", () => {
  const harness = create([domain("first", "operation", { work: 2n }), domain("second", "operation", { work: 2n })]);
  const secondScope = harness.context.resourceScope("second", harness.owner, none);
  let childCalls = 0; let mode = "reenter";
  const child = register(harness, "child", (_, scope) => { childCalls += 1; scope.charge("work", 2n); return 1; },
    { scope: secondScope });
  const parent = register(harness, "parent", (_, scope) => {
    scope.charge("work", 1n);
    return harness.context.query(child.question, 0);
  }, { authenticate: () => {
    harness.scope.charge("work", 1n);
    if (mode === "reenter") harness.context.query(child.question, 0);
    if (mode === "foreign-domain") secondScope.charge("work", 1n);
    return { scope: harness.scope, parts: Object.freeze([mode]) };
  } });
  seal(harness);
  for (const action of [() => harness.scope.charge("work", 0n),
    () => harness.scope.reserve("rows", 0n, "temporary"), () => harness.scope.withDepth("depth", () => 0)]) {
    code(action, "INVALID_RESOURCE_SCOPE");
  }
  code(() => harness.context.query(parent.question, 0), "AUTHENTICATION_REENTRANCY");
  assert.equal(childCalls, 0);
  mode = "foreign-domain"; code(() => harness.context.query(parent.question, 0), "INVALID_RESOURCE_SCOPE");
  mode = "normal"; assert.equal(harness.context.query(parent.question, 0), 1);
  assert.equal(childCalls, 1);
  harness.context.close();
});

test("all complete outcomes retain original identity; incomplete and thrown results retry without residue", () => {
  const harness = create(); let calls = 0;
  const outcomes = Object.freeze(["none", "present", "resolved", "refused", "pending", "unresolved", "partial"]);
  const values = new Map(outcomes.map(kind => [kind, Object.freeze({ kind, value: kind })]));
  let current;
  const registered = register(harness, "outcomes", () => { calls += 1; return current; }, { retention: "completed-outcome" });
  const thrown = Error("original provider failure"); let failure = thrown;
  const fallible = register(harness, "fallible", () => { if (failure !== undefined) throw failure; return "recovered"; });
  const mutable = register(harness, "mutable", () => ({}));
  const badOutcome = register(harness, "bad-outcome", input => input, { retention: "completed-outcome",
    authenticate: () => ({ scope: harness.scope, parts: Object.freeze([]) }) });
  seal(harness);
  orderedDomain([...values.keys()], outcomes, Object.is, "every closed outcome arm");
  for (const kind of outcomes) {
    current = values.get(kind);
    assert.equal(harness.context.query(registered.question, kind), current);
    assert.equal(harness.context.query(registered.question, kind), current);
  }
  assert.equal(calls, 10, "four completed arms once, three incomplete arms twice");
  for (const kind of ["pending", "partial", "unresolved"]) {
    current = values.get("resolved");
    assert.equal(harness.context.query(registered.question, kind), current);
    assert.equal(harness.context.query(registered.question, kind), current);
  }
  assert.equal(calls, 13);
  assert.throws(() => harness.context.query(fallible.question, 0), error => error === thrown);
  assert.equal(factory.resourceLimitDiagnostic(thrown).kind, "none");
  failure = "non-Error";
  assert.throws(() => harness.context.query(fallible.question, 0), error => error === "non-Error");
  failure = undefined;
  assert.equal(harness.context.query(fallible.question, 0), "recovered");
  code(() => harness.context.query(mutable.question, 0), "INVALID_CONTEXT_INPUT");
  for (const value of [1, Object.freeze({}), Object.freeze({ kind: 1 }), Object.freeze({ get kind() { throw thrown; } })]) {
    code(() => harness.context.query(badOutcome.question, value), "INVALID_CONTEXT_INPUT");
  }
  const observed = harness.context.queryUsage.questions;
  orderedDomain(observed.map(row => row.name), ["outcomes", "fallible", "mutable", "bad-outcome"], Object.is,
    "complete registered outcome/error question domain");
  assert.equal(observed.every(row => row.active === 0n), true);
  harness.context.close();
});

test("two typed registrations connect mutually; identical active keys give the whole scalar chain", () => {
  const harness = create();
  const first = register(harness, "first", undefined);
  const second = register(harness, "second", undefined);
  let cycle = true;
  first.provide(input => harness.context.query(second.question, input));
  second.provide(input => cycle ? harness.context.query(first.question, input)
    : input === 0 ? 0 : harness.context.query(first.question, input - 1) + 1);
  harness.context.sealRegistration();
  const error = code(() => harness.context.query(first.question, 2), "QUESTION_CYCLE", "mechanical");
  orderedDomain(error.chain.map(entry => entry.question), ["first", "second", "first"], Object.is, "complete cycle chain");
  assert.equal(Object.isFrozen(error.chain) && error.chain.every(Object.isFrozen), true);
  assert.equal(error.chain.every(entry => entry.site === none || entry.site.kind === "none"), true);
  cycle = false;
  assert.equal(harness.context.query(first.question, 2), 2);
  orderedDomain(harness.context.queryUsage.questions.map(row => row.name), ["first", "second"], Object.is,
    "complete recursive question domain before counters");
  assert.equal(harness.context.queryUsage.questions.every(row => row.active === 0n), true);
  harness.context.close();
});

test("exact tuple keys preserve scalar types, order, environments, purposes and actual identities", () => {
  const harness = create(); let calls = 0;
  const question = register(harness, "keys", () => ++calls, {
    authenticate: parts => ({ scope: harness.scope, parts }),
  });
  seal(harness);
  const anotherOwner = Object.freeze({ programIdentity: harness.context.programIdentity, owner: "mechanical" });
  const keys = [[1], [1n], ["1"], [true], [false], [null], [0], [-0], [NaN], [Infinity], [-Infinity],
    ["a", "b"], ["b", "a"], ["a"], [], [harness.owner], [anotherOwner],
    ["environment", 1], ["environment", 2], ["purpose", 1], [["nested"]], ["nested"], ["a", "a"]].map(Object.freeze);
  assert.equal(keys.length, 23, "complete key opposite domain, including duplicate child cardinality");
  const answers = keys.map(key => harness.context.query(question.question, key));
  assert.equal(new Set(answers).size, keys.length);
  for (let index = 0; index < keys.length; index += 1) {
    assert.equal(harness.context.query(question.question, Object.freeze([...keys[index]])), answers[index]);
  }
  assert.equal(harness.context.query(question.question, Object.freeze([Number("not-number")])), answers[8]);
  assert.equal(calls, keys.length);
  const snapshots = [harness.context.queryUsage, harness.context.queryUsage];
  assert.notEqual(snapshots[0], snapshots[1]);
  assert.equal(snapshots.every(snapshot => Object.isFrozen(snapshot) && Object.isFrozen(snapshot.questions)
    && Object.isFrozen(snapshot.resources) && snapshot.resources.every(Object.isFrozen)), true);
  orderedDomain(snapshots[0].questions.map(row => row.name), ["keys"], Object.is, "complete question usage domain");
  orderedDomain(snapshots[0].resources.map(row => row.dimension), ["keys"], Object.is, "complete observed resource domain");
  assert.equal(snapshots[0].questions[0].completed, 23n);
  assert.equal(snapshots[0].questions[0].hits, 24n);
  harness.context.close();
});

test("key validation rejects every unsupported, mutable, sparse, accessor, foreign and cyclic tuple", () => {
  const harness = create(); const foreign = create(); let calls = 0; let reads = 0;
  const question = register(harness, "invalid", () => ++calls, { authenticate: parts => ({ scope: harness.scope, parts }) });
  seal(harness);
  const cyclic = []; cyclic.push(cyclic); Object.freeze(cyclic);
  const getter = []; Object.defineProperty(getter, 0, { get() { reads += 1; return 0; } }); Object.freeze(getter);
  const fake = Object.freeze({ get programIdentity() { reads += 1; return harness.context.programIdentity; }, owner: "test" });
  const cases = [null, {}, [], Object.freeze([undefined]), Object.freeze([Symbol()]), Object.freeze([() => 0]),
    Object.freeze([{}]), Object.freeze([Object.freeze({})]), Object.freeze([Object.freeze({ programIdentity:
      harness.context.programIdentity, owner: "" })]), Object.freeze([foreign.owner]), Object.freeze([fake]),
    Object.freeze([,]), Object.freeze([[]]), getter, cyclic];
  assert.equal(cases.length, 15, "complete invalid key domain");
  for (const parts of cases) code(() => harness.context.query(question.question, parts), "INVALID_QUESTION_KEY");
  assert.equal(reads, 0); assert.equal(calls, 0);
  assert.equal(harness.context.query(question.question, Object.freeze(["valid"])), 1);
  harness.context.close(); foreign.context.close();
});

test("shared tuple cold work is linear in distinct nodes and edges; a warm root authenticates but does not rewalk", () => {
  const harness = create(); let authentications = 0;
  const question = register(harness, "sharing", () => "complete", { authenticate: parts => {
    authentications += 1; return { scope: harness.scope, parts };
  } }); seal(harness);
  const levels = 80; const width = 64;
  let child = Object.freeze(["leaf"]);
  for (let index = 0; index < levels; index += 1) child = Object.freeze([child, child]);
  const root = Object.freeze(Array.from({ length: width }, () => child));
  const distinctNodes = levels + 2; const edges = 2 * levels + width + 1;
  const bound = 20n * BigInt(distinctNodes + edges + "leaf".length);
  assert.equal(harness.context.query(question.question, root), "complete");
  const cold = usage(harness.context, "keys");
  assert.equal(cold <= bound && cold > BigInt(edges), true, `charged ${cold}; derived bound ${bound}`);
  assert.equal(harness.context.query(question.question, root), "complete");
  assert.equal(usage(harness.context, "keys") - cold, 1n, "one admitted root-summary lookup, no descendant replay");
  assert.equal(authentications, 2);
  assert.equal(harness.context.query(question.question, Object.freeze([child])), "complete");
  assert.equal(harness.context.queryUsage.questions[0].completed, 2n, "wide and singleton shared-child vectors stay distinct");
  harness.context.close();
});

test("every dimension/policy has below/at/over exact finite charging, with invalid inputs before arithmetic", () => {
  orderedDomain(dimensions, ["keys", "work", "rows", "depth"], Object.is, "complete policy dimension domain");
  for (const admission of ["operation", "cohort"]) {
    for (const dimension of dimensions) {
      for (const offset of [-1n, 0n, 1n]) {
        const limit = dimension === "keys" ? 8n : 2n;
        const harness = create([domain("work", admission, { [dimension]: limit })]);
        const parts = Object.freeze([]);
        const question = register(harness, "limit", (_, scope) => {
          const amount = limit + offset - (dimension === "keys" ? 4n : 0n);
          scope.charge(dimension, amount); return "complete";
        }, { authenticate: () => ({ scope: harness.scope, parts }) });
        seal(harness);
        if (offset === 1n) exhausted(() => harness.context.query(question.question, 0), dimension, limit);
        else assert.equal(harness.context.query(question.question, 0), "complete");
        harness.context.close();
      }
    }
    const harness = create([domain("work", admission)]);
    const invalid = register(harness, "invalid-resource", (_, scope) => {
      for (const action of [() => scope.charge("missing", 0n), () => scope.charge("work", -1n),
        () => scope.charge("work", 1), () => scope.reserve("rows", -1n, "retained"),
        () => scope.reserve("rows", 1n, "forever"), () => scope.withDepth("missing", () => 0)]) {
        code(action, "INVALID_RESOURCE_SCOPE");
      }
      return "complete";
    });
    seal(harness); harness.context.query(invalid.question, 0); harness.context.close();
  }
});

test("operation roots reset independently while nested same-domain work shares the real finite frame", () => {
  const harness = create([domain("work", "operation", { work: 2n })]);
  const question = register(harness, "production", (input, scope) => {
    scope.charge("work", 2n); return input;
  });
  const nested = register(harness, "nested", (input, scope) => {
    scope.charge("work", 1n); return harness.context.query(question.question, input);
  }); seal(harness);
  assert.equal(harness.context.query(question.question, 1), 1);
  assert.equal(harness.context.query(question.question, 2), 2);
  exhausted(() => harness.context.query(nested.question, 3), "work", 2n);
  assert.equal(harness.context.query(question.question, 3), 3, "failed nested root leaves no memo/frame residue");
  assert.equal(usage(harness.context, "work"), 7n);
  harness.context.close();
});

test("cohort owner identity cannot reset charged totals through scope.close or replacement wrappers", () => {
  const harness = create([domain("work", "cohort", { work: 2n })]);
  harness.scope.charge("work", 1n); harness.scope.close();
  const replacement = harness.context.resourceScope("work", harness.owner, none);
  replacement.charge("work", 1n);
  exhausted(() => replacement.charge("work", 1n), "work", 2n);
  const distinctOwner = Object.freeze({ programIdentity: harness.context.programIdentity, owner: "second-real-owner" });
  const independent = harness.context.resourceScope("work", distinctOwner, none);
  independent.charge("work", 2n);
  exhausted(() => independent.charge("work", 1n), "work", 2n, "second-real-owner");
  code(() => harness.context.resourceScope("missing", harness.owner, none), "INVALID_RESOURCE_SCOPE");
  for (const owner of [null, 1, {}, { ...harness.owner }, Object.freeze({ ...harness.owner, owner: "" }),
    Object.freeze({ programIdentity: Object.freeze({ kind: "program" }), owner: "foreign" })]) {
    code(() => harness.context.resourceScope("work", owner, none), "INVALID_RESOURCE_SCOPE");
  }
  for (const site of [null, 1, {}, Object.freeze({ kind: "bad" }), Object.freeze({ kind: "present" })]) {
    code(() => harness.context.resourceScope("work", harness.owner, site), "INVALID_RESOURCE_SCOPE");
  }
  harness.context.close();
});

test("temporary/staged leases release on every exit; only completed retained rows transfer", () => {
  for (const admission of ["operation", "cohort"]) {
    const harness = create([domain("work", admission, { rows: 3n })]);
    let retained; let temporary; let mode = "throw";
    const failure = Error("original");
    const question = register(harness, "leases", (_, scope) => {
      temporary = scope.reserve("rows", 1n, "temporary");
      retained = scope.reserve("rows", 2n, "retained");
      exhausted(() => scope.reserve("rows", 1n, "retained"), "rows", 3n);
      if (mode === "throw") throw failure;
      return Object.freeze({ kind: mode });
    }, { retention: "completed-outcome" }); seal(harness);
    assert.throws(() => harness.context.query(question.question, 0), error => error === failure);
    for (const kind of ["pending", "unresolved", "partial"]) {
      mode = kind; harness.context.query(question.question, 0);
      const rows = resourceRows(harness.context, ["keys", "rows"]).find(row => row.dimension === "rows");
      assert.equal(rows.temporary, 0n); assert.equal(rows.retained, 0n);
    }
    mode = "refused";
    const answer = harness.context.query(question.question, 0);
    assert.equal(harness.context.query(question.question, 0), answer);
    assert.equal(resourceRows(harness.context, ["keys", "rows"]).find(row => row.dimension === "rows").retained, 2n);
    temporary.release(); temporary.release(); retained.release(); retained.release();
    const again = harness.context.query(question.question, 0);
    assert.notEqual(again, answer, "explicit backing-lease release invalidated the old completed memo");
    harness.context.close(); retained.release();
  }
});

test("wrapper-close releases outside cohort leases but leaves transferred completed memo ownership intact", () => {
  const harness = create([domain("work", "cohort", { rows: 4n })]);
  const outside = harness.scope.reserve("rows", 2n, "retained");
  harness.scope.reserve("rows", 1n, "temporary");
  harness.scope.close(); outside.release();
  const afterClose = resourceRows(harness.context, ["rows"]).find(row => row.dimension === "rows");
  assert.equal(afterClose.retained, 0n); assert.equal(afterClose.temporary, 0n);
  let scope = harness.context.resourceScope("work", harness.owner, none); let calls = 0;
  const question = register(harness, "transferred", (_, actual) => {
    calls += 1; actual.reserve("rows", 4n, "retained"); return "retained";
  }, { authenticate: () => ({ scope, parts: Object.freeze([]) }) }); seal(harness);
  assert.equal(harness.context.query(question.question, 0), "retained");
  scope.close(); scope = harness.context.resourceScope("work", harness.owner, none);
  assert.equal(harness.context.query(question.question, 0), "retained"); assert.equal(calls, 1);
  exhausted(() => scope.reserve("rows", 1n, "retained"), "rows", 4n);
  harness.context.close();
});

test("current-root depth checks include cached relative child heights and finally cleanup", () => {
  const harness = create([domain("work", "operation", { depth: 3n })]);
  let calls = 0;
  const child = register(harness, "child", (_, scope) => {
    calls += 1; return scope.withDepth("depth", () => scope.withDepth("depth", () => 1));
  });
  const parent = register(harness, "parent", (input, scope) => scope.withDepth("depth", () => input === "deep"
    ? scope.withDepth("depth", () => harness.context.query(child.question, 0))
    : harness.context.query(child.question, 0)));
  const thrown = Error("depth action");
  const fallible = register(harness, "fallible", (_, scope) => scope.withDepth("depth", () => { throw thrown; }));
  seal(harness);
  assert.equal(harness.context.query(child.question, 0), 1);
  assert.equal(harness.context.query(parent.question, "at"), 1);
  exhausted(() => harness.context.query(parent.question, "deep"), "depth", 3n);
  assert.equal(calls, 1, "a hit checks cached height, without replaying descendants");
  assert.throws(() => harness.context.query(fallible.question, 0), error => error === thrown);
  assert.equal(harness.context.query(parent.question, "again"), 1);
  harness.context.close();
});

test("resource authority rejects copied kinds, reachable constructors, inherited fields and subclasses", () => {
  const harness = create([domain("work", "cohort", { work: 0n })]);
  const genuine = exhausted(() => harness.scope.charge("work", 1n), "work", 0n);
  const ordinary = new Error(genuine.message);
  Object.assign(ordinary, { kind: genuine.kind, diagnostic: genuine.diagnostic, dimension: "work", limit: 0n });
  for (const error of [ordinary, Object.create(genuine), new Error("ordinary")]) {
    assert.equal(factory.resourceLimitDiagnostic(error).kind, "none");
  }
  assert.throws(() => new genuine.constructor(Symbol(), "work", 0n, genuine.diagnostic), TypeError);
  class Copied extends genuine.constructor {
    constructor() { super(Symbol(), "work", 0n, genuine.diagnostic); }
  }
  assert.throws(() => new Copied(), TypeError);
  let setterCalls = 0;
  Object.defineProperty(genuine.constructor.prototype, "dimension", {
    configurable: true, set() { setterCalls += 1; },
  });
  try {
    exhausted(() => harness.scope.charge("work", 1n), "work", 0n);
    assert.equal(setterCalls, 0, "own immutable fields bypass inherited setters");
  } finally { delete genuine.constructor.prototype.dimension; }
  assert.equal(factory.resourceLimitDiagnostic(genuine).value, genuine.diagnostic);
  harness.context.close();
});

test("every dimension admits exact temporary/retained/depth work under both policies", () => {
  for (const admission of ["operation", "cohort"]) {
    for (const dimension of dimensions) {
      const limit = dimension === "keys" ? 8n : 2n;
      const harness = create([domain("work", admission, { [dimension]: limit })]);
      const question = register(harness, "mechanisms", (_, scope) => {
        const available = dimension === "keys" ? 4n : limit;
        const temporary = scope.reserve(dimension, available - 1n, "temporary");
        const retained = scope.reserve(dimension, 1n, "retained");
        exhausted(() => scope.reserve(dimension, 1n, "temporary"), dimension, limit);
        retained.release(); retained.release(); temporary.release();
        let entered = 0;
        const descend = remaining => scope.withDepth(dimension, () => {
          entered += 1;
          if (remaining > 1n) return descend(remaining - 1n);
          exhausted(() => scope.withDepth(dimension, () => { throw Error("unadmitted work"); }), dimension, limit);
          return "complete";
        });
        assert.equal(descend(available), "complete");
        assert.equal(BigInt(entered), available);
        return "complete";
      }, { authenticate: () => ({ scope: harness.scope, parts: Object.freeze([]) }) });
      seal(harness);
      assert.equal(harness.context.query(question.question, 0), "complete");
      const row = resourceRows(harness.context, dimension === "keys" ? ["keys"] : ["keys", dimension])
        .find(entry => entry.dimension === dimension);
      assert.equal(row.temporary, 0n); assert.equal(row.retained, 0n); assert.equal(row.peak, limit);
      harness.context.close();
    }
  }
});

test("authentication/key failures release staged leases and hot answers still pass admission", () => {
  const harness = create([domain("work", "cohort", { work: 2n, rows: 2n })]);
  let good = false; let calls = 0;
  const question = register(harness, "staged", () => { calls += 1; return "complete"; }, {
    authenticate: () => {
      harness.scope.reserve("rows", 2n, "retained");
      if (!good) return { scope: harness.scope, parts: Object.freeze([undefined]) };
      harness.scope.charge("work", 1n);
      return { scope: harness.scope, parts: Object.freeze([]) };
    },
  }); seal(harness);
  code(() => harness.context.query(question.question, 0), "INVALID_QUESTION_KEY");
  assert.equal(harness.context.queryUsage.resources.find(row => row.dimension === "rows").retained, 0n);
  good = true;
  assert.equal(harness.context.query(question.question, 0), "complete");
  exhausted(() => harness.context.query(question.question, 0), "rows", 2n);
  assert.equal(calls, 1, "hot cache does not bypass original resource admission/authentication");
  harness.context.close();
});

test("exact bigint limits exceed53bits without rounding and all linked retained rows retire together", () => {
  const huge = 9007199254740995n;
  const harness = create([domain("work", "cohort", { work: huge, rows: 2n })]);
  harness.scope.charge("work", huge);
  const error = exhausted(() => harness.scope.charge("work", 1n), "work", huge);
  assert.equal(error.diagnostic.evidence.find(entry => entry.name === "attempted").value, huge + 1n);
  assert.equal(usage(harness.context, "work"), huge);
  let first; let calls = 0;
  const question = register(harness, "linked", (_, scope) => {
    calls += 1; first = scope.reserve("rows", 1n, "retained");
    scope.reserve("rows", 1n, "retained"); return "complete";
  }); seal(harness);
  assert.equal(harness.context.query(question.question, 0), "complete");
  first.release();
  assert.equal(harness.context.queryUsage.resources.find(row => row.dimension === "rows").retained, 0n);
  assert.equal(harness.context.query(question.question, 0), "complete"); assert.equal(calls, 2);
  harness.context.close();
});

test("authentication never receives private state as this, and close during work forbids publication", () => {
  const harness = create();
  let receiver = "not-called";
  const question = register(harness, "private-this", () => "complete", {
    authenticate: function () {
      receiver = this;
      return { scope: harness.scope, parts: Object.freeze([]) };
    },
  });
  const closes = register(harness, "closing", (_, scope) => scope.withDepth("depth", () => {
    scope.reserve("rows", 1n, "retained"); harness.context.close(); return "not-published";
  })); seal(harness);
  assert.equal(harness.context.query(question.question, 0), "complete"); assert.equal(receiver, undefined);
  code(() => harness.context.query(closes.question, 0), "CONTEXT_CLOSED");
  harness.context.close();
});

test("only a successful first provider ends declaration, and failed seal leaves existing connections repairable", () => {
  const harness = create();
  const first = register(harness, "first", undefined);
  code(() => first.provide(null), "INVALID_CONTEXT_INPUT", "mechanical");
  code(() => ({ ...first }).provide(() => 0), "FOREIGN_QUESTION", "mechanical");
  const second = register(harness, "second", undefined);
  code(() => first.provide.call(second, () => 0), "FOREIGN_QUESTION", "mechanical");
  first.provide(input => harness.context.query(second.question, input) + 1);
  code(() => register(harness, "not-declared", () => 1), "REGISTRATION_SEALED", "mechanical");
  code(() => harness.context.sealRegistration(), "MISSING_PROVIDER", "mechanical");
  code(() => harness.context.query(first.question, 1), "REGISTRATION_UNSEALED", "mechanical");
  second.provide(input => input * 2);
  harness.context.sealRegistration();
  orderedDomain(harness.context.queryUsage.questions.map(row => row.name), ["first", "second"], Object.is,
    "complete mutually connected registry");
  assert.equal(harness.context.query(first.question, 3), 7);
  harness.context.close();
});

test("owner/name pairs and independent actual programs do not share memo or declaration identity", () => {
  const harness = create();
  const registrations = [["a/b", "c"], ["a", "b/c"]].map(([owner, name]) => harness.context.register({
    owner, name, domain: "work", retention: "immutable",
    authenticate: input => ({ scope: harness.scope, parts: Object.freeze([input]) }),
  }));
  assert.equal(registrations.length, 2, "complete distinct owner/name pair domain");
  registrations.forEach((registration, index) => registration.provide(() => index));
  harness.context.sealRegistration();
  registrations.forEach((registration, index) => assert.equal(harness.context.query(registration.question, 0), index));
  const independent = create();
  const sameName = independent.context.register({ owner: "a/b", name: "c", domain: "work", retention: "immutable",
    authenticate: input => ({ scope: independent.scope, parts: Object.freeze([input]) }) });
  sameName.provide(() => 99); independent.context.sealRegistration();
  assert.equal(independent.context.query(sameName.question, 0), 99);
  code(() => harness.context.query(sameName.question, 0), "FOREIGN_QUESTION");
  harness.context.close(); independent.context.close();
});
