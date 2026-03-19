import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLibraryBuild, writeLibraryScaffold } from "../test-helpers.js";

describe("library bindings first-party regressions (alias markers)", function () {
  this.timeout(10 * 60 * 1000);
  it("emits canonical binding alias markers for nominal source-binding types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-canonical-alias-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        ["export class Attachment {", '  Id: string = "";', "}", ""].join("\n"),
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
          "Test.Lib",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.include(
        'readonly "__tsonic_binding_alias_Test.Lib.Attachment"?: never;'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits canonical manifest aliases for generic source-binding types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-generic-alias-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export type Result<T> = {",
          "  ok: T;",
          "};",
          "",
          "export class Box<T> {",
          "  value!: T;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const bindings = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic",
            "bindings",
            "Test.Lib",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly clrName?: string;
          readonly alias?: string;
        }>;
      };

      expect(
        bindings.types?.some(
          (type) =>
            type.clrName === "Test.Lib.Result__Alias`1" &&
            type.alias === "Test.Lib.Result__Alias_1"
        )
      ).to.equal(true);
      expect(
        bindings.types?.some(
          (type) =>
            type.clrName === "Test.Lib.Box`1" && type.alias === "Test.Lib.Box_1"
        )
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
