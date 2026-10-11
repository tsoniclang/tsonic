import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body, extraFiles = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${body}`, ...extraFiles },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary authored source checks without target annotations");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const initializer = name => Node_Initializer(source.ast, nodes.find(node =>
    source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name));
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, {
    ...defaultSourceStorageLimits, maximumSteps: 65_536, maximumTransportRows: 4096,
  });
  const subject = name => {
    const selected = storage.subjectFor(initializer(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact checked graph subject`);
    return selected.subject;
  };
  const result = (name, kind = "complete") => {
    const selected = storage.closedOriginsFor(subject(name));
    assert.equal(selected.kind === kind, true,
      `${name}: finite ${kind} recursive relation; actual=${selected.kind}${selected.kind === "unresolved" ? `; ${selected.reason}` : ""}`);
    assert.equal(storage.failureReason() === undefined, true, "independent resource protection remains intact");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.origins), true, "only completed immutable evidence is exposed");
    return selected;
  };
  return { source, file, storage, initializer, subject, result };
}

const nesting = `
function nest(callback: () => object, count: number): () => object {
  return count === 0 ? callback : nest(() => callback(), count - 1);
}
`;

test("recursive returned closures retain both their seed and recursive creation without growing capture histories", () => {
  const current = fixture(`${nesting}
    const firstValue = {}; const secondValue = {};
    const firstSeed = () => firstValue; const secondSeed = () => secondValue;
    const first = nest(firstSeed, 3); const second = nest(secondSeed, 4);
  `);
  for (const [name, own, foreign] of [["first", "firstSeed", "secondSeed"], ["second", "secondSeed", "firstSeed"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 2, true, "exact seed and authored recursive closure identities");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(own)), true, "selected seed survives");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false, "independent caller is never imported");
  }
});

for (const [name, declarations, invocation] of [
  ["direct recursion", nesting, "nest"],
  ["mutual recursion", `
    function first(callback: () => object, count: number): () => object {
      return count === 0 ? callback : second(() => callback(), count - 1);
    }
    function second(callback: () => object, count: number): () => object {
      return count === 0 ? callback : first(() => callback(), count - 1);
    }
  `, "first"],
]) {
  test(`${name} preserves exact invoked results through recursively captured callback environments`, () => {
    const current = fixture(`${declarations}
      const leftValue = { left: 1 }; const rightValue = { right: 1 };
      const leftReader = ${invocation}(() => leftValue, 3);
      const rightReader = ${invocation}(() => rightValue, 4);
      const left = leftReader(); const right = rightReader();
    `);
    for (const [name, own, foreign] of [["left", "leftValue", "rightValue"], ["right", "rightValue", "leftValue"]]) {
      const selected = current.result(name);
      assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject(own), true,
        "only the selected caller's original return remains");
      assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
        "recursive context folding cannot merge independent roots");
    }
  });
}

test("recursive capture keeps an exposed mutable storage witness even when its original producer equals a private input", () => {
  const current = fixture(`${nesting}
    const original = {};
    export let exposed: object = original;
    const privateReader = nest(() => original, 3);
    const exposedReader = nest(() => exposed, 3);
    const privateResult = privateReader(); const exposedResult = exposedReader();
  `);
  for (const [name, kind] of [["privateResult", "complete"], ["exposedResult", "open"]]) {
    const selected = current.result(name, kind);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject("original"), true,
      "exact original producer survives recursive capture");
    if (kind === "open") assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true,
      "a recursive relation must not normalize away its writable captured location");
  }
});

test("recursive complete binding tuples retain every rotation and keep separate entry tuples independent", () => {
  const current = fixture(`
    function rotate(left: () => object, middle: () => object, right: () => object, count: number): object {
      return count === 0 ? left() : rotate(middle, right, left, count - 1);
    }
    const firstLeft = {}; const firstMiddle = {}; const firstRight = {};
    const secondLeft = {}; const secondMiddle = {}; const secondRight = {};
    const first = rotate(() => firstLeft, () => firstMiddle, () => firstRight, 3);
    const second = rotate(() => secondLeft, () => secondMiddle, () => secondRight, 4);
  `);
  for (const [name, own, foreign] of [["first", "first", "second"], ["second", "second", "first"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 3, true, "all three finite rotations, not an arbitrary unfolding cutoff");
    for (const suffix of ["Left", "Middle", "Right"]) {
      assert.equal(selected.origins.some(origin => origin.subject === current.subject(`${own}${suffix}`)), true,
        "the complete selected binding tuple remains reachable");
      assert.equal(selected.origins.some(origin => origin.subject === current.subject(`${foreign}${suffix}`)), false,
        "another entry tuple is never widened into this relation");
    }
  }
});

test("recursive callee and argument alternatives remain correlated as one complete invocation tuple", () => {
  const current = fixture(`
    function rotate(first: (value: object) => object, second: (value: object) => object,
      left: object, right: object, count: number): object {
      return count === 0 ? first(left) : rotate(second, first, right, left, count - 1);
    }
    const firstIdentity = {}; const firstConstant = {}; const firstForbidden = {};
    const secondIdentity = {}; const secondConstant = {}; const secondForbidden = {};
    const first = rotate(value => value, () => firstConstant, firstIdentity, firstForbidden, 4);
    const second = rotate(value => value, () => secondConstant, secondIdentity, secondForbidden, 5);
  `);
  for (const [name, own, foreign] of [["first", "first", "second"], ["second", "second", "first"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 2, true, "whole tuple yields only identity and constant results");
    for (const suffix of ["Identity", "Constant"]) {
      assert.equal(selected.origins.some(origin => origin.subject === current.subject(`${own}${suffix}`)), true,
        "a reachable complete invocation alternative survives");
      assert.equal(selected.origins.some(origin => origin.subject === current.subject(`${foreign}${suffix}`)), false,
        "independent entry roots never become a possible tuple");
    }
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(`${own}Forbidden`)), false,
      "independent unions of callee and argument would manufacture this unreachable result");
  }
});

test("recursive callback containers retain selected member and written receiver provenance", () => {
  const current = fixture(`
    class Box { value: object = {}; read(): object { return this.value; } }
    interface Reader { readonly read: () => object; }
    function nest(reader: Reader, count: number): Reader {
      return count === 0 ? reader : nest({ read: () => reader.read() }, count - 1);
    }
    function outer(box: Box, token: object): object {
      box.value = token;
      return nest({ read: () => box.read() }, 3).read();
    }
    const firstToken = {}; const secondToken = {};
    const first = outer(new Box(), firstToken); const second = outer(new Box(), secondToken);
  `);
  for (const [name, own, foreign] of [["first", "firstToken", "secondToken"], ["second", "secondToken", "firstToken"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(own)), true,
      "selected caller's receiver write reaches its recursively captured reader");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
      "stored member transport does not erase the selected caller");
  }
});

test("recursive record methods retain the selected receiver's entry seed through concrete equation expansion", () => {
  const current = fixture(`
    interface Item { value: object; }
    class Parser {
      constructor(private readonly value: object) {}
      parse(): Item { return this.parseValue(2); }
      parseValue(count: number): Item {
        return count === 0 ? { value: this.value }
          : count === 1 ? this.parseObject(count - 1) : this.parseArray(count - 1);
      }
      parseObject(count: number): Item { return { value: this.parseValue(count).value }; }
      parseArray(count: number): Item { return this.parseValue(count); }
    }
    const own = {}; const foreign = {};
    const firstParser = new Parser(own); const secondParser = new Parser(foreign);
    const first = firstParser.parse().value; const second = secondParser.parse().value;
  `);
  for (const [name, own, foreign] of [["first", "own", "foreign"], ["second", "foreign", "own"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject(own), true,
      "concrete recursive entry retains its exact receiver seed");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
      "a different parser invocation cannot supply this receiver's value");
  }
});

test("recursive source context relations keep exact cross-file generic declaration identities", () => {
  const current = fixture(`
    import { nest } from "./nest.js";
    const leftValue = { left: 1 }; const rightValue = { right: 1 };
    const leftReader = nest(() => leftValue, 3); const rightReader = nest(() => rightValue, 4);
    const left = leftReader(); const right = rightReader();
  `, { "/src/nest.ts": `
    export function nest<Value>(callback: () => Value, count: number): () => Value {
      return count === 0 ? callback : nest(() => callback(), count - 1);
    }
  ` });
  for (const [name, own] of [["left", "leftValue"], ["right", "rightValue"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject(own), true,
      "generic cross-file return and capture relations preserve original checked identity");
  }
});

test("recursive graph membership cannot admit an invocation whose correlated callee selects another implementation", () => {
  const current = fixture(`
    declare const choose: boolean;
    type Step = (next: Step, value: object) => object;
    const own = {}; const constant = {}; const forbidden = {}; const foreign = {};
    function step(next: Step, value: object): object {
      return choose ? value : next(next, forbidden);
    }
    const first = step((_next: Step, _value: object) => constant, own);
    const unrelated = step(step, foreign);
  `);
  const selected = current.result("first");
  assert.equal(selected.origins.length === 2, true, "only the actual input and selected callback result are reachable");
  for (const name of ["own", "constant"]) assert.equal(selected.origins.some(origin =>
    origin.subject === current.subject(name)), true, "selected caller has its original root");
  for (const name of ["forbidden", "foreign"]) assert.equal(selected.origins.some(origin =>
    origin.subject === current.subject(name)), false, "a globally possible recursive edge is not a selected caller transition");
});

test("a recursive selected callee retains its own lexical capture rather than the invoking closure's capture", () => {
  const current = fixture(`
    type Step = (next: Step, count: number) => object;
    function make(seed: object): Step {
      function step(next: Step, count: number): object {
        return count === 0 ? seed : next(next, count - 1);
      }
      return step;
    }
    const own = {}; const selected = {}; const unrelated = {};
    const first = make(own)(make(selected), 3);
    const separate = make(unrelated)(make(unrelated), 3);
  `);
  const result = current.result("first");
  assert.equal(result.origins.length === 2, true, "both actual checked branch producers retain their creation environments");
  for (const name of ["own", "selected"]) assert.equal(result.origins.some(origin =>
    origin.subject === current.subject(name)), true, "an invoked recursive closure supplies its own captured seed");
  assert.equal(result.origins.some(origin => origin.subject === current.subject("unrelated")), false,
    "a separate closure creation is never an alternative of this invocation");
});

test("callee-scoped defaults remain finite when a nested returned closure captures the defaulted parameter", () => {
  const current = fixture(`${nesting}
    const own = {}; const foreign = {};
    function outer(seed: object = own): object { return nest(() => seed, 2)(); }
    const first = outer(); const second = outer(foreign);
  `);
  for (const [name, own, foreign] of [["first", "own", "foreign"], ["second", "foreign", "own"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject(own), true,
      "default or explicit input belongs to exactly this completed invocation");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
      "a cyclic callee frame cannot import another invocation's input");
  }
});

for (const [name, declarations, left, right] of [
  ["property-held closure", `
    function make(token: object): { read: () => object } { return { read: () => token }; }
    function read(box: { read: () => object }): object { return box.read(); }
  `, "read(make(leftToken))", "read(make(rightToken))"],
  ["returned record field", `
    function make(token: object): { value: object } { return { value: token }; }
    function read(box: { value: object }): object { return box.value; }
  `, "read(make(leftToken))", "read(make(rightToken))"],
  ["constructor field through getter", `
    class Box { constructor(public value: object) {} get current(): object { return this.value; } }
    function read(box: Box): object { return box.current; }
  `, "read(new Box(leftToken))", "read(new Box(rightToken))"],
]) {
  test(`selected ${name} retains its producer context rather than the member reader context`, () => {
    const current = fixture(`${declarations}
      const leftToken = {}; const rightToken = {};
      const left = ${left}; const right = ${right};
    `);
    for (const [selected, own, foreign] of [["left", "leftToken", "rightToken"], ["right", "rightToken", "leftToken"]]) {
      const result = current.result(selected);
      assert.equal(result.origins.length === 1 && result.origins[0].subject === current.subject(own), true,
        "exact checked member correspondence carries the original creator's scope");
      assert.equal(result.origins.some(origin => origin.subject === current.subject(foreign)), false,
        "member traversal cannot combine separate producer and reader invocations");
    }
  });
}

test("selected receiver feedback completes its storage dependency without requiring recursive function dispatch", () => {
  const current = fixture(`
    class Value { read(): Value { return this; } }
    function forward(value: Value): Value {
      let selected = value;
      for (let index = 0; index < 3; index++) selected = selected.read();
      return selected;
    }
    const firstValue = new Value(); const secondValue = new Value();
    const first = forward(firstValue); const second = forward(secondValue);
  `);
  for (const [name, own, foreign] of [["first", "firstValue", "secondValue"], ["second", "secondValue", "firstValue"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject(own), true,
      "receiver/return storage feedback closes on its actual native allocation");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
      "the fixed point cannot broaden the selected receiver to another caller");
  }
});

for (const access of [".value", '["value"]']) {
  test(`selected ${access} read preserves every exact alternative creator scope`, () => {
    const current = fixture(`
      declare const choose: boolean;
      function make(token: object): { value: object } { return { value: token }; }
      const firstToken = {}; const secondToken = {}; const unrelated = {};
      const selected = (choose ? make(firstToken) : make(secondToken))${access};
      const separate = make(unrelated)${access};
    `);
    const selected = current.result("selected");
    assert.equal(selected.origins.length === 2, true, "creator footprints retain both distinct selected formal inputs");
    for (const name of ["firstToken", "secondToken"]) assert.equal(selected.origins.some(origin =>
      origin.subject === current.subject(name)), true, "each alternative uses its own creator scope");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject("unrelated")), false,
      "a globally possible creator is not an alternative of this read");
    const separate = current.result("separate");
    assert.equal(separate.origins.length === 1 && separate.origins[0].subject === current.subject("unrelated"), true);
  });
}

test("identical factory arguments do not merge separately created captured writable locations", () => {
  const current = fixture(`
    function make(seed: object) {
      let value = seed;
      return { read: () => value, write: (next: object) => { value = next; } };
    }
    const spawn = (seed: object) => make(seed);
    const original = {}; const replacement = {};
    const first = spawn(original); const second = spawn(original);
    first.write(replacement);
    const written = first.read();
    const selected = second.read();
  `);
  const written = current.result("written");
  for (const name of ["original", "replacement"]) assert.equal(written.origins.some(origin =>
    origin.subject === current.subject(name)), true, "the invoked writer remains effective on its own captured location");
  const selected = current.result("selected");
  assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject("original"), true,
    "equal original values are not evidence of equal captured binding locations");
  assert.equal(selected.origins.some(origin => origin.subject === current.subject("replacement")), false,
    "the first activation's writer cannot mutate the second activation's captured location");
});

test("transitive factory results preserve created locations rather than equal forwarded values", () => {
  const current = fixture(`
    function make(seed: object) {
      let value = seed;
      return { read: () => value, write: (next: object) => { value = next; } };
    }
    function forward(seed: object) { return make(seed); }
    const spawn = (seed: object) => forward(seed);
    const original = {}; const replacement = {};
    const first = spawn(original); const second = spawn(original);
    first.write(replacement);
    const written = first.read(); const selected = second.read();
  `);
  assert.equal(current.result("written").origins.some(origin => origin.subject === current.subject("replacement")), true,
    "the executed writer reaches its transitive factory's captured location");
  const selected = current.result("selected");
  assert.equal(selected.origins.length === 1 && selected.origins[0].subject === current.subject("original"), true,
    "forwarding a fresh allocation does not merge two separate creator activations");
});

test("an invoked writer contributes its selected receiver effect even when its result is discarded", () => {
  const current = fixture(`
    function write(box: { value: object }, token: object): void { box.value = token; }
    function run(token: object): object {
      const box = { value: {} };
      write(box, token);
      return box.value;
    }
    const firstToken = {}; const secondToken = {};
    const first = run(firstToken); const second = run(secondToken);
  `);
  for (const [name, own, foreign] of [["first", "firstToken", "secondToken"], ["second", "secondToken", "firstToken"]]) {
    const selected = current.result(name);
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(own)), true,
      "discarding a void return cannot discard the executed writer's selected RHS");
    assert.equal(selected.origins.some(origin => origin.subject === current.subject(foreign)), false,
      "writer context belongs to the actual receiver activation, not every invocation of its body");
  }
});

test("writer effects in a selected default initializer do not execute for a supplied present argument", () => {
  const current = fixture(`
    const replacement = {}; const supplied = {};
    function write(box: { value: object }): object { box.value = replacement; return replacement; }
    function read(box: { value: object }, selected: object = write(box)): object { return box.value; }
    const firstToken = {}; const secondToken = {};
    const first = read({ value: firstToken });
    const second = read({ value: secondToken }, supplied);
  `);
  const first = current.result("first");
  assert.equal(first.origins.some(origin => origin.subject === current.subject("replacement")), true,
    "the invoked default region contributes its actual writer effect");
  const second = current.result("second");
  assert.equal(second.origins.length === 1 && second.origins[0].subject === current.subject("secondToken"), true,
    "the supplied-present invocation cannot acquire a writer from its unexecuted default region");
});

test("constructor parameter-property producers retain the entry snapshot independently of local parameter rebinding", () => {
  for (const body of ["", "value = other;"]) {
    const current = fixture(`
      class Box { constructor(public readonly value: object, other: object) { ${body} } }
      const firstToken = {}; const firstReplacement = {};
      const secondToken = {}; const secondReplacement = {};
      const first = new Box(firstToken, firstReplacement).value;
      const second = new Box(secondToken, secondReplacement).value;
    `);
    for (const [name, own, foreign] of [["first", "firstToken", "secondToken"], ["second", "secondToken", "firstToken"]]) {
      const values = current.result(name);
      const producers = current.storage.storageProducersFor(current.subject(name));
      assert.equal(producers.kind === "complete", true, "a parameter field has a genuine physical initialization, not a formal self-cycle");
      assert.equal(values.origins.length === 1 && values.origins[0].subject === current.subject(own), true,
        "a later local parameter assignment cannot overwrite the constructor's member initialization");
      assert.equal(producers.producers.length === 1 && producers.producers[0].subject === current.subject(own), true,
        "physical producers preserve the selected constructor-entry snapshot");
      assert.equal(producers.producers.some(producer => producer.subject === current.subject(foreign)), false,
        "separate constructor invocations never share an input snapshot");
    }
  }
});

test("actual constructor member writes survive physical producer selection without becoming a formal binding override", () => {
  const current = fixture(`
    class Box { constructor(public readonly value: object, other: object) { this.value = other; } }
    const original = {}; const replacement = {};
    const selected = new Box(original, replacement).value;
  `);
  const producers = current.storage.storageProducersFor(current.subject("selected"));
  assert.equal(producers.kind === "complete", true, "physical initialization and actual member write are both closed");
  assert.equal(producers.producers.length === 2, true, "the entry snapshot and later physical writer remain distinct producers");
  for (const name of ["original", "replacement"]) assert.equal(producers.producers.some(producer =>
    producer.subject === current.subject(name)), true, "a constructor formal cannot suppress an actual member store");
  assert.equal(current.storage.failureReason() === undefined, true, "member identity is not repaired by widening resource ceilings");
});

test("ordinary parameter rebinding retains both producers without mutating its selected signature input", () => {
  const current = fixture(`
    function replace(value: object, other: object): object { value = other; return value; }
    const original = {}; const replacement = {}; const unrelated = {};
    const selected = replace(original, replacement);
    const separate = replace(unrelated, unrelated);
  `);
  const declaration = current.storage.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "replace");
  const parameter = current.source.ast.parameters(declaration)[0];
  const entry = current.storage.subject(parameter, "input");
  const local = current.storage.subject(parameter, "value");
  assert.equal(entry.kind === "resolved" && local.kind === "resolved", true, "both exact parameter roles exist");
  assert.equal(entry.subject !== local.subject, true, "signature entry and mutable binding have separate identities");
  const bindings = current.storage.bindingsForInvocation(declaration, current.initializer("selected"));
  assert.equal(bindings.kind === "resolved", true, "exact selected invocation bindings");
  const selectedInput = current.storage.boundOriginsFor(entry.subject, bindings.bindings);
  assert.equal(selectedInput.kind === "resolved" && selectedInput.subjects.length === 1 &&
    selectedInput.subjects[0] === current.subject("original"), true, "the entry snapshot remains the original actual");
  const selected = current.result("selected");
  assert.equal(selected.origins.length === 2, true, "ordinary binding provenance preserves entry and actual local store");
  for (const name of ["original", "replacement"]) assert.equal(selected.origins.some(origin =>
    origin.subject === current.subject(name)), true, "neither original producer is suppressed by the input binding");
  assert.equal(selected.origins.some(origin => origin.subject === current.subject("unrelated")), false,
    "a sibling invocation does not become this binding's producer");
});
