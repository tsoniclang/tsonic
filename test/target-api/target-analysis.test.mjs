import assert from "node:assert/strict";
import test from "node:test";
import {
  createTargetClassificationBuilder,
  createTargetClassificationKey,
  createTargetUseClassificationBuilder,
  resolveTargetContractFixedPoint,
  targetUseSiteIdentity,
  targetUseSiteRef,
} from "../../packages/target-api/dist/public/analysis.js";

test("target classifications are exact, idempotent, conflicting, and sealed", () => {
  const subject = {};
  const key = createTargetClassificationKey(
    "test.target-type",
    (left, right) => left.id === right.id,
  );
  const builder = createTargetClassificationBuilder();

  assert.deepEqual(builder.set(subject, key, { id: "int32" }), { kind: "added" });
  assert.deepEqual(builder.set(subject, key, { id: "int32" }), {
    kind: "idempotent",
    value: { id: "int32" },
  });
  assert.deepEqual(builder.set(subject, key, { id: "string" }), {
    kind: "conflict",
    previous: { id: "int32" },
    candidate: { id: "string" },
  });
  assert.equal(builder.has(subject, key), true);
  assert.deepEqual(builder.get(subject, key), { id: "int32" });

  const queries = builder.seal();
  assert.deepEqual(queries.get(subject, key), { id: "int32" });
  assert.throws(
    () => builder.set({}, key, { id: "bool" }),
    /classifications are sealed/u,
  );
  assert.throws(() => builder.seal(), /sealed exactly once/u);
});

test("one classification identity has one key object across a complete index", () => {
  const first = createTargetClassificationKey("test.identity");
  const duplicate = createTargetClassificationKey("test.identity");
  const builder = createTargetClassificationBuilder();
  builder.set({}, first, "first");
  assert.throws(
    () => builder.set({}, duplicate, "second"),
    /registered by a different key object/u,
  );
  assert.throws(
    () => builder.get({}, duplicate),
    /registered by a different key object/u,
  );
  assert.throws(
    () => createTargetClassificationKey(""),
    /non-empty identity/u,
  );
});

test("target-use classifications isolate role, contract, and specialization", () => {
  const operation = {};
  const key = createTargetClassificationKey("test.selected-call");
  const builder = createTargetUseClassificationBuilder();
  const specializedCall = targetUseSiteRef(
    operation,
    "call-result",
    "callable:relay",
    "T=int32",
  );
  const equivalentRef = targetUseSiteRef(
    operation,
    "call-result",
    "callable:relay",
    "T=int32",
  );
  builder.set(specializedCall, key, "System.Int32");

  assert.equal(builder.get(equivalentRef, key), "System.Int32");
  assert.equal(
    builder.get(
      targetUseSiteRef(operation, "call-argument", "callable:relay", "T=int32"),
      key,
    ),
    undefined,
  );
  assert.equal(
    builder.get(
      targetUseSiteRef(operation, "call-result", "callable:relay", "T=string"),
      key,
    ),
    undefined,
  );
  assert.notEqual(
    targetUseSiteIdentity({
      role: "c",
      enclosingContract: "ab",
      specialization: "",
    }),
    targetUseSiteIdentity({
      role: "bc",
      enclosingContract: "a",
      specialization: "",
    }),
  );
  assert.throws(
    () => targetUseSiteRef(operation, "", "callable:relay"),
    /non-empty role/u,
  );

  const queries = builder.seal();
  assert.equal(queries.get(equivalentRef, key), "System.Int32");
  assert.throws(
    () => builder.set(equivalentRef, key, "System.String"),
    /use classifications are sealed/u,
  );
});

test("target contract closure resolves dependencies and exposes reverse edges", () => {
  const evaluations = new Map();
  const result = resolveTargetContractFixedPoint({
    roots: ["caller"],
    evaluate(id, context) {
      evaluations.set(id, (evaluations.get(id) ?? 0) + 1);
      if (id === "leaf") {
        return {
          kind: "resolved",
          revision: { contract: "int32", dependencies: [] },
        };
      }
      const dependency = id === "caller" ? "callee" : "leaf";
      const contract = context.get(dependency);
      return contract === undefined
        ? { kind: "deferred", dependencies: [dependency], reason: `${dependency} is open` }
        : {
            kind: "resolved",
            revision: {
              contract: `${id}(${contract})`,
              dependencies: [dependency],
            },
          };
    },
  });

  assert.equal(result.kind, "resolved");
  assert.deepEqual(result.program.ids, ["callee", "caller", "leaf"]);
  assert.equal(result.program.get("caller"), "caller(callee(int32))");
  assert.deepEqual(result.program.dependencies("caller"), ["callee"]);
  assert.deepEqual(result.program.dependents("leaf"), ["callee"]);
  assert.equal(result.program.revision("caller"), 1);
  assert.deepEqual(Object.fromEntries(evaluations), {
    caller: 2,
    callee: 2,
    leaf: 1,
  });
});

test("changed dependencies remove stale reverse invalidation edges", () => {
  const evaluations = new Map();
  const result = resolveTargetContractFixedPoint({
    roots: ["A"],
    evaluate(id, context) {
      evaluations.set(id, (evaluations.get(id) ?? 0) + 1);
      if (id === "A") {
        if (context.get("B") === undefined) {
          return { kind: "deferred", dependencies: ["B"], reason: "B is open" };
        }
        if (context.get("D") === undefined) {
          return { kind: "deferred", dependencies: ["D"], reason: "D is open" };
        }
        return {
          kind: "resolved",
          revision: { contract: "A-final", dependencies: ["D"] },
        };
      }
      if (id === "B") {
        return {
          kind: "resolved",
          revision: {
            contract: context.get("C") === undefined ? "B-initial" : "B-final",
            dependencies: ["C"],
          },
        };
      }
      if (id === "C" || id === "E") {
        return { kind: "resolved", revision: { contract: id, dependencies: [] } };
      }
      if (context.get("E") === undefined) {
        return { kind: "deferred", dependencies: ["E"], reason: "E is open" };
      }
      return {
        kind: "resolved",
        revision: { contract: "D-final", dependencies: ["E"] },
      };
    },
  });

  assert.equal(result.kind, "resolved");
  assert.equal(result.program.get("A"), "A-final");
  assert.deepEqual(result.program.dependencies("A"), ["D"]);
  assert.deepEqual(result.program.dependents("B"), []);
  assert.equal(evaluations.get("A"), 3);
});

test("public contract revisions transitively reclassify users without touching unrelated contracts", () => {
  const evaluations = new Map();
  const result = resolveTargetContractFixedPoint({
    roots: ["root", "leaf", "trigger", "unrelated"],
    evaluate(id, context) {
      evaluations.set(id, (evaluations.get(id) ?? 0) + 1);
      if (id === "trigger" || id === "unrelated") {
        return {
          kind: "resolved",
          revision: { contract: id, dependencies: [] },
        };
      }
      if (id === "leaf") {
        return {
          kind: "resolved",
          revision: {
            contract: context.get("trigger") === undefined
              ? "leaf-v1"
              : "leaf-v2",
            dependencies: ["trigger"],
          },
        };
      }
      const dependency = id === "root" ? "middle" : "leaf";
      const contract = context.get(dependency);
      return contract === undefined
        ? {
            kind: "deferred",
            dependencies: [dependency],
            reason: `${dependency} is open`,
          }
        : {
            kind: "resolved",
            revision: {
              contract: `${id}(${contract})`,
              dependencies: [dependency],
            },
          };
    },
  });

  assert.equal(result.kind, "resolved");
  assert.equal(result.program.get("leaf"), "leaf-v2");
  assert.equal(result.program.get("middle"), "middle(leaf-v2)");
  assert.equal(result.program.get("root"), "root(middle(leaf-v2))");
  assert.equal(result.program.revision("leaf"), 2);
  assert.equal(result.program.revision("middle"), 2);
  assert.equal(result.program.revision("root"), 2);
  assert.equal(result.program.revision("unrelated"), 1);
  assert.equal(evaluations.get("unrelated"), 1);
});

test("contract closure rejects unresolved, oscillating, invalid, and over-budget graphs", () => {
  const unresolved = resolveTargetContractFixedPoint({
    roots: ["A"],
    evaluate() {
      return { kind: "deferred", dependencies: [], reason: "missing exact target fact" };
    },
  });
  assert.deepEqual(unresolved, {
    kind: "rejected",
    contractId: "A",
    reason:
      "Target contract closure remained deferred. missing exact target fact",
  });

  const oscillating = resolveTargetContractFixedPoint({
    roots: ["A"],
    evaluate(_id, context) {
      return {
        kind: "resolved",
        revision: {
          contract: context.get("A") === "one" ? "two" : "one",
          dependencies: ["A"],
        },
      };
    },
  });
  assert.equal(oscillating.kind, "rejected");
  assert.match(oscillating.reason, /oscillated/u);

  const overBudget = resolveTargetContractFixedPoint({
    roots: ["A", "B"],
    maximumContracts: 1,
    evaluate(id) {
      return { kind: "resolved", revision: { contract: id, dependencies: [] } };
    },
  });
  assert.equal(overBudget.kind, "rejected");
  assert.match(overBudget.reason, /1-contract limit/u);

  const invalidDependency = resolveTargetContractFixedPoint({
    roots: ["A"],
    evaluate() {
      return { kind: "resolved", revision: { contract: "A", dependencies: [""] } };
    },
  });
  assert.equal(invalidDependency.kind, "rejected");
  assert.match(invalidDependency.reason, /non-empty strings/u);
  assert.throws(
    () => resolveTargetContractFixedPoint({
      roots: ["A"],
      maximumEvaluations: 0,
      evaluate() {
        return { kind: "resolved", revision: { contract: "A", dependencies: [] } };
      },
    }),
    /positive safe integer/u,
  );
});
