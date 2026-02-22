import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveNugetConfigFile } from "./nuget-config.js";

describe("resolveNugetConfigFile", () => {
  it("uses a project nuget.config when present", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-nuget-config-present-")
    );

    try {
      const cfgPath = join(projectRoot, "nuget.config");
      writeFileSync(cfgPath, "<configuration />\n", "utf-8");

      const result = resolveNugetConfigFile(projectRoot);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(resolve(cfgPath));

      const generatedCfgPath = join(
        projectRoot,
        ".tsonic",
        "nuget",
        "tsonic.nuget.config"
      );
      expect(existsSync(generatedCfgPath)).to.equal(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("accepts NuGet.Config casing variants", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-nuget-config-casing-")
    );

    try {
      const cfgPath = join(projectRoot, "NuGet.Config");
      writeFileSync(cfgPath, "<configuration />\n", "utf-8");

      const result = resolveNugetConfigFile(projectRoot);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(resolve(cfgPath));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("generates a deterministic config when absent", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-nuget-config-generate-")
    );

    try {
      const result = resolveNugetConfigFile(projectRoot);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedPath = join(
        projectRoot,
        ".tsonic",
        "nuget",
        "tsonic.nuget.config"
      );
      expect(resolve(result.value)).to.equal(resolve(expectedPath));
      expect(existsSync(expectedPath)).to.equal(true);

      const cfg = readFileSync(expectedPath, "utf-8");
      expect(cfg).to.include("<clear />");
      expect(cfg).to.include("https://api.nuget.org/v3/index.json");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
