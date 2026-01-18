/**
 * Tests for tsonic add js
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addJsCommand } from "./add-js.js";
import type { Exec } from "./add-common.js";

describe("add js", () => {
  it("should install @tsonic/js (via npm) and copy runtime DLLs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-js-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test", version: "0.0.0", type: "module", devDependencies: {} },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: { libraries: [], frameworkReferences: [], packageReferences: [] },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const calls: Array<{ cmd: string; args: readonly string[] }> = [];
      const exec: Exec = (cmd, args, cwd) => {
        calls.push({ cmd, args });
        expect(cwd).to.equal(dir);
        return { status: 0, stdout: "", stderr: "" };
      };

      const result = addJsCommand(join(dir, "tsonic.workspace.json"), {}, exec);
      expect(result.ok).to.equal(true);

      expect(calls.length).to.equal(1);
      expect(calls[0]?.cmd).to.equal("npm");
      expect(calls[0]?.args.join(" ")).to.include("@tsonic/js@latest");

      expect(existsSync(join(dir, "libs", "Tsonic.JSRuntime.dll"))).to.equal(true);

      const updated = JSON.parse(
        readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")
      ) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["libs/Tsonic.JSRuntime.dll"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should be idempotent when @tsonic/js is already installed", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-js-idem-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            version: "0.0.0",
            type: "module",
            devDependencies: { "@tsonic/js": "^0.1.2" },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: { libraries: [], frameworkReferences: [], packageReferences: [] },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const calls: Array<{ cmd: string; args: readonly string[] }> = [];
      const exec: Exec = (cmd, args, cwd) => {
        calls.push({ cmd, args });
        expect(cwd).to.equal(dir);
        return { status: 0, stdout: "", stderr: "" };
      };

      const result = addJsCommand(join(dir, "tsonic.workspace.json"), {}, exec);
      expect(result.ok).to.equal(true);

      expect(calls.length).to.equal(0);
      expect(existsSync(join(dir, "libs", "Tsonic.JSRuntime.dll"))).to.equal(true);

      const updated = JSON.parse(
        readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")
      ) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["libs/Tsonic.JSRuntime.dll"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
