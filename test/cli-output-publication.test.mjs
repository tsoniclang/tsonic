import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import {
  publishBuildOutput,
  recoverBuildOutput,
} from "../packages/cli/dist/src/output-publication.js";

const repoRoot = process.cwd();
const testRoot = resolve(repoRoot, ".temp/test-runs/cli-output-publication", `${Date.now()}-${process.pid}`);

test("output publication atomically replaces the complete configured target set", async () => {
  const projectDirectory = resolve(testRoot, "complete-set");
  const outputRoot = resolve(projectDirectory, "out");
  await writeFiles(projectDirectory, {
    "out/csharp/src/Stale.cs": "stale\n",
    "out/retired/Retired.txt": "retired\n",
    "user-owned.txt": "preserve\n",
  });

  await publishBuildOutput({
    outputRoot,
    protectedPaths: [projectDirectory],
    expectedTargetIds: ["csharp", "demo"],
    targets: [
      {
        targetId: "csharp",
        artifacts: [artifact("src/Index.cs", "current csharp\n")],
      },
      {
        targetId: "demo",
        artifacts: [artifact("src/index.txt", "current demo\n")],
      },
    ],
  });

  assert.equal(await readFile(resolve(outputRoot, "csharp/src/Index.cs"), "utf8"), "current csharp\n");
  assert.equal(await readFile(resolve(outputRoot, "demo/src/index.txt"), "utf8"), "current demo\n");
  assert.deepEqual((await readdir(outputRoot)).sort(), ["csharp", "demo"]);
  assert.equal(await readFile(resolve(projectDirectory, "user-owned.txt"), "utf8"), "preserve\n");
  assert.deepEqual(await outputScratchEntries(projectDirectory, outputRoot), []);
});

test("output publication rejects incomplete and unsafe artifact sets before touching prior output", async () => {
  const cases = [
    {
      name: "missing target",
      expectedTargetIds: ["csharp", "demo"],
      targets: [{ targetId: "csharp", artifacts: [artifact("Index.cs", "new\n")] }],
      message: /Missing: demo/u,
    },
    {
      name: "escaping artifact",
      expectedTargetIds: ["csharp"],
      targets: [{ targetId: "csharp", artifacts: [artifact("../escape.cs", "new\n")] }],
      message: /resolves outside/u,
    },
    {
      name: "absolute artifact",
      expectedTargetIds: ["csharp"],
      targets: [{ targetId: "csharp", artifacts: [artifact(resolve(testRoot, "escape.cs"), "new\n")] }],
      message: /must be project-relative/u,
    },
    {
      name: "normalized duplicate",
      expectedTargetIds: ["csharp"],
      targets: [{
        targetId: "csharp",
        artifacts: [artifact("src/../Index.cs", "first\n"), artifact("Index.cs", "second\n")],
      }],
      message: /duplicate artifact path 'Index\.cs'/u,
    },
    {
      name: "file-directory collision",
      expectedTargetIds: ["csharp"],
      targets: [{
        targetId: "csharp",
        artifacts: [artifact("src", "file\n"), artifact("src/Index.cs", "nested\n")],
      }],
      message: /conflicts with file artifact 'src'/u,
    },
  ];

  for (const testCase of cases) {
    const projectDirectory = resolve(testRoot, "invalid", testCase.name.replaceAll(" ", "-"));
    const outputRoot = resolve(projectDirectory, "out");
    await writeFiles(projectDirectory, { "out/csharp/Previous.txt": "previous\n" });
    await assert.rejects(
      publishBuildOutput({
        outputRoot,
        protectedPaths: [projectDirectory],
        expectedTargetIds: testCase.expectedTargetIds,
        targets: testCase.targets,
      }),
      testCase.message,
      testCase.name,
    );
    assert.equal(await readFile(resolve(outputRoot, "csharp/Previous.txt"), "utf8"), "previous\n");
    assert.equal(existsSync(resolve(testRoot, "escape.cs")), false);
  }
});

test("output recovery restores the prior tree after a crash before publication", async () => {
  const projectDirectory = resolve(testRoot, "recover-prior");
  const outputRoot = resolve(projectDirectory, "out");
  const scratch = outputScratchPaths(projectDirectory, outputRoot);
  await writeFiles(projectDirectory, {
    "out/csharp/Previous.txt": "previous\n",
    [`${scratch.stageName}-crashed/csharp/Partial.txt`]: "partial\n",
  });
  await rename(outputRoot, scratch.backup);

  await recoverBuildOutput({ outputRoot, protectedPaths: [projectDirectory] });

  assert.equal(await readFile(resolve(outputRoot, "csharp/Previous.txt"), "utf8"), "previous\n");
  assert.equal(existsSync(resolve(projectDirectory, `${scratch.stageName}-crashed`)), false);
  assert.equal(existsSync(scratch.backup), false);
});

test("output recovery retains a complete published tree and removes its obsolete backup", async () => {
  const projectDirectory = resolve(testRoot, "recover-published");
  const outputRoot = resolve(projectDirectory, "out");
  const scratch = outputScratchPaths(projectDirectory, outputRoot);
  await writeFiles(projectDirectory, {
    "out/csharp/Current.txt": "current\n",
    [`${scratch.backupName}/csharp/Previous.txt`]: "previous\n",
  });

  await recoverBuildOutput({ outputRoot, protectedPaths: [projectDirectory] });

  assert.equal(await readFile(resolve(outputRoot, "csharp/Current.txt"), "utf8"), "current\n");
  assert.equal(existsSync(scratch.backup), false);
});

test("output publication automatically reclaims a dead process lock", async () => {
  const projectDirectory = resolve(testRoot, "dead-lock");
  const outputRoot = resolve(projectDirectory, "out");
  const scratch = outputScratchPaths(projectDirectory, outputRoot);
  await writeFiles(projectDirectory, {
    "out/csharp/Previous.txt": "previous\n",
    [`${scratch.lockName}/owner.json`]: `${JSON.stringify({
      token: "dead-owner",
      pid: 2_147_483_647,
      createdAt: Date.now(),
    })}\n`,
  });

  await publishBuildOutput({
    outputRoot,
    protectedPaths: [projectDirectory],
    expectedTargetIds: ["csharp"],
    targets: [{ targetId: "csharp", artifacts: [artifact("Current.txt", "current\n")] }],
  });

  assert.equal(await readFile(resolve(outputRoot, "csharp/Current.txt"), "utf8"), "current\n");
  assert.deepEqual(await outputScratchEntries(projectDirectory, outputRoot), []);
});

test("output publication fails closed while a live process owns the output lock", async () => {
  const projectDirectory = resolve(testRoot, "live-lock");
  const outputRoot = resolve(projectDirectory, "out");
  const scratch = outputScratchPaths(projectDirectory, outputRoot);
  await writeFiles(projectDirectory, {
    "out/csharp/Previous.txt": "previous\n",
    [`${scratch.lockName}/owner.json`]: `${JSON.stringify({
      token: "live-owner",
      pid: process.pid,
      createdAt: Date.now(),
    })}\n`,
  });

  await assert.rejects(
    publishBuildOutput({
      outputRoot,
      protectedPaths: [projectDirectory],
      expectedTargetIds: ["csharp"],
      targets: [{ targetId: "csharp", artifacts: [artifact("Current.txt", "current\n")] }],
    }),
    /Another Tsonic process is publishing target output/u,
  );
  assert.equal(await readFile(resolve(outputRoot, "csharp/Previous.txt"), "utf8"), "previous\n");
  assert.equal(existsSync(resolve(outputRoot, "csharp/Current.txt")), false);
});

function artifact(path, text) {
  return { kind: "source", path, text };
}

async function writeFiles(root, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const path = resolve(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, "utf8");
  }
}

function outputScratchPaths(projectDirectory, outputRoot) {
  const key = createHash("sha256").update(resolve(outputRoot)).digest("hex").slice(0, 24);
  const prefix = `.tsonic-output-${key}`;
  return {
    backup: resolve(projectDirectory, `${prefix}.backup`),
    backupName: `${prefix}.backup`,
    lockName: `${prefix}.lock`,
    stageName: `${prefix}.stage`,
  };
}

async function outputScratchEntries(projectDirectory, outputRoot) {
  const key = createHash("sha256").update(resolve(outputRoot)).digest("hex").slice(0, 24);
  return (await readdir(projectDirectory)).filter((entry) => entry.startsWith(`.tsonic-output-${key}`));
}
