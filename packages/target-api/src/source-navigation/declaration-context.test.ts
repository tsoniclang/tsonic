import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { sourceDeclarationAmbientContext } from "./declaration-context.js";

test("ambient storage context follows its declaration-file or explicit declaration owner", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export class Ordinary { static value = 1; } export declare class Declared { static value: number; }",
    "/src/native.d.ts": "export class External { static value: number; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "all actual source and declaration-file inputs check");
  const source = checked.getSourceFile("/src/index.ts");
  const native = checked.getSourceFile("/src/native.d.ts");
  assert.equal(source !== undefined && native !== undefined, true, "both exact checked files exist");
  if (source === undefined || native === undefined) return;
  assert.equal(sourceDeclarationAmbientContext(checked.ast, source, false), false, "ordinary source is not ambient");
  assert.equal(sourceDeclarationAmbientContext(checked.ast, native, false), true, "a declaration file is ambient without explicit declare modifiers");
  for (const file of [source, native]) {
    const inherited = sourceDeclarationAmbientContext(checked.ast, file, false);
    for (const declaration of checked.ast.statements(file)) {
      if (declaration === undefined || !checked.ast.is.IsClassDeclaration(declaration)) continue;
      const ambient = sourceDeclarationAmbientContext(checked.ast, declaration, inherited);
      const name = checked.ast.text(checked.ast.name(declaration));
      assert.equal(ambient, name !== "Ordinary", `${name}: exact declaration owner context`);
      for (const member of checked.ast.members(declaration)) {
        if (member === undefined) continue;
        assert.equal(sourceDeclarationAmbientContext(checked.ast, member, ambient), ambient,
          `${name}: a static member retains its actual declaration context`);
      }
    }
  }
});
