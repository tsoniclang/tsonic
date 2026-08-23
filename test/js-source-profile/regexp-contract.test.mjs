import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompilerSessionFromFiles,
  getBundledLibraryClosure,
} from "@tsonic/tsts";
import {
  jsRegExpSourceProfileDeclarations,
  jsRegExpSourceProfileIdentity,
  jsRegExpTypeLibraryContract,
} from "../../packages/js-source-profile/dist/index.js";

const contractExercise = String.raw`
declare const callback: (substring: string, ...args: any[]) => string;
declare const matcher: { [Symbol.match](string: string): RegExpMatchArray | null };
declare const replacer: { [Symbol.replace](string: string, replacement: string): string };
declare const searcher: { [Symbol.search](string: string): number };
declare const splitter: { [Symbol.split](string: string, limit?: number): string[] };

const literal = /(?<word>\p{L}+)/dgu;
const unicodeSets = /[\p{ASCII}&&\p{Letter}]/v;
const constructed = new RegExp(RegExp.escape("a.b"), "gimsuy");
const called = RegExp(literal);
const flags: string = literal.flags;
const source: string = literal.source;
const booleans: boolean[] = [
  literal.global,
  literal.ignoreCase,
  literal.multiline,
  literal.dotAll,
  literal.hasIndices,
  literal.sticky,
  literal.unicode,
  unicodeSets.unicodeSets,
];
literal.lastIndex = 1;
const tested: boolean = literal.test("letters");
const executed: RegExpExecArray | null = literal.exec("letters");
const symbolMatch: RegExpMatchArray | null = literal[Symbol.match]("letters");
const symbolMatches: RegExpStringIterator<RegExpExecArray> = literal[Symbol.matchAll]("letters");
const symbolReplaceString: string = literal[Symbol.replace]("letters", "$&");
const symbolReplaceCallback: string = literal[Symbol.replace]("letters", callback);
const symbolSearch: number = literal[Symbol.search]("letters");
const symbolSplit: string[] = literal[Symbol.split]("letters", 2);
const matched: RegExpMatchArray | null = "letters".match(literal);
const customMatched: RegExpMatchArray | null = "letters".match(matcher);
const allMatches: RegExpStringIterator<RegExpExecArray> = "letters".matchAll(literal);
const replacedString: string = "letters".replace(literal, "$&");
const replacedCallback: string = "letters".replace(literal, callback);
const customReplaced: string = "letters".replace(replacer, "value");
const replacedAllString: string = "letters".replaceAll(literal, "$&");
const replacedAllCallback: string = "letters".replaceAll(literal, callback);
const searched: number = "letters".search(literal);
const customSearched: number = "letters".search(searcher);
const split: string[] = "letters".split(literal, 2);
const customSplit: string[] = "letters".split(splitter, 2);

if (executed !== null) {
  const first: string = executed[0];
  const index: number = executed.index;
  const input: string = executed.input;
  const group: string | undefined = executed.groups?.word;
  const pair: [number, number] | undefined = executed.indices?.[0];
  const namedPair: [number, number] | undefined = executed.indices?.groups?.word;
}
`;

const minimalProfileFoundation = `
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
`;

test("canonical JS RegExp profile type-checks the complete declaration contract", () => {
  const diagnostics = checkFiles({
    "/src/profile.d.ts": `${minimalProfileFoundation}\n${jsRegExpSourceProfileDeclarations}`,
    "/src/index.ts": contractExercise,
  }, ["/src/profile.d.ts", "/src/index.ts"]);
  assert.deepEqual(diagnostics, []);
});

test("canonical JS RegExp contract remains admitted by the pinned TypeScript libraries", () => {
  const bundled = getBundledLibraryClosure(["lib.es2025.d.ts"]);
  const files = Object.fromEntries(bundled.map((library) => [`/libs/${library.name}`, library.text]));
  files["/src/index.ts"] = contractExercise;
  const rootLibrary = bundled.find((library) => library.name === "lib.es2025.d.ts");
  assert.notEqual(rootLibrary, undefined);
  const diagnostics = checkFiles(files, [
    ...bundled.map((library) => `/libs/${library.name}`),
    "/src/index.ts",
  ]);
  assert.deepEqual(diagnostics, []);
  const bundledNames = new Set(bundled.map((library) => library.name));
  for (const library of jsRegExpTypeLibraryContract.sourceLibraries) {
    assert.equal(bundledNames.has(library), true, `missing pinned contract library ${library}`);
  }
});

test("canonical profile identities are immutable and legacy RegExp APIs stay excluded", () => {
  assert.equal(Object.isFrozen(jsRegExpSourceProfileIdentity), true);
  assert.equal(Object.isFrozen(jsRegExpSourceProfileIdentity.owners), true);
  assert.equal(Object.isFrozen(jsRegExpTypeLibraryContract), true);
  assert.equal(Object.isFrozen(jsRegExpTypeLibraryContract.requiredMembers), true);
  assert.equal(jsRegExpTypeLibraryContract.requiredMembers.length, 34);
  assert.doesNotMatch(jsRegExpSourceProfileDeclarations, /\bcompile\s*\(/u);
  assert.doesNotMatch(jsRegExpSourceProfileDeclarations, /["']\$[1-9]["']\s*:/u);
  assert.doesNotMatch(jsRegExpSourceProfileDeclarations, /\b(?:lastMatch|lastParen|leftContext|rightContext)\s*:/u);
});

function checkFiles(files, rootFiles) {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files,
    rootFiles,
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      noLib: true,
      strict: true,
      target: "esnext",
    },
  });
  return session.checkSource().diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.messageText,
  }));
}
