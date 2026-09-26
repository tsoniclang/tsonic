import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { resolveTsonicMemoryLayoutObservation } from "../readers.js";
import { tsonicDataLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "../facts.js";
import { cleanMemorySession, memoryCall } from "./fixtures.js";

test("layout observations retain exact dimensions and field declaration identity", () => {
  const source = cleanMemorySession(`
    interface Header { tag: uint32; count: uint32 }
    const layout = memorylayout<Header>({
      datalayout: abi,
      bytesize: 16,
      bytealignment: 8,
      stride: 16,
      fields: [memoryfield({ select: (value: Header) => value.tag, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout }), memoryfield({ select: (value: Header) => value.count, byteoffset: 8, bytealignment: 4, fieldlayout: uint32Layout })],
    });
    sizeof(layout); alignof(layout); strideof(layout); fieldoffsetof(layout, value => value.count);
  `);
  for (const [name, value] of [["sizeof", 16], ["alignof", 8], ["strideof", 16], ["fieldoffsetof", 8]] as const) {
    const selected = resolveTsonicMemoryLayoutObservation(source.sourceFacts, memoryCall(source, name));
    assert.equal(selected?.kind, "resolved");
    if (selected?.kind !== "resolved") continue;
    assert.equal(selected.value, value);
    assert.ok(Object.isFrozen(selected));
  }
});

test("missing, relocated and stale ABI evidence cannot produce layout observations", () => {
  const source = cleanMemorySession("sizeof(uint32Layout);");
  const call = memoryCall(source, "sizeof");
  for (const mutation of ["missing-layout", "relocated-call", "stale-abi"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        const value = source.sourceFacts.getFact(subject, key);
        if (mutation === "missing-layout" && Object.is(key, tsonicMemoryLayoutFactKey)) return undefined;
        if (mutation === "relocated-call" && Object.is(key, tsonicMemoryLayoutQueryFactKey) && value !== undefined) {
          return { ...value, call: memoryCall(source, "memorylayout") };
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
