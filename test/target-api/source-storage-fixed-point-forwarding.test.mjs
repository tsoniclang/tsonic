import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  return { budget, graph };
}

for (const reversed of [false, true]) {
  test(`exact forwarding propagates a shared cyclic union without replaying unchanged collectors (${reversed})`, () => {
    const { budget, graph } = fixture();
    const count = 128;
    const calls = new Map();
    const select = graph.fixedPoint((key, _read, add, forward) => {
      calls.set(key, (calls.get(key) ?? 0) + 1);
      if (key === "root") {
        const keys = Array.from({ length: count }, (_, index) => index);
        if (reversed) keys.reverse();
        for (const child of keys) if (!forward(child)) return false;
        return true;
      }
      return add(key) && forward((key + 1) % count);
    });
    const selected = select("root");
    assert.equal(selected?.size === count, true, `all ${count} original values: ${budget.failure() ?? "no failure"}`);
    for (let value = 0; value < count; value += 1) assert.equal(selected.has(value), true);
    assert.equal(calls.size === count + 1 && [...calls.values()].every(value => value === 1), true,
      "every pure forwarding collector runs exactly once, including the cyclic peers");
    assert.equal(select("root") === selected && select(0)?.size === count, true, "completed stable family identities");
    assert.equal(Object.isFrozen(selected) && selected.add === undefined && budget.failure() === undefined, true);
  });
}

test("forwarded deltas wake nonlinear readers and admit late exact dependencies", () => {
  const { budget, graph } = fixture();
  const seed = {}; const alternate = {};
  const select = graph.fixedPoint((key, read, add, forward) => {
    if (key === "seed") return add(seed);
    if (key === "alternate") return add(alternate);
    if (key === "relay") return forward("seed");
    const values = read("relay");
    if (values === undefined || !forward("relay")) return false;
    return values.size === 0 || forward("alternate");
  });
  const selected = select("root");
  assert.equal(selected?.size === 2 && selected.has(seed) && selected.has(alternate), true);
  assert.equal(select("relay")?.size === 1 && select("relay").has(seed), true, "no reverse-edge contamination");
  assert.equal(budget.failure() === undefined, true);
});

test("forwarding completed independent cells and duplicate edges preserves exact source identities", () => {
  const { budget, graph } = fixture();
  const first = {}; const second = {};
  const select = graph.fixedPoint((key, _read, add, forward) => key === first || key === second ? add(key)
    : forward(key.source) && forward(key.source));
  const existing = select(first);
  const selected = select({ source: first });
  const separate = select({ source: second });
  assert.equal(selected?.size === 1 && selected.has(first) && !selected.has(second), true);
  assert.equal(separate?.size === 1 && separate.has(second) && !separate.has(first), true);
  assert.equal(select(first) === existing && budget.failure() === undefined, true);
});

test("empty forwarding cycles converge without fabricating an origin", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, _read, _add, forward) => forward(key === "first" ? "second" : "first"));
  const selected = select("first");
  assert.equal(selected?.size === 0 && select("first") === selected && select("second")?.size === 0, true);
  assert.equal(budget.failure() === undefined, true);
});

test("forwarding handles are valid only in their exact active collector", () => {
  for (const mode of ["completed", "reevaluated"]) {
    const { budget, graph } = fixture();
    let escaped;
    const select = graph.fixedPoint((key, read, add, forward) => {
      if (escaped !== undefined && mode === "reevaluated") return escaped(key);
      escaped = forward;
      return add(key) && (mode === "completed" || read(key) !== undefined);
    });
    const selected = select("root");
    if (mode === "completed") {
      assert.equal(selected?.has("root"), true);
      assert.equal(escaped("foreign"), false);
    } else assert.equal(selected === undefined, true);
    assert.match(budget.failure(), /active collector/u);
    assert.equal(select("root") === undefined, true);
  }
});

test("changed dependencies cannot retract a proved forwarded value", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, read, add, forward) => {
    if (key === "seed") return add("original");
    const state = read("seed");
    const previous = read(key);
    return state !== undefined && previous !== undefined && (previous.size !== 0 || forward("seed"));
  });
  assert.equal(select("root") === undefined, true, "removing the source cannot silently retain its earlier value");
  assert.match(budget.failure(), /retract a proved result/u);
});

test("retired empty forwarding dependencies cannot later inject unrelated values", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, read, add, forward) => {
    if (key === "seed") return add("ready");
    if (key === "slow") return forward("delay");
    if (key === "delay") return forward("last");
    if (key === "last") return add("unrelated");
    const values = read("seed");
    return values !== undefined && (values.size === 0 ? forward("slow") : add("selected"));
  });
  const selected = select("root");
  assert.equal(selected?.size === 1 && selected.has("selected") && !selected.has("unrelated"), true);
  assert.equal(select("slow")?.has("unrelated") && budget.failure() === undefined, true,
    "the exact source completed independently after its parent stopped forwarding it");
});

test("an invalidated reader reselects forwarding edges before an older edge propagates new values", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, read, add, forward) => {
    if (key === "ready") return add("ready");
    if (key === "other") return add("unrelated");
    const values = read("ready");
    return values !== undefined && (values.size === 0 ? forward("other") : add("selected"));
  });
  const selected = select("root");
  assert.equal(selected?.size === 1 && selected.has("selected") && !selected.has("unrelated"), true,
    "pending nonlinear evidence takes precedence over a superseded forwarding edge");
  assert.equal(select("other")?.has("unrelated") && budget.failure() === undefined, true);
});

test("a deep delta chain retires its pending frontier and never recurses on the native stack", () => {
  const { budget, graph } = fixture({ maximumSteps: 32_768, maximumTransportRows: 2048 });
  const original = {};
  const select = graph.fixedPoint((key, _read, add, forward) => key === 256 ? add(original) : forward(key + 1));
  const selected = select(0);
  assert.equal(selected?.size === 1 && selected.has(original), true);
  assert.equal(select(256)?.has(original) && budget.failure() === undefined, true);
});

for (const limits of [{ maximumSteps: 8 }, { maximumTransportRows: 4 }, { maximumTransportRows: 10 }]) {
  test(`forwarding exhaustion rejects the complete family under ${JSON.stringify(limits)}`, () => {
    const { budget, graph } = fixture(limits);
    const select = graph.fixedPoint((key, _read, add, forward) => add(key) && forward(key === "first" ? "second" : "first"));
    assert.equal(select("first") === undefined && budget.failure() !== undefined, true);
    assert.equal(select("first") === undefined && select("second") === undefined, true, "no partial or cached bypass");
  });
}

test("forwarding completion releases edge and delta rows but retains each completed cell and value", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 64 });
  const select = graph.fixedPoint((key, _read, add, forward) => add(key) && forward(key === "first" ? "second" : "first"));
  assert.equal(select("first")?.size === 2, true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining === 56, true, "only two cells, two views and four exact values remain");
});

test("exceptions discard partial forwarding families without damaging completed independent evidence", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 64 });
  const failure = new Error("exact forwarding failure");
  let reject = true;
  const select = graph.fixedPoint((key, _read, add, forward) => {
    if (key === "stable") return add(key);
    if (!forward("stable")) return false;
    if (reject) throw failure;
    return add(key) && forward(key);
  });
  const stable = select("stable");
  assert.throws(() => select("partial"), error => error === failure);
  reject = false;
  assert.equal(select("partial")?.size === 2 && select("stable") === stable && budget.failure() === undefined, true);
});
