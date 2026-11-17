import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("an actual throw retains its complete checked operand and syntax without a return conversion or invented decision", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { checked, interner } = fixture.checkedModuleOf("export function escape(value:string):never{throw value;}");
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  const callable = checked.tree.statements.nodes[0];
  const statement = callable.body.statements.nodes[0];
  assert.equal(statement.kind, "ThrowStatement");
  assert.equal(statement.tsonic, null);
  assert.equal(statement.expression.kind, "Identifier");
  assert.equal(statement.expression.parent, statement.id);
  assert.equal(statement.expression.tsonic.role, "value");
  assert.deepEqual(statement.expression.tsonic.resolution, { kind: "local", local: callable.parameters.nodes[0].tsonic.declaration.local });
  assert.equal("operation" in statement, false);
  assert.equal("completion" in statement, false);
  const decoded = fixture.hir.parseHir(fixture.hir.printHir(checked));
  assert.equal(decoded.kind, "parsed");
  const retained = decoded.value.tree.statements.nodes[0].body.statements.nodes[0];
  assert.equal(isDeepStrictEqual(retained, statement), true);
  const before = statement.expression.tsonic.resolution;
  statement.expression.tsonic.resolution = { kind: "local", local: { ...before.local,
    body: checked.bodies.find(body => body.root.kind === "SourceFile").body } };
  assert.equal(fixture.verifyChecked(checked, interner).length > 0, true);
  statement.expression.tsonic.resolution = before;
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
});
