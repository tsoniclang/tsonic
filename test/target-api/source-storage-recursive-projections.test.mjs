import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const subject = storage.subjectFor(initializer(name));
    return subject.kind === "resolved" ? storage.closedOriginsFor(subject.subject) : subject;
  };
  const expect = (name, expected) => {
    const result = query(name);
    assert.equal(result.kind === "complete", true, `${name}: ${storage.failureReason() ?? result.reason ?? result.kind}`);
    assert.equal(result.origins.length === expected.length && expected.every(original =>
      result.origins.some(origin => origin.subject.node === initializer(original))), true,
    `${name}: exact producers ${expected.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "original finite guards remain enabled");
  };
  return { expect, query, storage, initializer, source, file };
}

for (const openFirst of [false, true]) {
  test(`boundary frontiers retain activation and query-order independence (${openFirst ? "open first" : "closed first"})`, () => {
    const current = fixture(`
      declare const external: object[];
      function first(values: object[]): object { return values[0]; }
      const original = {};
      const known = first([original]);
      const unknown = first(external);
    `);
    const checkOpen = () => {
      const selected = current.query("unknown");
      assert.equal(selected.kind === "open", true, "the exact outside activation remains open");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
        "the contributing outside component retains its boundary");
      assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("original")), false,
        "the separate closed activation does not become an outside producer");
    };
    if (openFirst) checkOpen();
    current.expect("known", ["original"]);
    checkOpen();
    current.expect("known", ["original"]);
  });
}

for (const openFirst of [false, true]) {
  test(`bounded recursive boundary walks never poison exact closed invocation results (${openFirst})`, () => {
    const current = fixture(`
      interface Tree { readonly token: object; readonly children: readonly Tree[]; }
      declare const outside: Tree;
      function first(tree: Tree): object { return tree.children[0] ? first(tree.children[0]) : tree.token; }
      const token = {}; const result = first({ token, children: [] });
      const external = first(outside);
    `);
    const inspect = () => {
      const selected = current.query("external");
      assert.equal(selected.kind === "open", true, "an unbound recursive input retains its actual frontier");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
        "the bounded walk publishes external input, not a fabricated recursive producer");
    };
    if (openFirst) inspect();
    current.expect("result", ["token"]);
    inspect();
    current.expect("result", ["token"]);
  });
}

test("an unproved inspection retains its exact opaque operand even when the object's checked view has no members", () => {
  const current = fixture(`
    declare function inspect(value: object): boolean;
    const original: object = {};
    const alias = original;
    const observed = inspect(alias);
  `);
  const selected = current.query("alias");
  assert.equal(selected.kind === "open", true, "an empty public view cannot certify that an opaque operation preserves its input");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write" &&
    current.source.ast.is.IsCallExpression(boundary.exposure)), true,
  "the real checked invocation owns the opacity witness");
  assert.equal(current.storage.failureReason() === undefined, true, "no synthetic effect or new resource ceiling is required");
});

test("an escaping private callable retains future opaque inputs independently of its observed empty-object call", () => {
  const current = fixture(`
    declare function nativeFreeze<T>(value: T): Readonly<T>;
    function freeze(value: object): object { return nativeFreeze(value); }
    export function retained(): (value: object) => object { freeze({}); return freeze; }
  `);
  const declaration = namedDeclaration(current.source.ast, current.file, "nativeFreeze");
  const owner = namedDeclaration(current.source.ast, current.file, "freeze");
  const parameter = current.source.ast.parameters(owner)[0];
  const storage = createSourceStorageQuery(current.source, [current.file], undefined, {
    call(node, selected) {
      const semantics = current.source.semantics.forNode(node);
      return semantics.declarations.signatureDeclaration(selected.selectedSignature) === declaration
        ? { resultAlias: selected.sourceArguments[0].expression } : undefined;
    },
  });
  const subject = storage.subjectFor(parameter);
  const bindings = storage.bindingsForDeclaration(owner);
  assert.equal(subject.kind === "resolved" && bindings.kind === "resolved", true, "the actual escaping callable owns its declaration entry");
  const selected = storage.closedOriginsFor(subject.subject, bindings.bindings);
  assert.equal(selected.kind === "open", true, "one observed local call does not close future callers of the returned function");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "the retained declaration entry supplies its exact external-input witness");
  assert.equal(storage.failureReason() === undefined, true, "the shared source owner retains the original finite guards");
});

test("a returned generic fixed method preserves its captured value without inventing a replaceable method slot", () => {
  const current = fixture(`
    export function hold<T>(value: T): { read(): T } { return { read() { return value; } }; }
    const original = {}; const separate = {};
    const first = hold(original); const second = hold(separate);
    const selected = first.read(); const other = second.read();
  `);
  current.expect("selected", ["original"]);
  current.expect("other", ["separate"]);
});

test("a writable returned function property remains externally replaceable", () => {
  const current = fixture(`
    const original = {};
    export const retained: { read: () => object } = { read: () => original };
    const selected = retained.read;
  `);
  const selected = current.query("selected");
  assert.equal(selected.kind === "open", true, "a function-valued data property is not a fixed native method");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "the real writable slot retains its outside writer");
  assert.equal(current.storage.failureReason() === undefined, true, "fixed-method handling does not discharge writable-property evidence");
});

test("generic nested array calls retain finite checked types and exact scoped origins", () => {
  const current = fixture(`
    function first<T>(values: T[], fallback: T): T { return values.length === 0 ? fallback : values[0]!; }
    function nested<T>(values: T[][], fallback: T): T { return first(first(values, []), fallback); }
    const left = {}; const right = {};
    const one = nested([[left]], left);
    const two = nested([[right]], right);
  `);
  for (const [name, original] of [["one", "left"], ["two", "right"]]) {
    const selected = current.storage.subjectFor(current.initializer(name));
    assert.equal(selected.kind === "resolved", true, "exact checked result subject");
    assert.equal(current.storage.typeFor(selected.subject).kind === "resolved", true,
      "a checked generic component does not flatten unrelated invocation substitutions");
    current.expect(name, [original]);
  }
});

for (const access of ["this.values", 'this["values"]']) for (const tuple of [false, true]) {
  test(`projected ${tuple ? "tuple" : "array"} stores retain writer activation and physical receiver for ${access}`, () => {
    const current = fixture(`
      function identity<Value>(value: Value): Value { return value; }
      class Box {
        values: ${tuple ? "[object]" : "object[]"};
        constructor(value: object) { this.values = [value]; }
        replace(value: object): void { ${access} = [identity(value)]; }
        read(): object { return ${access}[0]!; }
      }
      const initial = {}; const replacement = {}; const otherInitial = {}; const otherReplacement = {};
      const first = new Box(initial); const second = new Box(otherInitial);
      first.replace(replacement); second.replace(otherReplacement);
      const one = first.read(); const two = second.read();
    `);
    current.expect("one", ["initial", "replacement"]);
    current.expect("two", ["otherInitial", "otherReplacement"]);
  });
}

test("projected closure-owned stores do not execute uninvoked writers or mix captured activations", () => {
  const current = fixture(`
    function make(seed: object) {
      const values: object[][] = [[seed]];
      return {
        replace(value: object): void { values[0] = [value]; },
        read(): object { return values[0]![0]!; },
      };
    }
    const initial = {}; const replacement = {}; const other = {}; const unused = {};
    const first = make(initial); const second = make(other);
    first.replace(replacement);
    function never(): void { second.replace(unused); }
    const one = first.read(); const two = second.read();
  `);
  current.expect("one", ["initial", "replacement"]);
  current.expect("two", ["other"]);
});

test("abstract local queries retain writes in their own entry region without inventing a caller", () => {
  const current = fixture(`
    const initial = {}; const replacement = {};
    export function choose(flag: boolean): object {
      let value: object = initial;
      if (flag) value = replacement;
      const selected = value;
      return selected;
    }
  `);
  current.expect("selected", ["initial", "replacement"]);
});

test("implicit construction retains initializer receivers inside an uninvoked exported entry", () => {
  const current = fixture(`
    const token = {};
    export class Box { readonly value: object = token; }
    export function inspect(): object {
      const box = new Box();
      const selected = box.value;
      return selected;
    }
  `);
  current.expect("selected", ["token"]);
});

for (const exported of [false, true]) for (const access of ["value.value", 'value["value"]']) for (const reverse of [false, true]) {
  test(`recursive data projection retains separate tree entries (${exported ? "exported" : "private"}, ${access}, ${reverse})`, () => {
    const current = fixture(`
      class Value {}
      class Leaf extends Value { constructor(readonly token: object) { super(); } }
      class Branch extends Value { constructor(readonly value: Value[]) { super(); } }
      const fallback = {}; const left = {}; const right = {};
      ${exported ? "export " : ""}function descend(value: Value): object {
        if (value instanceof Branch) return descend(${access}[0]);
        if (value instanceof Leaf) return value.token;
        return fallback;
      }
      const first = descend(new Branch([new Branch([new Leaf(left)])]));
      const second = descend(new Branch([new Branch([new Leaf(right)])]));
    `);
    const selections = [["first", "left"], ["second", "right"]];
    for (const [name, original] of reverse ? selections.reverse() : selections) current.expect(name, [original, "fallback"]);
  });
}

test("recursive structural record projections retain their exact fields without a class requirement", () => {
  const current = fixture(`
    declare const stop: boolean;
    interface Tree { readonly token: object; readonly children: readonly Tree[]; }
    function descend(tree: Tree): object {
      if (stop) return tree.token;
      return descend(tree.children[0]);
    }
    const left = {}; const right = {};
    const first = descend({ token: left, children: [{ token: left, children: [] }] });
    const second = descend({ token: right, children: [{ token: right, children: [] }] });
  `);
  current.expect("first", ["left"]);
  current.expect("second", ["right"]);
});

for (const readonly of [true, false]) {
  test(`recursive optional ${readonly ? "readonly" : "writable"} collection publications remain finite and preserve input boundaries`, () => {
    const current = fixture(`
      type Tree = number | ${readonly ? "readonly " : ""}Tree[] | null | undefined;
      export function inspect(tree: Tree): Tree { return tree; }
      const original = {}; const result = original;
    `);
    current.expect("result", ["original"]);
    let parameter;
    current.source.ast.forEachChild(current.file, node => {
      if (current.source.ast.is.IsFunctionDeclaration(node)) parameter = current.source.ast.parameters(node)[0];
    });
    const input = current.storage.subjectFor(parameter);
    assert.equal(input.kind === "resolved", true, "the recursive external formal is retained");
    const origins = current.storage.closedOriginsFor(input.subject);
    assert.equal(origins.kind === "open" && origins.boundaries.some(boundary => boundary.kind === "external-input"),
      true, "finite folding never certifies an external recursive input as closed");
    assert.equal(current.storage.failureReason() === undefined, true, "finite projection and work budgets remain enabled");
  });
}

test("an unrelated private query does not unfold an exported recursive field publication indefinitely", () => {
  const current = fixture(`
    class Value {}
    class Leaf extends Value { constructor(readonly value: { token: object }) { super(); } }
    class Branch extends Value { constructor(readonly value: Value[]) { super(); } }
    declare function expose(value: { token: object }): void;
    export function descend(value: Value): Value {
      if (value instanceof Branch) return descend(value.value[0]);
      return value;
    }
    export function render(value: Value): void {
      const selected = descend(value);
      if (selected instanceof Leaf) expose(selected.value);
    }
    const original = {}; const result = original;
  `);
  current.expect("result", ["original"]);
});

for (const call of ["first.read(left)", 'first["read"](left)', "identity(first.read)(left)"]) {
  test(`a projection nested in ${call} preserves the whole recursive callback and argument tuple`, () => {
    const current = fixture(`
      declare const stop: boolean;
      function identity<Value>(value: Value): Value { return value; }
      interface Pair { left: object; right: object; }
      interface Reader { read: (pair: Pair) => object; }
      function rotate(first: Reader, second: Reader, left: Pair, right: Pair): object {
        if (stop) return ${call};
        return rotate(second, first, right, left);
      }
      const leftReader: Reader = { read: pair => pair.left };
      const rightReader: Reader = { read: pair => pair.right };
      const original = {}; const forbidden = {}; const separate = {};
      const first = rotate(leftReader, rightReader,
        { left: original, right: forbidden }, { left: forbidden, right: original });
      const second = rotate(leftReader, rightReader,
        { left: separate, right: forbidden }, { left: forbidden, right: separate });
    `);
    current.expect("first", ["original"]);
    current.expect("second", ["separate"]);
  });
}

for (const accessor of ["box.slot", 'box["slot"]']) {
  test(`a structural ${accessor} getter retains separate invocation-owned writable captures`, () => {
    const current = fixture(`
      const original = {}; const replacement = {};
      interface Slot { read(): object; write(next: object): void; }
      interface Factory { readonly slot: Slot; }
      class Source {
        get slot(): Slot {
          let value = original;
          return { read: () => value, write: next => { value = next; } };
        }
      }
      function spawn(box: Factory): Slot { return ${accessor}; }
      const box = new Source();
      const first = spawn(box); const second = spawn(box);
      first.write(replacement);
      const written = first.read(); const untouched = second.read();
    `);
    current.expect("written", ["original", "replacement"]);
    current.expect("untouched", ["original"]);
  });
}

test("recursive member data retains executed writes to the selected physical instance", () => {
  const current = fixture(`
    declare const stop: boolean;
    class Box { constructor(public token: object) {} }
    function descend(box: Box): object {
      if (stop) return box.token;
      return descend(box);
    }
    const original = {}; const replacement = {};
    const firstBox = new Box(original); const secondBox = new Box(original);
    firstBox.token = replacement;
    const written = descend(firstBox); const untouched = descend(secondBox);
  `);
  current.expect("written", ["original", "replacement"]);
  current.expect("untouched", ["original"]);
});

for (const access of ["box.current", 'box["current"]']) {
  test(`structural ${access} getter execution mutates only its exact physical receiver`, () => {
    const current = fixture(`
      const original = {}; const replacement = {};
      interface Reader { readonly current: object; }
      class Box {
        constructor(public value: object) {}
        get current(): object { this.value = replacement; return this.value; }
      }
      function invoke(box: Reader): void { ${access}; }
      const first = new Box(original); const second = new Box(original);
      invoke(first);
      const written = first.value; const untouched = second.value;
    `);
    current.expect("written", ["original", "replacement"]);
    current.expect("untouched", ["original"]);
  });

  test(`structural ${access} setter execution retains its exact input and receiver`, () => {
    const current = fixture(`
      const original = {}; const replacement = {};
      interface Writer { current: object; }
      class Box {
        constructor(public value: object) {}
        get current(): object { return this.value; }
        set current(next: object) { this.value = next; }
      }
      function invoke(box: Writer, next: object): void { ${access} = next; }
      const first = new Box(original); const second = new Box(original);
      invoke(first, replacement);
      const written = first.value; const untouched = second.value;
    `);
    current.expect("written", ["original", "replacement"]);
    current.expect("untouched", ["original"]);
  });
}

test("an uninvoked structural getter does not become an executed mutation", () => {
  const current = fixture(`
    const original = {}; const replacement = {};
    interface Reader { readonly current: object; }
    class Box {
      constructor(public value: object) {}
      get current(): object { this.value = replacement; return this.value; }
    }
    function unused(box: Reader): void { box.current; }
    const box = new Box(original);
    const result = box.value;
  `);
  current.expect("result", ["original"]);
});

for (const operation of ["throw original", "raise(original)", "box.current", 'box["current"]']) {
  for (const mutate of [false, true]) {
    test(`${operation} retains the exact catch input independently of later catch writes (${mutate})`, () => {
      const current = fixture(`
        const original = {}; const replacement = {}; const separate = {};
        function raise(value: object): never { throw value; }
        interface Reader { readonly current: object; }
        class Box { get current(): object { throw original; } }
        const box: Reader = new Box();
        try { ${operation}; } catch (caught) {
          ${mutate ? "caught = replacement;" : ""}
          const result = caught;
        }
        try { throw separate; } catch (caught) { const untouched = caught; }
      `);
      current.expect("result", mutate ? ["original", "replacement"] : ["original"]);
      current.expect("untouched", ["separate"]);
    });
  }
}

test("writes to checked optional fields of fresh empty storage preserve their actual values and aliases", () => {
  const current = fixture(`
    interface Options { value?: object; }
    const original = {}; const untouched = {};
    const allocation = {};
    const alias: Options = allocation;
    const separate: Options = { value: untouched };
    alias.value = original;
    const result = alias.value;
    const other = separate.value;
  `);
  current.expect("result", ["original"]);
  current.expect("other", ["untouched"]);
});

test("defaulted formals retain exact values across distinct calls of the same declaration", () => {
  const current = fixture(`
    const fallback = {}; const original = {}; const separate = {};
    function select(value: object = fallback): object { return value; }
    const first = select(original);
    const second = select(separate);
    const defaulted = select();
  `);
  current.expect("first", ["original"]);
  current.expect("second", ["separate"]);
  current.expect("defaulted", ["fallback"]);
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
  test(`member-demand analysis preserves independent finite guards ${JSON.stringify(limits)}`, () => {
    const current = fixture(`const value = {}; const owner = { value }; const result = owner.value;`, limits);
    assert.equal(current.query("result").kind === "unresolved", true);
    assert.equal(current.storage.failureReason() !== undefined, true, "no partial success around exhaustion");
  });
}
