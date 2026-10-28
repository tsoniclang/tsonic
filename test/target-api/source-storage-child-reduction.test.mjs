import assert from "node:assert/strict";
import test from "node:test";
import { completeSourceStorageChildReduction } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/child-reduction.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const scope = Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze([]) });
const leaf = () => Object.freeze({ kind: "leaf", subject: Object.freeze({ kind: "input", node: {}, projection: Object.freeze([]) }), scope });

function nested(depth, project = false, limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const terminal = leaf();
  const references = [];
  let root = terminal;
  for (let index = 0; index < depth; index += 1) {
    const reference = {};
    references.push(reference);
    root = Object.freeze({ kind: "guarded", reference, value: root });
  }
  const reduce = term => {
    if (!budget.step()) return undefined;
    return term.kind === "guarded" ? { kind: "child-reduction", child: term.value, context: { correlated: true },
      replace: value => Object.freeze({ ...term, value }) }
      : project ? { kind: "project", inputs: [term], select: value => [value] } : { kind: "replace", terms: [term] };
  };
  return { budget, terminal, references, selected: completeSourceStorageChildReduction(budget, reduce(root), reduce) };
}

for (const project of [false, true]) {
  test(`child reduction completes deep ${project ? "projected" : "direct"} continuations without native recursion`, () => {
    const fixture = nested(20_000, project);
    assert.equal(fixture.selected?.kind, project ? "project" : "replace", "the original reduction kind is retained");
    const terms = project ? fixture.selected.select(fixture.terminal) : fixture.selected.terms;
    assert.equal(terms?.length, 1, "one exact correlated alternative remains");
    let current = terms[0];
    for (let index = fixture.references.length - 1; index >= 0; index -= 1) {
      assert.equal(current.kind === "guarded" && current.reference === fixture.references[index], true,
        "every original guard stays in its original inner-to-outer order");
      current = current.value;
    }
    assert.equal(current === fixture.terminal, true, "the exact original terminal identity is unchanged");
    assert.equal(fixture.budget.failure(), undefined, "deep finite continuations complete under the existing budget");
    assert.equal(fixture.budget.usage().peakRows, 20_000, "every pending continuation is accounted once");
    assert.equal(fixture.budget.usage().rows, 0, "temporary continuation reservations are released");
  });
}

test("child reductions preserve correlation, dependencies and noncontributing witnesses", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const first = { ...leaf(), kind: "reference" };
  const second = { ...leaf(), kind: "reference" };
  const terminal = leaf();
  const dependencies = [leaf(), leaf(), leaf()];
  const order = [];
  const inner = { kind: "child-reduction", child: second, context: { correlated: false, dependencies: [dependencies[1]] },
    replace: value => { order.push("inner"); return value; } };
  const outer = { kind: "child-reduction", child: first,
    context: { contributes: false, correlated: true, dependencies: [dependencies[2]] },
    replace: value => { order.push("outer"); return value; } };
  const selected = completeSourceStorageChildReduction(budget, outer, (term, correlated) => {
    assert.equal(correlated, term === first, "each child receives its own original correlation mode");
    return term === first ? inner : { kind: "replace", terms: [terminal], dependencies: [dependencies[0]] };
  });
  assert.equal(selected?.kind, "replace", "the completed child remains a replacement");
  assert.equal(selected.terms.length === 1 && selected.terms[0] === terminal, true, "the exact terminal is retained");
  assert.equal(order.join(","), "inner,outer", "replacements unwind in the original call order");
  assert.equal(selected.dependencies.length === 3 && selected.dependencies.every((value, index) => value === dependencies[index]), true,
    "base and both parent dependencies retain their original order and identity");
  assert.equal(selected.witnesses.length === 2 && selected.witnesses[0].subject === second.subject &&
    selected.witnesses[1].subject === first.subject && selected.witnesses.every(witness =>
      witness.bindings === scope && witness.contributes === false && witness.observesValue === false), true,
    "the outer noncontributing context preserves exact subjects and masks both witness modes");
});

for (const limit of ["maximumTransportRows", "maximumSteps"]) {
  test(`child reductions retain the existing ${limit} refusal without a native stack overflow`, () => {
    const fixture = nested(20_000, false, { [limit]: 128 });
    assert.equal(fixture.selected, undefined, "an exhausted exact reduction is not published");
    assert.equal(fixture.budget.failure(), limit === "maximumTransportRows"
      ? "Source storage transport exceeds its finite transport-row budget."
      : "Source storage transport exceeds its finite analysis-work budget.", "the original budget owns the precise refusal");
    assert.equal(fixture.budget.usage().rows, 0, "failure releases all pending continuation reservations");
  });
}
