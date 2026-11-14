import assert from "node:assert/strict";
import { before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

let fixture;
let wiring;
let pipeline;
let irInfer;
before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  pipeline = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  irInfer = await import("../../packages/host/dist/ir-infer/index.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };
const LIMITS = { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 };
const GRAPH = { maximumWork: 65536, maximumResultEntries: 65536 };

function ready(source) {
  const { checked, interner } = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const domain = checkedDomain(checked, fixture.hir);
  const { nodes } = domain;
  const items = new Map(checked.items.map(item => [item.definition, nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const descriptions = new Map(wiring.decls.describeDefinitions({ module: checked, nodes }, []).definitions
    .map(item => [item.definition, item]));
  const deps = pipeline.inferDepsOf({ rules: { libraries: { sources: [], sourceRoles: [], declaredSummaries: [] },
    types: interner, typeExpansion: EXPANSION }, hirBody: body => domain.bodyOf.get(body) ?? assert.fail("actual body required"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual declaration required"), bindings: [checked.bindings], limits: LIMITS, graph: GRAPH });
  const inputs = { modules: [{ module: checked, nodes }], types: interner, typeExpansion: EXPANSION };
  const partition = wiring.infer.groupsOf(deps, checked.bodies.map(body => body.body));
  assert.equal(partition.kind, "ok");
  return { checked, interner, domain, descriptions, deps, inputs, items, groups: partition.value };
}

function drive(program) {
  const completed = new Map();
  const parts = new Map();
  const signature = (request, group) => {
    assert.equal(group.signatures.some(part => part.definition === request.definition), false,
      "a group never requests its own completed declaration");
    let step = wiring.decls.declaredSignatureOf(program.inputs, request);
    if (step.kind === "paused") {
      const answers = step.requests.map(request => {
        const result = parts.get(irInfer.inferredPartKey(request.part));
        assert.notEqual(result, undefined, "another group's part must really be complete");
        return result;
      });
      step = wiring.decls.resumeDeclaredSignatureOf(program.inputs, step.paused, answers);
    }
    assert.equal(step.kind, "done");
    assert.equal(step.value.kind, "ok");
    assert.equal(step.value.positions.every(position => position.error === null), true);
    return step.value.value;
  };
  for (const group of program.groups) {
    let generation = wiring.infer.constraintsOf(program.deps, group);
    if (generation.kind === "paused") generation = wiring.infer.resumeConstraintsOf(program.deps, generation.paused,
      generation.requests.map(request => request.kind === "inferred-part"
        ? parts.get(irInfer.inferredPartKey(request.part)) ?? assert.fail("the actual outside part must already be verified and complete")
        : { kind: request.kind, value: signature(request.request, group) }));
    assert.equal(generation.kind, "done");
    assert.equal(generation.value.kind, "ok");
    const constraints = generation.value.value.constraints;
    assert.deepEqual(constraints.map(set => set.body), group.bodies);
    assert.deepEqual(constraints.flatMap(set => set.variables.map(variable => variable.id)),
      constraints.flatMap(set => set.variables).map((unused, index) => index));
    const solving = wiring.infer.solveGroup(program.deps, group, generation.value.value, { query: "solutionOf", key: group.id });
    assert.equal(solving.kind, "paused");
    const answers = solving.requests.map(request => {
      if (request.kind === "declaredSignatureOf") return { kind: request.kind, value: signature(request.request, group) };
      const step = wiring.decls.placeSignature(program.inputs, request.placement, { query: "solutionOf", key: group.id });
      assert.equal(step.kind, "done");
      assert.equal(step.value.kind, "ok");
      assert.equal(step.value.positions.every(position => position.error === null), true);
      return { kind: request.kind, value: step.value.value };
    });
    const done = wiring.infer.resumeSolveGroup(program.deps, solving.paused, answers);
    assert.equal(done.kind, "done");
    assert.equal(done.value.kind, "ok");
    const record = { group, constraints, ...done.value.value };
    const exported = fixture.types.exportTypes(program.interner, { maximumWork: 1000000, maximumCreatedRecords: 100000 });
    assert.equal(exported.kind, "complete");
    const types = { terms: exported.value.types.map((unused, index) => fixture.types.readType(program.interner, index)),
      signatures: exported.value.signatures.map((unused, index) => fixture.types.readSignature(program.interner, index)) };
    const declarationOf = definition => {
      const node = program.items.get(definition);
      const description = program.descriptions.get(definition);
      return node === undefined || description === undefined ? null : { scope: description.generics,
        parameterCount: "parameters" in node && "nodes" in node.parameters ? node.parameters.nodes.length : null,
        endpoints: "signatures" in node.tsonic ? node.tsonic.signatures : [] };
    };
    assert.deepEqual(irInfer.verifyInference({ ...record, types, declarationOf, nominalOf: () => null,
      bindingScopes: constraints.flatMap(set => set.constraints.filter(constraint => constraint.kind === "flow")
        .map(() => program.descriptions.get(program.domain.bodyOf.get(set.body).owner).generics)),
      nodeExists: reference => program.domain.nodeOf(reference) !== null, localExists: program.domain.localExists }), []);
    for (const set of constraints) for (const variable of set.variables) if (variable.kind === "signature")
      parts.set(irInfer.inferredPartKey(variable.signature), { part: variable.signature,
        type: record.solution.variables[variable.id].value.type, error: record.solution.variables[variable.id].error,
        origin: { request: { query: "solutionOf", key: group.id },
          position: { kind: "inference-variable", group: group.id, variable: variable.id } } });
    completed.set(group.id, record);
  }
  return completed;
}

test("real unannotated return solves its actual producer before one unmemoised same-group placement", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const records = drive(program);
  const record = [...records.values()].find(record => record.group.signatures.length > 0);
  assert.equal(record.group.signatures[0].part.kind, "return");
  assert.deepEqual(record.constraints[0].variables.map(variable => variable.kind), ["signature", "local"]);
  const signature = fixture.types.readSignature(program.interner, record.solution.bodies[0].signature);
  assert.deepEqual(fixture.types.readType(program.interner, signature.result), { kind: "primitive", primitive: "float64" });
});

test("actual independent default initializer completes before the omitted return consumes its exact outside-group part", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const records = drive(program);
  const completed = [...records.values()];
  const initializer = completed.find(record => record.group.signatures.some(part => part.part.kind === "parameter-initializer"));
  const returned = completed.find(record => record.group.signatures.some(part => part.part.kind === "return"));
  assert.notEqual(initializer, undefined);
  assert.notEqual(returned, undefined);
  assert.notEqual(initializer.group.id, returned.group.id);
  assert.equal(completed.indexOf(initializer) < completed.indexOf(returned), true);
  for (const record of [initializer, returned]) {
    assert.deepEqual(record.solution.variables.map(variable => variable.variable), [0]);
    assert.equal(record.solution.bodies.every(body => fixture.types.readType(program.interner, body.completion).kind === "primitive"), true);
  }
});

test("nested real arithmetic allocates source-order variables but evaluates only genuinely final operand evidence", () => {
  const program = ready("export function add(a: number, b: number) { return (a + b) + (a + b); }\n");
  const records = drive(program);
  const record = [...records.values()].find(record => record.group.signatures.length > 0);
  assert.deepEqual(record.constraints[0].variables.map(variable => variable.kind), ["signature", "local", "local", "local"]);
  assert.equal(record.contributions.some(contribution => contribution.reads.length === 2), true);
  assert.deepEqual(record.positions.filter(position => position.position.kind === "inference-variable")
    .map(position => position.position.variable), [2, 3, 1, 0]);
  assert.equal(record.positions.every(position => position.error === null), true);
});

test("an annotated callable waits only for its different default-argument group, never its own complete group", () => {
  const program = ready("export function select(a: number, b = a): number { return b; }\n");
  assert.equal(program.groups.every(group => group.bodies.length === 1), true);
  drive(program);
});

test("one group owns the variable/contribution/work limits and refuses without any partial system or solution", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  for (const maximumVariablesPerGroup of [0, 1]) {
    const result = wiring.infer.constraintsOf({ ...program.deps, limits: { ...LIMITS, maximumVariablesPerGroup } }, group);
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "refused");
    assert.equal(result.value.diagnostics.length, 1);
  }
  const generated = wiring.infer.constraintsOf({ ...program.deps, limits: { ...LIMITS, maximumVariablesPerGroup: 2 } }, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  for (const maximumAtomicContributionsPerGroup of [0, 1]) {
    const result = wiring.infer.solveGroup({ ...program.deps, limits: { ...LIMITS, maximumAtomicContributionsPerGroup } }, group, generated.value.value, { query: "solutionOf", key: group.id });
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "refused");
  }
  const result = wiring.infer.solveGroup({ ...program.deps, graph: { ...GRAPH, maximumWork: 0 } }, group, generated.value.value, { query: "solutionOf", key: group.id });
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "refused");
});

test("outside-part resume rejects a missing or wrong identity and retains the original classified ErrorValue without re-diagnosing", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const group = program.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const step = wiring.infer.constraintsOf(program.deps, group);
  assert.equal(step.kind, "paused");
  assert.deepEqual(step.requests.map(request => request.kind), ["inferred-part"]);
  const part = step.requests[0].part;
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused, []), /answers for/u);
  const type = fixture.types.internType(program.interner, { kind: "error" });
  const owner = program.groups.find(candidate => candidate.signatures.some(owned => irInfer.inferredPartKey(owned) === irInfer.inferredPartKey(part)));
  const actual = wiring.infer.constraintsOf(program.deps, owner).value.value.constraints.flatMap(set => set.variables)
    .find(variable => variable.kind === "signature" && irInfer.inferredPartKey(variable.signature) === irInfer.inferredPartKey(part));
  const origin = { request: { query: "solutionOf", key: owner.id },
    position: { kind: "inference-variable", group: owner.id, variable: actual.id } };
  const cause = { kind: "unit", unit: { request: { query: "sourceError", key: "actual" }, position: { kind: "result" } } };
  const error = { kind: "error", causes: [cause] };
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused,
    [{ part: { ...part, part: { kind: "return" } }, type, error, origin }]), /actual requested part identity/u);
  const answer = { part, type, error, origin };
  for (const invalid of [undefined, { ...origin, position: { kind: "result" } },
    { request: { query: "solutionOf", key: group.id }, position: { ...origin.position, group: group.id } },
    { ...origin, position: { ...origin.position, variable: -0 } }])
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused, [{ ...answer, origin: invalid }]),
      /different group's finalized variable origin/u);
  const generated = wiring.infer.resumeConstraintsOf(program.deps, step.paused, [answer]);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  assert.equal(generated.value.value.outsideParts[0], answer);
  assert.equal(generated.value.value.outsideParts[0].error, error);
  assert.equal(generated.value.value.outsideParts[0].error.causes[0], cause);
  assert.deepEqual(generated.value.diagnostics, []);
  const absorbed = generated.value.value.constraints[0].evidence.find(value => value.error !== null).error;
  assert.equal(absorbed.causes[0].kind, "unit");
  assert.equal(absorbed.causes[0].unit === origin, true);
  const solved = wiring.infer.solveGroup(program.deps, group, generated.value.value, { query: "solutionOf", key: group.id });
  assert.equal(solved.kind, "paused");
  assert.equal(solved.paused.variables[0].error === absorbed, true,
    "Rules retains the actual consumer's unit absorption, not copied host roots or a type-to-cause cache");
  assert.equal(solved.paused.positions[0].error === absorbed, true);
  assert.deepEqual(solved.earned, []);
});

test("read-only flow operands are not fabricated bounds and both dependency roles remain independently complete", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const step = wiring.infer.solveGroup(program.deps, group, generated, { query: "solutionOf", key: group.id });
  assert.equal(step.kind, "paused");
  const flow = step.paused.contributions.find(contribution => contribution.key.role.kind === "flow");
  assert.deepEqual(flow.reads, [1]);
  assert.deepEqual(flow.bounds, [0]);
  const record = [...drive(program).values()].find(record => record.group.id === group.id);
  assert.equal(record.solution.checks.some(check => check.variable === 1 && check.contribution.role.kind === "flow"), false);
});

test("SolveGroup's scripted multi-bound scheme reads its declared footprint linearly and preserves the exact invocation budget", () => {
  const program = ready("export function value(a: number): number { return a; }\n");
  const group = program.groups.find(group => program.domain.bodyOf.get(group.bodies[0]).root.kind === "Block");
  const body = group.bodies[0];
  const occurrence = { body, node: program.domain.bodyOf.get(body).root.id };
  const type = fixture.types.internType(program.interner, { kind: "primitive", primitive: "float64" });
  const evidence = { type, component: { kind: "body", value: occurrence }, category: { kind: "known", category: "number" },
    numeric: null, sum: null, nominal: null, pointer: null };
  for (const count of [8, 64, 256]) {
    const open = Array.from({ length: count }, (unused, variable) => fixture.types.internType(program.interner, { kind: "open", group: group.id, variable }));
    const variables = open.map((unused, id) => ({ kind: "local", id, occurrence, local: null }));
    let visits = 0;
    let evaluations = 0;
    const footprint = Array.from({ length: count }, (unused, variable) => variable);
    for (let variable = 0; variable < count; variable += 1)
      Object.defineProperty(footprint, variable, { get: () => { visits += 1; return variable; }, enumerable: true, configurable: true });
    const contribution = { key: { node: occurrence, candidate: null, role: { kind: "operator" } },
      reads: [], bounds: footprint, constraint: { body, index: 0 } };
    const scheme = {
      enumerate: () => ({ kind: "ok", value: [contribution], diagnostics: [] }),
      evaluate: () => {
        evaluations += 1;
        return { kind: "ok", diagnostics: [], value: { bounds: variables.map(variable => ({ variable: variable.id,
          contribution: contribution.key, kind: "producer", value: evidence, error: null })),
        decision: null, selectedCandidate: null } };
      },
    };
    const generated = { outsideParts: [], constraints: [{ group: group.id, body, variables, candidates: [],
      constraints: [{ kind: "op", occurrence, operator: "+", operands: open, result: type, permissionScope: null }],
      evidence: [...open.map(type => ({ value: { ...evidence, type }, error: null })), { value: evidence, error: null }] }] };
    const deps = { ...program.deps, rules: { ...program.deps.rules, constraints: { ...program.deps.rules.constraints, op: scheme } },
      limits: { maximumVariablesPerGroup: count, maximumAtomicContributionsPerGroup: 1 } };
    const exact = 3 * count + 2;
    for (const maximumWork of [exact - 1, exact]) {
      visits = 0; evaluations = 0;
      const result = wiring.infer.solveGroup({ ...deps, graph: { ...GRAPH, maximumWork } }, group, generated, { query: "solutionOf", key: group.id });
      assert.equal(evaluations, 1, "the single multi-bound scheme is evaluated once");
      assert.equal(visits, 2 * count, "one footprint admission pass and one readiness pass, never per-bound rescans");
      if (maximumWork === exact) {
        assert.equal(result.kind, "paused");
        assert.deepEqual(result.paused.variables.map(variable => variable.variable), variables.map(variable => variable.id));
        assert.equal(result.paused.checks.length, count);
      } else {
        assert.equal(result.kind, "done");
        assert.equal(result.value.kind, "refused");
        assert.equal(result.value.diagnostics.length, 1);
      }
    }
  }
});

test("a genuine good signature final and an errored demand retain distinct final, check and completed-result truth", async () => {
  const program = ready("export function value(a: number) { return a; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const unit = { query: "solutionOf", key: group.id };
  const body = program.domain.bodyOf.get(group.bodies[0]);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const system = generated.constraints[0];
  const original = system.constraints[0];
  const types = fixture.types;
  const errorType = types.internType(program.interner, { kind: "error" });
  const diagnosticUnit = { request: { query: "demandError", key: "actual-demand" }, position: { kind: "result" } };
  const identity = { kind: "host", unit: diagnosticUnit, code: "TEST_DEMAND_ERROR" };
  const diagnostic = { code: { kind: "host", name: identity.code, rendered: identity.code }, severity: "error",
    site: { kind: "source", origin: body.root.origin }, source: null, evidence: [], message: "actual errored demand",
    arguments: [], related: [], fix: null };
  const rootError = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  const error = { kind: "error", causes: [{ kind: "unit", unit: diagnosticUnit }] };
  const demand = { ...original, occurrence: { body: body.body, node: body.root.statements.nodes[0].id },
    from: original.to, to: errorType, role: "argument" };
  const dynamic = { type: errorType, component: { kind: "body", value: demand.occurrence },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null };
  const constraints = { ...generated, constraints: [{ ...system, constraints: [...system.constraints, demand],
    evidence: [...system.evidence, { value: { ...dynamic, type: original.to }, error: null }, { value: dynamic, error }] }] };
  const step = wiring.infer.solveGroup(program.deps, group, constraints, unit);
  assert.equal(step.kind, "paused");
  assert.equal(step.paused.variables[0].error, null, "a genuinely good producer is not poisoned by a failed demand");
  assert.equal(types.readType(program.interner, step.paused.variables[0].value.type).kind, "primitive");
  const check = step.paused.checks.find(check => check.outcome.kind === "error");
  assert.equal(check.outcome.error === error, true);
  const at = step.paused.positions.find(entry => entry.position.kind === "source-node");
  assert.equal(at.error === error, true, "the actual checked demand retains its original error at its source position");
  assert.deepEqual(at.position.node, { kind: "body", value: demand.occurrence });
  assert.equal(step.paused.positions.find(entry => entry.position.kind === "result").error !== null, true);
  const answers = step.requests.map(request => {
    assert.equal(request.kind, "placeSignature");
    const placed = wiring.decls.placeSignature(program.inputs, request.placement, unit);
    assert.equal(placed.kind, "done");
    assert.equal(placed.value.kind, "ok");
    return { kind: request.kind, value: placed.value.value };
  });
  const result = wiring.infer.resumeSolveGroup(program.deps, step.paused, answers);
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  const { createDatabase } = await import("../../packages/host/dist/query/index.js");
  const database = createDatabase({}, { maximumRecords: 512 }, () => assert.fail("an actual completed demand does not close a cycle"), "recorded");
  const root = { name: diagnosticUnit.request.query, keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: () => ({ kind: "ok", value: errorType, positions: [{ position: { kind: "result" }, error: rootError }],
      diagnostics: [diagnostic], emissions: [{ identity, diagnostic }] }) };
  assert.equal(database.run(root, diagnosticUnit.request.key).kind, "completed");
  const solution = { name: unit.query, keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: () => ({ kind: "ok", value: result.value.value, positions: result.value.value.positions, diagnostics: [], emissions: [] }) };
  assert.equal(database.run(solution, group.id).kind, "completed");
  assert.equal(database.errorOf({ request: unit, position: { kind: "inference-variable", group: group.id, variable: 0 } }).error, null);
  assert.equal(database.errorOf({ request: unit, position: at.position }).error === error, true);
  assert.equal(database.errorOf({ request: unit, position: { kind: "result" } }).error !== null, true);
  assert.equal(database.run(solution, group.id).kind, "completed");
  assert.deepEqual(database.diagnostics(), [diagnostic], "the absorbing solve emits no second diagnostic");
});

test("actual Rules propagate only dependent error operands with every original cause and no diagnostic", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const system = generated.constraints[0];
  const operation = system.constraints.find(constraint => constraint.kind === "op");
  const types = fixture.types;
  const errorType = types.internType(program.interner, { kind: "error" });
  const causes = [0, 1].map(index => ({ kind: "unit", unit: {
    request: { query: "realOperand", key: index }, position: { kind: "result" },
  } }));
  const errors = causes.map(cause => ({ kind: "error", causes: [cause] }));
  const values = errors.map(error => ({ value: { type: errorType, component: { kind: "body", value: operation.occurrence },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error }));
  const scheme = program.deps.rules.constraints.op;
  const constraint = { ...operation, operands: [errorType, errorType] };
  const enumeration = scheme.enumerate({ group: group.id, remainingContributions: 1, reference: { body: system.body, index: 0 },
    constraint, variables: system.variables, candidates: [], evidence: [...values, system.evidence[2]] });
  assert.equal(enumeration.kind, "ok");
  const evaluate = operands => scheme.evaluate({ constraint, contribution: enumeration.value[0],
    evidence: [...operands, system.evidence[2]], reads: [], candidates: [] });
  const combined = evaluate(values);
  assert.equal(combined.kind, "ok");
  assert.equal(combined.value.decision.kind, "error");
  assert.deepEqual(combined.value.decision.error.causes, causes);
  assert.equal(combined.value.bounds[0].error === combined.value.decision.error, true);
  assert.equal(combined.value.bounds[0].variable, system.variables.find(variable => variable.kind === "local").id);
  assert.equal(types.readType(program.interner, combined.value.bounds[0].value.type).kind, "error");
  assert.deepEqual(combined.diagnostics, []);
  assert.equal(evaluate([values[0], values[0]]).value.decision.error === errors[0], true, "one original error is not rewrapped");
  assert.equal(evaluate([values[0], { ...values[1], error: { kind: "error", causes: [causes[0]] } }])
    .value.decision.error.causes.length, 1, "equal actual cause identities are not chosen by first type or source spelling");
  assert.throws(() => evaluate([{ ...values[0], error: null }, values[1]]), /actual provenance/u);
  const variable = system.variables.find(variable => variable.kind === "signature");
  const finalized = program.deps.rules.variables.signature.finalize({
    variable, producers: [{ contribution: enumeration.value[0].key, variable: variable.id, kind: "producer",
      ...system.evidence[0] }, { ...combined.value.bounds[0], variable: variable.id }],
    demands: [], default: null, declaredConstraint: null, declaredDefault: null,
  });
  assert.equal(finalized.kind, "ok");
  assert.equal(finalized.value.error === combined.value.decision.error, true);
  assert.equal(types.readType(program.interner, finalized.value.value.type).kind, "error");
});

test("every public Infer invocation rejects malformed original counts before body, rule or semantic-state reads", () => {
  const program = ready("export function value(a: number) { return a; }\n");
  const unread = new Proxy({}, { get: () => assert.fail("a malformed count must be rejected before semantic-state reads") });
  const operations = [
    deps => wiring.infer.constraintsOf(deps, unread),
    deps => wiring.infer.resumeConstraintsOf(deps, unread, []),
    deps => wiring.infer.solveGroup(deps, unread, unread, unread),
    deps => wiring.infer.resumeSolveGroup(deps, unread, []),
  ];
  for (const [owner, field] of [["limits", "maximumVariablesPerGroup"], ["limits", "maximumAtomicContributionsPerGroup"],
    ["graph", "maximumWork"], ["graph", "maximumResultEntries"]]) {
    for (const value of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined, null, "4", 4n]) {
      const deps = { ...program.deps, [owner]: { ...program.deps[owner], [field]: value },
        hirBody: () => assert.fail("invalid inference limit reached a body reader"),
        itemOf: () => assert.fail("invalid inference limit reached a declaration reader") };
      Object.defineProperty(deps, "rules", { get: () => assert.fail("invalid inference limit reached Rules") });
      for (const operation of operations) assert.throws(() => operation(deps),
        new RegExp(field + " must be a nonnegative safe integer", "u"), field + ":" + String(value));
    }
  }
});
