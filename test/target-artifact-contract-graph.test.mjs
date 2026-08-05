import assert from "node:assert/strict";
import test from "node:test";

import {
  createTargetArtifactContractGraph,
  reconstructTargetArtifacts,
} from "../packages/target-api/dist/index.js";

const signature = "callable-signature";
const implementation = "implementation";

function contract(...facets) {
  return {
    facets: facets.map(([facet, value]) => ({ facet, value })),
  };
}

function dependency(owner, facet) {
  return { owner, facet };
}

function publish(graph, owner, value, dependencies, artifact = { owner }) {
  return graph.commit(owner, value, dependencies, artifact);
}

test("target artifact contracts reconstruct transitive public dependents", () => {
  const graph = createTargetArtifactContractGraph();

  assert.equal(publish(graph, "function:callee", contract(
    [signature, "void callee(Action[] actions)"],
    [implementation, "body-v1"],
  ), []).kind, "accepted");
  assert.equal(publish(graph, "function:caller", contract(
    [signature, "void caller()"],
    [implementation, "callee(actions)"],
  ), [dependency("function:callee", signature)]).kind, "accepted");
  assert.equal(publish(graph, "function:entry", contract(
    [signature, "void main()"],
    [implementation, "caller()"],
  ), [dependency("function:caller", signature)]).kind, "accepted");
  assert.equal(graph.hasPending(), false);

  const calleeRevision = publish(graph, "function:callee", contract(
    [signature, "void callee(params Action[] actions)"],
    [implementation, "body-v1"],
  ), []);
  assert.deepEqual(calleeRevision, {
    kind: "accepted",
    changedFacets: [signature],
    contractChanged: true,
    dependenciesChanged: false,
  });
  assert.equal(graph.nextDirty(), "function:caller");

  const callerRevision = publish(graph, "function:caller", contract(
    [signature, "void caller(int count)"],
    [implementation, "callee(first, second)"],
  ), [dependency("function:callee", signature)]);
  assert.deepEqual(callerRevision, {
    kind: "accepted",
    changedFacets: [signature, implementation],
    contractChanged: true,
    dependenciesChanged: false,
  });
  assert.equal(graph.nextDirty(), "function:entry");

  assert.equal(publish(graph, "function:entry", contract(
    [signature, "void main()"],
    [implementation, "caller(2)"],
  ), [dependency("function:caller", signature)]).kind, "accepted");
  assert.equal(graph.nextDirty(), undefined);
  assert.deepEqual(graph.verifyClosure(), { kind: "closed" });
  assert.equal(graph.facetRevision("function:callee", signature), 2);
  assert.equal(graph.facetRevision("function:caller", signature), 2);
});

test("target artifact contracts invalidate only consumers of changed facets", () => {
  const graph = createTargetArtifactContractGraph();
  publish(graph, "function:callee", contract(
    [signature, "void callee()"],
    [implementation, "body-v1"],
  ), []);
  publish(graph, "function:caller", contract(
    [implementation, "callee()"],
  ), [dependency("function:callee", signature)]);

  const changed = publish(graph, "function:callee", contract(
    [signature, "void callee()"],
    [implementation, "body-v2"],
  ), []);
  assert.deepEqual(changed, {
    kind: "accepted",
    changedFacets: [implementation],
    contractChanged: true,
    dependenciesChanged: false,
  });
  assert.equal(graph.nextDirty(), undefined);
});

test("target artifact contracts retain the latest artifact when its public contract is unchanged", () => {
  const graph = createTargetArtifactContractGraph();
  publish(graph, "function:value", contract([signature, "void value()"]), [], {
    body: "v1",
  });
  const revision = graph.revision;

  const updated = publish(
    graph,
    "function:value",
    contract([signature, "void value()"]),
    [],
    { body: "v2" },
  );

  assert.deepEqual(updated, {
    kind: "accepted",
    changedFacets: [],
    contractChanged: false,
    dependenciesChanged: false,
  });
  assert.equal(graph.revision, revision);
  assert.deepEqual(graph.artifact("function:value"), { body: "v2" });
  assert.equal(graph.hasPending(), false);
});

test("target artifact contracts reject oscillation without changing committed state", () => {
  const graph = createTargetArtifactContractGraph();
  publish(graph, "function:value", contract([signature, "v1"]), [], {
    owner: "function:value",
    version: 1,
  });
  publish(graph, "function:value", contract([signature, "v2"]), [], {
    owner: "function:value",
    version: 2,
  });
  const revision = graph.revision;

  assert.deepEqual(publish(graph,
    "function:value",
    contract([signature, "v1"]),
    [],
    { owner: "function:value", version: 1 },
  ), {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_OSCILLATION",
    reason:
      "Target artifact 'function:value' revisited an earlier observable contract while reconstructing facets callable-signature.",
  });
  assert.equal(graph.revision, revision);
  assert.equal(
    graph.contract("function:value").facets[0].value,
    "v2",
  );
  assert.deepEqual(graph.artifact("function:value"), {
    owner: "function:value",
    version: 2,
  });
});

test("target artifact contracts fail closed for unpublished dependency facets", () => {
  const graph = createTargetArtifactContractGraph();
  publish(graph, "function:caller", contract([implementation, "callee()"]), [
    dependency("function:callee", signature),
  ]);

  assert.deepEqual(graph.verifyClosure(), {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_OPEN",
    reason:
      "Target artifact 'function:caller' depends on unpublished artifact 'function:callee' facet 'callable-signature'.",
  });
  publish(graph, "function:callee", contract([implementation, "body"]), []);
  assert.deepEqual(graph.verifyClosure(), {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_OPEN",
    reason:
      "Target artifact 'function:caller' depends on absent facet 'callable-signature' of artifact 'function:callee'.",
  });
});

test("target artifact contract budgets reject atomically", () => {
  const graph = createTargetArtifactContractGraph({
    maximumArtifactCount: 1,
    maximumFacetCountPerArtifact: 1,
    maximumDependencyCount: 1,
    maximumContractCodeUnits: 8,
    maximumContractHistoryCodeUnits: 16,
    maximumContractHistoryPerArtifact: 2,
    maximumIdentityCodeUnits: 32,
    maximumFacetValueCodeUnits: 8,
  });
  assert.equal(
    publish(graph, "a", contract(["s", "one"]), []).kind,
    "accepted",
  );
  const revision = graph.revision;
  assert.deepEqual(publish(graph, "b", contract(["s", "two"]), []), {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED",
    reason: "Target artifact contracts exceed their finite 1-artifact budget.",
  });
  assert.equal(graph.revision, revision);
  assert.equal(graph.artifactCount, 1);
});

test("target artifact scheduling bounds unpublished owners exactly", () => {
  const graph = createTargetArtifactContractGraph({
    maximumArtifactCount: 1,
  });
  assert.equal(graph.markDirty("first").kind, "accepted");
  const rejected = graph.markDirty("second");
  assert.equal(rejected.kind, "rejected");
  assert.equal(rejected.code, "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED");
  graph.discardDirty("first");
  assert.equal(graph.markDirty("second").kind, "accepted");
});

test("target artifact contract batches publish all changes atomically", () => {
  const graph = createTargetArtifactContractGraph({
    maximumArtifactCount: 2,
  });
  publish(graph, "existing", contract([signature, "v1"]), [], {
    owner: "existing",
    version: 1,
  });
  const revision = graph.revision;

  const rejected = graph.commitBatch([
    {
      owner: "first",
      contract: contract([signature, "first"]),
      dependencies: [],
      artifact: { owner: "first" },
    },
    {
      owner: "second",
      contract: contract([signature, "second"]),
      dependencies: [],
      artifact: { owner: "second" },
    },
  ]);

  assert.equal(rejected.kind, "rejected");
  assert.equal(rejected.code, "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED");
  assert.equal(graph.revision, revision);
  assert.equal(graph.artifactCount, 1);
  assert.equal(graph.contract("first"), undefined);
  assert.equal(graph.contract("second"), undefined);
  assert.equal(graph.artifact("first"), undefined);
  assert.deepEqual(graph.artifact("existing"), {
    owner: "existing",
    version: 1,
  });
});

test("target artifact contract batches rebuild internal dependents together", () => {
  const graph = createTargetArtifactContractGraph();
  publish(graph, "callee", contract([signature, "void callee()"]), []);
  publish(graph, "caller", contract([signature, "void caller()"]), [
    dependency("callee", signature),
  ]);

  const result = graph.commitBatch([
    {
      owner: "callee",
      contract: contract([signature, "void callee(params Action[] values)"]),
      dependencies: [],
      artifact: { owner: "callee", version: 2 },
    },
    {
      owner: "caller",
      contract: contract([signature, "void caller(int expandedCount)"]),
      dependencies: [dependency("callee", signature)],
      artifact: { owner: "caller", version: 2 },
    },
  ]);

  assert.equal(result.kind, "accepted");
  assert.deepEqual(result.changes.map((change) => change.owner), [
    "callee",
    "caller",
  ]);
  assert.equal(graph.hasPending(), false);
  assert.deepEqual(graph.verifyClosure(), { kind: "closed" });
});

test("target artifact reconstruction propagates public changes to a fixed point", () => {
  const graph = createTargetArtifactContractGraph();
  let restParameter = false;
  const reconstructed = [];
  const reconstruct = (owner, current) => {
    reconstructed.push(owner);
    if (owner === "callee") {
      return {
        kind: "resolved",
        contract: contract([
          signature,
          restParameter
            ? "void callee(params Action[] actions)"
            : "void callee(Action[] actions)",
        ]),
        dependencies: [],
        artifact: { owner, restParameter },
      };
    }
    if (owner === "caller") {
      const calleeSignature = current.contract("callee")?.facets.find(
        (facet) => facet.facet === signature,
      )?.value;
      return {
        kind: "resolved",
        contract: contract([
          signature,
          calleeSignature?.includes("params") === true
            ? "void caller(int expandedCount)"
            : "void caller()",
        ]),
        dependencies: [dependency("callee", signature)],
        artifact: { owner, calleeSignature },
      };
    }
    const callerSignature = current.contract("caller")?.facets.find(
      (facet) => facet.facet === signature,
    )?.value;
    return {
      kind: "resolved",
      contract: contract([
        implementation,
        callerSignature === "void caller(int expandedCount)"
          ? "caller(2)"
          : "caller()",
      ]),
      dependencies: [dependency("caller", signature)],
      artifact: { owner, callerSignature },
    };
  };

  assert.deepEqual(reconstructTargetArtifacts(
    graph,
    ["callee", "caller", "entry"],
    reconstruct,
    { maximumReconstructionCount: 16 },
  ), { kind: "completed", reconstructionCount: 3 });
  assert.deepEqual(reconstructed, ["callee", "caller", "entry"]);

  reconstructed.length = 0;
  restParameter = true;
  assert.deepEqual(reconstructTargetArtifacts(
    graph,
    ["callee"],
    reconstruct,
    { maximumReconstructionCount: 16 },
  ), { kind: "completed", reconstructionCount: 3 });
  assert.deepEqual(reconstructed, ["callee", "caller", "entry"]);
  assert.equal(
    graph.contract("entry").facets[0].value,
    "caller(2)",
  );
});

test("target artifact reconstruction retries only after prerequisite progress", () => {
  const graph = createTargetArtifactContractGraph();
  let sourceAttempts = 0;
  const result = reconstructTargetArtifacts(graph, ["source"], (owner) => {
    assert.equal(owner, "source");
    sourceAttempts += 1;
    if (sourceAttempts === 1) {
      assert.equal(graph.commit(
        "storage",
        contract([signature, "nullable"]),
        [],
        { owner: "storage" },
      ).kind, "accepted");
      return {
        kind: "retry",
        reason: "The source plan discovered a stronger storage contract.",
      };
    }
    return {
      kind: "resolved",
      contract: contract([signature, "void Read(Todo? value)"]),
      dependencies: [dependency("storage", signature)],
      artifact: { owner, signature: "void Read(Todo? value)" },
    };
  }, { maximumReconstructionCount: 2 });

  assert.deepEqual(result, {
    kind: "completed",
    reconstructionCount: 2,
  });
  assert.equal(sourceAttempts, 2);
  assert.equal(
    graph.contract("source").facets[0].value,
    "void Read(Todo? value)",
  );
});

test("target artifact reconstruction rejects retry without progress", () => {
  const graph = createTargetArtifactContractGraph();
  const result = reconstructTargetArtifacts(graph, ["source"], () => ({
    kind: "retry",
    reason: "No prerequisite changed.",
  }), { maximumReconstructionCount: 1 });

  assert.equal(result.kind, "rejected");
  assert.equal(result.code, "TARGET_ARTIFACT_RETRY_WITHOUT_PROGRESS");
  assert.equal(result.owner, "source");
  assert.equal(result.reconstructionCount, 1);
});

test("target artifact reconstruction requires an explicit finite caller budget", () => {
  const graph = createTargetArtifactContractGraph();
  assert.throws(
    () => reconstructTargetArtifacts(graph, ["source"], () => ({
      kind: "rejected",
      code: "UNREACHABLE",
      reason: "The reconstructor must not run without a valid budget.",
    })),
    /maximum reconstruction count must be a positive safe integer/u,
  );
  assert.throws(
    () => reconstructTargetArtifacts(
      graph,
      ["source"],
      () => ({
        kind: "rejected",
        code: "UNREACHABLE",
        reason: "The reconstructor must not run without a valid budget.",
      }),
      { maximumReconstructionCount: Number.POSITIVE_INFINITY },
    ),
    /maximum reconstruction count must be a positive safe integer/u,
  );
});

test("independently invalid owners report every failure in one run, in stable order", () => {
  const graph = createTargetArtifactContractGraph();
  const attempted = [];
  const result = reconstructTargetArtifacts(
    graph,
    ["broken-b", "broken-a", "healthy"],
    (owner) => {
      attempted.push(owner);
      if (owner.startsWith("broken")) {
        return {
          kind: "rejected",
          code: "OWNER_INVALID",
          reason: `Owner '${owner}' is independently invalid.`,
        };
      }
      return {
        kind: "resolved",
        contract: contract([signature, "void healthy()"]),
        dependencies: [],
        artifact: { owner },
      };
    },
    { maximumReconstructionCount: 16 },
  );

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.failures.map((failure) => failure.owner), [
    "broken-a",
    "broken-b",
  ]);
  assert.deepEqual(attempted.sort(), ["broken-a", "broken-b", "healthy"]);
  assert.deepEqual(graph.artifact("healthy"), { owner: "healthy" });
  assert.equal(graph.artifact("broken-a"), undefined);
});

test("actual dependent failures are preserved instead of being guessed as blocked", () => {
  const graph = createTargetArtifactContractGraph();
  assert.equal(publish(
    graph,
    "base",
    contract([signature, "void base()"]),
    [],
  ).kind, "accepted");
  assert.equal(publish(
    graph,
    "consumer",
    contract([signature, "void consumer()"]),
    [dependency("base", signature)],
  ).kind, "accepted");

  const attempted = [];
  const result = reconstructTargetArtifacts(
    graph,
    ["base", "consumer"],
    (owner) => {
      attempted.push(owner);
      if (owner === "base") {
        return {
          kind: "rejected",
          code: "BASE_INVALID",
          reason: "Base owner is invalid.",
        };
      }
      return {
        kind: "rejected",
        code: "CONSUMER_INVALID",
        reason: "Consumer owner is independently invalid.",
      };
    },
    { maximumReconstructionCount: 16 },
  );

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.failures.map((failure) => failure.owner), [
    "base",
    "consumer",
  ]);
  assert.deepEqual(attempted, ["base", "consumer"]);
});

test("no-progress retry remains an infrastructure rejection when another owner failed", () => {
  const graph = createTargetArtifactContractGraph();
  const result = reconstructTargetArtifacts(
    graph,
    ["failing", "waiting"],
    (owner) => {
      if (owner === "failing") {
        return {
          kind: "rejected",
          code: "OWNER_INVALID",
          reason: "Failing owner is invalid.",
        };
      }
      return {
        kind: "retry",
        reason: "Waiting on the failing owner's contract.",
      };
    },
    { maximumReconstructionCount: 16 },
  );

  assert.equal(result.kind, "rejected");
  assert.equal(result.owner, "waiting");
  assert.equal(result.code, "TARGET_ARTIFACT_RETRY_WITHOUT_PROGRESS");
  assert.equal(result.reconstructionCount, 2);
});
