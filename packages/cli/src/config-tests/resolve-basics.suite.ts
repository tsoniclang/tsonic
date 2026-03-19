import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveConfig } from "../config.js";
import type { CliOptions } from "../types.js";
import {
  PROJECT_ROOT,
  WORKSPACE_ROOT,
  makeProjectConfig,
  makeWorkspaceConfig,
} from "./helpers.js";

describe("Config (resolve basics)", () => {
  it("should use config values as defaults", () => {
    const workspaceConfig = makeWorkspaceConfig({
      rid: "linux-x64",
      dotnetVersion: "net10.0",
      optimize: "speed",
    });
    const projectConfig = makeProjectConfig({
      entryPoint: "src/main.ts",
      sourceRoot: "src",
      outputDirectory: "dist",
      outputName: "myapp",
      optimize: "speed",
    });

    const result = resolveConfig(
      workspaceConfig,
      projectConfig,
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.rootNamespace).to.equal("MyApp");
    expect(result.entryPoint).to.equal("src/main.ts");
    expect(result.workspaceRoot).to.equal(WORKSPACE_ROOT);
    expect(result.projectRoot).to.equal(PROJECT_ROOT);
    expect(result.sourceRoot).to.equal("src");
    expect(result.outputDirectory).to.equal("dist");
    expect(result.outputName).to.equal("myapp");
    expect(result.rid).to.equal("linux-x64");
    expect(result.dotnetVersion).to.equal("net10.0");
    expect(result.optimize).to.equal("speed");
  });

  it("should override config with CLI options", () => {
    const cliOptions: CliOptions = {
      namespace: "OverriddenApp",
      out: "custom",
      src: "source",
      optimize: "size",
    };

    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ outputName: "myapp" }),
      cliOptions,
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.rootNamespace).to.equal("OverriddenApp");
    expect(result.outputName).to.equal("custom");
    expect(result.sourceRoot).to.equal("source");
    expect(result.optimize).to.equal("size");
  });

  it("should default frameworkReferences and packageReferences to empty arrays", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.frameworkReferences).to.deep.equal([]);
    expect(result.packageReferences).to.deep.equal([]);
  });

  it("should preserve frameworkReferences and packageReferences from workspace.dotnet", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        dotnet: {
          frameworkReferences: [
            "Microsoft.AspNetCore.App",
            { id: "Foo.Bar", types: "@foo/bar-types" },
          ],
          packageReferences: [
            {
              id: "Microsoft.EntityFrameworkCore",
              version: "10.0.1",
              types: "@tsonic/efcore",
            },
          ],
        },
      }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.frameworkReferences).to.deep.equal([
      "Microsoft.AspNetCore.App",
      "Foo.Bar",
    ]);
    expect(result.packageReferences).to.deep.equal([
      { id: "Microsoft.EntityFrameworkCore", version: "10.0.1" },
    ]);
  });

  it("should use entry file parameter over config", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ entryPoint: "src/main.ts" }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT,
      "custom/entry.ts"
    );
    expect(result.entryPoint).to.equal("custom/entry.ts");
  });

  it("should leave entryPoint as undefined when not specified", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ entryPoint: undefined }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.entryPoint).to.equal(undefined);
  });

  it("should default sourceRoot to dirname of entryPoint", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ entryPoint: "app/index.ts" }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.sourceRoot).to.equal("app");
  });

  it("should default outputDirectory to 'generated'", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.outputDirectory).to.equal("generated");
  });

  it("should default outputName to 'app'", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.outputName).to.equal("app");
  });

  it("should use dotnetVersion from workspace", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({ dotnetVersion: "net9.0" }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.dotnetVersion).to.equal("net9.0");
  });

  it("should merge workspace dotnet.libraries with CLI --lib", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        dotnet: { libraries: ["libs/A.dll", "libs/B.dll"] },
      }),
      makeProjectConfig(),
      { lib: ["libs/C.dll"] },
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.libraries).to.deep.equal([
      "libs/A.dll",
      "libs/B.dll",
      "libs/C.dll",
    ]);
  });

  it("should flatten dotnet.libraries object entries to paths", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        dotnet: {
          libraries: [
            { path: "libs/A.dll", types: "@acme/a-types" },
            "libs/B.dll",
          ],
        },
      }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.libraries).to.deep.equal(["libs/A.dll", "libs/B.dll"]);
  });
});
