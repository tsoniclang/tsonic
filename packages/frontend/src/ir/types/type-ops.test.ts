import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "./index.js";
import {
  getAwaitedIrType,
  isAwaitableIrType,
  irTypesEqual,
  normalizedUnionType,
  stableIrTypeKey,
  unwrapAsyncWrapperType,
} from "./type-ops.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };
const booleanType: IrType = { kind: "primitiveType", name: "boolean" };

const createRecursiveMiddlewareGraph = (): IrType => {
  const routerType = {
    kind: "referenceType",
    name: "Router",
    structuralMembers: [],
  } as unknown as Extract<IrType, { kind: "referenceType" }> & {
    structuralMembers: unknown[];
  };

  const middlewareLike = {
    kind: "unionType",
    types: [] as IrType[],
  } as unknown as Extract<IrType, { kind: "unionType" }> & {
    types: IrType[];
  };

  const middlewareArray: IrType = {
    kind: "arrayType",
    elementType: middlewareLike,
  };

  (
    routerType
  ).structuralMembers = [
    {
      kind: "methodSignature",
      name: "use",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "handlers" },
          type: middlewareLike,
          initializer: undefined,
          isOptional: false,
          isRest: true,
          passing: "value",
        },
      ],
      returnType: routerType,
    },
  ];

  middlewareLike.types.push(routerType, middlewareArray);
  return middlewareLike;
};

const createWideRecursiveMiddlewareGraph = (): IrType => {
  const routerType = {
    kind: "referenceType",
    name: "Router",
    structuralMembers: [],
  } as unknown as Extract<IrType, { kind: "referenceType" }> & {
    structuralMembers: unknown[];
  };

  const applicationType = {
    kind: "referenceType",
    name: "Application",
    structuralMembers: [],
  } as unknown as Extract<IrType, { kind: "referenceType" }> & {
    structuralMembers: unknown[];
  };

  const middlewareLike = {
    kind: "unionType",
    types: [] as IrType[],
  } as unknown as Extract<IrType, { kind: "unionType" }> & {
    types: IrType[];
  };

  const middlewareArray: IrType = {
    kind: "arrayType",
    elementType: middlewareLike,
  };
  const middlewareTuple: IrType = {
    kind: "tupleType",
    elementTypes: [middlewareLike, middlewareArray],
  };
  const middlewareMap: IrType = {
    kind: "dictionaryType",
    keyType: stringType,
    valueType: middlewareLike,
  };

  routerType.structuralMembers = [
    {
      kind: "methodSignature",
      name: "use",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "handlers" },
          type: middlewareLike,
          initializer: undefined,
          isOptional: false,
          isRest: true,
          passing: "value",
        },
      ],
      returnType: applicationType,
    },
    {
      kind: "methodSignature",
      name: "mount",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "path" },
          type: stringType,
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "handlers" },
          type: middlewareLike,
          initializer: undefined,
          isOptional: false,
          isRest: true,
          passing: "value",
        },
      ],
      returnType: applicationType,
    },
    {
      kind: "propertySignature",
      name: "table",
      isReadonly: true,
      isOptional: false,
      type: middlewareMap,
    },
  ];

  applicationType.structuralMembers = [
    ...routerType.structuralMembers,
    {
      kind: "propertySignature",
      name: "stack",
      isReadonly: false,
      isOptional: false,
      type: middlewareArray,
    },
    {
      kind: "propertySignature",
      name: "pair",
      isReadonly: false,
      isOptional: false,
      type: middlewareTuple,
    },
  ];

  middlewareLike.types.push(routerType, applicationType, middlewareArray, middlewareTuple);
  return middlewareLike;
};

describe("type-ops", () => {
  it("treats union member order as equal", () => {
    const left: IrType = {
      kind: "unionType",
      types: [stringType, numberType, booleanType],
    };
    const right: IrType = {
      kind: "unionType",
      types: [booleanType, stringType, numberType],
    };

    expect(irTypesEqual(left, right)).to.equal(true);
    expect(stableIrTypeKey(left)).to.equal(stableIrTypeKey(right));
  });

  it("normalizes and deduplicates nested unions", () => {
    const nested: IrType = {
      kind: "unionType",
      types: [
        stringType,
        {
          kind: "unionType",
          types: [numberType, stringType],
        },
      ],
    };

    const normalized = normalizedUnionType([nested, booleanType]);
    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(normalized.types).to.have.length(3);
    const keys = normalized.types.map((t) => stableIrTypeKey(t));
    expect(keys).to.deep.equal([
      stableIrTypeKey(booleanType),
      stableIrTypeKey(numberType),
      stableIrTypeKey(stringType),
    ]);
  });

  it("unwraps Promise/Task/ValueTask wrappers", () => {
    const payload: IrType = { kind: "primitiveType", name: "int" };

    const promiseType: IrType = {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [payload],
    };
    const taskType: IrType = {
      kind: "referenceType",
      name: "System.Threading.Tasks.Task_1",
      resolvedClrType: "System.Threading.Tasks.Task`1[[System.Int32]]",
      typeArguments: [payload],
    };
    const valueTaskType: IrType = {
      kind: "referenceType",
      name: "ValueTask_1",
      resolvedClrType: "System.Threading.Tasks.ValueTask`1[[System.Int32]]",
      typeArguments: [payload],
    };
    const plainType: IrType = {
      kind: "referenceType",
      name: "List_1",
      typeArguments: [payload],
    };

    expect(unwrapAsyncWrapperType(promiseType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(taskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(valueTaskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(plainType)).to.equal(undefined);
  });

  it("treats non-generic Task and ValueTask as awaitable void wrappers", () => {
    const taskType: IrType = {
      kind: "referenceType",
      name: "Task",
      resolvedClrType: "System.Threading.Tasks.Task",
      typeArguments: [],
    };
    const valueTaskType: IrType = {
      kind: "referenceType",
      name: "ValueTask",
      resolvedClrType: "System.Threading.Tasks.ValueTask",
      typeArguments: [],
    };

    expect(isAwaitableIrType(taskType)).to.equal(true);
    expect(isAwaitableIrType(valueTaskType)).to.equal(true);
    expect(getAwaitedIrType(taskType)).to.deep.equal({ kind: "voidType" });
    expect(getAwaitedIrType(valueTaskType)).to.deep.equal({
      kind: "voidType",
    });
    expect(unwrapAsyncWrapperType(taskType)).to.equal(undefined);
    expect(unwrapAsyncWrapperType(valueTaskType)).to.equal(undefined);
  });

  it("unwraps fully-qualified Task and ValueTask wrappers using type arguments", () => {
    const payload: IrType = { kind: "primitiveType", name: "string" };
    const taskType: IrType = {
      kind: "referenceType",
      name: "System.Threading.Tasks.Task",
      resolvedClrType: "global::System.Threading.Tasks.Task",
      typeArguments: [payload],
    };
    const valueTaskType: IrType = {
      kind: "referenceType",
      name: "System.Threading.Tasks.ValueTask",
      resolvedClrType: "global::System.Threading.Tasks.ValueTask",
      typeArguments: [payload],
    };

    expect(isAwaitableIrType(taskType)).to.equal(true);
    expect(isAwaitableIrType(valueTaskType)).to.equal(true);
    expect(getAwaitedIrType(taskType)).to.deep.equal(payload);
    expect(getAwaitedIrType(valueTaskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(taskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(valueTaskType)).to.deep.equal(payload);
  });

  it("builds stable keys for recursive structural graphs without overflowing", () => {
    const recursive = createRecursiveMiddlewareGraph();

    expect(() => stableIrTypeKey(recursive)).not.to.throw();
    expect(stableIrTypeKey(recursive)).to.contain("cycle:");
  });

  it("treats structurally equivalent recursive graphs as equal", () => {
    const left = createRecursiveMiddlewareGraph();
    const right = createRecursiveMiddlewareGraph();

    expect(stableIrTypeKey(left)).to.equal(stableIrTypeKey(right));
    expect(irTypesEqual(left, right)).to.equal(true);
  });

  it("builds stable keys for wide recursive graphs deterministically", () => {
    const left = createWideRecursiveMiddlewareGraph();
    const right = createWideRecursiveMiddlewareGraph();

    expect(() => stableIrTypeKey(left)).not.to.throw();
    expect(stableIrTypeKey(left)).to.equal(stableIrTypeKey(right));
    expect(irTypesEqual(left, right)).to.equal(true);
  });
});
