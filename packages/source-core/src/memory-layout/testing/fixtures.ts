import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, CompilerExtension, Node, SourceSemanticsModule } from "@tsonic/tsts";
import { createSourceSemanticsVirtualModuleProvider } from "../../extension/semantics-virtual-modules.js";
import { createTsonicCoreSourceExtension } from "../../extension/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../../extension/source-modules.js";
import type { TsonicDataLayoutRegistration } from "../facts.js";

export const memoryTestRegistration: TsonicDataLayoutRegistration = Object.freeze({
  providerDeclaration: Object.freeze({
    providerId: "test.memory-abi", providerVersion: "1", providerModuleId: "test:abi",
    moduleSpecifier: "test:abi", exportId: "abi.token",
  }),
  descriptor: Object.freeze({ fingerprint: "test-abi-v1-le64", byteOrder: "little", addressWidth: 64 }),
});

export const memoryTestPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, MemoryLayout, int32, uint32, nativeUint } from "@tsonic/core/types.js";
import { memoryLayout, memoryField, sizeOf, alignOf, strideOf, fieldOffsetOf,
  toRawPointer, reinterpretRawPointer, offsetRawPointer, rawPointerToAddressInteger,
  addressIntegerToRawPointer, keepAlive, loadPointer, storePointer } from "@tsonic/core/lang.js";
declare const raw: RawPointer | undefined;
declare const ordinary: Pointer<uint32> | undefined;
const uint32Layout = memoryLayout<uint32>(abi, 4, 4, 4);
`;

export function memorySession(sourceText: string, options: {
  readonly registrations?: readonly TsonicDataLayoutRegistration[];
  readonly extensions?: readonly CompilerExtension[];
  readonly extraFiles?: Readonly<Record<string, string>>;
} = {}): CheckedSourceProgram {
  const module: SourceSemanticsModule = { moduleSpecifier: "test:abi", exports: [] };
  const provider = createSourceSemanticsVirtualModuleProvider({
    id: "test.memory-abi", version: "1", displayName: "Memory test ABI", virtualDirectory: "test-memory-abi",
    modules: [module], evidenceMessage: "Exact test ABI declaration",
    importsForModule: () => [{ moduleSpecifier: "@tsonic/core/types.js", namedImports: [{ exportedName: "DataLayout", kind: "type" }], typeOnly: true }],
    exportsForModule: () => [{
      id: "abi.token", name: "abi", kind: "value",
      type: { kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "DataLayout" },
    }],
  });
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
