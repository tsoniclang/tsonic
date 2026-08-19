import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  parseTsonicProjectConfig,
} from "../../packages/host/dist/index.js";

const tempRoot = resolve(
  process.cwd(),
  ".temp/test-runs/source-navigation",
  `${Date.now()}-${process.pid}`,
);

export async function checkedSource(name, files) {
  const projectDirectory = resolve(tempRoot, name);
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    ...files,
  });
  const project = parseTsonicProjectConfig(projectConfig);
  const options = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: Object.entries(files)
      .filter(([relativePath]) => relativePath.endsWith(".d.ts"))
      .map(([relativePath, text]) => ({
        path: resolve(projectDirectory, relativePath),
        text,
      })),
  });
  return createTsonicSemanticSession({
    programOptions: options.programOptions,
    project,
    projectDirectory,
    target: project.targets[0],
    targetPack: fakeTargetPack,
    selectedSurfaces: [],
  }).source;
}

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

export function projectSourceFile(source, suffix) {
  const result = source.sourceFiles.find((sourceFile) =>
    sourceFile !== undefined &&
    source.ast.getFileName(sourceFile).endsWith(suffix));
  assert.notEqual(result, undefined);
  return result;
}

export function namedDeclaration(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    (
      ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node) ||
      ast.is.IsFunctionDeclaration(node)
    ) &&
    ast.text(ast.name(node)) === name);
}

export function namedMember(ast, declaration, name) {
  const result = ast.members(declaration).find((member) =>
    member !== undefined && ast.text(ast.name(member)) === name);
  assert.notEqual(result, undefined);
  return result;
}

export function namedVariable(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === name);
}

export function constructorReference(ast, sourceFile, name) {
  const expression = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node)?.Expression) === name);
  const reference = ast.as.AsNewExpression(expression)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

export function heritageBaseReference(ast, declaration) {
  const heritage = ast.extendsHeritageElements(declaration)[0];
  assert.notEqual(heritage, undefined);
  assert.equal(ast.is.IsExpressionWithTypeArguments(heritage), true);
  const reference = ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

export function requiredNode(ast, root, predicate) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (predicate(node)) {
      return node;
    }
    stack.push(...ast.children(node));
  }
  assert.fail("Expected source node was not found.");
}

export function moduleCase(id, runtime, render) {
  return { id, runtime, render };
}

const fakeTargetPack = {
  id: "demo",
  displayName: "Demo Target",
  provider: {
    id: "demo-provider",
    displayName: "Demo Provider",
    sourceCompilerContributions() {
      return {};
    },
  },
  createBackend() {
    return {
      compile() {
        return { artifacts: [], diagnostics: [] };
      },
    };
  },
  createToolchain() {
    return {
      prepare() {
        return { diagnostics: [], producedArtifacts: [] };
      },
    };
  },
};
