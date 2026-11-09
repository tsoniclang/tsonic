import type { SourceSemanticsModule } from "@tsonic/tsts";
import type { TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
import { createSourceSemanticsVirtualModuleProvider } from "../../extension/semantics-virtual-modules.js";

export const memoryTestRegistration: TsonicDataLayoutRegistration = Object.freeze({
  providerDeclaration: Object.freeze({
    providerId: "test.memory-abi", providerVersion: "1", providerModuleId: "test:abi",
    moduleSpecifier: "test:abi", exportId: "abi.token",
  }),
  descriptor: Object.freeze({ fingerprint: "test-abi-v1-le64", byteOrder: "little", addressWidth: 64 }),
});

export const memoryTestPrelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, MemoryLayout, int32, uint32, uint64, nativeUint } from "@tsonic/core/types.js";
import { memorylayout, memoryfield, sizeof, alignof, strideof, fieldoffsetof,
  torawptr, reinterpretrawptr, offsetrawptr, rawptrtoaddressinteger,
  addressintegertorawptr, keepalive, loadptr, storeptr } from "@tsonic/core/lang.js";
declare const raw: RawPointer | undefined;
declare const ordinary: Pointer<uint32> | undefined;
const uint32Layout = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
`;

export const memoryTestModule: SourceSemanticsModule = Object.freeze({ moduleSpecifier: "test:abi", exports: Object.freeze([]) });

export function createMemoryTestDeclarationProvider() {
  return createSourceSemanticsVirtualModuleProvider({
    id: "test.memory-abi", version: "1", displayName: "Memory test ABI", virtualDirectory: "test-memory-abi",
    modules: [memoryTestModule], evidenceMessage: "Exact test ABI declaration",
    importsForModule: () => [{ moduleSpecifier: "@tsonic/core/types.js", namedImports: [{ exportedName: "DataLayout", kind: "type" }], typeOnly: true }],
    exportsForModule: () => [{
      id: "abi.token", name: "abi", kind: "value",
      type: { kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "DataLayout" },
    }],
  });
}
