import assert from "node:assert/strict";

function fieldPath(summary, id) {
  const keys = [];
  while (id !== null) {
    const selected = summary.arena.projections[id];
    assert.equal(selected.projection.kind, "field");
    keys.unshift(selected.projection.member.decision.key.value);
    id = selected.parent;
  }
  return keys;
}

export async function checkSavedReferencePresence() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const fixture = await loadFrontFixture();
  const cases = [
    ["forwarded", "const saved = input.part; if (saved !== null) return choose(saved); return false;"],
    ["projected", "const saved = input.part; if (saved !== null) return saved.flag; return false;"],
    ["retained across receiver rebind", "const saved = (input.part); input = other; if (saved !== null) return choose(saved); return false;"],
    ["copied into a placed initializer", "const saved = input.part; const result = saved !== null && choose(saved); return result;"],
  ];
  for (const [label, statements] of cases) {
    const input = analysisInput(fixture, "sdk-minimal", `
      type Actual = { flag: boolean; other: boolean };
      type Formal = { other: boolean; flag: boolean };
      type Holder = { part: Actual | null; sibling: Actual | null };
      function choose(value: Formal): boolean { return value.flag; }
      export function read(input: Holder, other: Holder): boolean { ${statements} }
    `, ["read"]);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", label);
    assert.deepEqual(result.diagnostics, [], label);
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const code = chapter.bodies.filter(row => row.kind === "selected");
    const read = code.find(row => row.instance.body.includes(";read];function;0]"));
    const candidateChecks = code.flatMap(body => body.mir.blocks.filter(block => block.terminator.kind === "check")
      .map(block => ({ body, check: block.terminator })));
    assert.equal(candidateChecks.length, 1, label);
    const [{ body, check }] = candidateChecks;
    assert.equal(body === read, label !== "copied into a placed initializer", label);
    const place = body.mir.places[check.place];
    assert.equal(place.base.kind, "checked", label);
    assert.equal(place.base.projection.kind, "refined", label);
    const saved = body.mir.places[place.base.place].base;
    assert.equal(saved.kind, "local", label);
    const storage = body.mir.locals[saved.local];
    assert.equal(storage.role.kind, label === "copied into a placed initializer" ? "capture" : "user", label);
    const [proof] = body.facts[0].refinements.refinements;
    assert.equal(proof.kind, "proven", label);
    assert.equal(proof.node, check.tir.node, label);
    assert.equal(proof.guards.length, 1, label);

    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === read.instance.body);
    const path = id => fieldPath(summary, id);
    assert.deepEqual(summary.parameters[0].reads.paths.map(path), [["part"], ["part", "flag"]], label);
    assert.deepEqual(summary.parameters[1].reads.paths, [], label);
  }
}

export async function checkDeclaredNullableReferenceStorage() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const source = await loadFrontFixture();
  const fields = "input: { part: Box | null; other: Box | null }, flag: boolean";
  const formal = "input: Box | null, flag: boolean";
  const initial = "let saved: Box | null = input.part;";
  const guard = "if (saved !== null) return saved.flag; return flag;";
  const cases = [
    ["mutable rebind", fields, `${initial} saved = input.other; ${guard}`, ["other", "other.flag", "part"], "user"],
    ["conditional rebind", fields, `${initial} if (flag) saved = input.other; ${guard}`, ["other", "other.flag", "part", "part.flag"], "user"],
    ["conditional absence", fields, `${initial} if (flag) saved = null; ${guard}`, ["part", "part.flag"], "user", true],
    ["conditional unified absence", fields, "let saved: Box | null | undefined = input.part; if (flag) saved = undefined; if (saved != null) return saved.flag; return flag;",
      ["part", "part.flag"], "user", true],
    ["actual formal", formal, "if (input !== null) return input.flag; return flag;", ["flag"], "parameter"],
    ["absence without a projection", formal, "let saved: Box | null = input; if (flag) saved = null; return flag;", [], null, true],
  ];
  for (const [label, params, statements, paths, role, writesAbsence = false] of cases) {
    const input = analysisInput(source, "sdk-minimal",
      `type Box = { flag: boolean }; export function read(${params}): boolean { ${statements} }`, ["read"]);
    const program = analyzeHostProgram(input);
    assert.equal(program.kind, "ok", label);
    assert.deepEqual(program.diagnostics, [], label);
    const chapter = program.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const summary = program.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
    assert.deepEqual(summary.parameters[0].reads.paths.map(id => fieldPath(summary, id).join(".")).sort(), paths, label);
    const checks = body.mir.blocks.filter(block => block.terminator.kind === "check");
    const proofs = body.facts[0].refinements.refinements;
    assert.equal(checks.length, role === null ? 0 : 1, label);
    assert.equal(proofs.length, checks.length, label);
    if (role !== null) {
      const check = checks[0].terminator;
      const view = body.mir.places[check.place].base;
      assert.equal(view.kind, "checked", label);
      assert.equal(view.projection.kind, "refined", label);
      const local = body.mir.places[view.place].base;
      assert.equal(local.kind, "local", label);
      assert.equal(body.mir.locals[local.local].role.kind, role, label);
      assert.equal(proofs[0].kind, "proven", label);
      assert.equal(proofs[0].node, check.tir.node, label);
      assert.equal(proofs[0].guards[0], body.tir.root.statements.nodes.at(-2).expression.id, label);
    }
    const stores = body.mir.blocks.flatMap(block => block.statements).filter(statement =>
      statement.kind === "assign" && statement.value.kind === "convert"
      && statement.value.operation.decision.operation.kind === "conversion"
      && statement.value.operation.decision.operation.embedding.conversion === "absence");
    assert.equal(stores.length, writesAbsence ? 1 : 0, label);
    if (writesAbsence) {
      const operand = stores[0].value.operand;
      assert.equal(operand.kind, "constant", label);
      assert.equal(body.mir.constants[operand.constant].value.value.kind, "absence", label);
    }
  }
}

export async function checkSavedReferenceQualification() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { checkedSourceObjectFieldsOf, indexSyntaxTree } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { verifyTir } = await import("../../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../../packages/host/dist/ir-program/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { checkReachedProofCuts } = await import("./dataflow-cuts.mjs");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Box = { flag: boolean };
    export function read(input: { part: Box | null; sibling: Box | null }): boolean {
      const saved = input.part;
      const peer = input.sibling;
      if (saved !== null) return saved.flag;
      return false;
    }
  `, ["read"]);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const verified = typed.value.verifierOf(input.snapshot.entryPoint);
  const body = verified.module.bodies.find(row => row.bindings.kind === "instantiated" && row.body.includes(";read];function;0]"));
  const refined = body.root.statements.nodes[2].thenStatement.expression.expression;
  assert.equal(refined.kind, "Identifier");
  assert.equal(refined.tsonic.narrowing.kind, "narrowed");
  const source = captured.value.checked;
  const checked = source.bodies.get(body.body);
  const authored = Array.from(indexSyntaxTree(checked.root)).find(node => node.id === refined.id);
  const read = (account, operand = authored) => {
    const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (setup !== null) return setup;
    const fields = checkedSourceObjectFieldsOf(checked, {
      bodyOf: identity => source.bodies.get(identity) ?? null,
      nodeOf: source.nodeOf,
      itemOf: definition => {
        const reference = source.declarationSourceOf(definition);
        return reference === null ? null : source.nodeOf(reference);
      },
      bindingOf: captured.value.bindingOf,
      typeOf: type => readType(captured.value.types, type),
      admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
    });
    const value = fields.presence(operand, "read");
    return accountFailure(account) ?? { kind: "complete", value };
  };
  const savedType = checked.locals.find(local => local.name === "saved").checkerSlot.value;
  const present = authored.tsonic.value.views.read.value;
  checkReachedProofCuts(InvocationAccount.stateOf, read, { storage: savedType, present }, "actual saved nullable local");
  const field = checked.root.statements.nodes[0].declarationList.declarations.nodes[0].initializer;
  assert.equal(field.kind, "PropertyAccessExpression");
  for (const operand of [authored, field]) {
    const payload = Object.getOwnPropertyDescriptor(operand, "tsonic");
    Object.defineProperty(operand, "tsonic", { configurable: true, enumerable: payload.enumerable,
      get: () => assert.fail("The actual presence operand is unread before its proof admission.") });
    try {
      for (const cut of [{ maximumWork: 1 }, { maximumResultEntries: 2 }]) {
        const account = createAccount({ ...input.limits.dataflow, ...cut });
        const stop = read(account, operand);
        assert.equal(stop, accountFailure(account));
        assert.notEqual(stop, null);
        assert.equal(read(account, operand), stop);
      }
    } finally {
      Object.defineProperty(operand, "tsonic", payload);
    }
  }
  for (const operand of [authored, field]) {
    const copied = { ...operand, get tsonic() { return assert.fail("A crossed source never supplies its payload."); } };
    assert.deepEqual(read(createAccount(input.limits.dataflow), copied), { kind: "complete", value: null });
  }
  const verify = () => verifyTir(verified, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body);
  assert.deepEqual(verify(), { kind: "complete", violations: [] });
  const peer = body.locals.find(local => local.name === "peer");
  const original = refined.tsonic;
  assert.equal(peer.storage, original.narrowing.source);
  refined.tsonic = { ...original, resolution: { kind: "local", local: { body: body.body, local: peer.id } } };
  try {
    const result = verify();
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.some(row => row.rule === "refinement-destination"), true);
  } finally {
    refined.tsonic = original;
  }
}

export async function checkDeclaredNullableWriteQualification() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../../packages/host/dist/pipeline/typed-barrier.js");
  const { checkedSourceObjectFieldsOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { verifyTir } = await import("../../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../../packages/host/dist/ir-program/index.js");
  const { readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeWork, chargeResultEntries, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { checkReachedProofCuts } = await import("./dataflow-cuts.mjs");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Box = { flag: boolean };
    export function write(first: Box | null, second: Box | null, flag: boolean): boolean {
      if (flag) { first = null; second = null; }
      return flag;
    }
  `, ["write"]);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const verified = typed.value.verifierOf(input.snapshot.entryPoint);
  const body = verified.module.bodies.find(row => row.bindings.kind === "instantiated" && row.body.includes(";write];function;0]"));
  const checked = captured.value.checked;
  const authored = checked.bodies.get(body.body);
  const left = authored.root.statements.nodes[0].thenStatement.statements.nodes[0].expression.left;
  const read = (account, access = "write") => {
    const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (setup !== null) return setup;
    const fields = checkedSourceObjectFieldsOf(authored, {
      bodyOf: id => checked.bodies.get(id) ?? null,
      nodeOf: checked.nodeOf,
      itemOf: definition => {
        const reference = checked.declarationSourceOf(definition);
        return reference === null ? null : checked.nodeOf(reference);
      },
      bindingOf: captured.value.bindingOf,
      typeOf: type => readType(captured.value.types, type),
      admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
    });
    const value = fields.presence(left, access);
    return accountFailure(account) ?? { kind: "complete", value };
  };
  const storage = authored.locals[0].checkerSlot.value;
  const type = readType(captured.value.types, storage);
  assert.equal(type.kind, "optional");
  checkReachedProofCuts(InvocationAccount.stateOf, read, { storage, present: type.value }, "actual nullable formal assignment");
  assert.deepEqual(read(createAccount(input.limits.dataflow), "read"), { kind: "complete", value: null });
  const payload = Object.getOwnPropertyDescriptor(left, "tsonic");
  Object.defineProperty(left, "tsonic", { configurable: true, enumerable: payload.enumerable,
    get: () => assert.fail("The actual optional assignment target is unread before its proof admission.") });
  try {
    const cut = createAccount({ ...input.limits.dataflow, maximumWork: 1 });
    const stop = read(cut);
    assert.notEqual(stop, null);
    assert.equal(stop, accountFailure(cut));
    assert.equal(read(cut), stop);
  } finally {
    Object.defineProperty(left, "tsonic", payload);
  }

  const verify = () => verifyTir(verified, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body);
  assert.deepEqual(verify(), { kind: "complete", violations: [] });
  const [first, second] = body.root.statements.nodes[0].thenStatement.statements.nodes.map(row => row.expression);
  const original = first.right.tsonic;
  const decision = original.conversion.operation.decision;
  const operation = decision.operation;
  const step = operation.embedding.proof.steps[0];
  const crossed = second.right.tsonic.conversion.operation.decision.operation.embedding.proof.steps[0].to;
  assert.equal(operation.to, second.tsonic.storage);
  assert.notEqual(step.to.root.value.node, crossed.root.value.node);
  first.right.tsonic = { ...original, conversion: { ...original.conversion, operation: { ...original.conversion.operation,
    decision: { ...decision, operation: { ...operation, embedding: { ...operation.embedding,
      proof: { ...operation.embedding.proof, steps: [{ ...step, to: crossed }] } } } } } } };
  try {
    const result = verify();
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.some(row => row.rule === "operation-type" && row.site.kind === "node"
      && row.site.node === first.right.id && row.detail.some(detail => detail.kind === "text" &&
        detail.value === "an absence write to an optional reference requires its actual checked destination and qualified conversion")), true);
  } finally {
    first.right.tsonic = original;
  }
}
