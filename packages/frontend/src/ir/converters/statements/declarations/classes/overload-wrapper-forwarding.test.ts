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
    expect(restArg.expression.kind).to.equal("call");
    if (restArg.expression.kind !== "call") return;
    expect(restArg.expression.callee.kind).to.equal("memberAccess");
    if (restArg.expression.callee.kind !== "memberAccess") return;
    expect(restArg.expression.callee.memberBinding).to.deep.equal({
      kind: "method",
      assembly: "__synthetic",
      type: "Array",
      member: "slice",
      emitSemantics: {
        callStyle: "receiver",
      },
    });
  });

  it("preserves implementation defaults when forwarding optional wrapper parameters", () => {
    const intType: IrType = {
      kind: "primitiveType",
      name: "int",
    };
    const numberType: IrType = {
      kind: "primitiveType",
      name: "number",
    };
    const targetUnion: IrType = {
      kind: "unionType",
      types: [intType, numberType],
    };

    const wrapperParam: IrParameter = {
      ...createParameter("offsetOrValue", intType),
      isOptional: true,
    };
    const helperParam: IrParameter = {
      ...createParameter("offsetOrValue", targetUnion),
      initializer: {
        kind: "literal",
        value: 0,
        inferredType: intType,
      },
    };

    const forwardedArgs = buildForwardedCallArguments(
      [createParameter("sourceOrIndex", intType), wrapperParam],
      [createParameter("sourceOrIndex", intType), helperParam]
    );

    expect(forwardedArgs).to.have.length(2);

    const arg = forwardedArgs[1];
    expect(arg?.kind).to.equal("typeAssertion");
    if (!arg || arg.kind !== "typeAssertion") return;
    expect(arg.targetType).to.deep.equal(targetUnion);
    expect(arg.expression.kind).to.equal("logical");
    if (arg.expression.kind !== "logical") return;
    expect(arg.expression.operator).to.equal("??");
    expect(arg.expression.left.kind).to.equal("identifier");
    expect(arg.expression.right.kind).to.equal("literal");
  });

  it("attaches literal numeric proof when forwarding numeric default initializers", () => {
    const intType: IrType = {
      kind: "primitiveType",
      name: "int",
    };

    const forwardedArgs = buildForwardedCallArguments(
      [
        createParameter("source", intType),
        {
          ...createParameter("offset", intType),
          isOptional: true,
        },
      ],
      [
        createParameter("source", intType),
        {
          ...createParameter("offset", intType),
          initializer: {
            kind: "numericNarrowing",
            expression: {
              kind: "literal",
              value: 0,
              inferredType: { kind: "referenceType", name: "int" },
            },
            targetKind: "Int32",
            inferredType: intType,
          },
        },
      ]
    );

    const arg = forwardedArgs[1];
    expect(arg?.kind).to.equal("logical");
    if (!arg || arg.kind !== "logical") return;
    expect(arg.right.kind).to.equal("numericNarrowing");
    if (arg.right.kind !== "numericNarrowing") return;
    expect(arg.right.proof).to.deep.equal({
      kind: "Int32",
      source: { type: "literal", value: 0 },
    });
  });
});
