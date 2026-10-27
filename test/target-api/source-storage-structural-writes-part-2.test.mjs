import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageFormalMemberWrites } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { formalFixture, optionalDemand } from './source-storage-structural-writes-fixtures.mjs';

for (const [label, callerType, calleeType, invocation, optional] of [
  ["both operands", "Reader | undefined", "Reader | undefined", "sink(owner);", ["forward", "sink"]],
  ["upstream operand", "Reader | undefined", "Reader", "if (owner) sink(owner);", ["forward"]],
  ["downstream operand", "Reader", "Reader | undefined", "sink(owner);", ["sink"]],
]) test(`forwarded present-member demand normalizes ${label} without changing declared carriers`, () => {
  const current = formalFixture(`
    function sink(owner: ${calleeType}) { if (owner) owner.read = () => 3; }
    function forward(owner: ${callerType}) { ${invocation} }
  `);
  for (const name of ["sink", "forward"]) {
    if (optional.includes(name)) optionalDemand(current, name, [current.member()]);
    else current.complete(name, [current.member()]);
  }
});

test("an optional default alias forwards the present-member requirement without erasing either absence", () => {
  const current = formalFixture(`
    function replace(owner?: Reader, fallback: Reader | undefined = owner) { if (fallback) fallback.read = () => 3; }
  `);
  optionalDemand(current, "replace", [current.member()]);
  optionalDemand(current, "replace", [current.member()], "fallback");
});

test("readonly optional consumers and omitted/nullish defaults retain genuinely empty demands", () => {
  const current = formalFixture(`
    function inspect(owner: Reader | null | undefined = undefined) { return owner?.read(); }
    function forward(owner?: Reader) { inspect(); inspect(undefined); inspect(null); return inspect(owner); }
  `);
  optionalDemand(current, "inspect", []);
  optionalDemand(current, "forward", []);
});

for (const type of ["Reader | Other | undefined", "Reader | Other | null | undefined"])
  test(`present-member selection cannot erase non-nullish alternatives from ${type}`, () => {
    const current = formalFixture(`
      interface Other { value: number; }
      function replace(owner: ${type}) { if (owner && "read" in owner) owner.read = () => 3; }
    `);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "removing absence never removes the distinct Other carrier");
    assert.match(selected.reason, /correspondence/u);
  });

for (const type of ["unknown", "any", "null", "undefined", "null | undefined"])
  test(`present-member selection never fabricates a Reader from ${type}`, () => {
    const current = formalFixture(`function replace(owner: ${type}) { (owner as unknown as Reader).read = () => 3; }`);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "a checked cast does not invent a present formal/member correspondence");
    assert.match(selected.reason, /correspondence/u);
  });

test("optional present-member summaries still reject foreign, missing and wrong-owner parameter identities", () => {
  const current = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; } function other(owner?: Reader) { }");
  const foreign = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; }");
  const declaration = current.callable("replace");
  for (const parameter of [current.parameter(current.callable("other"), "owner"),
    foreign.parameter(foreign.callable("replace"), "owner"), Object.freeze({})]) {
    const selected = current.storage.formalMemberWriteDemand(declaration, parameter);
    assert.equal(selected.kind, "unresolved", "normalizing types never normalizes foreign source identity");
    assert.match(selected.reason, /identical checked implementation/u);
  }
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }])
  test(`optional member demands retain exact finite refusal ${Object.keys(limits)[0]}`, () => {
    const current = formalFixture("function replace(owner?: Reader) { if (owner) owner.read = () => 3; }", {}, limits);
    const selected = current.query("replace");
    assert.equal(selected.kind, "unresolved", "present-type normalization never turns finite failure into completed empty proof");
    assert.match(selected.reason, /budget/u);
  });

for (const [label, body, access] of [
  ["named optional property", "const values: { entry?: number } = { entry: 1 }; delete values.entry;", "values.entry"],
  ["string property key", "const values: { entry?: number } = { entry: 1 }; delete values['entry'];", "values['entry']"],
  ["constant property key", "const key = 'entry'; const values: { entry?: number } = { entry: 1 }; delete values[key];", "values[key]"],
  ["numeric array element", "const values = [1, 2]; delete values[0];", "values[0]"],
  ["string array element", "const values = [1, 2]; delete values['0'];", "values['0']"],
  ["dictionary element", "const values: { [key: string]: number } = { entry: 1 }; delete values['entry'];", "values['entry']"],
  ["transparent property operand", "const values: { entry?: number } = { entry: 1 }; delete ((values.entry));", "values.entry"],
  ["transparent element operand", "const values = [1, 2]; delete ((values[0]));", "values[0]"],
  ["nullish optional storage", "const values: { entry?: number | null } = { entry: null }; delete values.entry;", "values.entry"],
  ["optional callable slot", "const values: { read?: () => number } = { read() { return 1; } }; delete values.read;", "values.read"],
]) test(`canonical deletion retains a valueless mutation for ${label}`, () => {
  const current = formalFixture(body);
  const { ast } = current.source;
  const references = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
  assert.equal(references.length, 1, `${label}: the complete program has one exact ${access} operand`);
  const reference = references[0];
  const operation = current.nodes.find(ast.is.IsDeleteExpression);
  assert.equal(reference !== undefined && operation !== undefined, true, `${label}: original checked access and operation`);
  const classified = sourceBindingWriteAtReference(ast, reference);
  assert.equal(classified?.kind, "deletion", `${label}: canonical source-write kind`);
  assert.equal(classified.reference === reference && classified.operation === operation, true, `${label}: exact original identities`);
  assert.equal(classified.values.length, 0, `${label}: deletion has no stored RHS`);
  assert.equal(Object.isFrozen(classified) && Object.isFrozen(classified.values), true, `${label}: immutable source evidence`);
  assert.equal(sourceBindingWriteAtReference(ast, operation), undefined, `${label}: the Boolean result is not a stored value`);
  const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", `${label}: actual mutation occurrence (${selected.reason ?? ""})`);
  assert.equal(selected.write.reference === reference && selected.write.operation === operation, true, `${label}: published original identities`);
  assert.equal(selected.write.kind, "mutation", `${label}: deleting is not initialization`);
  assert.equal(selected.write.value, undefined, `${label}: no invented Boolean or absence producer`);
  assert.equal(selected.write.values.length, 0, `${label}: no manufactured null/undefined tag or value edge`);
  assert.equal(selected.write.reason, undefined, `${label}: no missing-RHS refusal on a genuine valueless operation`);
  assert.equal(selected.write.receiver !== undefined && selected.write.destinations.length > 0, true,
    `${label}: the actual receiver and writable destination survive`);
  assert.equal(current.storage.failureReason(), undefined, `${label}: all actual source relations stay finite`);
});

for (const [label, body, access, kind] of [
  ["assignment", "const values = { entry: 1 }; values.entry = 2;", "values.entry", "assignment"],
  ["compound assignment", "const values = { entry: 1 }; values.entry += 2;", "values.entry", "assignment"],
  ["prefix update", "const values = { entry: 1 }; ++values.entry;", "values.entry", "update"],
  ["postfix update", "const values = [1]; values[0]++;", "values[0]", "update"],
]) test(`valueless deletion never erases the original producer of ${label}`, () => {
  const current = formalFixture(body);
  const { ast } = current.source;
  const references = current.nodes.filter(node => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
  assert.equal(references.length, 1, `${label}: the complete program has one exact ${access} operand`);
  const reference = references[0];
  assert.equal(reference !== undefined, true, `${label}: original checked access`);
  const classified = sourceBindingWriteAtReference(ast, reference);
  assert.equal(classified?.kind, kind, `${label}: unchanged source-write classification`);
  assert.equal(classified.reference === reference && classified.values.length === 1, true, `${label}: exact nonempty value producer`);
  const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", `${label}: original occurrence remains selected`);
  assert.equal(selected.write.reason, undefined, `${label}: original producer remains proved`);
  assert.equal(selected.write.values.length, 1, `${label}: ordinary writes never become deletions`);
});

test("a read operand beside a deletion is not itself a mutation", () => {
  const current = formalFixture("const values: { entry?: number } = { entry: 1 }; const observed = values.entry; delete values.entry;");
  const { ast } = current.source;
  const read = current.nodes.find(node => ast.is.IsPropertyAccessExpression(node) && ast.is.IsVariableDeclaration(ast.parent(node)));
  assert.equal(read !== undefined, true, "the checked initializer contains the independent read operand");
  assert.equal(sourceBindingWriteAtReference(ast, read), undefined, "only the exact delete operand is a deletion");
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }])
  test(`valueless deletion preserves finite refusal ${Object.keys(limits)[0]}`, () => {
    const current = formalFixture("const values: { entry?: number } = { entry: 1 }; delete values.entry;", {}, limits);
    const reference = current.nodes.find(current.source.ast.is.IsPropertyAccessExpression);
    const selected = current.storage.writeAt(reference, current.storage.emptyBindings);
    assert.equal(selected.kind, "unresolved", "finite failure is never published as a completed empty write");
    assert.equal(typeof selected.reason === "string" && selected.reason.length > 0, true, "the real finite failure reason is retained");
    assert.equal(typeof current.storage.failureReason() === "string", true, "the original rejected budget remains authoritative");
  });
