/**
 * Tests for tsonic add nodejs
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNodejsCommand } from "./add-nodejs.js";
import type { Exec } from "./add-common.js";

describe("add nodejs", () => {
  it("should install @tsonic/nodejs (via npm) and copy runtime DLLs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-nodejs-"));
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
        join(dir, "tsonic.json"),
        JSON.stringify({ rootNamespace: "Test", dotnet: { typeRoots: [] } }, null, 2) + "\n",
        "utf-8"
      );

      const calls: Array<{ cmd: string; args: readonly string[] }> = [];
      const exec: Exec = (cmd, args) => {
        calls.push({ cmd, args });
        return { status: 0, stdout: "", stderr: "" };
      };

      const result = addNodejsCommand(join(dir, "tsonic.json"), {}, exec);
      expect(result.ok).to.equal(true);

      expect(calls.length).to.equal(1);
      expect(calls[0]?.cmd).to.equal("npm");
      expect(calls[0]?.args.join(" ")).to.include("@tsonic/nodejs@latest");

      expect(existsSync(join(dir, "lib", "Tsonic.Runtime.dll"))).to.equal(true);
      expect(existsSync(join(dir, "lib", "Tsonic.JSRuntime.dll"))).to.equal(true);
      expect(existsSync(join(dir, "lib", "nodejs.dll"))).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

