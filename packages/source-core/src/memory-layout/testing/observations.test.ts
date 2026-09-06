import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { resolveTsonicMemoryLayoutObservation } from "../readers.js";
import { tsonicDataLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "../facts.js";
import { cleanMemorySession, memoryCall } from "./fixtures.js";

test("layout observations retain exact dimensions and field declaration identity", () => {
  const source = cleanMemorySession(`
    interface Header { tag: uint32; count: uint32 }
    const layout = memoryLayout<Header>(abi, 16, 8, 16,
      memoryField((value: Header) => value.tag, 0, 4, uint32Layout),
      memoryField((value: Header) => value.count, 8, 4, uint32Layout));
    sizeOf(layout); alignOf(layout); strideOf(layout); fieldOffsetOf(layout, value => value.count);
  `);
  for (const [name, value] of [["sizeOf", 16], ["alignOf", 8], ["strideOf", 16], ["fieldOffsetOf", 8]] as const) {
    const selected = resolveTsonicMemoryLayoutObservation(source.sourceFacts, memoryCall(source, name));
    assert.equal(selected?.kind, "resolved");
    if (selected?.kind !== "resolved") continue;
    assert.equal(selected.value, value);
    assert.ok(Object.isFrozen(selected));
  }
});

test("missing, relocated and stale ABI evidence cannot produce layout observations", () => {
  const source = cleanMemorySession("sizeOf(uint32Layout);");
  const call = memoryCall(source, "sizeOf");
  for (const mutation of ["missing-layout", "relocated-call", "stale-abi"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        const value = source.sourceFacts.getFact(subject, key);
        if (mutation === "missing-layout" && Object.is(key, tsonicMemoryLayoutFactKey)) return undefined;
        if (mutation === "relocated-call" && Object.is(key, tsonicMemoryLayoutQueryFactKey) && value !== undefined) {
          return { ...value, call: memoryCall(source, "memoryLayout") };
        }
        if (mutation === "stale-abi" && Object.is(key, tsonicDataLayoutFactKey) && value !== undefined) {
          return { ...value, fingerprint: "another-ABI-revision" };
        }
        return value;
      },
      getFacts: subject => source.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => source.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, call)?.kind, "rejected", mutation);
  }
});
