// Mirror of internal/sourcemap/generator_test.go (all TestSourceMapGenerator_*
// functions). Go's assert.DeepEqual compares RawSourceMap by field; rawFields()
// projects the port's RawSourceMap (dropping the JsonFieldNames symbol) for the
// same comparison. Go nil slices/pointers map to undefined.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import type { Generator, RawSourceMap } from "./generator.js";
import {
  Generator_AddGeneratedMapping,
  Generator_AddName,
  Generator_AddNamedSourceMapping,
  Generator_AddSource,
  Generator_AddSourceMapping,
  Generator_RawSourceMap,
  Generator_SetSourceContent,
  Generator_String,
  NewGenerator,
} from "./generator.js";

interface rawFields {
  Version: number;
  File: string;
  SourceRoot: string;
  Sources: GoSlice<string>;
  Mappings: string;
  Names: GoSlice<string>;
  SourcesContent: GoSlice<GoPtr<string>> | undefined;
}

function rawFields(m: GoPtr<RawSourceMap>): rawFields {
  return {
    Version: m!.Version,
    File: m!.File,
    SourceRoot: m!.SourceRoot,
    Sources: m!.Sources,
    Mappings: m!.Mappings,
    Names: m!.Names,
    SourcesContent: m!.SourcesContent,
  };
}

function newGen(): GoPtr<Generator> {
  // Go: tspath.ComparePathsOptions{} — zero values.
  return NewGenerator("main.js", "/", "/", { UseCaseSensitiveFileNames: false, CurrentDirectory: "" } as ComparePathsOptions);
}

function assertNilError(err: GoError): void {
  assert.equal(err, undefined);
}

function assertError(err: GoError, message: string): void {
  assert.ok(err !== undefined, `expected error ${JSON.stringify(message)}`);
  assert.equal(err!.message, message);
}

test("SourceMapGenerator_Empty", () => {
  const gen = newGen();
  assert.deepEqual(rawFields(Generator_RawSourceMap(gen)), {
    Version: 3,
    File: "main.js",
    SourceRoot: "/",
    Sources: [],
    Mappings: "",
    Names: [],
    SourcesContent: undefined,
  });
});

test("SourceMapGenerator_Empty_Serialized", () => {
  const gen = newGen();
  assert.equal(Generator_String(gen), '{"version":3,"file":"main.js","sourceRoot":"/","sources":[],"names":[],"mappings":""}');
});

test("SourceMapGenerator_AddSource", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assert.equal(sourceIndex, 0);
  assert.deepEqual(rawFields(Generator_RawSourceMap(gen)), {
    Version: 3,
    File: "main.js",
    SourceRoot: "/",
    Sources: ["main.ts"],
    Mappings: "",
    Names: [],
    SourcesContent: undefined,
  });
});

test("SourceMapGenerator_SetSourceContent", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_SetSourceContent(gen, sourceIndex, "foo"));
  assert.equal(sourceIndex, 0);
  assert.deepEqual(rawFields(Generator_RawSourceMap(gen)), {
    Version: 3,
    File: "main.js",
    SourceRoot: "/",
    Sources: ["main.ts"],
    Mappings: "",
    Names: [],
    SourcesContent: ["foo"],
  });
});

test("SourceMapGenerator_SetSourceContent_ForSecondSourceOnly", () => {
  const gen = newGen();
  Generator_AddSource(gen, "/skipped.ts");
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_SetSourceContent(gen, sourceIndex, "foo"));
  assert.equal(sourceIndex, 1);
  assert.deepEqual(rawFields(Generator_RawSourceMap(gen)), {
    Version: 3,
    File: "main.js",
    SourceRoot: "/",
    Sources: ["skipped.ts", "main.ts"],
    Mappings: "",
    Names: [],
    SourcesContent: [undefined, "foo"],
  });
});

test("SourceMapGenerator_SetSourceContent_SourceIndexOutOfRange", () => {
  const gen = newGen();
  assertError(Generator_SetSourceContent(gen, -1, ""), "sourceIndex is out of range");
  assertError(Generator_SetSourceContent(gen, 0, ""), "sourceIndex is out of range");
});

test("SourceMapGenerator_SetSourceContent_ForSecondSourceOnly_Serialized", () => {
  const gen = newGen();
  Generator_AddSource(gen, "/skipped.ts");
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_SetSourceContent(gen, sourceIndex, "foo"));
  assert.equal(
    Generator_String(gen),
    '{"version":3,"file":"main.js","sourceRoot":"/","sources":["skipped.ts","main.ts"],"names":[],"mappings":"","sourcesContent":[null,"foo"]}',
  );
});

test("SourceMapGenerator_AddName", () => {
  const gen = newGen();
  const nameIndex = Generator_AddName(gen, "foo");
  assert.equal(nameIndex, 0);
  assert.deepEqual(rawFields(Generator_RawSourceMap(gen)), {
    Version: 3,
    File: "main.js",
    SourceRoot: "/",
    Sources: [],
    Mappings: "",
    Names: ["foo"],
    SourcesContent: undefined,
  });
});

test("SourceMapGenerator_AddGeneratedMapping", () => {
  const gen = newGen();
  assertNilError(Generator_AddGeneratedMapping(gen, 0, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "A");
});

test("SourceMapGenerator_AddGeneratedMapping_OnSecondLineOnly", () => {
  const gen = newGen();
  assertNilError(Generator_AddGeneratedMapping(gen, 1, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, ";A");
});

test("SourceMapGenerator_AddSourceMapping", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "AAAA");
});

test("SourceMapGenerator_AddSourceMapping_NextGeneratedCharacter", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0));
  assertNilError(Generator_AddSourceMapping(gen, 0, 1, sourceIndex, 0, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "AAAA,CAAA");
});

test("SourceMapGenerator_AddSourceMapping_NextGeneratedAndSourceCharacter", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0));
  assertNilError(Generator_AddSourceMapping(gen, 0, 1, sourceIndex, 0, 1));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "AAAA,CAAC");
});

test("SourceMapGenerator_AddSourceMapping_NextGeneratedLine", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0));
  assertNilError(Generator_AddSourceMapping(gen, 1, 0, sourceIndex, 0, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "AAAA;AAAA");
});

test("SourceMapGenerator_AddSourceMapping_PreviousSourceCharacter", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 1));
  assertNilError(Generator_AddSourceMapping(gen, 0, 1, sourceIndex, 0, 0));
  assert.equal(rawFields(Generator_RawSourceMap(gen)).Mappings, "AAAC,CAAD");
});

test("SourceMapGenerator_AddNamedSourceMapping", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  const nameIndex = Generator_AddName(gen, "foo");
  assertNilError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, nameIndex));
  const m = rawFields(Generator_RawSourceMap(gen));
  assert.equal(m.Mappings, "AAAAA");
  assert.deepEqual(m.Names, ["foo"]);
});

test("SourceMapGenerator_AddNamedSourceMapping_WithPreviousName", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  const nameIndex1 = Generator_AddName(gen, "foo");
  const nameIndex2 = Generator_AddName(gen, "bar");
  assertNilError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, nameIndex2));
  assertNilError(Generator_AddNamedSourceMapping(gen, 0, 1, sourceIndex, 0, 0, nameIndex1));
  const m = rawFields(Generator_RawSourceMap(gen));
  assert.equal(m.Mappings, "AAAAC,CAAAD");
  assert.deepEqual(m.Names, ["foo", "bar"]);
});

test("SourceMapGenerator_AddGeneratedMapping_GeneratedLineCannotBacktrack", () => {
  const gen = newGen();
  assertNilError(Generator_AddGeneratedMapping(gen, 1, 0));
  assertError(Generator_AddGeneratedMapping(gen, 0, 0), "generatedLine cannot backtrack");
});

test("SourceMapGenerator_AddGeneratedMapping_GeneratedCharacterCannotBeNegative", () => {
  const gen = newGen();
  assertNilError(Generator_AddGeneratedMapping(gen, 0, 0));
  assertError(Generator_AddGeneratedMapping(gen, 0, -1), "generatedCharacter cannot be negative");
});

test("SourceMapGenerator_AddSourceMapping_GeneratedLineCannotBacktrack", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 1, 0, sourceIndex, 0, 0));
  assertError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0), "generatedLine cannot backtrack");
});

test("SourceMapGenerator_AddSourceMapping_GeneratedCharacterCannotBeNegative", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertNilError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, 0));
  assertError(Generator_AddSourceMapping(gen, 0, -1, sourceIndex, 0, 0), "generatedCharacter cannot be negative");
});

test("SourceMapGenerator_AddSourceMapping_SourceIndexIsOutOfRange", () => {
  const gen = newGen();
  assertError(Generator_AddSourceMapping(gen, 0, 0, -1, 0, 0), "sourceIndex is out of range");
  assertError(Generator_AddSourceMapping(gen, 0, 0, 0, 0, 0), "sourceIndex is out of range");
});

test("SourceMapGenerator_AddSourceMapping_SourceLineCannotBeNegative", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, -1, 0), "sourceLine cannot be negative");
});

test("SourceMapGenerator_AddSourceMapping_SourceCharacterCannotBeNegative", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertError(Generator_AddSourceMapping(gen, 0, 0, sourceIndex, 0, -1), "sourceCharacter cannot be negative");
});

test("SourceMapGenerator_AddNamedSourceMapping_GeneratedLineCannotBacktrack", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  const nameIndex = Generator_AddName(gen, "foo");
  assertNilError(Generator_AddNamedSourceMapping(gen, 1, 0, sourceIndex, 0, 0, nameIndex));
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, nameIndex), "generatedLine cannot backtrack");
});

test("SourceMapGenerator_AddNamedSourceMapping_GeneratedCharacterCannotBeNegative", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  const nameIndex = Generator_AddName(gen, "foo");
  assertNilError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, nameIndex));
  assertError(Generator_AddNamedSourceMapping(gen, 0, -1, sourceIndex, 0, 0, nameIndex), "generatedCharacter cannot be negative");
});

test("SourceMapGenerator_AddNamedSourceMapping_SourceIndexIsOutOfRange", () => {
  const gen = newGen();
  const nameIndex = Generator_AddName(gen, "foo");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, -1, 0, 0, nameIndex), "sourceIndex is out of range");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, 0, 0, 0, nameIndex), "sourceIndex is out of range");
});

test("SourceMapGenerator_AddNamedSourceMapping_SourceLineCannotBeNegative", () => {
  const gen = newGen();
  const nameIndex = Generator_AddName(gen, "foo");
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, -1, 0, nameIndex), "sourceLine cannot be negative");
});

test("SourceMapGenerator_AddNamedSourceMapping_SourceCharacterCannotBeNegative", () => {
  const gen = newGen();
  const nameIndex = Generator_AddName(gen, "foo");
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, -1, nameIndex), "sourceCharacter cannot be negative");
});

test("SourceMapGenerator_AddNamedSourceMapping_NameIndexIsOutOfRange", () => {
  const gen = newGen();
  const sourceIndex = Generator_AddSource(gen, "/main.ts");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, -1), "nameIndex is out of range");
  assertError(Generator_AddNamedSourceMapping(gen, 0, 0, sourceIndex, 0, 0, 0), "nameIndex is out of range");
});
