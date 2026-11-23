import assert from "node:assert/strict";
import { analysisInput } from "./front/analysis-input.mjs";
import { loadFrontFixture } from "./front/checked-module.mjs";

function checkInitializationWire(text, parse, definition) {
  const externalLabel = "ResolvedExternalEntry";
  const storageLabel = "ModuleStaticCellRef";
  const external = text.indexOf(externalLabel, text.indexOf("initialization=ProgramInitialization("));
  const storage = text.indexOf(storageLabel, external);
  assert.ok(external > 0 && storage > external);
  const after = (token, start) => {
    const found = text.indexOf(token, start);
    assert.ok(found >= start, token);
    return found + token.length;
  };
  const cell = after("cell=", storage);
  const closesCell = text.indexOf(")", cell);
  const closesEntry = after(")]", closesCell);
  assert.equal(text[closesEntry], ")");
  const groups = after("definitions=", external);
  const canonicalGroup = `[def:${JSON.stringify(definition)}]`;
  assert.equal(text.slice(groups, groups + canonicalGroup.length), canonicalGroup);
  const refusal = (source, offset, expected) => {
    const lines = source.slice(0, offset).split(/\r\n|\r|\n/);
    assert.deepEqual(parse(source), { kind: "invalid-text", offset, line: lines.length, column: lines.at(-1).length + 1,
      expected, found: source[offset] });
  };
  for (const [offset, token] of [
    [external + externalLabel.length, "("],
    [after("module=", external), "mod:"],
    [after("name=", external), "string"],
    [groups, "["],
    [storage + storageLabel.length, "("],
    [after("execution=", storage), "Execution"],
    [cell, "number"],
  ]) refusal(text.slice(0, offset) + "@" + text.slice(offset + 1), offset, [token]);
  for (const offset of [closesCell, closesEntry])
    refusal(text.slice(0, offset) + " @" + text.slice(offset + 1), offset + 1, [")"]);
  const emptyGroup = text.slice(0, groups) + "[]" + text.slice(groups + canonicalGroup.length);
  refusal(emptyGroup, groups + 2, ["nonempty declaration group"]);
}

async function verifyInitializationCuts(run, limits, expected) {
  const { accountFailure, createAccount, refuseAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const control = createAccount(limits);
  assert.deepEqual(run(control), expected);
  const { work, entries } = InvocationAccount.stateOf(control);
  assert.equal(work > 0 && entries > 0, true);
  for (const [field, dimension, required] of [["maximumWork", "work", work], ["maximumResultEntries", "result-entries", entries]]) {
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const account = createAccount({ ...limits, [field]: maximum });
      const result = run(account);
      if (maximum === required) assert.deepEqual(result, expected, `exact ${dimension} cut`);
      else {
        assert.deepEqual(result, { kind: "resource-limit", dimension, maximum }, `${dimension} cut ${maximum}/${required}`);
        assert.equal(result === accountFailure(account), true);
      }
    }
  }
  const alreadyStopped = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  assert.equal(refuseAccount(alreadyStopped, refusal) === refusal, true);
  assert.equal(run(alreadyStopped) === refusal, true);
}

export async function checkSelectedStaticExposure() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { parseProgramIndex, printProgramIndex } = await import("../../../packages/host/dist/ir-program/index.js");
  const { programLookup } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { verifyInitialization, verifyInitializationEffects } = await import("../../../packages/host/dist/ir-program/verify-initialization.js");
  const { createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { summaryKey } = await import("../../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const request = { module: moduleOf("api"), name: "exposed" };
  const snapshot = (declaration, exposed) => fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "export const start: boolean = true; export function run(value: boolean): boolean { return value; }",
    "api.ts": "export { selected as exposed } from './provider.js';",
    "provider.ts": declaration,
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }], externalEntries: exposed ? [request] : [] });
  for (const declaration of ["export const selected: boolean = true;", "export let selected: boolean | undefined;"]) {
    const current = analyzeHostProgram({ ...input, snapshot: snapshot(declaration, true) });
    assert.equal(current.kind, "ok", JSON.stringify(current.diagnostics));
    const { index } = current.value;
    const initialization = index.initialization;
    const [selection] = initialization.external;
    const [reference] = selection.storage;
    const [definition] = selection.definitions;
    const lookup = programLookup(index);
    assert.deepEqual({ module: selection.module, name: selection.name }, request);
    assert.equal(fixture.ids.decodeDefId(definition).value.module, moduleOf("provider"));
    assert.equal(reference.owner.kind, "summary");
    const { key } = reference.owner;
    assert.equal(fixture.ids.decodeBodyId(key.execution.instance.body).value.role, "module");
    assert.ok(initialization.modules.includes(key.execution));
    const summary = lookup.summaries.get(summaryKey(key));
    assert.equal(summary.arena.cells[reference.cell].role.declaration.definition, definition);
    assert.equal(summary.contentsOnReturn.some(row => row.target === reference.cell), true);
    assert.deepEqual(initialization.entries, []);
    const printed = printProgramIndex(index);
    const decoded = parseProgramIndex(printed);
    assert.equal(decoded.kind, "parsed");
    assert.deepEqual(decoded.value.initialization, initialization);
    assert.equal(printProgramIndex(decoded.value), printed);
    assert.equal(parseProgramIndex(printed.replace(/(ModuleStaticCellRef\(.*?, cell=)0/, "$1-0")).kind, "invalid-text");
    if (declaration.startsWith("export const")) checkInitializationWire(printed, parseProgramIndex, definition);
    const checked = (plan, account = createAccount(input.limits.dataflow)) =>
      verifyInitialization({ ...index, initialization: plan }, lookup, initialization, account);
    const effects = (plan, facts = lookup, account = createAccount(input.limits.dataflow)) => verifyInitializationEffects(plan, facts, {
      account, maximumConditionAlternatives: input.limits.analyses.maximumConditionAlternatives,
      eventCount: 0, refusal: { kind: "refused", diagnostics: [] },
    });
    assert.deepEqual(checked(decoded.value.initialization), { kind: "complete", value: [] });
    assert.deepEqual(effects(decoded.value.initialization), { kind: "complete", value: null });
    for (const storage of [[{ ...reference, cell: reference.cell + 1 }], [reference, reference], [
      { ...reference, owner: { kind: "summary", key: { kind: "body", execution: initialization.modules[0] } } },
    ]]) {
      const crossed = { ...initialization, external: [{ ...selection, storage }] };
      assert.equal(checked(crossed).value[0].rule, "initialization-exposure-exact");
      assert.equal(effects(crossed).value.rule, "plan-initialized");
    }
    const unwritten = { ...summary, initialization: { ...summary.initialization,
      rows: summary.initialization.rows.filter(row => row.cell !== reference.cell) } };
    const summaries = new Map(lookup.summaries).set(summaryKey(key), unwritten);
    assert.equal(effects(initialization, { ...lookup, summaries }).value.rule, "plan-initialized");
    if (declaration.startsWith("export const")) {
      const exactField = { rule: "initialization-exposure-exact", site: { kind: "index" }, detail: [{ kind: "number", value: 0 }] };
      const entry = { rule: "initialization-entry-exact", site: { kind: "index" }, detail: [] };
      assert.notEqual(selection.module, initialization.entry);
      const reversed = [...initialization.modules].reverse();
      assert.ok(reversed.length > 1);
      const executionCount = { rule: "initialization-executions-exact", site: { kind: "index" }, detail: [] };
      const wrongOrder = reversed.flatMap((execution, position) => execution === initialization.modules[position] ? [] : [{
        ...executionCount, detail: [{ kind: "number", value: position }],
      }]);
      assert.deepEqual(checked({ ...initialization, external: [{ ...selection, definitions: [] }] }),
        { kind: "complete", value: [exactField] });
      for (const [plan, value] of [
        [{ ...initialization, entry: selection.module }, [entry]],
        [{ ...initialization, modules: reversed }, wrongOrder],
        [{ ...initialization, modules: [] }, [executionCount]],
        [{ ...initialization, external: [] }, [{ ...exactField, detail: [] }]],
      ]) await verifyInitializationCuts(account => checked(plan, account), input.limits.dataflow, { kind: "complete", value });
      await verifyInitializationCuts(account => checked(initialization, account),
        input.limits.dataflow, { kind: "complete", value: [] });
      await verifyInitializationCuts(account => checked({ ...initialization, external: [{ ...selection,
        storage: [{ ...reference, cell: -0 }] }] }, account),
      input.limits.dataflow, { kind: "complete", value: [exactField] });
      await verifyInitializationCuts(account => effects(initialization, lookup, account),
        input.limits.dataflow, { kind: "complete", value: null });
      await verifyInitializationCuts(account => effects(initialization, { ...lookup, summaries }, account),
        input.limits.dataflow, { kind: "complete", value: { ...exactField, rule: "plan-initialized" } });
      const selectedModule = fixture.ids.decodeBodyId(key.execution.instance.body).value.owner;
      assert.notEqual(selectedModule, definition);
      const crossedDefinition = { ...initialization, external: [{ ...selection, definitions: [selectedModule] }] };
      assert.deepEqual(checked(crossedDefinition), { kind: "complete", value: [exactField] });
      assert.deepEqual(effects(crossedDefinition), { kind: "complete", value: { ...exactField, rule: "plan-initialized" } });
      const omittedSummary = new Map(lookup.summaries);
      omittedSummary.delete(summaryKey(key));
      assert.deepEqual(effects(initialization, { ...lookup, summaries: omittedSummary }), { kind: "complete", value: {
        ...exactField, rule: "plan-initialized",
        detail: [{ kind: "number", value: initialization.modules.indexOf(key.execution) }],
      } });
      const invalidExposure = { kind: "complete", value: { ...exactField, rule: "plan-initialized" } };
      const pendingProvider = initialization.modules.filter(execution => execution !== key.execution);
      assert.deepEqual(effects({ ...initialization, modules: pendingProvider }, { ...lookup, summaries: omittedSummary }), invalidExposure);
      const missingOwner = new Map(lookup.definitions);
      assert.equal(missingOwner.delete(selectedModule), true);
      assert.deepEqual(effects(initialization, { ...lookup, definitions: missingOwner }), invalidExposure);
      const callable = index.summaries.find(row => row.key.kind === "body"
        && fixture.ids.decodeBodyId(row.key.execution.instance.body).value.role === "function");
      assert.ok(callable);
      const callableScheduled = { ...initialization, modules: [...initialization.modules, callable.key.execution] };
      assert.deepEqual(effects(callableScheduled), { kind: "complete", value: null });
      assert.deepEqual(effects({ ...callableScheduled, external: [{ ...selection, storage: [
        { ...reference, owner: { kind: "summary", key: callable.key } },
      ] }] }), invalidExposure);
      const sparseModules = [...initialization.modules];
      delete sparseModules[initialization.modules.indexOf(key.execution)];
      assert.deepEqual(effects({ ...initialization, modules: sparseModules }), { kind: "complete", value: {
        ...exactField, rule: "plan-initialized", detail: [{ kind: "number", value: initialization.modules.indexOf(key.execution) }],
      } });
      for (const opposite of [
        { ...initialization, modules: pendingProvider },
        { ...initialization, modules: [] },
        { ...initialization, external: new Array(initialization.external.length) },
        { ...initialization, external: [{ ...selection, definitions: new Array(selection.definitions.length) }] },
        { ...initialization, external: [{ ...selection, storage: new Array(selection.storage.length) }] },
        { ...initialization, entries: new Array(1) },
      ]) assert.deepEqual(effects(opposite), invalidExposure);
    }
  }

  const unwritten = "export let selected: boolean;";
  const refused = analyzeHostProgram({ ...input, snapshot: snapshot(unwritten, true) });
  assert.equal(refused.kind, "refused");
  const diagnostic = refused.diagnostics.find(row => row.code.kind === "host"
    && row.code.name === "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.equal(diagnostic?.message, "Exported static storage is not initialized on the returning module plan.");
  assert.equal(diagnostic?.site.kind, "source");
  const hidden = analyzeHostProgram({ ...input, snapshot: { ...snapshot(unwritten, false), entryPoint: moduleOf("provider") } });
  assert.equal(hidden.kind, "ok", JSON.stringify(hidden.diagnostics));
  const hiddenLookup = programLookup(hidden.value.index);
  const hiddenModule = hidden.value.index.initialization.modules[0];
  const hiddenSummary = hiddenLookup.summaries.get(summaryKey({ kind: "body", execution: hiddenModule }));
  assert.deepEqual(hiddenSummary.initialization.cells, [0]);
  assert.deepEqual(hiddenSummary.contentsOnReturn, []);

  const callable = analyzeHostProgram({ ...input,
    snapshot: snapshot("export function selected(): boolean { return true; }", true) });
  assert.equal(callable.kind, "ok", JSON.stringify(callable.diagnostics));
  const { index: callableIndex } = callable.value;
  const [callableEntry] = callableIndex.initialization.external;
  assert.deepEqual({ module: callableEntry.module, name: callableEntry.name }, request);
  assert.deepEqual(callableEntry.storage, []);
  assert.equal(callableIndex.initialization.entries.length, 1);
  const callableLookup = programLookup(callableIndex);
  await verifyInitializationCuts(account => verifyInitializationEffects(callableIndex.initialization, callableLookup, {
    account, maximumConditionAlternatives: input.limits.analyses.maximumConditionAlternatives,
    eventCount: 0, refusal: { kind: "refused", diagnostics: [] },
  }), input.limits.dataflow, { kind: "complete", value: null });
}

export async function checkRepeatedStaticInitialization() {
  const front = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { verifyInitializationEffects } = await import("../../../packages/host/dist/ir-program/verify-initialization.js");
  const { proveInitialization } = await import("../../../packages/host/dist/analyses/body/index.js");
  const { createAccount, accountFailure } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { admitSummaryIdentity, summaryKey, staticInitializationOf } = await import("../../../packages/host/dist/ir-facts/index.js");
  const source = 'import { set } from "./provider.js"; export const result: boolean = set(true);';
  const snapshot = front.projectSnapshot({ sourceFiles: { "main.ts": source,
    "provider.ts": "export let state: boolean = false; export function set(value: boolean): boolean { return state = value; }" },
    libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent }] });
  const input = { ...analysisInput(front, "sdk-minimal", source), snapshot };
  const outcome = analyzeHostProgram(input);
  assert.equal(outcome.kind, "ok", JSON.stringify(outcome.diagnostics));
  const { index } = outcome.value;
  const plan = index.initialization;
  assert.equal(plan.modules.length, 2);
  assert.deepEqual(plan.external, []);
  assert.deepEqual(plan.entries, []);
  const lookup = programLookup(index);
  const conditionRefusal = { kind: "refused", diagnostics: [] };
  const maximumConditionAlternatives = input.limits.analyses.maximumConditionAlternatives;
  const keyOf = execution => summaryKey({ kind: "body", execution });
  const priorWrites = new Set();
  const effects = plan.modules.map(execution => {
    const account = createAccount(input.limits.dataflow);
    const result = staticInitializationOf(lookup.summaries.get(keyOf(execution)),
      key => priorWrites.has(key), { account, eventCount: 0, maximumConditionAlternatives, refusal: conditionRefusal });
    assert.equal(result.kind, "complete");
    assert.equal(result.value.kind, "bound");
    assert.deepEqual(result.value.unmet, []);
    for (const key of result.value.writes) priorWrites.add(key);
    return { writes: result.value.writes, entries: InvocationAccount.stateOf(account).entries };
  });
  const [provider, entry] = effects;
  assert.equal(provider.writes.length, 1);
  assert.equal(entry.writes.length, 2);
  assert.equal(entry.writes.includes(provider.writes[0]), true);
  assert.equal(priorWrites.size, 2);
  const orderedEntries = effects.reduce((total, effect) => total + effect.entries, 1 + priorWrites.size);
  const identities = createAccount(input.limits.dataflow);
  for (const execution of plan.modules) assert.equal(admitSummaryIdentity({ kind: "body", execution }, identities), null);
  const identityEntries = InvocationAccount.stateOf(identities).entries;
  const proof = account => proveInitialization({ account, unit: { query: "initializationProof", key: [] },
    maximumConditionAlternatives, conditionRefusal, originOf: () => assert.fail("No diagnostic origin is required."),
    summaryOf: key => ({ unit: { query: "summaryOf", key: [summaryKey(key)] }, value: lookup.summaries.get(summaryKey(key)) }),
  }, { modules: plan.modules, entries: plan.entries, storage: [] });
  const verify = account => verifyInitializationEffects(plan, lookup, {
    account, maximumConditionAlternatives, eventCount: 0, refusal: conditionRefusal,
  });
  assert.deepEqual(verify(createAccount(input.limits.dataflow)), { kind: "complete", value: null });
  const proved = proof(createAccount(input.limits.dataflow));
  assert.equal(proved.kind, "complete");
  assert.deepEqual(proved.value.value, { modules: plan.modules, entries: plan.entries });
  for (const [run, exact] of [[verify, orderedEntries + identityEntries], [proof, orderedEntries + 2 * identityEntries + 8]]) {
    const enough = createAccount(input.limits.dataflow);
    const expected = run(enough);
    assert.equal(expected.kind, "complete");
    assert.equal(InvocationAccount.stateOf(enough).entries, exact);
    const exactAccount = createAccount({ ...input.limits.dataflow, maximumResultEntries: exact });
    assert.deepEqual(run(exactAccount), expected);
    const oneUnder = createAccount({ ...input.limits.dataflow, maximumResultEntries: exact - 1 });
    const stop = run(oneUnder);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "result-entries", maximum: exact - 1 });
    assert.equal(stop === accountFailure(oneUnder), true);
  }
}

export async function checkInterruptedModuleInitialization() {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { programLookup } = await import("../../../packages/host/dist/ir-program/program-values.js");
  const { verifyInitializationEffects } = await import("../../../packages/host/dist/ir-program/verify-initialization.js");
  const { summaryKey } = await import("../../../packages/host/dist/ir-facts/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const provider = fixture.moduleOf(fixture.packageOf("/project"), "src/provider.ts");
  const mainText = "import './provider.js'; export let unset: boolean; export const read: boolean = unset;";
  const run = providerText => analyzeHostProgram({ ...input, snapshot: fixture.projectSnapshot({ sourceFiles: {
    "main.ts": mainText, "provider.ts": providerText,
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }) });
  const result = run("throw false; export const unreachable: boolean = true;");
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const [first, later] = index.initialization.modules;
  assert.equal(index.initialization.modules.length, 2);
  const lookup = programLookup(index);
  const summaryOf = execution => lookup.summaries.get(summaryKey({ kind: "body", execution }));
  const firstBody = modules.find(module => module.module === provider).bodies
    .find(body => body.kind === "selected" && body.instance.body === first.instance.body);
  assert.ok(firstBody);
  const main = index.initialization.entry;
  assert.equal(modules.find(module => module.module === main).bodies
    .some(body => body.kind === "selected" && body.instance.body === later.instance.body), true);
  const [thrown] = firstBody.tir.root.statements.nodes;
  assert.equal(thrown.kind, "ThrowStatement");
  assert.equal(thrown.expression.kind, "FalseKeyword");
  assert.deepEqual(firstBody.mir.blocks.map(block => block.terminator.kind), ["throw"]);
  assert.equal(summaryOf(first).returns, false);
  assert.equal(summaryOf(first).unwinds, true);
  assert.equal(summaryOf(later).initialization.points.some(point => point.kind === "need"), true);
  await verifyInitializationCuts(account => verifyInitializationEffects(index.initialization, lookup, {
    account, maximumConditionAlternatives: input.limits.analyses.maximumConditionAlternatives,
    eventCount: 0, refusal: { kind: "refused", diagnostics: [] },
  }), input.limits.dataflow, { kind: "complete", value: null });
  const prematureRead = { ...index.initialization, modules: [later, first] };
  await verifyInitializationCuts(account => verifyInitializationEffects(prematureRead, lookup, {
    account, maximumConditionAlternatives: input.limits.analyses.maximumConditionAlternatives,
    eventCount: 0, refusal: { kind: "refused", diagnostics: [] },
  }), input.limits.dataflow, { kind: "complete", value: {
    rule: "plan-initialized", site: { kind: "index" }, detail: [{ kind: "number", value: 0 }],
  } });

  const returning = run("export const flag: boolean = true;");
  assert.equal(returning.kind, "refused");
  assert.equal(returning.diagnostics.length, 1);
  const [diagnostic] = returning.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: { module: main, start: mainText.lastIndexOf("unset"), length: 5, derived: [] } });

  const providerText = "export let unseen: boolean; throw unseen;";
  const thrownRead = run(providerText);
  assert.equal(thrownRead.kind, "refused");
  assert.equal(thrownRead.diagnostics.length, 1);
  assert.equal(thrownRead.diagnostics[0].code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(thrownRead.diagnostics[0].site,
    { kind: "source", origin: { module: provider, start: providerText.lastIndexOf("unseen"), length: 6, derived: [] } });
}
