import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";
import { fixture } from "./source-storage-recursive-projections-fixtures.mjs";

for (const accessor of ["box.slot", 'box["slot"]']){
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

for (const access of ["box.current", 'box["current"]']){
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

for (const operation of ["throw original", "raise(original)", "box.current", 'box["current"]']){
for (const mutate of [false, true]){
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

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]){
test(`member-demand analysis preserves independent finite guards ${JSON.stringify(limits)}`, () => {
    const current = fixture(`const value = {}; const owner = { value }; const result = owner.value;`, limits);
    assert.equal(current.query("result").kind === "unresolved", true);
    assert.equal(current.storage.failureReason() !== undefined, true, "no partial success around exhaustion");
  });
}
