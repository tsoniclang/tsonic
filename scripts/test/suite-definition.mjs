import { basename, resolve } from "node:path";

export function createParallelSuiteDefinition(repos) {
  return {
    nodeSuites: [
      {
        scope: "tsonic",
        groupForFile: classifyTsonicRootGroup,
        directory: resolve(repos.tsonic, "test"),
        suffix: ".test.mjs",
        maxDepth: 0,
        intentionallySkipped: new Set(["test/cli-build.test.mjs"]),
      },
      {
        scope: "tsonic",
        group: "host-cli-config",
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
        group: "node-provider",
        directory: resolve(repos.csharpNodejs, "test"),
        suffix: ".test.mjs",
        maxDepth: 0,
      },
    ],
    architectureSuites: [
      {
        scope: "tsonic-csharp",
        group: "host-architecture",
        directory: resolve(repos.tsonicCsharp, "test/architecture"),
      },
    ],
    dotnetSuites: [
      {
        scope: "csharp-js",
        group: "runtime-dotnet",
        cwd: repos.csharpJs,
        projectOrSolution: resolve(repos.csharpJs, "Tsonic.CSharp.Js.sln"),
        directory: resolve(repos.csharpJs, "tests/Tsonic.CSharp.Js.Tests"),
      },
      {
        scope: "csharp-nodejs",
        group: "runtime-dotnet",
        cwd: repos.csharpNodejs,
        projectOrSolution: resolve(repos.csharpNodejs, "Tsonic.CSharp.Node.slnx"),
        directory: resolve(repos.csharpNodejs, "csharp/test/Tsonic.CSharp.Node.Tests"),
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
    groupOrder: [
      "host-architecture",
      "host-ledger-inventory",
      "host-cli-config",
      "host-cli-build-core",
      "host-cli-build-provider",
      "host-cli-build-runtime",
      "host-cli-build-toolchain",
      "csharp-provider",
      "csharp-source-semantics",
      "csharp-js-surface",
      "csharp-backend-toolchain",
      "node-provider",
      "runtime-dotnet",
    ],
  };
}

function classifyTsonicRootGroup(file) {
  const name = basename(file);
  if (/architecture|package-artifact|source-profile/u.test(name)) {
    return "host-architecture";
  }
  if (/capability|old-|inventory|ledger|coverage/u.test(name)) {
    return "host-ledger-inventory";
  }
  if (/async|lazy/u.test(name)) {
    return "host-cli-build-runtime";
  }
  return "host-cli-config";
}

function classifyTsonicCliBuildGroup(file) {
  const name = basename(file);
  if (/provider|source-semantics|type-forms/u.test(name)) {
    return "host-cli-build-provider";
  }
  if (/js-surface|nodejs|runtime|compat|object|arrays|iteration/u.test(name)) {
    return "host-cli-build-runtime";
  }
  if (/downstream|toolchain|whole-program|modules|declarations/u.test(name)) {
    return "host-cli-build-toolchain";
  }
  return "host-cli-build-core";
}

function classifyTsonicCsharpGroup(file) {
  const name = basename(file);
  if (/provider|conversion/u.test(name)) {
    return "csharp-provider";
  }
  if (/surface|runtime|operator|object|array|regexp|source|semantic|compat|iteration/u.test(name)) {
    return "csharp-source-semantics";
  }
  if (/backend|project|printer|roslyn|declaration|statement|binding/u.test(name)) {
    return "csharp-backend-toolchain";
  }
  if (/architecture|abstraction|boundary/u.test(name)) {
    return "host-architecture";
  }
  return "csharp-source-semantics";
}
