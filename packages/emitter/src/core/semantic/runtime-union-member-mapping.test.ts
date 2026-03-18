import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import { identifierType } from "../format/backend-ast/builders.js";
import {
  buildRuntimeUnionMemberIndexByAstKey,
  findMappedRuntimeUnionMemberIndex,
} from "./runtime-union-member-mapping.js";

const regExpType: IrType = {
  kind: "referenceType",
  name: "RegExp",
  resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
};

describe("runtime-union-member-mapping", () => {
  it("indexes runtime-union members by emitted type key", () => {
    const indexByAstKey = buildRuntimeUnionMemberIndexByAstKey([
      identifierType("string"),
      identifierType("global::Tsonic.JSRuntime.RegExp"),
    ]);

    expect(indexByAstKey.get("predefined:string")).to.equal(0);
    expect(
      indexByAstKey.get(
        "qualifiedIdentifier:global::Tsonic.JSRuntime.RegExp"
      )
    ).to.equal(1);
  });

  it("prefers emitted member-type mapping before semantic fallback", () => {
    const context = createContext({ rootNamespace: "Test" });
    const indexByAstKey = buildRuntimeUnionMemberIndexByAstKey([
      identifierType("string"),
      identifierType("global::Tsonic.JSRuntime.RegExp"),
    ]);

    const index = findMappedRuntimeUnionMemberIndex({
      targetMembers: [
        { kind: "primitiveType", name: "string" },
        regExpType,
      ],
      targetMemberIndexByAstKey: indexByAstKey,
      actualMember: {
        kind: "referenceType",
        name: "PathSpec",
        resolvedClrType: "Test.PathSpec",
      },
      actualMemberTypeAst: identifierType("string"),
      context,
    });

    expect(index).to.equal(0);
  });

  it("falls back to semantic matching when emitted member type is unavailable", () => {
    const context = createContext({ rootNamespace: "Test" });
    const indexByAstKey = buildRuntimeUnionMemberIndexByAstKey([
      identifierType("string"),
      identifierType("global::Tsonic.JSRuntime.RegExp"),
    ]);

    const index = findMappedRuntimeUnionMemberIndex({
      targetMembers: [
        { kind: "primitiveType", name: "string" },
        regExpType,
      ],
      targetMemberIndexByAstKey: indexByAstKey,
      actualMember: regExpType,
      context,
    });

    expect(index).to.equal(1);
  });
});
