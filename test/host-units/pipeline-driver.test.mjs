import assert from "node:assert/strict";
import { before, test } from "node:test";

let driver;
let query;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "driver tests run under the aggregate resource guard");
  driver = await import("../../packages/host/dist/pipeline/driver.js");
  query = await import("../../packages/host/dist/query/index.js");
});

const unbounded = { maximumRecords: Number.MAX_SAFE_INTEGER };
const noCycle = () => { throw new Error("this case closes no cycle"); };
const never = () => { throw new Error("this operation is not reached in this case"); };
const ok = (value, diagnostics = []) => ({ kind: "done", value: { kind: "ok", value, diagnostics } });
const refuse = diagnostics => ({ kind: "done", value: { kind: "refused", diagnostics } });
const pause = (requests, state, earned = []) => ({ kind: "paused", requests, paused: state, earned });
const fact = (name, key, encodedKey) => ({ query: name, key, encodedKey });
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
    route: never, witness: never, cycleOutcome: noCycle });
}

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
    witness: request => `constraints needs ${request.name}`, cycleOutcome: noCycle });
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
    witness: request => request, cycleOutcome: noCycle });
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
    route: place, witness: never, cycleOutcome: noCycle });
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
      witness: () => "f needs big", cycleOutcome: noCycle });
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
  const errorValue = { kind: "error", cause: "unit:broken" };
  const broken = leaf("broken", () => ok(errorValue, [detected]));
  const caller = driver.defineQuery({ name: "caller",
    producer: { start: () => pause([{}], null), resume: (_, answers) => ok(answers[0], [own]) },
    route: () => driver.factRoute(broken, null, value => value), witness: () => null, cycleOutcome: noCycle });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  const result = database.run(caller, null);
  assert.equal(result.value, errorValue);
  assert.deepEqual(result.diagnostics, [own]);
  assert.deepEqual(database.diagnostics(), [detected, own]);
  database.run(caller, null);
  assert.deepEqual(database.diagnostics(), [detected, own]);
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
    witness: request => request.kind, cycleOutcome: noCycle });
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

test("rows in a cycle: Query hands over the whole cycle with each row's witness; each row states its own outcome for the one verdict", () => {
  const classified = [];
  const row = (name, other, value) => driver.defineQuery({ name,
    producer: { start: () => pause([{ needs: other().name }], null), resume: never },
    route: () => driver.factRoute(other(), "k", answer => answer),
    witness: request => `${name} needs ${request.needs}`,
    cycleOutcome: (key, verdict) => ({ kind: "ok", value: { error: value, cause: verdict.cause, key }, diagnostics: [] }) });
  for (const first of ["constant", "type"]) {
    const constant = row("constant", () => type, "no constant");
    const type = row("type", () => constant, "no type");
    const database = query.createDatabase(null, unbounded, cycle => { classified.push(cycle); return { cause: "ungrounded" }; }, "recorded");
    const rows = { constant, type };
    assert.deepEqual(database.run(rows[first], "k").value, { error: first === "constant" ? "no constant" : "no type", cause: "ungrounded", key: "k" });
    assert.deepEqual(database.run(constant, "k").value.error, "no constant");
    assert.deepEqual(database.run(type, "k").value.error, "no type");
  }
  const expected = { members: [{ fact: fact("constant", "k", "S1:k"), witness: "constant needs type" },
    { fact: fact("type", "k", "S1:k"), witness: "type needs constant" }] };
  assert.deepEqual(classified, [expected, expected]);
});

test("one pause of one hundred thousand synchronous nested answers, and one hundred thousand pauses, run without native recursion", () => {
  const count = 100000;
  const nested = request => driver.nestedRoute({ start: () => ok(request * 2), resume: never, route: never, witness: never, answer: value => value });
  let pauses = 0;
  const wide = driver.defineQuery({ name: "wide",
    producer: { start: () => pause(Array.from({ length: count }, (_, index) => index), null),
      resume: (_, answers) => ok(answers.length + answers[count - 1]) },
    route: nested, witness: never, cycleOutcome: noCycle });
  const long = driver.defineQuery({ name: "long",
    producer: { start: () => pause([0], 0),
      resume: (state, answers) => { pauses += 1; return state + 1 === count ? ok(answers[0]) : pause([state + 1], state + 1); } },
    route: nested, witness: never, cycleOutcome: noCycle });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(wide, null), { kind: "completed", value: count + (count - 1) * 2, diagnostics: [] });
  assert.deepEqual(database.run(long, null), { kind: "completed", value: (count - 1) * 2, diagnostics: [] });
  assert.equal(pauses, count);
});

test("diagnostics of a nested application stay with a requester that then refuses; an exhausted run reports the fact it stopped at", () => {
  const nestedFound = diagnostic(2, "b.ts", "found by the application");
  const refusal = diagnostic(1, "a.ts", "the requester's own refusal");
  const requester = driver.defineQuery({ name: "requester",
    producer: { start: () => pause([{}], null), resume: () => refuse([refusal]) },
    route: () => driver.nestedRoute({ start: () => ok(1, [nestedFound]), resume: never, route: never, witness: never, answer: value => value }),
    witness: never, cycleOutcome: noCycle });
  const database = query.createDatabase(null, unbounded, noCycle, "recorded");
  assert.deepEqual(database.run(requester, null), { kind: "refused", diagnostics: [refusal, nestedFound] });
  assert.deepEqual(database.diagnostics(), [refusal, nestedFound]);
  const needed = leaf("needed", () => ok(1));
  const needs = driver.defineQuery({ name: "needs",
    producer: { start: () => pause([{}], null), resume: (_, answers) => ok(answers[0]) },
    route: () => driver.factRoute(needed, "k", value => value), witness: () => null, cycleOutcome: noCycle });
  const bounded = query.createDatabase(null, { maximumRecords: 7 }, noCycle, "recorded");
  assert.deepEqual(bounded.run(needs, null), { kind: "exhausted", maximumRecords: 7, at: fact("needed", "k", "S1:k") });
});
