import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import {
  identifierExpression,
  identifierType,
} from "../format/backend-ast/builders.js";
import type { RuntimeUnionLayout } from "./runtime-unions.js";
import { tryBuildRuntimeUnionProjectionToLayoutAst } from "./runtime-union-projection.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const regexType: IrType = {
  kind: "referenceType",
  name: "RegExp",
  resolvedClrType: "global::js.RegExp",
};
const objectArrayType: IrType = {
  kind: "arrayType",
  elementType: { kind: "referenceType", name: "object" },
};

describe("runtime-union-projection", () => {
  it("maps source members onto target union slots by emitted member surface", () => {
    const context = createContext({ rootNamespace: "Test" });
    const sourceLayout: RuntimeUnionLayout = {
      members: [stringType, regexType],
      memberTypeAsts: [
        { kind: "predefinedType", keyword: "string" },
        identifierType("global::js.RegExp"),
      ],
      runtimeUnionArity: 2,
    };
    const targetLayout: RuntimeUnionLayout = {
      members: [objectArrayType, stringType, regexType],
      memberTypeAsts: [
        { kind: "arrayType", rank: 1, elementType: identifierType("object") },
        { kind: "predefinedType", keyword: "string" },
        identifierType("global::js.RegExp"),
      ],
      runtimeUnionArity: 3,
    };

    const projected = tryBuildRuntimeUnionProjectionToLayoutAst({
      valueAst: identifierExpression("value"),
      sourceLayout,
      targetLayout,
      context,
      buildMappedMemberValue: ({ parameterExpr, context: nextContext }) => [
        parameterExpr,
        nextContext,
      ],
    });

    expect(projected?.[0]).to.deep.equal({
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("value"),
        memberName: "Match",
      },
      arguments: [
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: "__tsonic_union_member_1" }],
          body: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: {
                kind: "typeReferenceExpression",
                type: identifierType("global::Tsonic.Runtime.Union", [
                  {
                    kind: "arrayType",
                    rank: 1,
                    elementType: identifierType("object"),
                  },
                  { kind: "predefinedType", keyword: "string" },
                  identifierType("global::js.RegExp"),
                ]),
              },
              memberName: "From2",
            },
            arguments: [identifierExpression("__tsonic_union_member_1")],
          },
        },
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: "__tsonic_union_member_2" }],
          body: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: {
                kind: "typeReferenceExpression",
                type: identifierType("global::Tsonic.Runtime.Union", [
                  {
                    kind: "arrayType",
                    rank: 1,
                    elementType: identifierType("object"),
                  },
                  { kind: "predefinedType", keyword: "string" },
                  identifierType("global::js.RegExp"),
                ]),
              },
              memberName: "From3",
            },
            arguments: [identifierExpression("__tsonic_union_member_2")],
          },
        },
      ],
    });
  });

  it("uses excluded-member bodies when a runtime subset filters source slots", () => {
    const context = createContext({ rootNamespace: "Test" });
    const sourceLayout: RuntimeUnionLayout = {
      members: [stringType, regexType],
      memberTypeAsts: [
        { kind: "predefinedType", keyword: "string" },
        identifierType("global::js.RegExp"),
      ],
      runtimeUnionArity: 2,
    };
    const targetLayout: RuntimeUnionLayout = {
      members: [stringType, regexType],
      memberTypeAsts: [
        { kind: "predefinedType", keyword: "string" },
        identifierType("global::js.RegExp"),
      ],
      runtimeUnionArity: 2,
    };

    const projected = tryBuildRuntimeUnionProjectionToLayoutAst({
      valueAst: identifierExpression("value"),
      sourceLayout,
      targetLayout,
      context,
      candidateMemberNs: [2, 5],
      selectedSourceMemberNs: new Set([5]),
      buildMappedMemberValue: ({ parameterExpr, context: nextContext }) => [
        parameterExpr,
        nextContext,
      ],
      buildExcludedMemberBody: () => identifierExpression("excluded"),
    });

    expect(projected?.[0]).to.deep.equal({
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("value"),
        memberName: "Match",
      },
      arguments: [
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: "__tsonic_union_member_1" }],
          body: identifierExpression("excluded"),
        },
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: "__tsonic_union_member_2" }],
          body: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: {
                kind: "typeReferenceExpression",
                type: identifierType("global::Tsonic.Runtime.Union", [
                  { kind: "predefinedType", keyword: "string" },
                  identifierType("global::js.RegExp"),
                ]),
              },
              memberName: "From2",
            },
            arguments: [identifierExpression("__tsonic_union_member_2")],
          },
        },
      ],
    });
  });
});
