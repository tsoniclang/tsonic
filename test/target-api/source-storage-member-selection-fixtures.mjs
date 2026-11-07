import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createHostSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/host.js";
import { createSourceProfileStorageEffects, createSourceStorageQuery } from "../../packages/target-api/dist/target-analysis/index.js";
import { sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";
import { createSourceStorageGuardedValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/guarded-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStoragePhysicalMembers } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/member-selection.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

// The Error declarations are JS source-profile declarations when admitted, so the Host storage composition
// (facts.profile.nativeConstructorStorage) registers the ErrorConstructor construct signatures as native constructors.
// Unadmitted, the same declarations are ordinary ambient declarations outside any source profile: no native proof.
const errorProfileFile = ".tsonic/source-profiles/js/errors.d.ts";

async function inheritedNativeMemberFixture(name, body, admitted = true) {
  const errors = admitted ? "" : sourceErrorDeclarations;
  const checked = await checkedSource(name, {
    "globals.d.ts": `
      interface Object {} interface Function {} interface CallableFunction extends Function {}
      interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
      interface Number {} interface String {} interface RegExp {}
      interface Array<T> { [index: number]: T; length: number; }
      interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
      ${errors}
    `,
    ...(admitted ? { [errorProfileFile]: sourceErrorDeclarations } : {}),
    "src/index.ts": `export {}; ${body} const created = new Retained(); const observed = created.message;`,
  });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = projectSourceFile(source, "src/index.ts");
  const globals = projectSourceFile(source, admitted ? errorProfileFile : "globals.d.ts");
  const error = namedDeclaration(source.ast, globals, "Error");
  const owner = namedDeclaration(source.ast, globals, "ErrorConstructor");
  const constructors = source.ast.members(owner).filter(source.ast.is.IsConstructSignatureDeclaration);
  // The Host storage effects (facts.analyses.storage composes the same), with no target premise.
  const effects = createSourceProfileStorageEffects(source, {});
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget, effects);
  const invocation = Node_Initializer(source.ast, namedVariable(source.ast, file, "created"));
  const lineages = transport.constructionLineagesFor(invocation, undefined, "heritage");
  const field = source.ast.members(error).find(member => source.ast.text(source.ast.name(member)) === "message");
  // The native instance contract: the Host result of the ErrorConstructor construct signature (the Error type).
  const resolved = constructors.length === 0 ? undefined : source.facts.values.callableReturn(constructors[0]);
  const destination = resolved === undefined || resolved.kind === "refused" ? undefined : resolved.type;
  assert.equal(destination?.kind === "declared" && destination.declaration === error, true, "the construct result is the Error declaration");
  assert.equal(field !== undefined && destination !== undefined, true, "the actual checked native member and instance contract");
  return { source, file, budget, transport, lineages, field, destination, constructors };
}

function fixture(body, extraFiles = {}) {
  const files = { "/src/index.ts": `export {}; ${body}`, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const storage = createSourceStorageQuery(source, Object.keys(files).map(name => checked.getSourceFile(name)));
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const origins = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact source subject`);
    const result = storage.closedOriginsFor(selected.subject);
    const boundaries = result.boundaries?.slice(0, 8).map(boundary =>
      `${boundary.kind}:${source.ast.text(source.ast.name(boundary.subject.node))}:${boundary.subject.kind}:${source.ast.kindName(boundary.exposure)}`);
    assert.equal(result.kind === "complete", true, `${name}: complete selected member evidence (${result.kind}; ${result.reason ?? ""}; ${boundaries?.join(",") ?? ""})`);
    assert.equal(storage.failureReason() === undefined, true, `${name}: no missing owner evidence`);
    return result.origins;
  };
  return { source, storage, variable, initializer, origins };
}

export { inheritedNativeMemberFixture, fixture };
