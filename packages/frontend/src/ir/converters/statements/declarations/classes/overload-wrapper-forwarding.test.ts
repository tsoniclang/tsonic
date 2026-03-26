import { expect } from "chai";
import { describe, it } from "mocha";
import { IrParameter, IrType } from "../../../../types.js";
import { buildForwardedCallArguments } from "./overload-wrapper-forwarding.js";

const createParameter = (
  name: string,
  type: IrType,
  isRest = false
): IrParameter => ({
  kind: "parameter",
  pattern: {
    kind: "identifierPattern",
    name,
  },
  type,
  isOptional: false,
  isRest,
  passing: "value",
});

describe("overload wrapper forwarding", () => {
  it("uses typed defaults and helper rest types when forwarding wrapper rest arguments", () => {
    const requestHandlerType: IrType = {
      kind: "referenceType",
      name: "RequestHandler",
    };
    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
    };
    const middlewareLikeType: IrType = {
      kind: "unionType",
      types: [requestHandlerType, routerType],
    };
    const pathSpecType: IrType = {
      kind: "referenceType",
      name: "PathSpec",
    };
    const helperFirstType: IrType = {
      kind: "unionType",
      types: [pathSpecType, middlewareLikeType],
    };
    const wrapperRestType: IrType = {
      kind: "arrayType",
      elementType: middlewareLikeType,
      origin: "explicit",
    };
    const helperRestType: IrType = {
      kind: "arrayType",
      elementType: middlewareLikeType,
      origin: "explicit",
    };

    const forwardedArgs = buildForwardedCallArguments(
      [createParameter("handlers", wrapperRestType, true)],
      [
        createParameter("first", helperFirstType, false),
        createParameter("rest", helperRestType, true),
      ]
    );

    expect(forwardedArgs).to.have.length(2);

    const firstArg = forwardedArgs[0];
    expect(firstArg?.kind).to.equal("conditional");
    if (!firstArg || firstArg.kind !== "conditional") return;

    expect(firstArg.whenTrue.kind).to.equal("typeAssertion");
    if (firstArg.whenTrue.kind === "typeAssertion") {
      expect(firstArg.whenTrue.targetType).to.deep.equal(helperFirstType);
    }
    expect(firstArg.whenFalse.kind).to.equal("defaultof");
    if (firstArg.whenFalse.kind === "defaultof") {
      expect(firstArg.whenFalse.targetType).to.deep.equal(helperFirstType);
    }

    const restArg = forwardedArgs[1];
    expect(restArg?.kind).to.equal("spread");
    if (!restArg || restArg.kind !== "spread") return;
    expect(restArg.expression.inferredType).to.deep.equal(helperRestType);
  });
});
