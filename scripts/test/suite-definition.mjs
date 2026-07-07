import { basename, resolve } from "node:path";

export function createParallelSuiteDefinition(repos) {
  return {
    nodeSuites: [
      {
        scope: "tsonic",
        group: "host-cli",
        directory: resolve(repos.tsonic, "test"),
        suffix: ".test.mjs",
        maxDepth: 0,
        intentionallySkipped: new Set(["test/cli-build.test.mjs"]),
      },
      {
        scope: "tsonic",
        group: "host-cli",
        directory: resolve(repos.tsonic, "test/cli"),
        suffix: ".test.mjs",
        maxDepth: 0,
      },
      {
        scope: "tsonic",
        groupForFile: classifyTsonicCliBuildGroup,
        directory: resolve(repos.tsonic, "test/cli-build"),
        suffix: ".test.mjs",
        maxDepth: 0,
      },
      {
        scope: "tsonic-csharp",
        groupForFile: classifyTsonicCsharpGroup,
        directory: resolve(repos.tsonicCsharp, "test"),
        suffix: ".test.mjs",
        maxDepth: 0,
      },
      {
        scope: "csharp-nodejs",
        group: "provider-runtime",
        directory: resolve(repos.csharpNodejs, "test"),
        suffix: ".test.mjs",
        maxDepth: 0,
      },
    ],
    architectureSuites: [
      {
        scope: "tsonic-csharp",
        group: "host-cli",
        directory: resolve(repos.tsonicCsharp, "test/architecture"),
      },
    ],
    dotnetShards: [
      {
        id: "csharp-js:dotnet-test",
        scope: "csharp-js",
        group: "dotnet-toolchain",
        cwd: repos.csharpJs,
        command: "dotnet",
        args: ["test", "Tsonic.CSharp.Js.sln", "--no-build", "--no-restore", "--verbosity", "minimal"],
        projectOrSolution: resolve(repos.csharpJs, "Tsonic.CSharp.Js.sln"),
      },
      {
        id: "csharp-nodejs:dotnet-test",
        scope: "csharp-nodejs",
        group: "dotnet-toolchain",
        exclusive: true,
        cwd: repos.csharpNodejs,
        command: "dotnet",
        args: ["test", "Tsonic.CSharp.Node.slnx", "--no-build", "--no-restore", "--verbosity", "minimal"],
        projectOrSolution: resolve(repos.csharpNodejs, "Tsonic.CSharp.Node.slnx"),
      },
    ],
    aggregateImportContracts: [
      {
        scope: "tsonic",
        aggregateFile: resolve(repos.tsonic, "test/cli-build.test.mjs"),
        directDirectory: resolve(repos.tsonic, "test/cli-build"),
        suffix: ".test.mjs",
      },
    ],
    shouldTitleShard({ staticTestCount, literalTitleCount }) {
      return staticTestCount > 1 && staticTestCount === literalTitleCount;
    },
  };
}

function classifyTsonicCliBuildGroup(file) {
  const name = basename(file);
  if (/provider|source-semantics|js-surface|nodejs|runtime|compat|object|arrays|iteration|type-forms/u.test(name)) {
    return "provider-runtime";
  }
  if (/downstream|toolchain|whole-program|modules|declarations/u.test(name)) {
    return "dotnet-toolchain";
  }
  return "host-cli";
}

function classifyTsonicCsharpGroup(file) {
  const name = basename(file);
  if (/provider|surface|runtime|operator|object|array|regexp|source|semantic|compat|conversion|iteration/u.test(name)) {
    return "provider-runtime";
  }
  if (/backend|project|printer|roslyn|declaration|statement|binding/u.test(name)) {
    return "dotnet-toolchain";
  }
  return "host-cli";
}
