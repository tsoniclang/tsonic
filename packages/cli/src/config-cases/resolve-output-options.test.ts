import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveConfig } from "../config.js";
import {
  PROJECT_ROOT,
  WORKSPACE_ROOT,
  makeProjectConfig,
  makeWorkspaceConfig,
} from "./helpers.js";

describe("Config (output and runtime options)", () => {
  it("should default optimize to 'speed'", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({ optimize: undefined }),
      makeProjectConfig({ optimize: undefined }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.optimize).to.equal("speed");
  });

  it("should default stripSymbols to true", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.stripSymbols).to.equal(true);
  });

  it("should use buildOptions.stripSymbols from config", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ buildOptions: { stripSymbols: false } }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.stripSymbols).to.equal(false);
  });

  it("should override stripSymbols with --no-strip CLI option", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ buildOptions: { stripSymbols: true } }),
      { noStrip: true },
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.stripSymbols).to.equal(false);
  });

  it("should default invariantGlobalization to true", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.invariantGlobalization).to.equal(true);
  });

  it("should use buildOptions.invariantGlobalization from config", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({ buildOptions: { invariantGlobalization: false } }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.invariantGlobalization).to.equal(false);
  });

  it("should allow output.invariantGlobalization to override buildOptions", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({
        entryPoint: "src/main.ts",
        buildOptions: { invariantGlobalization: true },
        output: { invariantGlobalization: false },
      }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.invariantGlobalization).to.equal(false);
    expect(result.outputConfig.invariantGlobalization).to.equal(false);
  });

  it("should allow output.stripSymbols to override buildOptions", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({
        entryPoint: "src/main.ts",
        buildOptions: { stripSymbols: true },
        output: { stripSymbols: false },
      }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.stripSymbols).to.equal(false);
    expect(result.outputConfig.stripSymbols).to.equal(false);
  });

  it("should use output.optimization when optimize is not set", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({
        entryPoint: "src/main.ts",
        output: { optimization: "size" },
      }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.optimize).to.equal("size");
    expect(result.outputConfig.optimization).to.equal("size");
  });

  it("should prefer top-level optimize over output.optimization", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({
        entryPoint: "src/main.ts",
        optimize: "speed",
        output: { optimization: "size" },
      }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.optimize).to.equal("speed");
    expect(result.outputConfig.optimization).to.equal("speed");
  });

  it("should resolve console-app output config", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig({
        entryPoint: "src/main.ts",
        output: {
          type: "console-app",
          targetFramework: "net8.0",
          singleFile: false,
          selfContained: false,
        },
      }),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.outputConfig.type).to.equal("console-app");
    expect(result.outputConfig.targetFramework).to.equal("net8.0");
    expect(result.outputConfig.singleFile).to.equal(false);
    expect(result.outputConfig.selfContained).to.equal(false);
  });

  it("should default keepTemp to false", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.keepTemp).to.equal(false);
  });

  it("should set keepTemp from CLI option", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      { keepTemp: true },
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.keepTemp).to.equal(true);
  });

  it("should default verbose to false", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.verbose).to.equal(false);
  });

  it("should set verbose from CLI option", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      { verbose: true },
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.verbose).to.equal(true);
  });

  it("should default quiet to false", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.quiet).to.equal(false);
  });

  it("should set quiet from CLI option", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      { quiet: true },
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.quiet).to.equal(true);
  });

  it("should handle all options together", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        rid: "linux-x64",
        dotnetVersion: "net9.0",
        optimize: "size",
        buildOptions: {
          stripSymbols: false,
          invariantGlobalization: false,
        },
      }),
      makeProjectConfig({
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "out",
        outputName: "program",
        buildOptions: {
          stripSymbols: false,
          invariantGlobalization: false,
        },
      }),
      {
        namespace: "CLI.Override",
        src: "source",
        out: "binary",
        rid: "win-x64",
        optimize: "speed",
        noStrip: true,
        keepTemp: true,
        verbose: true,
        quiet: false,
      },
      WORKSPACE_ROOT,
      PROJECT_ROOT,
      "custom.ts"
    );

    expect(result.rootNamespace).to.equal("CLI.Override");
    expect(result.entryPoint).to.equal("custom.ts");
    expect(result.projectRoot).to.equal(PROJECT_ROOT);
    expect(result.sourceRoot).to.equal("source");
    expect(result.outputDirectory).to.equal("out");
    expect(result.outputName).to.equal("binary");
    expect(result.rid).to.equal("win-x64");
    expect(result.dotnetVersion).to.equal("net9.0");
    expect(result.optimize).to.equal("speed");
    expect(result.stripSymbols).to.equal(false);
    expect(result.invariantGlobalization).to.equal(false);
    expect(result.keepTemp).to.equal(true);
    expect(result.verbose).to.equal(true);
    expect(result.quiet).to.equal(false);
  });
});
