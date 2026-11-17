import assert from "node:assert/strict";
import test from "node:test";
import { keelSourceRejectionIdentity } from "./tooling/keel-source-rejection.mjs";

const diagnostic = Object.freeze({ code: "TSTS_DIAGNOSTIC", category: "error",
  message: "Property 'push' does not exist on the selected native type.",
  sourceSpan: { fileName: "index.ts", line: 3, column: 5, endLine: 3, endColumn: 9 },
  evidence: ["tsts.code=TS2339"] });
const observation = Object.freeze({ stage: "source", nativeProgramCompilationInvoked: false,
  publishedArtifacts: [], diagnostics: [diagnostic] });

test("known unavailable-surface controls preserve complete checker diagnostics, not generated output", () => {
  const identity = keelSourceRejectionIdentity(observation, ["TS2339"]);
  assert.match(identity, /^[a-f0-9]{64}$/u);
  assert.equal(keelSourceRejectionIdentity({ ...observation, diagnostics: [{ ...diagnostic }] }, ["TS2339"]), identity);
  assert.notEqual(keelSourceRejectionIdentity({ ...observation,
    diagnostics: [{ ...diagnostic, message: "Another precise diagnostic." }] }, ["TS2339"]), identity);
  assert.notEqual(keelSourceRejectionIdentity({ ...observation,
    diagnostics: [{ ...diagnostic, sourceSpan: { ...diagnostic.sourceSpan, column: 6 } }] }, ["TS2339"]), identity);
});

test("negative controls cannot hide admitted, target-failed, published or unexecuted programs", () => {
  for (const changed of [
    { ...observation, stage: "target" },
    { ...observation, nativeProgramCompilationInvoked: true },
    { ...observation, nativeProgramCompilationInvoked: undefined },
    { ...observation, publishedArtifacts: ["out/generated.rs"] },
    { ...observation, diagnostics: [] },
    { ...observation, diagnostics: [{ ...diagnostic, code: "RUST_PARAMETER_CARRIER_UNSUPPORTED" }] },
    { ...observation, diagnostics: [{ ...diagnostic, category: "warning" }] },
    { ...observation, diagnostics: [{ ...diagnostic, message: "" }] },
    { ...observation, diagnostics: [{ ...diagnostic, evidence: ["tsts.code=TS2304"] }] },
    { ...observation, diagnostics: [{ ...diagnostic, evidence: ["native.error=E0308"] }] },
    { ...observation, diagnostics: [{ ...diagnostic, sourceSpan: undefined }] },
    { ...observation, diagnostics: [{ ...diagnostic, sourceSpan: { ...diagnostic.sourceSpan, endLine: 2 } }] },
  ]) assert.throws(() => keelSourceRejectionIdentity(changed, ["TS2339"]));
  for (const codes of [[], ["TS2339", "TS2339"], ["TS2339", "TS2304"], ["E0308"], [undefined]]) {
    assert.throws(() => keelSourceRejectionIdentity(observation, codes));
  }
});
