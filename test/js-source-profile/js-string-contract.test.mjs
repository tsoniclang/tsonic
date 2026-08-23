import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  formatDiagnostics,
} from "@tsonic/tsts";
import {
  createJsSourceSemanticsExtension,
  createJsSourceVirtualModulesProvider,
  jsRegExpSourceProfileDeclarations,
  jsSourceSemanticsModules,
} from "../../packages/js-source-profile/dist/index.js";

const profileFoundation = `
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Boolean {}
interface Number {}
interface String {}
interface Array<T> { length: number; [index: number]: T; }
interface IteratorResult<T> { done?: boolean; value: T; }
interface Iterator<T> { next(): IteratorResult<T>; }
interface Iterable<T> { [Symbol.iterator](): Iterator<T>; }
interface IterableIterator<T> extends Iterator<T>, Iterable<T> {}
interface SymbolConstructor { readonly iterator: unique symbol; }
declare var Symbol: SymbolConstructor;
${jsRegExpSourceProfileDeclarations}
`;

test("native string remains the default and JsString requires the explicit jsstr marker", () => {
  const checked = check(`
    import { jsstr } from "@tsonic/js/lang.js";
    import type { JsString } from "@tsonic/js/types.js";

    const native: string = "😀";
    const exact: JsString = jsstr(native);
    const firstUnit: JsString = exact.charAt(0);
    const repaired: string = firstUnit.toWellFormed();
    const nativeResult: RegExpExecArray | null = /./.exec(native);
    const exactResult: JsRegExpExecArray | null = /./.exec(exact);
    export { native, exact, firstUnit, repaired, nativeResult, exactResult };
  `);

  assert.equal(formatDiagnostics(checked.diagnostics), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
});

test("native and exact strings never become implicitly assignable", () => {
  const checked = check(`
    import { jsstr } from "@tsonic/js/lang.js";
    import type { JsString } from "@tsonic/js/types.js";

    const native: string = "value";
    const exact: JsString = jsstr(native);
    const invalidExact: JsString = native;
    const invalidNative: string = exact;
    export { invalidExact, invalidNative };
  `);
  const text = formatDiagnostics(checked.diagnostics);

  assert.equal((text.match(/TS2322/gu) ?? []).length, 2, text);
  assert.deepEqual(checked.extensionDiagnostics, []);
});

test("the JS declaration provider owns only the explicit source modules", () => {
  const provider = createJsSourceVirtualModulesProvider();

  assert.equal(provider.ownsModule("@tsonic/js/types.js", {}).kind, "owned");
  assert.equal(provider.ownsModule("@tsonic/js/lang.js", {}).kind, "owned");
  assert.equal(provider.ownsModule("node:fs", {}).kind, "unowned");
});

function check(source) {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/profile.d.ts": profileFoundation,
      "/src/index.ts": source,
    },
    rootFiles: ["/src/profile.d.ts", "/src/index.ts"],
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      noLib: true,
      strict: true,
      target: "esnext",
    },
    extensionHostOptions: {
      extensions: [
        createSourceSemanticsExtension({ modules: jsSourceSemanticsModules() }),
        createJsSourceSemanticsExtension(),
      ],
    },
  });
  return session.checkSource();
}
