import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageFormalMemberWrites } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

export function fixture(body, extraFiles = {}, domain = "complete") {
  const files = { "/project/index.ts": body, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project",
    files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "source checking accepts the unmodified alias program");
  const source = createTargetSourceProgram(checked);
  const sourceFiles = Object.keys(files).map(name => checked.getSourceFile(name));
  const nodes = [];
  const pending = [...sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const storage = createSourceStorageQuery(source, sourceFiles);
  const named = (name, predicate) => nodes.find(node => predicate(node) && source.ast.text(source.ast.name(node)) === name);
  const original = named("original", source.ast.is.IsVariableDeclaration);
  const replacement = named("replacement", source.ast.is.IsVariableDeclaration);
  const owner = named("Value", source.ast.is.IsClassDeclaration);
  const member = source.ast.members(owner).find(node => source.ast.text(source.ast.name(node)) === "callback");
  const selected = source.ast.is.IsGetAccessorDeclaration(member) ? storage.subject(member, "return")
    : storage.storageSubjectFor(member);
  assert.equal(selected.kind, "resolved");
  const origins = storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind, domain, "no unseen external writer is erased");
  if (domain === "open") assert.equal(origins.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "an exported writable class contract remains open");
  assert.equal(storage.failureReason() === undefined, true, "one finite graph accounts every direction");
  return { source, sourceFiles, storage, member, origins: origins.origins,
    original: source.ast.as.AsVariableDeclaration(original).Initializer,
    replacement: source.ast.as.AsVariableDeclaration(replacement).Initializer };
}

export function formalFixture(body, extraFiles = {}, limits = {}) {
  const files = { "/project/index.ts": `export {}; interface Reader { read(): number; } ${body}`, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/project"));
  const source = createTargetSourceProgram(checked);
  const sourceFiles = Object.keys(files).map(name => checked.getSourceFile(name));
  const nodes = [];
  const pending = [...sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    assert.equal(node !== undefined, true, "every fixture node belongs to a checked source file");
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const storage = createSourceStorageQuery(source, sourceFiles, { ...defaultSourceStorageLimits, ...limits });
  const callable = name => {
    const declaration = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.body(node) !== undefined &&
      source.ast.text(source.ast.name(node)) === name);
    assert.equal(declaration !== undefined, true, `${name}: actual implementation declaration`);
    return declaration;
  };
  const parameter = (declaration, name) => {
    const parameters = sourceCallableValueParameters(source.ast, declaration, source.semantics.forNode(declaration), { kind: "declaration" });
    const selected = parameters?.find(node => source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, `${name}: checked runtime value parameter`);
    return selected;
  };
  const query = (name, input = "owner") => {
    const declaration = callable(name);
    return storage.formalMemberWriteDemand(declaration, parameter(declaration, input));
  };
  const member = (name = "Reader") => {
    const owner = nodes.find(node => source.ast.is.IsInterfaceDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    const selected = owner === undefined ? undefined : source.ast.members(owner).find(node => source.ast.text(source.ast.name(node)) === "read");
    assert.equal(selected !== undefined, true, `${name}: original checked read member`);
    return selected;
  };
  const complete = (name, expected, input = "owner") => {
    const selected = query(name, input);
    assert.equal(selected.kind, "complete", `${name}: completed formal write demand (${selected.reason ?? ""})`);
    assert.equal(selected.members.length, expected.length, `${name}: exact member count`);
    assert.equal(expected.every(node => selected.members.includes(node)), true, `${name}: exact original member identities`);
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.members), true, `${name}: immutable published summary`);
    return selected;
  };
  return { source, sourceFiles, storage, nodes, callable, parameter, query, member, complete };
}

export function optionalDemand(current, name, expected, input = "owner") {
  const declaration = current.callable(name);
  const parameter = current.parameter(declaration, input);
  const subject = current.storage.subject(parameter, "input");
  assert.equal(subject.kind, "resolved", `${name}.${input}: identical declared input`);
  const before = current.storage.typeFor(subject.subject);
  assert.equal(before.kind, "resolved", `${name}.${input}: original declared carrier`);
  const types = current.source.semantics.forNode(parameter).types;
  assert.equal(types.isUnion(before.type) && types.unionOrIntersectionTypes(before.type).some(type => types.isNullish(type)), true,
    `${name}.${input}: declared absence remains present in the raw carrier`);
  const result = current.complete(name, expected, input);
  const after = current.storage.typeFor(subject.subject);
  assert.equal(after.kind === "resolved" && after.type === before.type, true,
    `${name}.${input}: present-member selection never replaces the original optional type`);
  return result;
}
