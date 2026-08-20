import {
  assert,
  compileFakeProject,
  createFakeArtifact,
  createFakeTargetPack,
  rejectedTargetStage,
  createFakeSurface,
  createFakeVirtualTargetCapability,
  createTargetRegistry,
  parseTsonicProjectConfig,
  resolve,
  tempRoot,
  test,
  writeProject,
  compileProject,
} from "./surface-composition.helpers.mjs";

test("host owns the complete successful target-session lifecycle", async () => {
  const events = [];
  const pack = createFakeTargetPack(events, {
    traceLifecycle: true,
    compileArtifacts: [createFakeArtifact("source", "src/main.demo", "main")],
  });
  const result = await compileFakeProject("session-lifecycle-success", pack, { id: "demo" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(events, [
    "session:create",
    "session:profile",
    "session:compiler",
    "provider:demo:surfaces=",
    "session:runtime",
    "provider-runtime:demo",
    "session:compile",
    "compile:demo",
    "session:close",
    "toolchain:demo:artifacts=src/main.demo",
  ]);
});

test("source and runtime rejection close the session before later phases", async () => {
  const sourceEvents = [];
  const sourcePack = createFakeTargetPack(sourceEvents, { traceLifecycle: true });
  const sourceResult = await compileFakeProject(
    "session-lifecycle-source-rejection",
    sourcePack,
    { id: "demo" },
    { source: "export const = ;\n" },
  );
  assert.equal(sourceResult.targets[0].compileResult.kind, "rejected");
  assert.deepEqual(sourceEvents, [
    "session:create",
    "session:profile",
    "session:compiler",
    "provider:demo:surfaces=",
    "session:close",
  ]);

  const runtimeEvents = [];
  const shared = createFakeArtifact("asset", "runtime/shared.txt", "shared");
  const runtimePack = createFakeTargetPack(runtimeEvents, {
    traceLifecycle: true,
    providerArtifacts: [shared],
    surfaces: [createFakeSurface("js", { events: runtimeEvents, artifacts: [shared] })],
  });
  const runtimeResult = await compileFakeProject(
    "session-lifecycle-runtime-rejection",
    runtimePack,
    { id: "demo", surfaces: ["js"] },
  );
  assert.equal(runtimeResult.targets[0].compileResult.kind, "rejected");
  assert.equal(runtimeEvents.includes("session:compile"), false);
  assert.equal(runtimeEvents.at(-1), "session:close");
});

test("target rejection and thrown compilation both close without publishing or toolchain", async () => {
  for (const [name, onCompile] of [
    ["rejected", () => rejectedTargetStage([{
        code: "TARGET_PLAN_REJECTED",
        category: "error",
        message: "planning rejected the program",
      }])],
    ["thrown", () => {
      throw new Error("target invariant failed");
    }],
  ]) {
    const events = [];
    const pack = createFakeTargetPack(events, {
      traceLifecycle: true,
      onCompile,
    });
    const result = await compileFakeProject(`session-lifecycle-${name}`, pack, { id: "demo" });
    assert.equal(result.targets[0].compileResult.kind, "rejected");
    assert.equal(events.includes("session:close"), true);
    assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
  }
});

test("close failure prevents toolchain preparation", async () => {
  const events = [];
  const pack = createFakeTargetPack(events, {
    traceLifecycle: true,
    closeError: new Error("close failed"),
  });
  const result = await compileFakeProject("session-lifecycle-close-failure", pack, { id: "demo" });

  assert.equal(result.targets[0].compileResult.kind, "rejected");
  assert.equal(result.diagnostics.at(-1).code, "TARGET_SESSION_CLOSE");
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});

test("each target gets one session and each capability target payload is captured once", async () => {
  const events = [];
  const capability = createFakeVirtualTargetCapability("owned", {
    events,
    moduleOwnership: [{ specifierPrefix: "@owned/native/" }],
    targetContributions: [{ kind: "fixture-relation" }],
  });
  let observedContributionCount = 0;
  const first = createFakeTargetPack(events, {
    id: "demo-a",
    traceLifecycle: true,
  });
  const second = createFakeTargetPack(events, {
    id: "demo-b",
    traceLifecycle: true,
  });
  const capabilityForTarget = (targetId) => ({
    ...capability,
    targetId,
    createTargetContributions(context) {
      const contributions = capability.createTargetContributions(context);
      observedContributionCount += 1;
      return contributions;
    },
  });
  const projectDirectory = resolve(tempRoot, "session-lifecycle-cardinality");
  const config = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo-a" }, { id: "demo-b" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(config, null, 2),
    "src/index.ts": "import { named } from \"@owned/native/value.js\";\nexport const value = named;\n",
  });
  const result = compileProject({
    project: parseTsonicProjectConfig(config),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createTargetRegistry([first, second]),
    installedCapabilities: [
      capabilityForTarget("demo-a"),
      capabilityForTarget("demo-b"),
    ],
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(events.filter((event) => event === "session:create").length, 2);
  assert.equal(events.filter((event) => event === "session:close").length, 2);
  assert.equal(observedContributionCount, 2);
});
