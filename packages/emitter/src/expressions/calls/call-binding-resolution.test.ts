import { describe, it } from "mocha";
import { expect } from "chai";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { resolveRecoveredReceiverBinding } from "./call-binding-resolution.js";
import type { EmitterContext } from "../../types.js";

const createContext = (patch: Partial<EmitterContext> = {}): EmitterContext =>
  ({
    indentLevel: 0,
    options: {
      rootNamespace: "Test",
      indent: 2,
    },
    isStatic: false,
    isAsync: false,
    usings: new Set<string>(),
    ...patch,
  }) as EmitterContext;

describe("resolveRecoveredReceiverBinding", () => {
  it("does not hijack imported static type calls via registry fallback", () => {
    const context = createContext({
      importBindings: new Map([
        [
          "Buffer",
          {
            kind: "type",
            typeAst: identifierType("global::MyApp.Buffer"),
          },
        ],
      ]),
      bindingsRegistry: new Map([
        [
          "System.Buffer",
          {
            alias: "Buffer",
            name: "Buffer",
            kind: "class",
            members: [
              {
                kind: "method",
                name: "ByteLength",
                binding: {
                  assembly: "System.Runtime",
                  type: "System.Buffer",
                  member: "ByteLength",
                },
              },
            ],
          } as never,
        ],
      ]),
    });

    const result = resolveRecoveredReceiverBinding(
      {
        kind: "call",
        callee: {
          kind: "memberAccess",
          object: {
            kind: "identifier",
            name: "Buffer",
          },
          property: "byteLength",
          isComputed: false,
          isOptional: false,
        },
        arguments: [
          { kind: "literal", value: "hello", raw: '"hello"' },
          { kind: "literal", value: "utf8", raw: '"utf8"' },
        ],
      } as never,
      context
    );

    expect(result).to.equal(undefined);
  });
});
