import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { collectImportActivatedTargetCapabilities, collectRuntimeActivatedTargetCapabilities } from "../../../packages/host/dist/target/capability-activation.js";
import { sourceProjectFiles } from "../../../packages/target-api/dist/public/source.js";

for (const statement of [
  'import type { Options } from "native:records";',
  'import { type Options } from "native:records";',
  'export type { Options } from "native:records";',
  'export { type Options } from "native:records";',
  'import { options } from "native:records";',
]) {
  test(`native capability references remain available for ${statement}`, () => {
    const session = createCompilerSessionFromFiles({
      currentDirectory: "/src",
      files: new Map([["/src/index.ts", statement]]),
      compilerOptions: { module: "esnext", moduleResolution: "bundler", noLib: true },
    });
    const source = session.checkSource();
    const capability = (id, prefix, requiredCapabilities = [], targetId = "demo") => ({
      id, targetId, requiredCapabilities, moduleOwnership: [{ specifierPrefix: prefix }],
    });
    const records = capability("records", "native:", ["storage"]);
    const storage = capability("storage", "storage:");
    const unrelated = capability("unrelated", "other:");
    const otherTarget = capability("other-target", "native:", [], "another");
    const files = sourceProjectFiles(source);
    const selected = collectImportActivatedTargetCapabilities(source.ast, files,
      [records, storage, unrelated, otherTarget], { id: "demo" });
    assert.deepEqual(selected, [records, storage]);
    assert.deepEqual(collectRuntimeActivatedTargetCapabilities(source.ast, files, selected),
      statement === 'import { options } from "native:records";' ? [records, storage] : []);
    assert.deepEqual(collectRuntimeActivatedTargetCapabilities(source.ast, files, []), []);
  });
}
