import { resolve } from "node:path";

export const fullTestTrainBanks = Object.freeze([
  { bank: "host", scopes: ["tsonic", "tsonic-csharp", "csharp-nodejs", "csharp-runtime", "csharp-js"] },
  { bank: "node", scopes: ["tsonic-rust"] },
]);

export function selectParallelSuiteDefinition(repos, scopes) {
  const definitions = [createParallelSuiteDefinition(repos), createRustParallelSuiteDefinition(repos)];
  const definition = scopes.size === 0 ? definitions.find(candidate => candidate.default) :
    definitions.find(candidate => [...scopes].every(scope => candidate.scopes.includes(scope)));
  if (definition === undefined) throw new Error("Selected scopes must belong to one canonical bank; run separate banks independently.");
  return definition;
}

export function createParallelSuiteDefinition(repos) {
  const rustTarget = resolve(repos.tsonicCsharp, "../tsonic-rust");
  const rustNodejs = resolve(repos.tsonicCsharp, "../rust-nodejs");
  const hostPreRuns = ["tsonic.build", "tsonic-csharp.build", "csharp-runtime.build", "csharp-js.build",
    "csharp-nodejs.install", "csharp-nodejs.build", "csharp-nodejs.test-build"];
  const targetPreRuns = ["tsonic.build", "tsonic-csharp.build", "tsonic-csharp.native-runtime"];
  const providerPreRuns = [...targetPreRuns, "tsonic-csharp.provider-fixtures"];
  const nativeResources = { heapMiB: 3072 };
  const hostSuite = (group, path, metadata = {}) => nodeSuite(repos.tsonic, "tsonic", group, path,
    { preRunIds: hostPreRuns, ...metadata });
  const targetSuite = (group, path, metadata = {}) => nodeSuite(repos.tsonicCsharp, "tsonic-csharp", group, path,
    { preRunIds: targetPreRuns, resources: nativeResources, ...metadata });
  return {
    bank: "host", default: true, scopes: fullTestTrainBanks[0].scopes,
    preRuns: [
      {
        id: "tsonic.build",
        cwd: repos.tsonic,
        command: "npm",
        args: ["run", "build"],
      },
      {
        id: "tsonic-csharp.build",
        dependsOn: ["tsonic.build"],
        cwd: repos.tsonicCsharp,
        command: "npm",
        args: ["run", "build"],
        env: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
      },
      {
        id: "csharp-runtime.build",
        cwd: repos.csharpRuntime,
        command: "dotnet",
        args: ["build", "Tsonic.CSharp.Runtime.sln", "--verbosity", "minimal"],
      },
      {
        id: "tsonic-csharp.native-runtime",
        dependsOn: ["tsonic-csharp.build"],
        cwd: repos.tsonicCsharp,
        command: "node",
        args: ["scripts/test/build-dotnet-runtime.mjs"],
      },
      {
        id: "csharp-js.build",
        dependsOn: ["csharp-runtime.build"],
        cwd: repos.csharpJs,
        command: "dotnet",
        args: ["build", "Tsonic.CSharp.Js.sln", "--verbosity", "minimal"],
      },
      {
        id: "csharp-nodejs.install",
        cwd: repos.csharpNodejs,
        command: "npm",
        args: ["install", "--ignore-scripts"],
      },
      {
        id: "csharp-nodejs.build",
        dependsOn: ["tsonic.build", "tsonic-csharp.build", "csharp-js.build", "csharp-nodejs.install"],
        cwd: repos.csharpNodejs,
        command: "npm",
        args: ["run", "build"],
        env: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
      },
      {
        id: "csharp-nodejs.test-build",
        dependsOn: ["csharp-nodejs.build"],
        cwd: repos.csharpNodejs,
        command: "dotnet",
        args: ["build", "Tsonic.CSharp.Node.slnx", "--verbosity", "minimal"],
      },
      {
        id: "tsonic-csharp.provider-fixtures",
        dependsOn: ["tsonic-csharp.build"],
        cwd: repos.tsonicCsharp,
        command: "node",
        args: ["scripts/test/build-dotnet-provider-fixtures.mjs"],
      },
      {
        id: "tsonic-rust.install",
        cwd: rustTarget,
        command: "npm",
        args: ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
      },
      {
        id: "tsonic-rust.build",
        dependsOn: ["tsonic.build", "tsonic-rust.install"],
        cwd: rustTarget,
        command: "npm",
        args: ["run", "build"],
      },
      {
        id: "rust-nodejs.install",
        cwd: rustNodejs,
        command: "npm",
        args: ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
      },
      {
        id: "rust-nodejs.build",
        dependsOn: ["tsonic-rust.build", "rust-nodejs.install"],
        cwd: rustNodejs,
        command: "npm",
        args: ["run", "build"],
      },
    ],
    nodeSuites: [
      {
        ...hostSuite("host-architecture", "test/architecture"),
        fileMetadata: {
          "test/architecture/carrier-registry-parity.test.mjs": { preRunIds: [...hostPreRuns, "tsonic-rust.build"] },
          "test/architecture/keel-node-registry.test.mjs": { preRunIds: [...hostPreRuns, "rust-nodejs.build"] },
        },
      },
      hostSuite("host-ledger-inventory", "test/host/capabilities"),
      hostSuite("host-cli-config", "test/host/config"),
      hostSuite("host-cli-config", "test/host/dependencies"),
      hostSuite("host-cli-config", "test/host/publication"),
      hostSuite("host-cli-config", "test/host/cli"),
      hostSuite("host-source-core", "test/source-core"),
      packageUnitSuite(repos.tsonic, "host-source-core", "source-core", hostPreRuns),
      hostSuite("host-js-source-profile", "test/js-source-profile"),
      hostSuite("host-target-api", "test/target-api"),
      packageUnitSuite(repos.tsonic, "host-target-api", "target-api", hostPreRuns),
      hostSuite("host-cli-build-core", "test/cli-build/core"),
      hostSuite("host-cli-build-provider", "test/cli-build/providers"),
      hostSuite("host-cli-build-runtime", "test/cli-build/runtime"),
      hostSuite("host-cli-build-toolchain", "test/cli-build/toolchain"),
      hostSuite("host-test-infrastructure", "test/infrastructure/runner"),
      hostSuite("host-test-infrastructure", "test/fixtures/node-oracle"),
      hostSuite("host-ledger-inventory", "test/infrastructure/historical-inventory"),
      targetSuite("host-architecture", "test/architecture"),
      targetSuite("csharp-source-semantics", "test/helpers"),
      targetSuite("csharp-source-semantics", "test/source"),
      targetSuite("csharp-provider", "test/providers", { preRunIds: providerPreRuns }),
      targetSuite("csharp-source-semantics", "test/policy"),
      targetSuite("csharp-source-semantics", "test/analysis"),
      targetSuite("csharp-source-semantics", "test/target-model"),
      targetSuite("csharp-backend-toolchain", "test/backend"),
      targetSuite("csharp-backend-toolchain", "test/print"),
      targetSuite("csharp-backend-toolchain", "test/toolchain"),
      targetSuite("csharp-provider", "test/integration/provider-selection", { preRunIds: providerPreRuns }),
      {
        ...targetSuite("csharp-backend-toolchain", "test/integration/generated"),
        fileMetadata: Object.fromEntries([
          "direct-translation-source-profile-elements", "js-api-capability-closure", "regexp-complete.part-01", "regexp-complete.part-02",
          "source-profile-contract",
        ].map(name => [`test/integration/generated/${name}.test.mjs`, { group: "csharp-provider", preRunIds: providerPreRuns }])),
      },
      {
        scope: "csharp-nodejs",
        group: "node-provider",
        directory: resolve(repos.csharpNodejs, "nodejs/test"),
        suffix: ".test.mjs",
        resources: nativeResources,
        preRunIds: hostPreRuns,
      },
    ],
    testRoots: [
      { scope: "tsonic", directory: resolve(repos.tsonic, "test") },
      { scope: "tsonic-csharp", directory: resolve(repos.tsonicCsharp, "test") },
      { scope: "csharp-nodejs", directory: resolve(repos.csharpNodejs, "nodejs/test") },
    ],
    architectureSuites: [],
    dotnetSuites: [
      {
        scope: "csharp-runtime",
        group: "runtime-dotnet",
        taskMode: "assembly",
        cwd: repos.csharpRuntime,
        projectOrSolution: resolve(repos.csharpRuntime, "Tsonic.CSharp.Runtime.sln"),
        directory: resolve(repos.csharpRuntime, "tests/Tsonic.CSharp.Runtime.Tests"),
        resources: nativeResources,
        preRunIds: ["csharp-runtime.build"],
      },
      {
        scope: "csharp-js",
        group: "runtime-dotnet",
        taskMode: "assembly",
        cwd: repos.csharpJs,
        projectOrSolution: resolve(repos.csharpJs, "Tsonic.CSharp.Js.sln"),
        directory: resolve(repos.csharpJs, "tests/Tsonic.CSharp.Js.Tests"),
        resources: nativeResources,
        preRunIds: ["csharp-runtime.build", "csharp-js.build"],
      },
      {
        scope: "csharp-nodejs",
        group: "runtime-dotnet",
        taskMode: "directory",
        exclusiveGroups: Object.freeze(["net"]),
        cwd: repos.csharpNodejs,
        projectOrSolution: resolve(repos.csharpNodejs, "Tsonic.CSharp.Node.slnx"),
        directory: resolve(repos.csharpNodejs, "csharp/test/Tsonic.CSharp.Node.Tests"),
        resources: nativeResources,
        preRunIds: hostPreRuns,
      },
    ],
    groupWorkerLimits: Object.freeze({
      "runtime-dotnet": 2,
    }),
  };
}

export function createRustParallelSuiteDefinition(repos) {
  return {
    bank: "node", default: false, scopes: fullTestTrainBanks[1].scopes,
    preRuns: [
      { id: "tsonic-rust.build", cwd: repos.tsonicRust, command: "npm", args: ["run", "build"] },
      {
        id: "tsonic-rust.installed-layout", dependsOn: ["tsonic-rust.build"], cwd: repos.tsonicRust,
        command: process.execPath,
        args: ["--import", resolve(repos.tsonicRust, "scripts/register-tsonic-root-loader.mjs"), "-e",
          "import('./test/helpers/rust-session.mjs').then(session => session.buildInstalledLayout())"],
      },
    ],
    nodeSuites: [{
      ...nodeSuite(repos.tsonicRust, "tsonic-rust", "rust-compiler", "test"),
      preRunIds: ["tsonic-rust.installed-layout"],
      resources: { heapMiB: 3072 },
      nodeArguments: ["--import", resolve(repos.tsonicRust, "scripts/register-tsonic-root-loader.mjs")],
    }],
    testRoots: [{ scope: "tsonic-rust", directory: resolve(repos.tsonicRust, "test") }],
    architectureSuites: [],
    dotnetSuites: [],
    groupWorkerLimits: Object.freeze({}),
  };
}

function packageUnitSuite(repository, group, name, preRunIds) {
  return {
    scope: "tsonic",
    group,
    directory: resolve(repository, "packages", name, "src"),
    compiledDirectory: resolve(repository, "packages", name, "dist"),
    suffix: ".test.ts",
    preRunIds,
  };
}

function nodeSuite(repository, scope, group, path, metadata = {}) {
  return {
    scope,
    group,
    directory: resolve(repository, path),
    suffix: ".test.mjs",
    ...metadata,
  };
}
