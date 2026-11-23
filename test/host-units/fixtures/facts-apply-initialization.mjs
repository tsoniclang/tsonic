import assert from "node:assert/strict";

export async function applyInitializationCases(suite) {
  const { bindInitialization, staticInitializationOf } = await import("../../../packages/host/dist/ir-facts/index.js");
  const flow = await import("../../../packages/host/dist/dataflow/index.js");
  const ids = await import("../../../packages/host/dist/ids/index.js");
  const module = ids.encodeModuleId({ package: ids.encodePackageId("initialization"), path: "main.ts" });
  const definition = ids.encodeDefId({ module, segments: [{ name: "run", ordinal: 0 }] });
  const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const execution = { instance: { body, bindings: { kind: "parametric" } }, provided: 1 };
  const location = producer => ({ owner: { kind: "body", execution }, producer });
  const symbolicCell = index => ({ kind: "parameter", index });
  const arena = roles => ({ cells: roles.map((role, id) => ({ id, role,
    occurrence: { kind: "entry", execution, local: id }, lifetimes: [] })),
    projections: [], producers: [], contexts: [], boundProducers: [], origins: [], boundaries: [] });
  const event = { kind: "callback", subject: location(0), exit: "return" };
  const no = () => ({ alternatives: [] });
  const yes = () => ({ alternatives: [[]] });
  const variable = index => ({ alternatives: [[index]] });
  const simple = () => ({ owner: { kind: "body", execution }, arena: arena([symbolicCell(0), symbolicCell(1), symbolicCell(2)]),
    table: { cells: [], events: [], conditions: [no(), yes()], points: [{ kind: "return" }],
    rows: [{ point: 0, cell: null, condition: 0 }] }, binding: { cells: [], events: [] } });
  const input = application => ({ application, caller: arena([symbolicCell(0), symbolicCell(1), symbolicCell(2)]), events: [event, event] });
  const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "condition bound" },
    severity: "error", site: { kind: "none" }, source: null, evidence: [], message: "condition bound", arguments: [], related: [], fix: null }] };
  const limits = (maximumWork = 1000000, maximumResultEntries = 1000000, maximumConditionAlternatives = 1000) => ({
    eventCount: 2, maximumConditionAlternatives, refusal,
    account: flow.createAccount({ maximumWork, maximumResultEntries }) });
  const complete = result => { assert.equal(result.kind, "complete"); return result.value; };
  const writes = index => {
    const value = simple(); value.table.cells = [0];
    value.table.rows.push({ point: 0, cell: 0, condition: 1 });
    value.binding.cells.push({ kind: "cell", index });
    return value;
  };
  const wrapper = applied => {
    const value = simple(); value.table.events = [event]; value.table.conditions.push(variable(0));
    value.table.rows[0].condition = 2;
    value.binding.events = [{ kind: "tables", applied: applied.map(application => ({ application, point: 0 })) }];
    return value;
  };

  await suite.test("static initialization binds the qualified cell and preserves its need before normal writes", async () => {
    const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
    const declaration = { definition, bindings: { kind: "instantiated", bindings: {
      classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
    } } };
    const at = { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null };
    const witness = { read: { kind: "body", value: { body, node: 0 } }, via: [] };
    const need = { kind: "need", cell: 0, at, witness };
    const normal = { kind: "return" };
    const base = { key: { kind: "body", execution }, callbacks: [], returns: true, arena: {
      ...arena([]), cells: [{ id: 0, role: { kind: "static", declaration },
        occurrence: { kind: "declared", at: { kind: "node", node: { kind: "item", value: { owner: definition, node: 1 } } } },
        lifetimes: [] }],
    }, initialization: { cells: [0], events: [], conditions: [no(), yes()], points: [need, need, normal],
      rows: [0, 1, 2].flatMap(point => [{ point, cell: null, condition: 0 }, { point, cell: 0, condition: point === 2 ? 1 : 0 }]) } };
    const resources = () => ({ ...limits(), eventCount: 0 });
    const invoke = (value = base, checked = null, actual = resources()) =>
      staticInitializationOf(value, key => checked?.has(key) === true, actual);
    const first = complete(invoke());
    assert.deepEqual(first.unmet, [{ declaration, at, witness }]);
    assert.equal(first.writes.length, 1);
    assert.deepEqual(complete(invoke(base, new Set(first.writes))).unmet, []);
    const otherBinding = structuredClone(base);
    otherBinding.arena.cells[0].role.declaration.bindings.bindings.selfBindings.push({ kind: "bound", owner: definition, type: 0 });
    const second = complete(invoke(otherBinding, new Set(first.writes)));
    assert.equal(second.unmet.length, 1);
    assert.notEqual(second.writes[0], first.writes[0]);
    const local = structuredClone(base);
    local.initialization.rows[1].condition = 1;
    local.initialization.rows[3].condition = 1;
    assert.deepEqual(complete(invoke(local)).unmet, []);
    const unwound = structuredClone(local);
    unwound.initialization.points[2] = { kind: "unwind" };
    unwound.returns = false;
    assert.deepEqual(complete(invoke(unwound)), { kind: "bound", writes: [], unmet: [] });
    const empty = { ...base, initialization: { ...base.initialization, cells: [],
      points: [{ kind: "return" }, { kind: "unwind" }],
      rows: [{ point: 0, cell: null, condition: 0 }, { point: 1, cell: null, condition: 0 }] } };
    assert.deepEqual(complete(invoke(empty)), { kind: "bound", writes: [], unmet: [] });
    assert.deepEqual(invoke(empty, null, { ...limits(2), eventCount: 0 }), { kind: "resource-limit", dimension: "work", maximum: 2 });
    assert.deepEqual(complete(invoke({ ...empty, initialization: { ...empty.initialization,
      points: [need, ...empty.initialization.points] } })), { kind: "unbound" });
    assert.deepEqual(complete(invoke(base, null, limits())), { kind: "unbound" });
    for (const change of [
      summary => { summary.callbacks = [{}]; },
      summary => { summary.initialization.events = [event]; },
      summary => { summary.initialization.cells = new Array(1); },
      summary => { summary.initialization.cells = [0, 0]; },
      summary => { summary.initialization.cells = [1]; },
      summary => { summary.arena.cells[0].role = symbolicCell(0); },
      summary => { summary.initialization.points[2] = { kind: "before", at, subject: location(0) }; },
      summary => { summary.initialization.points[2] = { kind: "completed", handle: location(0), exit: "return" }; },
      summary => { summary.initialization.rows[4].condition = 1; },
      summary => { summary.returns = false; },
    ]) {
      const changed = structuredClone(base);
      change(changed);
      assert.deepEqual(complete(invoke(changed)), { kind: "unbound" });
    }
    const exact = resources();
    assert.deepEqual(complete(invoke(base, null, exact)), first);
    const abandoned = resources();
    const stoppedReader = staticInitializationOf(base, () => {
      flow.refuseAccount(abandoned.account, refusal);
      return true;
    }, abandoned);
    assert.equal(stoppedReader, refusal);
    const { work, entries } = InvocationAccount.stateOf(exact.account);
    for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) {
      for (let maximum = 0; maximum < needed; maximum += 1) {
        const actual = { ...limits(dimension === "work" ? maximum : work, dimension === "result-entries" ? maximum : entries), eventCount: 0 };
        const stopped = invoke(base, null, actual);
        assert.equal(stopped.kind, "resource-limit");
        assert.equal(stopped.dimension, dimension);
        assert.equal(flow.accountFailure(actual.account), stopped);
        assert.equal(invoke(null, null, actual), stopped);
      }
    }
  });

  await suite.test("a nested initialization binding rejects an actual non-completion point without inventing exit credit", () => {
    const child = simple();
    child.table.points = [{ kind: "before", at: { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null }, subject: location(0) }];
    assert.throws(() => bindInitialization(input(wrapper([child])), limits()),
      error => error instanceof TypeError && error.message === "A nested initialization table selects an actual completion point");
  });

  await suite.test("a selected source completion condition must be a canonical positive antichain", () => {
    const value = simple();
    value.table.conditions[0] = { alternatives: [[0], [0]] };
    assert.throws(() => bindInitialization(input(value), limits()),
      error => error instanceof TypeError && error.message === "Initialization requires canonical source completion conditions");
  });

  await suite.test("the canonical initialization codec retains every distinct read point and its source-cell selector", async () => {
    const { printInitializationTable } = await import("../../../packages/host/dist/ir-facts/print.js");
    const { parseInitializationTable } = await import("../../../packages/host/dist/ir-facts/parse.js");
    const key = { kind: "declared", execution: { request: { definition, endpoint: "api-body", ordinal: 2,
      bindings: { kind: "parametric" } }, provided: 1 } };
    const source = { kind: "body", value: { body, node: 0 } };
    const declared = { kind: "declared", execution: key.execution, source };
    const bodyPoints = [null, "continue", "resume", "return", "unwind"].map((edge, statement) => ({
      kind: "body", execution, point: { block: 0, statement }, edge,
    }));
    const points = [declared, ...bodyPoints].flatMap((at, cell) => [
      { kind: "need", at, cell, witness: { read: source, via: [{ key, row: cell }] } },
      { kind: "before", at, subject: location(0) },
    ]);
    points.push({ kind: "return" }, { kind: "unwind" },
      { kind: "completed", handle: { owner: { kind: "summary", key }, producer: 1 }, exit: "return" },
      { kind: "completed", handle: location(0), exit: "unwind" });
    const table = { cells: [2, 0, 1, 3, 4, 5],
      events: [{ kind: "callback", subject: location(0), exit: "return" },
        { kind: "handle", subject: { owner: { kind: "summary", key }, producer: 1 }, exit: "unwind" }],
      conditions: [no(), yes(), { alternatives: [[0], [1]] }], points,
      rows: points.flatMap((_point, point) => [{ point, cell: null, condition: 0 }, { point, cell: 0, condition: 2 }]) };
    const text = printInitializationTable(table);
    const parsed = parseInitializationTable(text);
    assert.equal(parsed.kind, "parsed");
    assert.deepEqual(parsed.value, table);
    assert.equal(printInitializationTable(parsed.value), text);
    for (const changed of [text.replace("cell=0, witness", "witness"), text.replace("edge=null", "edge=\"other\""),
      text.replace("conditions=[", "conditions=missing["), text.replace("BoundProducerRef(", "ProducerRef("),
      text.trimEnd().slice(0, -1), text + "unexpected"])
      assert.equal(parseInitializationTable(changed).kind, "invalid-text");
  });

  await suite.test("private initialization result slots use the signed completion default only through actual supplied cell bindings", () => {
    const selected = simple();
    const at = { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null };
    const resultCell = () => ({ kind: "created", anchor: { kind: "result" }, slot: { kind: "entity" } });
    selected.arena = arena([resultCell(), resultCell()]);
    selected.table.cells = [0, 1];
    selected.binding.cells = [{ kind: "cell", index: 1 }, { kind: "cell", index: 2 }];
    selected.table.points = [{ kind: "before", at, subject: location(0) }, { kind: "return" }, { kind: "unwind" },
      { kind: "completed", handle: location(1), exit: "return" }, { kind: "completed", handle: location(1), exit: "unwind" }];
    selected.table.rows = selected.table.points.map((_point, point) => ({ point, cell: null, condition: 0 }));
    const rows = complete(bindInitialization(input(selected), limits()));
    assert.deepEqual(rows, selected.table.points.flatMap((point, index) => [
      { point, cell: null, condition: no() },
      ...(index === 0 ? [] : [{ point, cell: { kind: "cell", index: 1 }, condition: yes() },
        { point, cell: { kind: "cell", index: 2 }, condition: yes() }]),
    ]), "equal symbolic result roles never identify two actual caller cells");
    selected.binding.cells[1] = { kind: "cell", index: 1 };
    assert.equal(complete(bindInitialization(input(selected), limits())).filter(row => row.cell !== null).length, 4,
      "only actual supplied alias bindings merge caller cell indices");
    selected.table.rows.push({ point: 1, cell: 0, condition: 0 }, { point: 1, cell: 1, condition: 0 });
    assert.deepEqual(complete(bindInitialization(input(selected), limits())).filter(row => row.point.kind === "return"),
      [{ point: { kind: "return" }, cell: null, condition: no() }], "an explicit unproved result slot is never replaced by true");
    selected.table.events = [event]; selected.binding.events = [{ kind: "event", index: 0 }];
    selected.table.conditions.push(variable(0));
    selected.table.rows.at(-2).condition = 2;
    assert.deepEqual(complete(bindInitialization(input(selected), limits())).filter(row => row.point.kind === "return"), [
      { point: { kind: "return" }, cell: null, condition: no() },
      { point: { kind: "return" }, cell: { kind: "cell", index: 1 }, condition: variable(0) },
    ]);
    selected.table.rows = selected.table.rows.filter(row => row.cell === null);
    for (const kind of ["parameter", "local", "receiver", "capture", "static"]) {
      const anchor = kind === "parameter" || kind === "capture" ? { kind, index: 0 }
        : kind === "local" ? { kind, local: 0 }
          : kind === "static" ? { kind, declaration: { definition, bindings: { kind: "parametric" } } } : { kind };
      selected.table.cells = [0]; selected.arena = arena([resultCell()]); selected.arena.cells[0].role.anchor = anchor;
      selected.binding.cells = [{ kind: "cell", index: 1 }];
      assert.deepEqual(complete(bindInitialization(input(selected), limits())), selected.table.points.map(point =>
        ({ point, cell: null, condition: no() })), "another actual anchor is not the returned entity");
    }
    selected.arena.cells[0].role = resultCell();
    selected.table.points = [{ kind: "need", cell: 0, at, witness: { read: { kind: "body", value: { body, node: 0 } }, via: [] } }];
    selected.table.rows = [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 0 }];
    assert.deepEqual(complete(bindInitialization(input(selected), limits())), [
      { point: selected.table.points[0], cell: { kind: "cell", index: 1 }, condition: no() },
    ], "result ownership never erases a genuine earlier requirement");
  });

  await suite.test("private initialization application substitutes actual caller cells/events and expands distinguished default rows", () => {
    assert.deepEqual(complete(bindInitialization(input(simple()), limits())), [{ point: { kind: "return" }, cell: null, condition: no() }]);
    const selected = input(wrapper([writes(2)]));
    const before = structuredClone(selected);
    assert.deepEqual(complete(bindInitialization(selected, limits())), [
      { point: { kind: "return" }, cell: null, condition: no() },
      { point: { kind: "return" }, cell: { kind: "cell", index: 2 }, condition: yes() },
    ]);
    assert.deepEqual(selected, before, "one application never mutates caller or callee semantic data");
    assert.deepEqual(complete(bindInitialization(input(wrapper([writes(0), writes(1)])), limits())),
      [{ point: { kind: "return" }, cell: null, condition: no() }], "must writes conjoin every supplied actual alternative");
    assert.deepEqual(complete(bindInitialization(input(wrapper([writes(1), writes(1)])), limits())), [
      { point: { kind: "return" }, cell: null, condition: no() },
      { point: { kind: "return" }, cell: { kind: "cell", index: 1 }, condition: yes() },
    ]);
    const shared = writes(1);
    assert.deepEqual(complete(bindInitialization(input(wrapper([shared, shared])), limits())),
      complete(bindInitialization(input(wrapper([writes(1), writes(1)])), limits())),
      "a shared immutable dependency and two equivalent dependency values have the same semantic result");
    const importing = simple(); importing.table.events = [event]; importing.table.conditions.push(variable(0));
    importing.table.rows[0].condition = 2; importing.binding.events = [{ kind: "event", index: 1 }];
    assert.deepEqual(complete(bindInitialization(input(wrapper([importing])), limits())),
      [{ point: { kind: "return" }, cell: null, condition: variable(1) }]);
    importing.binding.events = [{ kind: "never" }];
    assert.deepEqual(complete(bindInitialization(input(importing), limits())),
      [{ point: { kind: "return" }, cell: null, condition: no() }]);
    for (const point of [{ kind: "unwind" }, { kind: "completed", handle: location(0), exit: "unwind" }]) {
      const child = simple(); child.table.points = [point];
      complete(bindInitialization(input(wrapper([child])), limits()));
    }
    const aliases = writes(0); aliases.table.cells.push(1); aliases.binding.cells.push({ kind: "cell", index: 0 });
    aliases.table.rows.push({ point: 0, cell: 1, condition: 0 });
    assert.deepEqual(complete(bindInitialization(input(aliases), limits()))[1].condition, yes(),
      "actual supplied same-cell binding, not source/context equality, carries alias credit");
    aliases.table.rows[0].condition = 1; aliases.table.rows.splice(1, 1);
    assert.deepEqual(complete(bindInitialization(input(aliases), limits())),
      [{ point: { kind: "return" }, cell: null, condition: yes() }],
      "an unlisted formal uses the actual default, including under a supplied alias binding");
    const point = { kind: "need", cell: 0, at: { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null },
      witness: { read: { kind: "body", value: { body, node: 0 } }, via: [] } };
    for (const cell of [{ kind: "written" }, { kind: "fresh", index: 1 }, { kind: "cell", index: 2 }]) {
      const need = simple(); need.table.cells = [0]; need.table.points = [point];
      need.table.rows = [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 0 }]; need.binding.cells = [cell];
      const rows = complete(bindInitialization(input(need), limits()));
      assert.deepEqual(rows, [{ point, cell, condition: cell.kind === "written" ? yes() : no() }]);
      assert.equal(rows[0].point, point, "the original qualified read/dependency witness is retained once");
    }
  });

  await suite.test("read-point state composes actual aliases before the required source-cell check without merging different reads", () => {
    const value = simple();
    value.table.cells = [0, 1];
    value.binding.cells = [{ kind: "cell", index: 1 }, { kind: "cell", index: 1 }];
    const at = statement => ({ kind: "body", execution, point: { block: 0, statement }, edge: null });
    const witness = node => ({ read: { kind: "body", value: { body, node } }, via: [] });
    const early = { kind: "need", cell: 1, at: at(0), witness: witness(0) };
    const late = { kind: "need", cell: 1, at: at(2), witness: witness(2) };
    value.table.points = [early, late, { kind: "return" }];
    value.table.rows = [{ point: 0, cell: null, condition: 0 }, { point: 1, cell: null, condition: 0 },
      { point: 1, cell: 0, condition: 1 }, { point: 2, cell: null, condition: 0 }];
    const rows = complete(bindInitialization(input(value), limits()));
    assert.deepEqual(rows, [{ point: early, cell: value.binding.cells[1], condition: no() },
      { point: late, cell: value.binding.cells[1], condition: yes() },
      { point: { kind: "return" }, cell: null, condition: no() }]);
    assert.equal(rows[0].point.witness, early.witness);
    assert.equal(rows[1].point.witness, late.witness);
    value.binding.cells[1] = { kind: "cell", index: 2 };
    assert.deepEqual(complete(bindInitialization(input(value), limits())).slice(0, 2).map(row => row.condition), [no(), no()]);
    value.binding.cells[1] = { kind: "unproven", indices: [1, 2] };
    const uncertain = complete(bindInitialization(input(value), limits()));
    assert.deepEqual(uncertain.slice(0, 2).map(row => row.condition), [no(), no()]);
    assert.equal(uncertain[1].cell, value.binding.cells[1], "the actual whole may domain is retained, not replaced with written or one target");
    value.table.rows.push({ point: 1, cell: 1, condition: 1 });
    assert.deepEqual(complete(bindInitialization(input(value), limits()))[1].condition, yes(),
      "a genuine write to the required source cell before its read does not require an unrelated caller alias proof");
    for (const change of [
      changed => { delete changed.table.points[0].cell; },
      changed => { changed.table.points[0].cell = -0; },
      changed => { changed.table.points[0].cell = 2; },
      changed => { changed.table.rows = changed.table.rows.filter(row => !(row.point === 0 && row.cell === null)); },
    ]) {
      const changed = structuredClone(value); change(changed);
      assert.throws(() => bindInitialization(input(changed), limits()), TypeError);
    }
  });

  await suite.test("an unproven nonempty may-domain preserves reads and history targets without granting a strong write", () => {
    const value = writes(0);
    const may = { kind: "unproven", indices: [0, 2] };
    value.binding.cells = [may];
    assert.deepEqual(complete(bindInitialization(input(value), limits())),
      [{ point: { kind: "return" }, cell: null, condition: no() }]);
    for (const indices of [[], [0, 0], [-0], [-1], [0.5], [3], [NaN], new Array(1)]) {
      const changed = writes(0); changed.binding.cells = [{ kind: "unproven", indices }];
      assert.throws(() => bindInitialization(input(changed), limits()), TypeError);
    }
    for (const dimension of ["work", "result-entries"]) {
      let completed = false;
      for (let maximum = 0; maximum <= 150; maximum += 1) {
        const account = dimension === "work" ? limits(maximum) : limits(1000000, maximum);
        const result = bindInitialization(input(value), account);
        if (result.kind === "complete") completed = true;
        else {
          assert.equal(completed, false);
          assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
          assert.equal(bindInitialization(null, account), result);
        }
      }
      assert.equal(completed, true);
    }
    const stopped = limits(0);
    flow.refuseAccount(stopped.account, refusal);
    assert.equal(bindInitialization(null, stopped), refusal);
  });

  await suite.test("private initialization preserves supplied activation and lifetime cell distinctions without structural identity", () => {
    const selected = {
      key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: definition }], selectedDeclarations: [definition], primary: definition,
      bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    };
    const symbols = [
      { kind: "local", local: 0 },
      { kind: "parameter", index: 0 },
      { kind: "capture", index: 0 },
      { kind: "static", declaration: { definition, bindings: { kind: "parametric" } } },
      { kind: "created", anchor: { kind: "local", local: 0 }, slot: { kind: "local", local: { body, local: 1 } } },
      { kind: "created", anchor: { kind: "parameter", index: 0 }, slot: { kind: "capture", path: 0, index: 1 } },
      { kind: "created", anchor: { kind: "result" }, slot: { kind: "field", member: selected } },
      { kind: "created", anchor: { kind: "receiver" }, slot: { kind: "entity" } },
      { kind: "detached" },
    ];
    for (const symbol of symbols) {
      for (const other of [symbol, structuredClone(symbol)]) {
        const value = input(writes(0)); value.caller = arena([symbol, other]);
        assert.deepEqual(complete(bindInitialization(value, limits())), [
          { point: { kind: "return" }, cell: null, condition: no() },
          { point: { kind: "return" }, cell: { kind: "cell", index: 0 }, condition: yes() },
        ], "equal symbolic owners, slots and even reference objects do not merge supplied distinct cells");
      }
    }
    const siblings = writes(0);
    siblings.table.cells = [0, 1];
    siblings.arena = arena([
      { kind: "created", anchor: { kind: "parameter", index: 0 }, slot: { kind: "capture", path: 0, index: 0 } },
      { kind: "created", anchor: { kind: "parameter", index: 0 }, slot: { kind: "capture", path: 1, index: 0 } },
    ]);
    siblings.binding.cells = [{ kind: "cell", index: 1 }, { kind: "cell", index: 1 }];
    assert.deepEqual(complete(bindInitialization(input(siblings), limits()))[1],
      { point: { kind: "return" }, cell: { kind: "cell", index: 1 }, condition: yes() },
      "only supplied Origins same-cell binding unifies sibling set/get roles, not member paths or a creation key");
    siblings.binding.cells[1] = { kind: "fresh", index: 2 };
    assert.deepEqual(complete(bindInitialization(input(siblings), limits()))[1],
      { point: { kind: "return" }, cell: { kind: "cell", index: 1 }, condition: yes() },
      "a distinct supplied fresh lifetime receives no credit from the earlier slot");
  });

  await suite.test("private initialization applications validate real inventories and reject cyclic/missing ready bindings", () => {
    const mutations = [
      value => { value.binding.cells.push({ kind: "written" }); },
      value => { value.binding.events.push({ kind: "never" }); },
      value => { value.table.conditions = [yes(), no()]; },
      value => { value.table.rows[0].point = 9; },
      value => { value.table.rows[0].condition = 9; },
      value => { value.table.rows[0].cell = 9; },
      value => { value.table.rows.push({ ...value.table.rows[0] }); },
      value => { value.table.points.push({ kind: "return" }); },
      value => { value.table.rows = []; },
    ];
    for (const mutate of mutations) { const value = simple(); mutate(value); assert.throws(() => bindInitialization(input(value), limits()), TypeError); }
    for (const index of [-1, -0, 0.5, NaN, 9]) {
      const value = writes(index);
      assert.throws(() => bindInitialization(input(value), limits()), TypeError);
      const events = wrapper([simple()]); events.binding.events = [{ kind: "event", index }];
      assert.throws(() => bindInitialization(input(events), limits()), TypeError);
    }
    const missing = wrapper([simple()]); missing.binding.events[0].applied[0].point = 8;
    assert.throws(() => bindInitialization(input(missing), limits()), TypeError);
    const wrongPoint = wrapper([simple()]); wrongPoint.binding.events[0].applied[0].application.table.points = [
      { kind: "before", at: { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null }, subject: location(0) },
    ];
    assert.throws(() => bindInitialization(input(wrongPoint), limits()), TypeError);
    wrongPoint.binding.events[0].applied[0].application.table.points[0] = { kind: "need" };
    assert.throws(() => bindInitialization(input(wrongPoint), limits()), TypeError);
    const duplicateCell = writes(0); duplicateCell.table.rows.push({ point: 0, cell: 0, condition: 0 });
    assert.throws(() => bindInitialization(input(duplicateCell), limits()), TypeError);
    const noDefault = writes(0); noDefault.table.rows.shift();
    assert.throws(() => bindInitialization(input(noDefault), limits()), TypeError);
    const noAlternatives = wrapper([]);
    assert.throws(() => bindInitialization(input(noAlternatives), limits()), TypeError, "no empty alternative list earns completion credit");
    const cycle = wrapper([simple()]); cycle.binding.events[0].applied[0].application = cycle;
    assert.throws(() => bindInitialization(input(cycle), limits()), error => error instanceof TypeError && error.message === "Nested initialization applications are acyclic");
    assert.throws(() => bindInitialization(input(simple()), { ...limits(), eventCount: 1 }), TypeError);
  });

  await suite.test("initialization formal positions select sparse permuted rows in the one actual source arena", () => {
    const value = simple();
    value.arena = arena([symbolicCell(0), { kind: "created", anchor: { kind: "result" }, slot: { kind: "entity" } },
      { kind: "detached" }, symbolicCell(3)]);
    value.table.cells = [3, 1];
    value.binding.cells = [{ kind: "cell", index: 0 }, { kind: "cell", index: 2 }];
    value.table.rows.push({ point: 0, cell: 0, condition: 1 });
    assert.deepEqual(complete(bindInitialization(input(value), limits())), [
      { point: { kind: "return" }, cell: null, condition: no() },
      { point: { kind: "return" }, cell: { kind: "cell", index: 0 }, condition: yes() },
      { point: { kind: "return" }, cell: { kind: "cell", index: 2 }, condition: yes() },
    ], "row zero writes source row three, while the unlisted formal one selects the actual source result role at row one");
    for (const source of [-1, -0, 0.5, NaN, 4, undefined]) {
      const changed = structuredClone(value); changed.table.cells[1] = source;
      assert.throws(() => bindInitialization(input(changed), limits()), TypeError);
    }
    for (const amend of [
      changed => { changed.table.cells[1] = 3; },
      changed => { delete changed.table.cells[1]; },
      changed => { delete changed.arena.cells[3]; },
      changed => { changed.arena.cells[3].id = 1; },
    ]) {
      const changed = structuredClone(value); amend(changed);
      assert.throws(() => bindInitialization(input(changed), limits()), TypeError);
    }
    for (const amend of [
      changed => { delete changed.caller.cells[2]; },
      changed => { changed.caller.cells[2].id = 0; },
    ]) {
      const changed = input(value); amend(changed);
      assert.throws(() => bindInitialization(changed, limits()), TypeError);
    }
    value.binding.cells[0] = { kind: "written" };
    assert.equal(complete(bindInitialization(input(value), limits())).some(row => row.cell?.index === 0), false);
  });

  await suite.test("private initialization uses an explicit charged finite stack and the same original first refusal", () => {
    const minimal = input(simple());
    assert.deepEqual(complete(bindInitialization(minimal, limits(19, 10, 0))),
      [{ point: { kind: "return" }, cell: null, condition: no() }],
      "nineteen traversal/validation/rewrite/output steps and ten admitted frame/index/result records");
    assert.deepEqual(bindInitialization(minimal, limits(18, 10, 0)), { kind: "resource-limit", dimension: "work", maximum: 18 });
    assert.deepEqual(bindInitialization(minimal, limits(19, 9, 0)), { kind: "resource-limit", dimension: "result-entries", maximum: 9 });
    let reads = 0;
    const observed = input(simple());
    const table = observed.application.table;
    Object.defineProperty(observed.application, "table", { get() { reads += 1; return table; } });
    assert.deepEqual(bindInitialization(observed, limits(2)), { kind: "resource-limit", dimension: "work", maximum: 2 });
    assert.equal(reads, 0, "a refused preparation admission reads no later table record");
    let nested = writes(1);
    for (let index = 0; index < 10000; index += 1) nested = wrapper([nested]);
    const rows = complete(bindInitialization(input(nested), limits(10000000, 10000000)));
    assert.deepEqual(rows[1], { point: { kind: "return" }, cell: { kind: "cell", index: 1 }, condition: yes() });
    for (const count of [128, 256]) {
      const child = writes(1); const table = child.table; let reads = 0;
      Object.defineProperty(child, "table", { get() { reads += 1; return table; } });
      complete(bindInitialization(input(wrapper(Array.from({ length: count }, () => child))), limits()));
      assert.equal(reads, count * 2 + 5,
        "two genuine point/domain reads per edge, one preparation and two selected conditions under each of default/distinguished cell");
    }
    const need = simple(); need.table.cells = [0]; need.binding.cells = [{ kind: "cell", index: 1 }];
    need.table.points = [{ kind: "need", cell: 0, at: { kind: "body", execution, point: { block: 0, statement: 0 }, edge: null },
      witness: { read: { kind: "body", value: { body, node: 0 } }, via: [] } }];
    need.table.rows = [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 0 }];
    const returned = simple();
    returned.table.cells = [0];
    returned.arena = arena([{ kind: "created", anchor: { kind: "result" }, slot: { kind: "entity" } }]);
    returned.binding.cells = [{ kind: "cell", index: 1 }];
    for (const dimension of ["work", "result-entries"]) {
      for (const application of [wrapper([writes(1)]), need, returned]) {
      let completed = false;
      for (let maximum = 0; maximum <= 400; maximum += 1) {
        const environment = dimension === "work" ? limits(maximum) : limits(100000, maximum);
        const result = bindInitialization(input(application), environment);
        if (result.kind === "complete") completed = true;
        else {
          assert.equal(completed, false);
          assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
          assert.equal(flow.accountFailure(environment.account), result);
          assert.equal(bindInitialization(null, environment), result, "no ready-data read after the original stop");
        }
      }
      assert.equal(completed, true);
      }
    }
    const alternatives = limits(100000, 100000, 0);
    assert.equal(bindInitialization(input(wrapper([writes(1)])), alternatives), refusal);
    assert.equal(bindInitialization(null, alternatives), refusal);
    const original = limits(); flow.refuseAccount(original.account, refusal);
    assert.equal(bindInitialization(null, original), refusal);
  });
}
