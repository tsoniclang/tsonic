import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { compileToCSharp } from "./integration-cases/helpers.js";

const repoRoot = path.resolve(process.cwd(), "../..");
const readFixtureSource = (fixtureName: string): string =>
  fs.readFileSync(
    path.join(
      repoRoot,
      "test",
      "fixtures",
      fixtureName,
      "packages",
      fixtureName,
      "src",
      "index.ts"
    ),
    "utf-8"
  );

describe("End-to-End Integration", () => {
  describe("Fixture regression mirrors", () => {
    it("mirrors js-surface-array-from-map-keys", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-surface-array-from-map-keys"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("var keys = global::js.Array.from(");
      expect(csharp).to.include("counts.keys()");
      expect(csharp).to.include('global::js.ConsoleModule.log(keys.join(","));');
    });

    it("mirrors js-surface-json-unknown-entries", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-surface-json-unknown-entries"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'var root = global::js.JSON.parse<object>("{\\"title\\":\\"hello\\",\\"count\\":2}");'
      );
      expect(csharp).to.include("var entries = global::js.Object.entries(root);");
      expect(csharp).to.include(
        'if (global::Tsonic.Runtime.Operators.@typeof(value) == "number")'
      );
      expect(csharp).to.include(
        'global::js.ConsoleModule.log(key, global::js.Number.toString((double)value));'
      );
      expect(csharp).to.include(
        'global::js.ConsoleModule.log(key, global::js.String.toUpperCase((string)value));'
      );
    });

    it("mirrors js-surface-runtime-builtins", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-surface-runtime-builtins"),
        "/test/test.ts",
        { surface: "@tsonic/js", enableJsonAot: true }
      );

      expect(csharp).to.include(
        'var value = global::js.String.trim("  hello,world  ");'
      );
      expect(csharp).to.include("var now = new global::js.Date();");
      expect(csharp).to.include('var regex = new global::js.RegExp("HELLO");');
      expect(csharp).to.include('var chars = global::js.Array.from("abcd");');
      expect(csharp).to.include("var more = global::js.Array.of(6, 7, 8);");
      expect(csharp).to.include(
        "var joined = new global::js.Array<int>(filtered).join(\",\");"
      );
      expect(csharp).to.include(
        "var joinedDefault = new global::js.Array<int>(filtered).join();"
      );
      expect(csharp).to.include("global::js.Globals.parseInt(\"123\")");
    });

    it("mirrors js-string-array-returns", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-string-array-returns"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'string[] parts = global::System.Linq.Enumerable.ToArray(global::js.String.split(path, "/"));'
      );
      expect(csharp).to.include(
        'string[]? maybeMatch = global::js.String.match(path, "docs");'
      );
      expect(csharp).to.include(
        'string[][] allMatches = global::System.Linq.Enumerable.ToArray(global::js.String.matchAll("a-a", "a"));'
      );
      expect(csharp).to.include(
        'return new global::js.Array<string>(parts).join(",");'
      );
      expect(csharp).to.include(
        "global::js.ConsoleModule.log(takeParts(parts), firstMatch, firstAll, global::js.Number.toString(selected.Length));"
      );
    });

    it("mirrors js-surface-node-boolean-tostring primitive member lowering", () => {
      const source = `
        declare function existsSync(path: string): boolean;
        declare function join(...parts: string[]): string;

        export function main(): void {
          const file = join(import.meta.dirname, "src", "index.ts");
          console.log(existsSync(file).toString());
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        "global::js.Boolean.toString(existsSync(file))"
      );
      expect(csharp).to.not.include("existsSync(file).ToString()");
      expect(csharp).to.not.include("existsSync(file).toString()");
      expect(csharp).to.not.include("import.meta");
    });

    it("mirrors js-surface-node-date-union", () => {
      const source = `
        declare class JsDate {
          toISOString(): string;
        }

        declare function statSync(path: string): { readonly mtime: JsDate };

        export function main(): void {
          const maybeDate: JsDate | undefined = undefined;
          const resolved = maybeDate ?? statSync("tsonic.workspace.json").mtime;
          console.log(resolved.toISOString().length.toString());
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        'var resolved = maybeDate ?? statSync("tsonic.workspace.json").mtime;'
      );
      expect(csharp).to.include(
        "global::js.Number.toString(resolved.toISOString().Length)"
      );
      expect(csharp).to.not.include("(object)resolved");
    });

    it("mirrors import-meta-object", () => {
      const csharp = compileToCSharp(readFixtureSource("import-meta-object"), "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include('url = "file:///test/test.ts"');
      expect(csharp).to.include('filename = "/test/test.ts"');
      expect(csharp).to.include('dirname = "/test"');
      expect(csharp).to.not.include("import.meta");
    });

    it("mirrors object-literal-method-accessor-js", () => {
      const csharp = compileToCSharp(
        readFixtureSource("object-literal-method-accessor-js"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("__tmp.inc = () =>");
      expect(csharp).to.include("__tmp.x += 1;");
      expect(csharp).to.include("counter.value");
      expect(csharp).to.include("counter.inc()");
      expect(csharp).to.include("global::js.Number.toString(counter.value)");
    });

    it("mirrors readonly-array-property-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("readonly-array-property-mutation")
      );

      expect(csharp).to.include("private string[] items { get; set; }");
      expect(csharp).to.include("this.items.push(value);");
      expect(csharp).to.include('return this.items.join("-");');
    });

    it("mirrors module-const-array-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("module-const-array-mutation")
      );

      expect(csharp).to.include(
        "internal static string[] parts = global::System.Array.Empty<string>();"
      );
      expect(csharp).to.include("parts.push(value);");
      expect(csharp).to.include('global::System.Console.WriteLine(parts.join("-"));');
    });

    it("mirrors native-array-push-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("native-array-push-mutation")
      );

      expect(csharp).to.include(
        "string[] parts = global::System.Array.Empty<string>();"
      );
      expect(csharp).to.include('parts.push("hello");');
      expect(csharp).to.include('parts.push("world");');
      expect(csharp).to.include('global::System.Console.WriteLine(parts.join("-"));');
    });

    it("mirrors json-native-inline-stringify", () => {
      const csharp = compileToCSharp(
        readFixtureSource("json-native-inline-stringify"),
        "/test/test.ts",
        { surface: "@tsonic/js", enableJsonAot: true }
      );

      expect(csharp).to.include(
        'global::System.Text.Json.JsonSerializer.Serialize(new global::System.Collections.Generic.Dictionary<string, object?> { ["ok"] = true, ["value"] = (object)(double)3 },'
      );
      expect(csharp).to.not.include("JSON.stringify(");
    });

    it("mirrors json-native-roundtrip", () => {
      const csharp = compileToCSharp(
        readFixtureSource("json-native-roundtrip"),
        "/test/test.ts",
        { enableJsonAot: true }
      );

      expect(csharp).to.include("var parsed = JSON.parse<Payload__Alias>(json);");
      expect(csharp).to.include(
        'var roundtrip = JSON.stringify(parsed);'
      );
      expect(csharp).to.include('var parsedNumber = JSON.parse<double>("123");');
      expect(csharp).to.include('var parsedBool = JSON.parse<bool>("true");');
      expect(csharp).to.include("INLINE.stringify=");
      expect(csharp).to.include("ESCAPES=");
    });
  });
});
