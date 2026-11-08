import assert from "node:assert/strict";
import { sourcePrimitive } from "@tsonic/tsts";
import { createCsharpTargetPack } from "../../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "../source-program-fixture.mjs";

export function sourceTypeFlowFixture(text) {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({ project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
      "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
      "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    targetContributions: base => ({ ...base, semanticsModules: [...base.semanticsModules ?? [], {
      moduleSpecifier: "@test/words", packageName: "@test/words", exports: [
        sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32),
      ],
    }] }),
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0);
  const source = checked.value;
  const file = source.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the same original project file is required");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]);
  }
  const declaration = name => {
    const node = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(node !== undefined, true, `the original declaration ${name} is required`);
    return node;
  };
  const slot = name => {
    const selected = source.facts.values.declaredSlot(declaration(name));
    assert.equal(selected.kind, "resolved", `the original declared slot ${name} resolves`);
    return selected.value.type;
  };
  return { source, nodes, declaration, slot };
}
