import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, CompilerExtension, Node } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension } from "../../host-input/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../../extension/source-modules.js";
import type { TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
import type { TsonicMemoryLayoutFact, TsonicValueMemoryLayoutFact } from "../../host-input/memory-layout-facts.js";
import { createMemoryTestDeclarationProvider, memoryTestPrelude, memoryTestRegistration } from "./programs.js";

export function memorySession(sourceText: string, options: {
  readonly registrations?: readonly TsonicDataLayoutRegistration[];
  readonly extensions?: readonly CompilerExtension[];
  readonly extraFiles?: Readonly<Record<string, string>>;
} = {}): CheckedSourceProgram {
  const provider = createMemoryTestDeclarationProvider();
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src", files: { "/src/index.ts": sourceText, ...options.extraFiles },
    compilerOptions: { module: "esnext", moduleResolution: "bundler", strict: true, target: "es2022" },
    extensionHostOptions: { extensions: [
      createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension({ dataLayouts: options.registrations ?? [memoryTestRegistration] }),
      { identity: { id: "test.memory-abi", version: "1" }, initialize(context) { context.registerSourceDeclarationProvider(provider); } },
      ...options.extensions ?? [],
    ] },
  });
  return session.checkSource();
}

export function cleanMemorySession(sourceText: string): CheckedSourceProgram {
  const checked = memorySession(memoryTestPrelude + sourceText);
  const diagnostics = checked.diagnostics.filter((entry) => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}

export function assertMemoryDiagnostics(checked: CheckedSourceProgram): void {
  assert.equal(checked.extensionDiagnostics.length, 0, checked.extensionDiagnostics.map((entry) =>
    `${entry.extensionCode}: ${entry.message}`).join("\n"));
}

export function valueMemoryLayout(layout: TsonicMemoryLayoutFact | undefined): TsonicValueMemoryLayoutFact {
  assert.ok(layout?.kind === "value");
  return layout;
}

export function memoryCalls(checked: CheckedSourceProgram, name: string): readonly Node[] {
  const result: Node[] = [];
  const ast = checked.ast;
  const visit = (node: Node): void => {
    if (ast.is.IsCallExpression(node)) {
      const callee = ast.as.AsCallExpression(node)?.Expression;
      if (ast.text(ast.name(callee) ?? callee) === name) result.push(node);
    }
    for (const child of ast.children(node)) if (child !== undefined) visit(child);
  };
  const source = checked.getSourceFile("/src/index.ts");
  assert.ok(source);
  visit(source);
  return result;
}

export function memoryCall(checked: CheckedSourceProgram, name: string, index = 0): Node {
  const call = memoryCalls(checked, name)[index];
  assert.ok(call, `Missing ${name} call ${index}.`);
  return call;
}

export function memoryDescriptorProperty(checked: CheckedSourceProgram, call: Node, name: string): Node {
  const descriptor = checked.ast.arguments(call)[0];
  assert.ok(checked.ast.is.IsObjectLiteralExpression(descriptor));
  const property = checked.ast.properties(descriptor).find(property => checked.ast.text(checked.ast.name(property)) === name);
  const value = checked.ast.as.AsPropertyAssignment(property)?.Initializer;
  assert.ok(value, `Missing named descriptor property '${name}'.`);
  return value;
}
