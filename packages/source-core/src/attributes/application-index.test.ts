import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "@tsonic/tsts";
import { isAstNode } from "@tsonic/target-api/source";
import { createTsonicAttributeApplicationFactIndex } from "../public/facts.js";
import { tsonicAttributeBuilderFactKey } from "./facts.js";
import {
  checkSource,
  createCleanSourceCoreSession,
  propertyCallExpression,
  sourceAst,
  sourceFacts,
} from "../extension/source-extension.fixtures.js";

test("attribute indexing preserves original finalized identities and visits each source node once", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute } from "@tsonic/core/lang.js";
    class Annotation { constructor(value: string) {} }
    class Subject { run(): void {} }
    attribute<Subject>().add(() => new Annotation("first"));
    attribute<Subject>().method(value => value.run).add(() => new Annotation("second"));
  `);
  const ast = sourceAst(session);
  const facts = sourceFacts(session);
  const reads = new Map<Node, number>();
  const index = createTsonicAttributeApplicationFactIndex({
    ast,
    sourceFiles: [sourceFile],
    sourceFacts: {
      getFact(subject, key) {
        const fact = facts.getFact(subject, key);
        assert.equal(key, tsonicAttributeBuilderFactKey);
        assert.ok(isAstNode(ast, subject));
        reads.set(subject, (reads.get(subject) ?? 0) + 1);
        return fact;
      },
    },
  });
  const calls = [0, 1].map(occurrence => propertyCallExpression(session, sourceFile, "add", occurrence));
  const applications = calls.map(call => facts.getFact(call, tsonicAttributeBuilderFactKey));
  assert.deepEqual(index.all, applications);
  assert.deepEqual(index.forSourceFile(sourceFile), applications);
  for (const [position, call] of calls.entries()) {
    assert.equal(index.all[position], applications[position]);
    assert.equal(index.forSubject(call), applications[position]);
    assert.equal(Object.isFrozen(index.forSubject(call)), true);
  }
  const selector = propertyCallExpression(session, sourceFile, "method");
  assert.equal(index.forSubject(selector), facts.getFact(selector, tsonicAttributeBuilderFactKey));
  assert.equal(index.forSubject(selector)?.kind, "builder-state");
  assert.equal(index.forSubject(sourceFile), undefined);
  const visited = new Set<Node>();
  const visit = (node: Node): void => {
    visited.add(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(sourceFile);
  assert.equal(reads.size, visited.size);
  for (const node of visited) assert.equal(reads.get(node), 1);
  assert.equal(Object.isFrozen(index), true);
  assert.equal(Object.isFrozen(index.all), true);
  assert.equal(Object.isFrozen(index.forSourceFile(sourceFile)), true);
});

test("attribute indexing preserves source-file order, placement and empty selections", () => {
  const sourceText = `
    import { attribute } from "@tsonic/core/lang.js";
    function mark(): void {}
    attribute.module().add(() => mark());
  `;
  const { session, sourceFile } = createCleanSourceCoreSession(sourceText, { "/src/second.ts": sourceText });
  const secondFile = checkSource(session).getSourceFile("/src/second.ts");
  assert.ok(secondFile !== undefined);
  const input = { ast: sourceAst(session), sourceFacts: sourceFacts(session) };
  for (const files of [[sourceFile, secondFile], [secondFile, sourceFile]]) {
    const index = createTsonicAttributeApplicationFactIndex({ ...input, sourceFiles: files });
    assert.deepEqual(index.all.map(fact => fact.applicationTarget), files);
    for (const file of files) {
      const [application] = index.forSourceFile(file);
      assert.equal(application?.applicationPlacement, "module");
      assert.equal(application?.applicationTarget, file);
      assert.equal(application, index.all.find(fact => fact.applicationTarget === file));
    }
  }
  const empty = createTsonicAttributeApplicationFactIndex({ ...input, sourceFiles: [] });
  assert.deepEqual(empty.all, []);
  assert.deepEqual(empty.forSourceFile(sourceFile), []);
  assert.equal(Object.isFrozen(empty.forSourceFile(sourceFile)), true);
  assert.equal(empty.forSubject(sourceFile), undefined);
});

test("attribute indexing includes finalized applications nested inside an application input", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute } from "@tsonic/core/lang.js";
    class Subject {}
    function mark(callback?: () => void): void {}
    attribute<Subject>().add(() => mark(() => {
      attribute<Subject>().add(() => mark());
    }));
  `);
  const index = createTsonicAttributeApplicationFactIndex({
    ast: sourceAst(session), sourceFacts: sourceFacts(session), sourceFiles: [sourceFile],
  });
  const applications = [0, 1].map(occurrence => sourceFacts(session).getFact(
    propertyCallExpression(session, sourceFile, "add", occurrence), tsonicAttributeBuilderFactKey));
  assert.equal(applications.length, 2);
  assert.equal(applications.every(fact => fact?.kind === "application"), true);
  assert.deepEqual(index.all, applications);
  assert.equal(index.all[0], applications[0]);
  assert.equal(index.all[1], applications[1]);
});
