import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLibraryBuild, writeLibraryScaffold } from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);

  it("preserves exported top-level overload signatures in facade and internal surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-top-level-overloads-")
    );

    try {
      const wsConfigPath = writeLibraryScaffold(
        dir,
        "Acme.FunctionOverloads",
        "Acme.FunctionOverloads"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export function parse(text: string): string;",
          "export function parse(text: string, radix: number): string;",
          "export function parse(text: string, radix: number = 10): string {",
          "  return `${text}:${radix}`;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.FunctionOverloads",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      expect(internal).to.include("static parse(text: string): string;");
      expect(internal).to.include(
        "static parse(text: string, radix: number): string;"
      );
      expect(internal).to.not.include("__tsonic_overload_impl_parse");

      const facade = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.FunctionOverloads.d.ts"
        ),
        "utf-8"
      );
      expect(facade).to.include(
        "export declare function parse(text: string): string;"
      );
      expect(facade).to.include(
        "export declare function parse(text: string, radix: number): string;"
      );
      expect(facade).to.not.include("__tsonic_overload_impl_parse");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
