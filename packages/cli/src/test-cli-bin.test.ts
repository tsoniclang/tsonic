import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getStableCliPath } from "./test-cli-bin.js";

describe("test-cli-bin", () => {
  it("creates an executable snapshot entrypoint for downstream selftests", () => {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const cliPath = getStableCliPath(repoRoot);
    const mode = statSync(cliPath).mode & 0o777;
    const entrypoint = readFileSync(cliPath, "utf-8");
    expect(mode & 0o111).to.not.equal(0);
    expect(entrypoint).to.include("process.env.TSONIC_REPO_ROOT ??=");
    expect(entrypoint).to.include('await import("./dist/index.js");');
  });
});
