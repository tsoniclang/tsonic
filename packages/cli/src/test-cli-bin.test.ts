import { describe, it } from "mocha";
import { expect } from "chai";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getStableCliPath } from "./test-cli-bin.js";

describe("test-cli-bin", () => {
  it("creates an executable snapshot entrypoint for downstream selftests", () => {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const cliPath = getStableCliPath(repoRoot);
    const mode = statSync(cliPath).mode & 0o777;
    expect(mode & 0o111).to.not.equal(0);
  });
});
