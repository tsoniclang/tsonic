import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSourceConstructorResults } from "../../packages/target-api/dist/public/analysis.js";
import { constructorResultFixture } from "./source-storage-construction-fixtures.mjs";

for (const [name, constructor] of [
  ["branch-local receiver assignment", "let self: Owner; if (flag) { self = this; } else { self = this; } return self;"],
  ["receiver assignment after a substitute", "let self: Owner = { value: 2 }; self = this; return self;"],
  ["terminating substitute branch", "let self: Owner = this; if (flag) { self = { value: 2 }; throw 'stop'; } return self;"],
  ["assignment expression", "let self: Owner; return self = this;"],
  ["same receiver conditional writes", "let self: Owner = this; flag ? self = this : self = this; return self;"],
  ["nested return is not a constructor return", "const unrelated = () => ({ value: 2 }); unrelated(); return this;"],
]) {
  test(`constructor locality preserves ${name}`, () => {
    const { source } = constructorResultFixture(`class Owner { value = 1; constructor(flag: boolean) { ${constructor} } }`);
    const issues = analyzeSourceConstructorResults(source);
    assert.equal(issues.length, 0, `${name}: current-body facts establish the receiver without storage.`);
  });
}

for (const [name, constructor] of [
  ["one branch substitutes an alias", "let self: Owner = this; if (flag) { self = { value: 2 }; } return self;"],
  ["conditional assignment substitutes an alias", "let self: Owner = this; flag ? self = this : self = { value: 2 }; return self;"],
  ["asserted never cannot hide a reassigned alias", "let self: Owner = this; self = { value: 2 }; return self as never;"],
  ["assignment expression returns its substitute", "let self: Owner = this; return self = { value: 2 };"],
]) {
  test(`constructor locality rejects ${name}`, () => {
    const { source, nodes } = constructorResultFixture(`class Owner { value = 1; constructor(flag: boolean) { ${constructor} } }`);
    const issues = analyzeSourceConstructorResults(source);
    const returned = nodes.find(node => source.ast.is.IsReturnStatement(node));
    assert.equal(issues.length, 1, `${name}: exactly one local rejection.`);
    assert.equal(issues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED", `${name}: a substitute is not an unresolved identity.`);
    assert.equal(issues[0].sourceNode === source.ast.as.AsReturnStatement(returned).Expression, true,
      `${name}: the original return expression owns the rejection.`);
  });
}

test("constructor locality does not analyze unrelated recursive declarations", () => {
  const { source } = constructorResultFixture(`
    interface Link { readonly value: number; readonly next?: Link; }
    export function last(link: Link): Link { return link.next ? last(link.next) : link; }
    export function add(left: number, right: number): number { return left + right; }
    export class Owner { value = 1; constructor() { return this; } }
  `);
  const issues = analyzeSourceConstructorResults(source);
  assert.equal(issues.length, 0, "A deep unrelated declaration cannot poison local constructor admission.");
  assert.equal(Object.isFrozen(issues), true, "Local admission retains its immutable result contract.");
});

test("constructor locality keeps opaque return diagnostics local", () => {
  const { source, nodes } = constructorResultFixture(`
    declare function opaque(owner: Owner): Owner;
    class Owner { value = 1; constructor() { return opaque(this) as never; } }
    class Valid { value = 1; constructor() { return this; } }
  `);
  const returned = nodes.find(node => source.ast.is.IsReturnStatement(node) &&
    source.ast.text(source.ast.as.AsReturnStatement(node).Expression).includes("opaque"));
  const issues = analyzeSourceConstructorResults(source);
  assert.equal(issues.length, 1, "Only the opaque constructor receives a diagnostic.");
  assert.equal(issues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN", "An assertion cannot prove an opaque call's identity.");
  assert.equal(issues[0].sourceNode === source.ast.as.AsReturnStatement(returned).Expression, true,
    "The opaque return itself owns the error; the independent valid constructor is unaffected.");
});

test("constructor locality does not replay a nested writer to prove an alias", () => {
  const { source, nodes } = constructorResultFixture(`
    class Owner { value = 1; constructor() {
      let self: Owner = this;
      const replace = () => { self = { value: 2 }; };
      replace();
      return self;
    } }
  `);
  const returned = nodes.find(node => source.ast.is.IsReturnStatement(node));
  const issues = analyzeSourceConstructorResults(source);
  assert.equal(issues.length, 1, "A call cannot retain a stale local receiver fact across a deferred write.");
  assert.equal(issues[0].code, "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN", "Nested execution is not replayed as constructor-local proof.");
  assert.equal(issues[0].sourceNode === source.ast.as.AsReturnStatement(returned).Expression, true,
    "The original alias return owns its local uncertainty.");
});

test("constructor locality preserves receiver identity across member mutation and comparison", () => {
  const { source } = constructorResultFixture(`
    class Owner { value = 1; constructor() {
      const self = this;
      if (self.value === 1) self.value++;
      return self;
    } }
  `);
  assert.equal(analyzeSourceConstructorResults(source).length, 0,
    "Member mutation and comparison do not reassign the receiver binding.");
});
