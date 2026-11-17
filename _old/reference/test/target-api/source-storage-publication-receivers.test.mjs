import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;

for (const publication of ["opaque", "exported"]) {
  for (const initialization of ["absent", "present", "adapted"]) {
    test(`physical publication retains the selected ${initialization} receiver contract (${publication})`, async () => {
      const checked = await checkedSource(`physical-publication-${publication}-${initialization}`, {
        "globals.d.ts": globals,
        "src/index.ts": `
          export {};
          interface Options { marker?: "buffer"; env?: { token: { value: number } }; }
          interface ExternalView { marker?: string; env?: { token: { value: number } }; }
          declare function consume(input: ${initialization === "adapted" ? "ExternalView" : "Options"}): void;
          const token = { value: 1 }; const unrelated = { value: 2 };
          const environment = { token };
          const options: Options = { marker: "buffer"${initialization === "present" ? ", env: environment" : ""} };
          const independent: Options = { marker: "buffer", env: { token: unrelated } };
          ${initialization === "present" ? "" : "options.env = environment;"}
          ${publication === "opaque" ? "consume(options);" : "export const published = options;"}
          const seen = options.env;
        `,
      });
      assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
      assert.equal(checked.extensionDiagnostics.length, 0, "checked declarations are admitted");
      const source = createTargetSourceProgram(checked);
      const file = projectSourceFile(source, "src/index.ts");
      const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
      const variable = name => namedVariable(source.ast, file, name);
      const selected = storage.subjectFor(variable("seen"));
      assert.equal(selected.kind === "resolved", true, "the real published member read has a graph-owned subject");
      const observed = storage.closedOriginsFor(selected.subject);
      assert.equal(observed.kind === "open", true,
        `the exact physical publication remains open, not ${observed.kind}${observed.reason === undefined ? "" : `: ${observed.reason}`}`);
      assert.equal(observed.boundaries.some(boundary => boundary.kind ===
        (publication === "opaque" ? "opaque-write" : "external-write")), true,
      "the originally selected native publication reaches the written payload");
      const original = storage.subjectFor(variable("token"));
      assert.equal(original.kind === "resolved", true, "the original constant binding retains its identity");
      assert.equal(storage.closedOriginsFor(original.subject).kind === "complete", true,
        "publishing a member never invents replacement writes to its original constant binding");
      const excluded = storage.subjectFor(variable("unrelated"));
      assert.equal(excluded.kind === "resolved", true, "the independent allocation retains its identity");
      assert.equal(storage.closedOriginsFor(excluded.subject).kind === "complete", true,
        "the same physical declaration never publishes another allocation's writer");
      const allocation = Node_Initializer(source.ast, variable("options"));
      assert.equal(allocation !== undefined, true, "the actual literal is retained");
      assert.equal(source.semantics.forNode(allocation).types.propertyInfos(
        source.semantics.forNode(allocation).types.expressionType(allocation)).some(property => property.name === "env"),
      initialization === "present", "the raw expression type never acquires invented contextual fields");
      assert.equal(storage.failureReason(), undefined, "all exact correspondence completes under the unchanged budget");
    });
  }
}
