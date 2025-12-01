/**
 * Test ref/out/in parameter emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitParameters } from "../statements/classes/parameters.js";
import type { IrParameter } from "@tsonic/frontend";
import type { EmitterContext } from "../types.js";

describe("Parameter modifiers (ref/out/in)", () => {
  const baseContext: EmitterContext = {
    indentLevel: 0,
    isStatic: false,
    isAsync: false,
    options: { runtime: "dotnet", rootNamespace: "Test" },
  };

  it("should emit out parameter with out modifier", () => {
    const params: IrParameter[] = [
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "result" },
        type: {
          kind: "referenceType",
          name: "out",
          typeArguments: [
            {
              kind: "referenceType",
              name: "int",
            },
          ],
        },
        isOptional: false,
        isRest: false,
        passing: "out",
      },
    ];

    const [emitted] = emitParameters(params, baseContext);
    expect(emitted).to.equal("out int result");
  });

  it("should emit ref parameter with ref modifier", () => {
    const params: IrParameter[] = [
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "value" },
        type: {
          kind: "referenceType",
          name: "ref",
          typeArguments: [
            {
              kind: "referenceType",
              name: "int",
            },
          ],
        },
        isOptional: false,
        isRest: false,
        passing: "ref",
      },
    ];

    const [emitted] = emitParameters(params, baseContext);
    expect(emitted).to.equal("ref int value");
  });

  it("should emit in parameter with in modifier", () => {
    const params: IrParameter[] = [
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "value" },
        type: {
          kind: "referenceType",
          name: "In",
          typeArguments: [
            {
              kind: "referenceType",
              name: "int",
            },
          ],
        },
        isOptional: false,
        isRest: false,
        passing: "in",
      },
    ];

    const [emitted] = emitParameters(params, baseContext);
    expect(emitted).to.equal("in int value");
  });

  it("should emit multiple parameters with mixed modifiers", () => {
    const params: IrParameter[] = [
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "input" },
        type: {
          kind: "referenceType",
          name: "int",
        },
        isOptional: false,
        isRest: false,
        passing: "value",
      },
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "output" },
        type: {
          kind: "referenceType",
          name: "out",
          typeArguments: [
            {
              kind: "referenceType",
              name: "int",
            },
          ],
        },
        isOptional: false,
        isRest: false,
        passing: "out",
      },
      {
        kind: "parameter",
        pattern: { kind: "identifierPattern", name: "counter" },
        type: {
          kind: "referenceType",
          name: "ref",
          typeArguments: [
            {
              kind: "referenceType",
              name: "int",
            },
          ],
        },
        isOptional: false,
        isRest: false,
        passing: "ref",
      },
    ];

    const [emitted] = emitParameters(params, baseContext);
    expect(emitted).to.equal("int input, out int output, ref int counter");
  });
});
