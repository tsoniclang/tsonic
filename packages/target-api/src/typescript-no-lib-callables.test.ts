import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { typescriptNoLibCallableDeclarations } from "./typescript-no-lib-callables.js";

function check(source: string): string {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/source",
    rootFiles: ["/source/core.d.ts", "/source/callables.d.ts", "/source/index.ts"],
    files: {
      "/source/core.d.ts": `
        interface Object {} interface IArguments {} interface String {} interface Number {}
        interface Boolean {} interface RegExp {} interface Array<Value> {}
      `,
      "/source/callables.d.ts": typescriptNoLibCallableDeclarations,
      "/source/index.ts": source,
    },
    compilerOptions: { noLib: true, strict: true, module: "esnext", moduleResolution: "bundler" },
  });
  const checked = session.checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  return formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined));
}

test("the ambient callable contract admits real function and constructor signatures", () => {
  assert.equal(check(`
    function retain<Value extends Function>(value: Value): Value { return value; }
    const identity = <Value>(value: Value): Value => value;
    const selected: Function = identity;
    const callable: CallableFunction = identity;
    class Item {}
    const constructor: NewableFunction = Item;
    const Constructor = retain(Item);
    const result: number = retain(identity)(1);
    const instance: Item = new Constructor();
  `), "");
});

test("empty records and symbols never acquire an untyped callable signature", () => {
  for (const declaration of ["const value = {};", "const value = 1;", "declare const value: unique symbol;"]) {
    assert.match(check(`${declaration} value();`), /TS2349/u);
    assert.match(check(`${declaration} new value();`), /TS2351/u);
    assert.match(check(`${declaration} const assigned: Function = value;`), /TS2322|TS2741/u);
  }
});

test("the ambient callable identity is private rather than a source value or public export", () => {
  assert.match(check("export const value = callable;"), /TS2304/u);
  assert.match(check('import { callable } from "./callables.js";'), /TS2459/u);
});

test("callable identity does not change overload argument checking", () => {
  assert.match(check('function invoke(value: number): void {} invoke("wrong");'), /TS2345/u);
});
