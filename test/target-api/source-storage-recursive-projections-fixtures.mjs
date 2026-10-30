import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const subject = storage.subjectFor(initializer(name));
    return subject.kind === "resolved" ? storage.closedOriginsFor(subject.subject) : subject;
  };
  const expect = (name, expected) => {
    const result = query(name);
    const detail = result.kind === "open" ? result.boundaries.slice(0, 8).map(boundary =>
      `${boundary.kind}:${boundary.subject.kind}`).join("; ") : "";
    assert.equal(result.kind === "complete", true, `${name}: ${storage.failureReason() ?? result.reason ?? result.kind}; ${detail}`);
    assert.equal(result.origins.length === expected.length && expected.every(original =>
      result.origins.some(origin => origin.subject.node === initializer(original))), true,
    `${name}: exact producers ${expected.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "original finite guards remain enabled");
  };
  return { expect, query, storage, initializer, source, file };
}

export { fixture };
