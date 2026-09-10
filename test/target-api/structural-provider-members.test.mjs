import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { checkCsharpSource, assertCsharpCheckingSucceeded } from "../../../tsonic-csharp/test/helpers/direct-csharp-session.mjs";
import { createTsonicPlugin } from "../../../csharp-nodejs/dist/index.js";

test("the public structural query relates a variable to actual Node provider options", () => {
  const checked = checkCsharpSource({ surface: "js", capabilities: [createTsonicPlugin()], sourceText: `
    import { createWriteStream } from "node:fs";
    export function example(path: string): void {
      const options = { highWaterMark: 3 };
      const output = createWriteStream(path, options);
      options.highWaterMark = 99;
      output.end();
    }
  ` });
  assertCsharpCheckingSucceeded(checked);
  const source = createTargetSourceProgram(checked.source);
  const file = checked.source.getSourceFile("/project/index.ts");
  assert.ok(file);
  const relations = [];
  function visit(node) {
    if (source.ast.is.IsCallExpression(node)) {
      const semantics = source.semantics.forNode(node);
      const call = semantics.operations.call(node);
      if (call?.sourceArguments.length === 2) {
        const actual = call.sourceArguments[1].type;
        const selected = call.sourceSelectedSignatureParameters[1].selectedType;
        assert.ok(actual && selected);
        const destination = semantics.types.withoutMissingOrUndefined(selected);
        assert.ok(destination);
        relations.push(semantics.types.structuralMembers(actual, destination));
      }
    }
    for (const child of source.ast.children(node)) if (child !== undefined) visit(child);
  }
  visit(file);
  assert.equal(relations.length, 1);
  const relation = relations[0];
  assert.equal(relation.kind, "available");
  const present = relation.members.filter(member => member.kind === "present");
  assert.equal(present.length, 1);
  assert.equal(present[0].source.property.name, "highWaterMark");
  assert.equal(present[0].destination.property.name, "highWaterMark");
  assert.notEqual(present[0].source.property.symbol, present[0].destination.property.symbol);
  assert.ok(relation.members.some(member => member.kind === "absent"));
});
