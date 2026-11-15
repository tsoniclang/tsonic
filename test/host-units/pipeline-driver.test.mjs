import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFile = resolve(repository, "packages/host/dist/pipeline/driver.js");
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let driver;
let query;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "driver tests run under the aggregate resource guard");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  driver = await import("../../packages/host/dist/pipeline/driver.js");
  query = await import("../../packages/host/dist/query/index.js");
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const url = pathToFileURL(runtimeFile).href;
    const result = capture.result.filter(script => script.url === url);
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, [runtimeFile], raw);
    const directory = resolve(repository, ".temp/pipeline-driver-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, 1, "the driver has real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally { session.disconnect(); }
});

const messages = database => database.diagnostics().map(entry => entry.message);
const d = (number, message) => diagnostic(number, `f${number}.ts`, message);

const unitError = construct => (key, cause, data) => ({ value: construct(key, cause, data), positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] });
const unbounded = { maximumRecords: Number.MAX_SAFE_INTEGER };
const noCycle = () => { throw new Error("this case closes no cycle"); };
const never = () => { throw new Error("this operation is not reached in this case"); };
const ok = (value, diagnostics = []) => ({ kind: "done", value: { kind: "ok", emissions: [], positions: [{ position: { kind: "result" }, error: null }], value, diagnostics } });
const refuse = diagnostics => ({ kind: "done", value: { kind: "refused", diagnostics } });
const pause = (requests, state, earned = []) => ({ kind: "paused", requests, paused: state, earned });
const fact = (name, key, encodedKey) => ({ query: name, key, encodedKey });
const limitReached = (maximum, name, encodedKey) => ({ code: { kind: "host", name: "TSONIC_COMPILER_RESOURCE_LIMIT", rendered: "TSONIC_COMPILER_RESOURCE_LIMIT" },
  severity: "error", site: { kind: "none" }, source: "query", evidence: ["query.maximumRecords", name, encodedKey, "A1:S6:result"],
  message: "A compiler resource limit was reached.", arguments: [{ kind: "text", value: "query.maximumRecords" }, { kind: "number", value: maximum }], related: [], fix: null });
const stoppedAt = (maximum, name, encodedKey) => ({ kind: "refused", diagnostics: [limitReached(maximum, name, encodedKey)] });

const completions = database => database.trace().filter(event => event.kind === "completion").map(event => [event.fact.query, event.outcome]);
const requests = database => database.trace().filter(event => event.kind === "dependency")
  .map(event => [event.from === null ? null : event.from.query, event.to.query, event.to.key, event.state]);

function diagnostic(number, path, message) {
  return ({ code: ({ kind: "checker", number, rendered: `TS${number}` }),
    severity: "error", site: ({ kind: "file", path }), source: "driver-case", evidence: ([]),
    message, arguments: ([]), related: ([]), fix: null });
}

function leaf(name, produce) {
  return driver.defineQuery({ name, producer: { start: (_, key) => produce(key), resume: never },
    route: never, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
}

test("a row projects its original typed key once without changing the producer or dependency key", () => {
  const original = { definition: "function", ready: () => 7 };
  const projections = [];
  const starts = [];
  const target = driver.defineQuery({ name: "typed-target", keyData: key => { projections.push(key); return [key.definition]; },
    producer: { start: (_, key) => { starts.push(key); return ok(key.ready()); }, resume: never },
    route: never, witness: never, answerPolicy: { kind: "refusal-only" } });
  const caller = driver.defineQuery({ name: "typed-caller", keyData: key => { projections.push(key); return [key.definition]; },
    producer: { start: (_, key) => { starts.push(key); return pause([key], key); }, resume: (state, answers) => ok({ state, answer: answers[0] }) },
    route: request => driver.factRoute(target, request, value => value), witness: request => request.definition,
    answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  const first = database.run(caller, original);
  assert.equal(first.kind, "completed");
  assert.equal(first.value.state === original, true);
  assert.equal(first.value.answer, 7);
  assert.equal(database.run(caller, { ...original }).value === first.value, true);
  assert.equal(starts.length, 2);
  assert.equal(starts.every(key => key === original), true);
  assert.equal(projections.length, 3, "one explicit projection for each root or dependency demand");
  assert.equal(projections[0] === original && projections[1] === original, true);
});

test("a pause of three requests is three kernel steps in request order and one resume of the same state with the matching answers", () => {
  const signature = leaf("signature", key => ok(`sig:${key}`));
  const state = { opaque: "constraint state" };
  const resumes = [];
  let starts = 0;
  const constraints = driver.defineQuery({ name: "constraints",
    producer: {
      start: (inputs, key) => {
        starts += 1;
        assert.equal(inputs, "session");
        assert.equal(key, "body");
        return pause(["g", "h", "i"].map(name => ({ kind: "signature", name })), state);
      },
      resume: (received, answers) => { resumes.push([received, answers.slice()]); return ok(answers.map(answer => answer.value).join("+")); },
    },
    route: request => driver.factRoute(signature, request.name, value => ({ kind: "signature", value })),
    witness: request => `constraints needs ${request.name}`, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase("session", unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(constraints, "body"), { kind: "completed", value: "sig:g+sig:h+sig:i", diagnostics: [] });
  assert.equal(starts, 1);
  assert.equal(resumes.length, 1);
  assert.equal(resumes[0][0], state, "the same opaque state, not a copy");
  assert.deepEqual(resumes[0][1], ["g", "h", "i"].map(name => ({ kind: "signature", value: `sig:${name}` })));
  assert.deepEqual(requests(database), [[null, "constraints", "body", "cold"], ["constraints", "signature", "g", "cold"],
    ["constraints", "signature", "h", "cold"], ["constraints", "signature", "i", "cold"]]);
  assert.deepEqual(database.run(constraints, "body"), { kind: "completed", value: "sig:g+sig:h+sig:i", diagnostics: [] });
  assert.equal(starts, 1, "a completed fact is memoised");
});

test("a fact and a projection answer alike; a projection is a part of a completed result and has no memo of its own", () => {
  let solved = 0;
  const solution = leaf("solution", () => { solved += 1; return ok({ parts: { a: "int32", b: "bool" } }); });
  const reader = driver.defineQuery({ name: "reader",
    producer: {
      start: () => pause([{ kind: "part", part: "a" }, { kind: "whole" }, { kind: "part", part: "b" }], null),
      resume: (_, answers) => ok(answers),
    },
    route: request => request.kind === "whole"
      ? driver.factRoute(solution, "group", value => ({ kind: "answer", value }))
      : driver.projectionRoute(solution, "group", value => ({ kind: "answer", value: value.parts[request.part] })),
    witness: request => request, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  const result = database.run(reader, null);
  assert.deepEqual(result.value, [{ kind: "answer", value: "int32" }, { kind: "answer", value: { parts: { a: "int32", b: "bool" } } },
    { kind: "answer", value: "bool" }]);
  assert.equal(solved, 1);
  assert.deepEqual(database.stats(), [{ name: "reader", computed: 1, hits: 0 }, { name: "solution", computed: 1, hits: 2 }]);
  assert.deepEqual(driver.factRoute(solution, "group", value => value).way, "fact");
  assert.deepEqual(driver.projectionRoute(solution, "group", value => value).way, "projection");
});

test("a nested application runs inside its requester, on values only the requester holds, unmemoised; its own request is the requester's dependency", () => {
  const found = diagnostic(1, "a.ts", "found by the application");
  const shape = leaf("shape", key => ok(`shape:${key}`));
  let applied = 0;
  let innerResumes = 0;
  const place = request => driver.nestedRoute({
    start: inputs => {
      applied += 1;
      assert.equal(inputs, "session");
      return pause([{ definition: request.definition }], "inner state");
    },
    resume: (state, answers) => {
      innerResumes += 1;
      assert.equal(state, "inner state");
      return ok(`${answers[0]} with ${request.parts.join(",")}`, [found]);
    },
    route: inner => driver.factRoute(shape, inner.definition, value => value),
    witness: inner => `placement needs the shape of ${inner.definition}`,
    answer: value => ({ kind: "placed", value }),
  });
  const solve = driver.defineQuery({ name: "solve",
    producer: {
      start: (_, key) => pause([{ kind: "place", definition: "f", parts: [`${key}:int32`] }], "outer state"),
      resume: (state, answers) => { assert.equal(state, "outer state"); return ok(answers[0]); },
    },
    route: place, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  assert.equal(place({ definition: "f", parts: [] }).way, "nested");
  const database = query.createDatabase("session", unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(solve, "g1"), { kind: "completed", value: { kind: "placed", value: "shape:f with g1:int32" }, diagnostics: [found] });
  assert.deepEqual(database.run(solve, "g2"), { kind: "completed", value: { kind: "placed", value: "shape:f with g2:int32" }, diagnostics: [found] });
  assert.equal(applied, 2, "applied once per requester: no memo");
  assert.equal(innerResumes, 2);
  assert.deepEqual(database.stats(), [{ name: "shape", computed: 1, hits: 1 }, { name: "solve", computed: 2, hits: 0 }]);
  assert.deepEqual(requests(database), [[null, "solve", "g1", "cold"], ["solve", "shape", "f", "cold"],
    [null, "solve", "g2", "cold"], ["solve", "shape", "f", "warm"]]);
  assert.deepEqual(database.diagnostics(), [found, found], "once with each requester's own result");
});

test("a refused answer abandons the requester: no memo entry, and what it had earned is kept once, for a fact and for a nested application", () => {
  const limit = diagnostic(1, "a.ts", "limit");
  const conflict = diagnostic(2, "b.ts", "conflict found before the request");
  const big = leaf("big", () => refuse([limit]));
  for (const way of ["fact", "nested"]) {
    let starts = 0;
    let resumed = 0;
    const f = driver.defineQuery({ name: "f",
      producer: { start: () => { starts += 1; return pause([{ kind: "need" }], null, [conflict]); },
        resume: () => { resumed += 1; return ok(0); } },
      route: () => way === "fact" ? driver.factRoute(big, null, value => value)
        : driver.nestedRoute({ start: () => refuse([limit]), resume: never, route: never, witness: never, answer: value => value }),
      witness: () => "f needs big", keyData: key => key, answerPolicy: { kind: "refusal-only" } });
    const database = query.createDatabase(null, unbounded, noCycle, "recorded");
    for (let request = 1; request <= 2; request += 1) {
      assert.deepEqual(database.run(f, null), { kind: "refused", diagnostics: [limit] });
      assert.deepEqual(database.diagnostics(), [limit, conflict]);
      assert.equal(starts, request, "the abandoned computation was not memoised");
    }
    assert.equal(resumed, 0);
    assert.deepEqual(completions(database).filter(([name]) => name === "f"), [["f", "abandoned"], ["f", "abandoned"]]);
  }
});

test("an error-valued answer is delivered unchanged; the driver adds, drops and repeats no diagnostic", () => {
  const detected = diagnostic(1, "a.ts", "detected by the producer of the error value");
  const own = diagnostic(2, "b.ts", "the requester's own");
  const errorValue = { kind: "error", data: null, emissions: [], cause: "unit:broken" };
  const broken = leaf("broken", () => ok(errorValue, [detected]));
  const caller = driver.defineQuery({ name: "caller",
    producer: { start: () => pause([{}], null), resume: (_, answers) => ok(answers[0], [own]) },
    route: () => driver.factRoute(broken, null, value => value), witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  const result = database.run(caller, null);
  assert.equal(result.value, errorValue);
  assert.deepEqual(result.diagnostics, [own]);
  assert.deepEqual(database.diagnostics(), [detected, own]);
  database.run(caller, null);
  assert.deepEqual(database.diagnostics(), [detected, own]);
});

const statedTwice = "A producer restated a diagnostic it had already stated: a pause states only what was earned since the previous pause, and a result only what was earned after the last.";

test("a result carries only what was earned after the last pause; the complete list is composed for the producer, which cannot drop a stated diagnostic and may not restate one", () => {
  const found = diagnostic(1, "a.ts", "found before the pause");
  const after = diagnostic(2, "b.ts", "found after the answer");
  const answer = leaf("answer", () => ok(1));
  const row = (name, final) => driver.defineQuery({ name,
    producer: { start: () => pause([{}], null, [found]), resume: () => ok(2, final) },
    route: () => driver.factRoute(answer, null, value => value), witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(row("more", [after]), null), { kind: "completed", value: 2, diagnostics: [found, after] });
  assert.deepEqual(database.diagnostics(), [found, after]);
  const silent = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(silent.run(row("silent", []), null), { kind: "completed", value: 2, diagnostics: [found] },
    "a result that carries nothing does not drop what a pause stated");
  assert.deepEqual(silent.diagnostics(), [found]);
  const restating = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.throws(() => restating.run(row("restates", [found]), null), error => {
    assert.deepEqual(error.cause, { owner: "pipeline", query: { name: "restates", encodedKey: "N" }, origin: null, message: statedTwice });
    return true;
  });
  assert.deepEqual(restating.diagnostics(), [], "a computation that threw has no result and nothing kept");
});

test("D-1: each pause states only what was earned since the pause before it; restating at a later pause is a compiler defect naming its row", () => {
  const first = d(1, "stated at the first pause");
  const second = d(2, "stated at the second pause");
  const limit = d(3, "limit");
  const base = leaf("base", key => ok(key));
  const big = leaf("big", () => refuse([limit]));
  const producer = (name, later) => driver.defineQuery({ name,
    producer: { start: () => pause(["a"], 1, [first]), resume: state => state === 1 ? pause(["b"], 2, later) : ok(0) },
    route: request => request === "a" ? driver.factRoute(base, "a", value => value) : driver.factRoute(big, null, value => value),
    witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.throws(() => database.run(producer("restates", [first, second]), null), error => {
    assert.deepEqual(error.cause, { owner: "pipeline", query: { name: "restates", encodedKey: "N" }, origin: null, message: statedTwice });
    return true;
  });
  assert.deepEqual(messages(database), []);
  assert.deepEqual(database.run(producer("increments", [second]), null), { kind: "refused", diagnostics: [limit] });
  assert.deepEqual(messages(database), ["stated at the first pause", "stated at the second pause", "limit"],
    "both chunks are kept for the abandoned computation, each diagnostic once");
  const quiet = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(quiet.run(producer("nothing-new", []), null), { kind: "refused", diagnostics: [limit] });
  assert.deepEqual(messages(quiet), ["stated at the first pause", "limit"], "a pause that earned nothing states nothing and loses nothing");
});

test("R1: a requested fact that itself pauses; a projection of a fact that pauses, and of one that refuses", () => {
  const limit = d(1, "limit");
  const found = d(2, "found before the request");
  const base = leaf("base", key => ok(`base:${key}`));
  const middle = driver.defineQuery({ name: "middle",
    producer: { start: (_, key) => pause([key], key), resume: (state, answers) => ok({ whole: answers[0], part: `part of ${state}` }) },
    route: request => driver.factRoute(base, request, value => value), witness: () => "middle needs base", keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const big = leaf("big", () => refuse([limit]));
  let starts = 0;
  const reader = way => driver.defineQuery({ name: `reader-${way}`,
    producer: { start: () => { starts += 1; return pause([{}], null, [found]); }, resume: (_, answers) => ok(answers[0]) },
    route: () => way === "fact" ? driver.factRoute(middle, "k", value => value.whole)
      : way === "projection" ? driver.projectionRoute(middle, "k", value => value.part)
        : driver.projectionRoute(big, null, value => value),
    witness: () => way, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(reader("fact"), null), { kind: "completed", value: "base:k", diagnostics: [found] });
  assert.deepEqual(database.run(reader("projection"), null), { kind: "completed", value: "part of k", diagnostics: [found] });
  const refusing = reader("refused-projection");
  starts = 0;
  for (let request = 1; request <= 2; request += 1) {
    assert.deepEqual(database.run(refusing, null), { kind: "refused", diagnostics: [limit] });
    assert.equal(starts, request, "not memoised");
  }
  assert.deepEqual(messages(database), ["limit", "found before the request", "found before the request", "found before the request"],
    "one object stated by three facts is listed three times until diagnostics are collected by identity");
  assert.deepEqual(database.stats().filter(row => row.name === "middle"), [{ name: "middle", computed: 1, hits: 1 }]);
});

test("R1: a nested application that refuses after its own pause; one whose own dependency refuses; one inside another", () => {
  const limit = d(1, "limit");
  const outer = d(2, "earned by the requester");
  const inner = d(3, "earned by the application");
  const late = d(4, "application refuses on resume");
  const base = leaf("base", key => ok(`base:${key}`));
  const big = leaf("big", () => refuse([limit]));
  const application = kind => driver.nestedRoute({
    start: () => pause([{}], "inner", [inner]),
    resume: () => kind === "late-refusal" ? refuse([late]) : never(),
    route: () => kind === "late-refusal" ? driver.factRoute(base, "k", value => value) : driver.factRoute(big, null, value => value),
    witness: () => "application", answer: value => value });
  for (const [kind, expectedRefusal, expectedKept] of [
    ["late-refusal", [late], [outer, inner, late]],
    ["dependency-refuses", [limit], [limit, outer, inner]],
  ]) {
    let starts = 0;
    const requester = driver.defineQuery({ name: "requester",
      producer: { start: () => { starts += 1; return pause([{}], null, [outer]); }, resume: never },
      route: () => application(kind), witness: () => "requester", keyData: key => key, answerPolicy: { kind: "refusal-only" } });
    const database = query.createDatabase(null, unbounded, noCycle, "recorded");
    for (let request = 1; request <= 2; request += 1) {
      assert.deepEqual(database.run(requester, null), { kind: "refused", diagnostics: expectedRefusal }, kind);
      assert.equal(starts, request, `${kind}: not memoised`);
      assert.deepEqual(database.diagnostics(), expectedKept, `${kind}: each once after ${request} run(s)`);
    }
  }
  const innermost = driver.nestedRoute({ start: () => ok(2, [inner]), resume: never, route: never, witness: never, answer: value => value * 10 });
  const wrapping = driver.nestedRoute({ start: () => pause([{}], null), resume: (_, answers) => ok(answers[0] + 1),
    route: () => innermost, witness: never, answer: value => `wrapped ${value}` });
  const top = driver.defineQuery({ name: "top", producer: { start: () => pause([{}], null), resume: (_, answers) => ok(answers[0]) },
    route: () => wrapping, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(top, null), { kind: "completed", value: "wrapped 21", diagnostics: [inner] });
});

test("K-3240: three pauses, abandoned at the second and at the third and then completed; a nested application abandoned inside a requester that pauses twice", () => {
  const [e1, e2, e3, e4] = [1, 2, 3, 4].map(number => d(number, `earned in step ${number}`));
  const stops = [5, 6, 7].map(number => d(number, `refusal ${number}`));
  const gate = leaf("gate", key => key[2] === null ? ok(key[1]) : refuse([stops[key[2]]]));
  let phase = 0;
  let refuseAt = 0;
  const three = driver.defineQuery({ name: "three",
    producer: { start: () => pause([1], 1, [e1]),
      resume: state => state === 1 ? pause([2], 2, [e2]) : state === 2 ? pause([3], 3, [e3]) : ok("done", [e4]) },
    route: request => driver.factRoute(gate, [phase, request, request === refuseAt ? phase : null], value => value),
    witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  const attempt = at => { refuseAt = at; const result = database.run(three, null); phase += 1; return result; };
  assert.deepEqual(attempt(2), { kind: "refused", diagnostics: [stops[0]] });
  assert.deepEqual(database.diagnostics(), [e1, e2, stops[0]]);
  assert.deepEqual(attempt(3), { kind: "refused", diagnostics: [stops[1]] });
  assert.deepEqual(database.diagnostics(), [e1, e2, e3, stops[0], stops[1]], "three chunks kept, each diagnostic once");
  assert.deepEqual(attempt(2), { kind: "refused", diagnostics: [stops[2]] });
  assert.deepEqual(database.diagnostics(), [e1, e2, e3, stops[0], stops[1], stops[2]], "an abandonment at an earlier pause does not shorten what is kept");
  assert.deepEqual(attempt(0), { kind: "completed", value: "done", diagnostics: [e1, e2, e3, e4] });
  assert.deepEqual(database.diagnostics(), [e1, e2, e3, e4, stops[0], stops[1], stops[2]], "published once with the result; nothing kept beside it");

  const [r1, r2, r3, a1, a2] = [11, 12, 13, 14, 15].map(number => d(number, `earned ${number}`));
  const aRefusal = d(16, "the application refuses");
  const base = leaf("base", key => ok(key));
  let refuses = true;
  const application = driver.nestedRoute({ start: () => pause([{}], "a", [a1]), resume: () => refuses ? refuse([aRefusal]) : ok(5, [a2]),
    route: () => driver.factRoute(base, "for the application", value => value), witness: () => "application", answer: value => value });
  const requester = driver.defineQuery({ name: "twice",
    producer: { start: () => pause(["plain"], 1, [r1]),
      resume: (state, answers) => state === 1 ? pause(["nested"], 2, [r2]) : ok(answers[0], [r3]) },
    route: request => request === "plain" ? driver.factRoute(base, "for the requester", value => value) : application,
    witness: () => "requester", keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const nested = query.createDatabase(null, unbounded, noCycle, "recorded");
  for (let request = 1; request <= 2; request += 1) {
    assert.deepEqual(nested.run(requester, null), { kind: "refused", diagnostics: [aRefusal] });
    assert.deepEqual(nested.diagnostics(), [r1, r2, a1, aRefusal],
      "the requester's two chunks, the application's chunk and its refusal, each once after " + request + " abandonment(s)");
  }
  refuses = false;
  assert.deepEqual(nested.run(requester, null), { kind: "completed", value: 5, diagnostics: [r1, r2, a1, a2, r3] },
    "in the order earned; the application's diagnostics are the requester's");
  assert.deepEqual(nested.diagnostics(), [r1, r2, r3, a1, a2], "the completed result replaces what the abandoned attempts kept");
});

test("S-1: the restating check is per producer run; the same diagnostic from two applications, or from an application and its requester, is not a producer defect", () => {
  const shared = d(1, "found by the application (one object)");
  const sameObject = driver.nestedRoute({ start: () => ok(1, [shared]), resume: never, route: never, witness: never, answer: value => value });
  for (const shape of ["two pauses", "one pause, two requests"]) {
    const requester = driver.defineQuery({ name: `requester ${shape}`,
      producer: shape === "two pauses"
        ? { start: () => pause(["n"], 1), resume: (state, answers) => state === 1 ? pause(["n"], 2) : ok(answers[0]) }
        : { start: () => pause(["n", "n"], 1), resume: (_, answers) => ok(answers[0] + answers[1]) },
      route: () => sameObject, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
    const database = query.createDatabase(null, unbounded, noCycle, "recorded");
    assert.deepEqual(database.run(requester, null).diagnostics, [shared, shared],
      `${shape}: two applications each state it once; one listing remains only through uniqueness by identity at collection`);
  }
  const mine = d(2, "the requester's");
  const echoing = driver.defineQuery({ name: "echoing", producer: { start: () => pause([{}], null, [mine]), resume: () => ok(0) },
    route: () => driver.nestedRoute({ start: () => ok(1, [mine]), resume: never, route: never, witness: never, answer: value => value }),
    witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  assert.deepEqual(query.createDatabase(null, unbounded, noCycle, "recorded").run(echoing, null).diagnostics, [mine, mine]);
  const base = leaf("base", key => ok(key));
  const restatingApplication = driver.defineQuery({ name: "restating-application", producer: { start: () => pause([{}], null), resume: never },
    route: () => driver.nestedRoute({ start: () => pause([{}], null, [shared]), resume: () => ok(1, [shared]),
      route: () => driver.factRoute(base, "k", value => value), witness: () => null, answer: value => value }),
    witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  assert.throws(() => query.createDatabase(null, unbounded, noCycle, "recorded").run(restatingApplication, null), error => {
    assert.deepEqual(error.cause, { owner: "pipeline", query: { name: "restating-application", encodedKey: "N" }, origin: null, message: statedTwice });
    return true;
  }, "one application that restates in its result what its own pause stated is the defect");
});

test("R1: rows in a cycle that paused with chunks, one through a nested application, with a requester outside: each member's result is its chunks, for both verdicts", () => {
  const [a1, a2, n1, b1, rootEarned] = [1, 2, 3, 4, 5].map(number => d(number, `e${number}`));
  const refusal = d(9, "cycle refused");
  const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "classified", index: 0 } } };
  const base = leaf("base", key => ok(key));
  for (const verdict of ["error", "refused"]) {
    const application = driver.nestedRoute({ start: () => pause([{}], null, [n1]), resume: never,
      route: () => driver.factRoute(b, null, value => value), witness: () => "application needs B", answer: value => value });
    const a = driver.defineQuery({ name: "A",
      producer: { start: () => pause(["base"], 1, [a1]), resume: state => state === 1 ? pause(["nested"], 2, [a2]) : never() },
      route: request => request === "base" ? driver.factRoute(base, "x", value => value) : application,
      witness: () => "A", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => "A-error") } });
    const b = driver.defineQuery({ name: "B", producer: { start: () => pause([{}], null, [b1]), resume: never },
      route: () => driver.factRoute(a, null, value => value), witness: () => "B needs A", keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError(() => "B-error") } });
    const root = driver.defineQuery({ name: "root", producer: { start: () => pause([{}], null, [rootEarned]), resume: (_, answers) => ok(answers[0]) },
      route: () => driver.factRoute(a, null, value => value), witness: () => "root", keyData: key => key, answerPolicy: { kind: "refusal-only" } });
    const database = query.createDatabase(null, unbounded,
      cycle => cycle.members.map(() => verdict === "error" ? { kind: "error", data: null, emissions: [], cause, diagnostics: [] } : { kind: "refused", diagnostic: refusal }), "recorded");
    if (verdict === "error") {
      assert.deepEqual(database.run(root, null), { kind: "completed", value: "A-error", diagnostics: [rootEarned] });
      assert.deepEqual(database.run(a, null), { kind: "completed", value: "A-error", diagnostics: [a1, a2, n1] });
      assert.deepEqual(database.run(b, null), { kind: "completed", value: "B-error", diagnostics: [b1] });
      assert.deepEqual(database.diagnostics(), [a1, a2, n1, b1, rootEarned], "each once; warm requests publish nothing");
    } else {
      assert.deepEqual(database.run(root, null), { kind: "refused", diagnostics: [a1, a2, n1, refusal] });
      assert.deepEqual(database.run(a, null), { kind: "refused", diagnostics: [a1, a2, n1, refusal] });
      assert.deepEqual(database.run(b, null), { kind: "refused", diagnostics: [b1, refusal] });
      assert.deepEqual(database.diagnostics(), [a1, a2, n1, b1, rootEarned, refusal, refusal],
        "one classified refusal per member result: the same object is listed once per member until diagnostics are collected by identity");
    }
  }
});

test("R1: a row whose final result is refused after a chunk is memoised whole; two requesters are abandoned; each diagnostic once", () => {
  const [c1, own, r1, r2] = [1, 2, 3, 4].map(number => d(number, `e${number}`));
  const base = leaf("base", key => ok(key));
  const refuses = driver.defineQuery({ name: "refuses", producer: { start: () => pause([{}], null, [c1]), resume: () => refuse([own]) },
    route: () => driver.factRoute(base, "k", value => value), witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const requester = (name, earned) => driver.defineQuery({ name, producer: { start: () => pause([{}], null, [earned]), resume: never },
    route: () => driver.factRoute(refuses, null, value => value), witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(requester("one", r1), null), { kind: "refused", diagnostics: [c1, own] });
  assert.deepEqual(database.run(requester("two", r2), null), { kind: "refused", diagnostics: [c1, own] });
  assert.deepEqual(database.diagnostics(), [c1, own, r1, r2]);
  assert.deepEqual(database.stats().find(row => row.name === "refuses"), { name: "refuses", computed: 1, hits: 1 });
});

test("what a nested application found within a pause is stated with the next kernel request of that pause", () => {
  const limit = d(1, "limit");
  const own = d(2, "earned by the requester");
  const found = d(3, "found by the application");
  const big = leaf("big", () => refuse([limit]));
  const requester = driver.defineQuery({ name: "requester",
    producer: { start: () => pause(["nested", "fact"], null, [own]), resume: never },
    route: request => request === "nested"
      ? driver.nestedRoute({ start: () => ok(1, [found]), resume: never, route: never, witness: never, answer: value => value })
      : driver.factRoute(big, null, value => value),
    witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(requester, null), { kind: "refused", diagnostics: [limit] });
  assert.deepEqual(database.diagnostics(), [limit, own, found], "the abandoned requester keeps its own and the application's diagnostics");
});

test("MR-1: a paused rule's needs are relayed by its invoker in one batch; the same rule state is resumed with its own slice, never restarted", () => {
  const members = leaf("members", key => ok(`members:${key}`));
  const signature = leaf("signature", key => ok(`signature:${key}`));
  const log = [];
  const ruleState = { assumptions: ["Node <: Node"], obligations: 2 };
  const rule = {
    start: () => { log.push("rule start"); return { kind: "paused", state: ruleState, needs: [{ kind: "members", type: "Node" }, { kind: "members", type: "Leaf" }] }; },
    resume: (state, answers) => { log.push(["rule resume", state, answers]); return { kind: "decided", decision: `embeds given ${answers.join(" and ")}` }; },
  };
  const invoker = driver.defineQuery({ name: "solve",
    producer: {
      start: () => {
        const first = rule.start();
        return pause([{ kind: "signature", definition: "g" }, ...first.needs], { own: "solver state", parked: first.state, slice: [1, 2] });
      },
      resume: (state, answers) => {
        assert.equal(state.own, "solver state");
        const decided = rule.resume(state.parked, answers.slice(state.slice[0], state.slice[0] + state.slice[1]));
        return ok([answers[0], decided.decision]);
      },
    },
    route: request => request.kind === "signature" ? driver.factRoute(signature, request.definition, value => value)
      : driver.factRoute(members, request.type, value => value),
    witness: request => request.kind, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(invoker, null), { kind: "completed",
    value: ["signature:g", "embeds given members:Node and members:Leaf"], diagnostics: [] });
  assert.equal(log.length, 2);
  assert.equal(log[0], "rule start");
  assert.equal(log[1][1], ruleState, "the same rule state");
  assert.deepEqual(log[1][2], ["members:Node", "members:Leaf"]);
  assert.deepEqual(requests(database).slice(1), [["solve", "signature", "g", "cold"], ["solve", "members", "Node", "cold"],
    ["solve", "members", "Leaf", "cold"]]);
});

test("a closing witness borrows the actual pause and resolved prefix; the classifier finalizes its evidence once", () => {
  for (const entry of ["typed", "body"]) {
    const ready = { type: "actual ready value" };
    const state = { parts: ["first", "closing"], definition: "actual paused declaration" };
    const prefixes = new WeakSet();
    const observed = [];
    const first = leaf("ready", () => ok(ready));
    let typed;
    const body = driver.defineQuery({ name: "body", keyData: key => key,
      producer: { start: () => pause(["typed"], null), resume: never },
      route: () => driver.factRoute(typed, "key", value => value),
      witness: (request, paused, answers) => ({ request, paused, answers }), answerPolicy: { kind: "refusal-only" } });
    let constructed = 0;
    typed = driver.defineQuery({ name: "typed", keyData: key => key,
      producer: { start: () => pause(["first", "closing"], state), resume: never },
      route: request => driver.factRoute(request === "first" ? first : body, "key", value => value),
      witness: (request, paused, answers) => {
        assert.equal(paused, state);
        if (request === "first") prefixes.add(answers);
        else assert.equal(prefixes.has(answers), true, "the driver does not copy prefixes at each request");
        observed.push([request, answers.length]);
        return { request, paused, answers };
      },
      answerPolicy: { kind: "typed-error", construct: (key, cause, data) => {
        constructed += 1;
        assert.equal(key, "key"); assert.equal(data.state, state); assert.equal(data.ready[0], ready);
        return { value: { ready: data.ready[0], failed: cause }, positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [cause] } }] };
      } } });
    const detected = { ...d(9, "new cycle"), code: { kind: "host", name: "TSONIC_DECLARATION_CYCLE", rendered: "TSONIC_DECLARATION_CYCLE" } };
    const origin = { request: { query: "typed", key: "key" }, position: { kind: "result" } };
    const cause = { kind: "diagnostic", diagnostic: { kind: "host", unit: origin, code: "TSONIC_DECLARATION_CYCLE" } };
    let finalized;
    const database = query.createDatabase(null, unbounded, cycle => {
      const member = cycle.members.find(member => member.fact.query === "typed");
      assert.equal(member.witness.request, "closing"); assert.equal(member.witness.paused, state);
      assert.deepEqual(member.witness.answers, [ready]);
      finalized = { state: member.witness.paused, ready: member.witness.answers.slice() };
      return cycle.members.map(member => member.answerPolicy === "refusal-only" ? { kind: "refused", diagnostic: detected }
        : { kind: "error", cause, data: finalized, diagnostics: [detected], emissions: [{ identity: cause.diagnostic, diagnostic: detected }] });
    }, "recorded");
    const result = database.run(entry === "typed" ? typed : body, "key");
    assert.equal(result.kind, entry === "typed" ? "completed" : "refused");
    assert.deepEqual(observed, [["first", 0], ["closing", 1]]);
    assert.equal(constructed, 1);
    assert.deepEqual(finalized.ready, [ready]);
    assert.deepEqual(database.diagnostics(), [detected, detected], "the typed origin and refusal retain the same original diagnostic reference");
    assert.equal(database.run(typed, "key").value.failed, cause);
    assert.equal(constructed, 1, "cached redemand neither reconstructs nor emits");
  }
});

test("a projection reads the same completed canonical unit position without a separate error cache", () => {
  const group = "group";
  const position = { kind: "inference-variable", group, variable: 0 };
  const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "checked", index: 1 } } };
  const error = { kind: "error", causes: [cause] };
  const solution = leaf("solutionOf", () => ({ kind: "done", value: { kind: "ok", value: "actual final type", diagnostics: [], emissions: [],
    positions: [{ position, error }, { position: { kind: "result" }, error: { kind: "error", causes: [{ kind: "unit", unit: { request: { query: "solutionOf", key: group }, position } }] } }] } }));
  const reader = driver.defineQuery({ name: "projection-reader", keyData: key => key,
    producer: { start: () => pause([group], null), resume: (_, answers) => ok(answers) },
    route: key => driver.projectionRoute(solution, key, (value, errorOf) => {
      const result = errorOf({ request: { query: solution.name, key: solution.keyData(key) }, position });
      assert.equal(result.kind, "completed");
      assert.equal(result.error, error);
      return { value, error: result.error };
    }), witness: () => null, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(reader, null).value, [{ value: "actual final type", error }]);
  assert.equal(database.stats().some(row => row.name === "inferred-part"), false);
});

test("rows in a cycle: Query hands over the whole cycle with each row's witness; a row only names its error value for the classified cause", () => {
  const classified = [];
  const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "classified", index: 0 } } };
  const row = (name, other, value) => driver.defineQuery({ name,
    producer: { start: () => pause([{ needs: other().name }], null), resume: never },
    route: () => driver.factRoute(other(), "k", answer => answer),
    witness: request => `${name} needs ${request.needs}`,
    keyData: key => key, answerPolicy: { kind: "typed-error", construct: unitError((key, received) => ({ error: value, cause: received.diagnostic.diagnostic.module, key })) } });
  for (const first of ["constant", "type"]) {
    const constant = row("constant", () => type, "no constant");
    const type = row("type", () => constant, "no type");
    const database = query.createDatabase(null, unbounded, cycle => { classified.push(cycle); return cycle.members.map(() => ({ kind: "error", data: null, emissions: [], cause, diagnostics: [] })); }, "recorded");
    const rows = { constant, type };
    assert.deepEqual(database.run(rows[first], "k").value, { error: first === "constant" ? "no constant" : "no type", cause: "classified", key: "k" });
    assert.deepEqual(database.run(constant, "k").value.error, "no constant");
    assert.deepEqual(database.run(type, "k").value.error, "no type");
  }
  const expected = { members: [{ fact: fact("constant", "k", "S1:k"), witness: "constant needs type", answerPolicy: "typed-error" },
    { fact: fact("type", "k", "S1:k"), witness: "type needs constant", answerPolicy: "typed-error" }] };
  assert.deepEqual(classified, [expected, expected]);
});

test("K3374: driver rows retain the registered policy through mixed cycles and nested refusal abandonment", () => {
  for (const first of ["body", "value", "outer"]) {
    const refusal = d(1, "the verified body is refused by the original cycle");
    const bodyEarned = d(2, "earned by the body producer");
    const valueEarned = d(3, "earned by the value producer");
    const nestedEarned = d(4, "earned by the nested application");
    const outerEarned = d(5, "earned by the outer producer");
    const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: "value", index: 0 } } };
    const refusalOnly = { kind: "refusal-only" };
    const errorPolicy = { kind: "typed-error", construct: unitError((key, received) => {
      assert.equal(received === cause, true, `${first}/original cause`);
      return { kind: "error", key, cause: received };
    }) };
    let resumed = 0;
    const resume = () => { resumed += 1; return ok(0); };
    const body = driver.defineQuery({ name: "body", keyData: key => key, answerPolicy: refusalOnly,
      producer: { start: () => pause([null], null, [bodyEarned]), resume },
      route: () => driver.factRoute(value, null, answer => answer), witness: () => "body needs value" });
    const value = driver.defineQuery({ name: "value", keyData: key => key, answerPolicy: errorPolicy,
      producer: { start: () => pause([null], null, [valueEarned]), resume },
      route: () => driver.factRoute(body, null, answer => answer), witness: () => "value needs body" });
    const outer = driver.defineQuery({ name: "outer", keyData: key => key, answerPolicy: refusalOnly,
      producer: { start: () => pause([null], null, [outerEarned]), resume },
      route: () => driver.nestedRoute({ start: () => pause([null], null, [nestedEarned]), resume,
        route: () => driver.factRoute(body, null, answer => answer), witness: () => "nested needs body", answer: answer => answer }),
      witness: () => "outer applies nested" });
    assert.equal(body.answerPolicy === refusalOnly, true);
    assert.equal(value.answerPolicy === errorPolicy, true);
    const classified = [];
    const database = query.createDatabase(null, unbounded, cycle => {
      classified.push(cycle);
      return cycle.members.map(member => member.answerPolicy === "refusal-only"
        ? { kind: "refused", diagnostic: refusal } : { kind: "error", data: null, emissions: [], cause, diagnostics: [] });
    }, "recorded");
    const rows = { body, value, outer };
    const result = database.run(rows[first], null);
    if (first === "value") {
      assert.equal(result.kind, "completed");
      assert.equal(result.value.cause === cause, true);
      assert.deepEqual(result.diagnostics, [valueEarned]);
    } else assert.deepEqual(result, { kind: "refused", diagnostics: [bodyEarned, refusal] });
    assert.deepEqual(database.run(outer, null), { kind: "refused", diagnostics: [bodyEarned, refusal] });
    assert.deepEqual(database.run(outer, null), { kind: "refused", diagnostics: [bodyEarned, refusal] });
    assert.deepEqual(database.stats().find(entry => entry.name === "outer"), {
      name: "outer", computed: first === "outer" ? 3 : 2, hits: 0 });
    assert.deepEqual(classified, [{ members: [
      { fact: fact("body", null, "N"), witness: "body needs value", answerPolicy: "refusal-only" },
      { fact: fact("value", null, "N"), witness: "value needs body", answerPolicy: "typed-error" },
    ] }]);
    assert.equal(resumed, 0);
    assert.equal(database.diagnostics().filter(entry => entry === refusal).length, 1);
    for (const earned of [bodyEarned, valueEarned, nestedEarned, outerEarned])
      assert.equal(database.diagnostics().includes(earned), true, `${first}/earned diagnostic`);
  }
});

test("one pause of one hundred thousand synchronous nested answers, and one hundred thousand pauses, run without native recursion", () => {
  const count = 100000;
  const nested = request => driver.nestedRoute({ start: () => ok(request * 2), resume: never, route: never, witness: never, answer: value => value });
  let pauses = 0;
  const wide = driver.defineQuery({ name: "wide",
    producer: { start: () => pause(Array.from({ length: count }, (_, index) => index), null),
      resume: (_, answers) => ok(answers.length + answers[count - 1]) },
    route: nested, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const long = driver.defineQuery({ name: "long",
    producer: { start: () => pause([0], 0),
      resume: (state, answers) => { pauses += 1; return state + 1 === count ? ok(answers[0]) : pause([state + 1], state + 1); } },
    route: nested, witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(wide, null), { kind: "completed", value: count + (count - 1) * 2, diagnostics: [] });
  assert.deepEqual(database.run(long, null), { kind: "completed", value: (count - 1) * 2, diagnostics: [] });
  assert.equal(pauses, count);
});

test("diagnostics of a nested application stay with a requester that then refuses; a run that meets Query's bound is refused with Query's diagnostic for the fact it stopped at", () => {
  const nestedFound = diagnostic(2, "b.ts", "found by the application");
  const refusal = diagnostic(1, "a.ts", "the requester's own refusal");
  const requester = driver.defineQuery({ name: "requester",
    producer: { start: () => pause([{}], null), resume: () => refuse([refusal]) },
    route: () => driver.nestedRoute({ start: () => ok(1, [nestedFound]), resume: never, route: never, witness: never, answer: value => value }),
    witness: never, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(requester, null), { kind: "refused", diagnostics: [nestedFound, refusal] },
    "in the order earned: what the application found, then the requester's refusal");
  assert.deepEqual(database.diagnostics(), [refusal, nestedFound]);
  const needed = leaf("needed", () => ok(1));
  const needs = driver.defineQuery({ name: "needs",
    producer: { start: () => pause([{}], null), resume: (_, answers) => ok(answers[0]) },
    route: () => driver.factRoute(needed, "k", value => value), witness: () => null, keyData: key => key, answerPolicy: { kind: "refusal-only" } });
  const bounded = query.createDatabase(null, { maximumRecords: 7 }, noCycle, "recorded");
  assert.deepEqual(bounded.run(needs, null), stoppedAt(7, "needed", "S1:k"));
  assert.deepEqual(bounded.diagnostics(), [limitReached(7, "needed", "S1:k")]);
});
