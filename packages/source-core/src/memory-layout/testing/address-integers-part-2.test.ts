import assert from "node:assert/strict";

import { test } from "node:test";

import { readTsonicRawMemoryOperation } from "../readers.js";

import { memoryCall } from "./fixtures.js";

import { addressSession } from "./address-integers-fixtures.js";

for (const [width, source] of [
  [32, "addressintegertorawptr<uint32>(-1, abi);"],
  [32, "addressintegertorawptr<uint32>(1.5, abi);"],
  [32, "addressintegertorawptr<uint32>(1e309, abi);"],
  [32, "addressintegertorawptr<uint32>(4294967296, abi);"],
  [32, "addressintegertorawptr<uint32>(9007199254740993, abi);"],
  [32, "const address: uint32 = 1.5; addressintegertorawptr(address, abi);"],
  [32, "const address: uint32 = 4294967296; addressintegertorawptr(address, abi);"],
  [64, "addressintegertorawptr<uint64>(-1n, abi);"],
  [64, "addressintegertorawptr<uint64>(18446744073709551616n, abi);"],
  [64, "const address: uint64 = 18446744073709551616n; addressintegertorawptr(address, abi);"],
  [32, "declare const address: number; addressintegertorawptr<uint32>(address, abi);"],
  [64, "declare const address: bigint; addressintegertorawptr<uint64>(address, abi);"],
  [32, "declare const address: nativeUint; addressintegertorawptr(address, abi);"],
  [64, "declare const address: nativeUint; addressintegertorawptr(address, abi);"],
  [64, "import type { int64 } from '@tsonic/core/types.js'; declare const address: int64; addressintegertorawptr<uint64>(address, abi);"],
  [64, "import type { uint128 } from '@tsonic/core/types.js'; declare const address: uint128; addressintegertorawptr<uint64>(address, abi);"],
  [32, "declare const address: uint64; addressintegertorawptr(address, abi);"],
  [64, "declare const address: uint32; addressintegertorawptr(address, abi);"],
  [32, "import type { uint8 } from '@tsonic/core/types.js'; declare const address: uint8; addressintegertorawptr<uint32>(address, abi);"],
  [32, "addressintegertorawptr(4, abi);"],
  [64, "addressintegertorawptr(4n, abi);"],
] as const){
test(`address conversion rejects an unproved domain or invalid constant: ${width} ${source}`, () => {
    const checked = addressSession(source, width);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressintegertorawptr")), undefined);
    assert.equal(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_ANALYSIS_FAILED"), false);
  });
}
