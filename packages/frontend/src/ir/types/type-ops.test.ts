import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "./index.js";
import { substituteIrType } from "./ir-substitution.js";
import {
  getAwaitedIrType,
  isAwaitableIrType,
  irTypesEqual,
  normalizedUnionType,
  runtimeUnionCarrierFamilyKey,
  stableIrTypeKey,
  stampRuntimeUnionAliasCarrier,
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

  middlewareLike.types.push(
    routerType,
    applicationType,
    middlewareArray,
    middlewareTuple
  );
  return middlewareLike;
};

const createRecursiveGenericBox = (): IrType => {
  const boxType = {
    kind: "referenceType",
    name: "Box",
    structuralMembers: [],
  } as unknown as Extract<IrType, { kind: "referenceType" }> & {
    structuralMembers: unknown[];
  };

  boxType.structuralMembers = [
    {
      kind: "propertySignature",
      name: "value",
      isReadonly: false,
      isOptional: false,
      type: { kind: "typeParameterType", name: "T" },
    },
    {
      kind: "propertySignature",
      name: "next",
      isReadonly: false,
      isOptional: false,
      type: boxType,
    },
  ];

  return boxType;
};


const createFreshNamedRecursiveBox = (valueType: IrType): IrType => {
  const createBox = (): Extract<IrType, { kind: "referenceType" }> => {
    const box = {
      kind: "referenceType",
      name: "RecursiveBox",
      typeArguments: [valueType],
    } as unknown as Extract<IrType, { kind: "referenceType" }> & {
      structuralMembers: readonly unknown[];
    };

    Object.defineProperty(box, "structuralMembers", {
      configurable: true,
      enumerable: true,
      get: () => [
        {
          kind: "propertySignature",
          name: "value",
          isReadonly: false,
          isOptional: false,
          type: valueType,
        },
        {
          kind: "propertySignature",
          name: "next",
          isReadonly: false,
          isOptional: false,
          type: createBox(),
        },
        {
          kind: "methodSignature",
          name: "equals",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "other" },
              type: createBox(),
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: booleanType,
        },
      ],
    });

    return box;
  };

  return createBox();
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

  it("canonicalizes CLR reference identities in stable keys", () => {
    const emittedSurface: IrType = {
      kind: "referenceType",
      name: "Span",
      resolvedClrType: "global::System.Span<int>",
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };
    const metadataSurface: IrType = {
      kind: "referenceType",
      name: "Span_1",
      resolvedClrType: "System.Span`1",
      typeArguments: [{ kind: "primitiveType", name: "int" }],
    };

    expect(stableIrTypeKey(emittedSurface)).to.equal(
      stableIrTypeKey(metadataSurface)
    );
  });

  it("uses TypeId stable IDs before CLR display names", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-a:Acme.Widget",
        clrName: "Acme.Widget",
        assemblyName: "PackageA",
        tsName: "Widget",
      },
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Widget",
      typeId: {
        stableId: "package-b:Acme.Widget",
        clrName: "Acme.Widget",
        assemblyName: "PackageB",
        tsName: "Widget",
      },
    };

    expect(stableIrTypeKey(left)).not.to.equal(stableIrTypeKey(right));
    expect(irTypesEqual(left, right)).to.equal(false);
  });

  it("does not compare identity-less references by simple name", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Widget",
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Widget",
    };

    expect(() => stableIrTypeKey(left)).to.throw(
      "Cannot build stable type key for identity-less reference type 'Widget'"
    );
    expect(irTypesEqual(left, right)).to.equal(false);
  });

  it("preserves identity-less union references instead of deduping by simple name", () => {
    const left: IrType = {
      kind: "referenceType",
      name: "Widget",
    };
    const right: IrType = {
      kind: "referenceType",
      name: "Widget",
    };

    const normalized = normalizedUnionType([left, right]);
    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(normalized.types).to.have.length(2);
    expect(normalized.types[0]).to.equal(left);
    expect(normalized.types[1]).to.equal(right);
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

  it("drops literal members when the matching primitive is present", () => {
    const normalized = normalizedUnionType([
      { kind: "literalType", value: "route" },
      { kind: "literalType", value: "router" },
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "undefined" },
    ]);

    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(normalized.types).to.deep.equal([
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "undefined" },
    ]);
  });

  it("collapses duplicate unions created by substitution", () => {
    const duplicated: IrType = {
      kind: "unionType",
      types: [
        { kind: "typeParameterType", name: "TResult" },
        { kind: "typeParameterType", name: "T" },
      ],
    };

    const substituted = substituteIrType(
      duplicated,
      new Map<string, IrType>([
        ["T", stringType],
        ["TResult", stringType],
      ])
    );

    expect(substituted).to.deep.equal(stringType);
  });

  it("does not assign runtime carrier family keys to normalized unions", () => {
    const normalized = normalizedUnionType([
      { kind: "typeParameterType", name: "TElement" },
      stringType,
    ]);

    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(normalized.runtimeCarrierFamilyKey).to.equal(undefined);
  });

  it("canonicalizes raw union family keys across nested unions and nullish wrappers", () => {
    const callbackType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };
    const raw: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "unionType",
          types: [callbackType, stringType],
        },
        { kind: "primitiveType", name: "null" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };
    const normalized = normalizedUnionType([callbackType, stringType]);

    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(runtimeUnionCarrierFamilyKey(raw)).to.equal(
      runtimeUnionCarrierFamilyKey(normalized)
    );
  });

  it("preserves duplicate runtime slots in preserve-layout family keys", () => {
    const duplicated: Extract<IrType, { kind: "unionType" }> = {
      kind: "unionType",
      preserveRuntimeLayout: true,
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
        { kind: "primitiveType", name: "string" },
      ],
    };

    expect(runtimeUnionCarrierFamilyKey(duplicated)).to.equal(
      "runtime-union:preserve:prim:string|prim:string"
    );
  });

  it("preserves explicit runtime carrier family keys across substitution", () => {
    const genericUnion = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        {
          kind: "arrayType",
          elementType: { kind: "typeParameterType", name: "TElement" },
        },
        stringType,
      ]),
      {
        aliasName: "BytesOrString",
        fullyQualifiedName: "Test.BytesOrString",
      }
    );

    expect(genericUnion.kind).to.equal("unionType");
    if (genericUnion.kind !== "unionType") return;

    const substituted = substituteIrType(
      genericUnion,
      new Map<string, IrType>([
        [
          "TElement",
          {
            kind: "referenceType",
            name: "byte",
            resolvedClrType: "System.Byte",
          },
        ],
      ])
    );

    expect(substituted.kind).to.equal("unionType");
    if (substituted.kind !== "unionType") return;
    expect(substituted.runtimeCarrierFamilyKey).to.equal(
      genericUnion.runtimeCarrierFamilyKey
    );
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

  it("does not encode incidental object sharing in stable type keys", () => {
    const sharedElement: IrType = { kind: "referenceType", name: "int" };
    const sharedTuple: IrType = {
      kind: "tupleType",
      elementTypes: [sharedElement, sharedElement],
    };
    const distinctTuple: IrType = {
      kind: "tupleType",
      elementTypes: [
        { kind: "referenceType", name: "int" },
        { kind: "referenceType", name: "int" },
      ],
    };

    expect(stableIrTypeKey(sharedTuple)).to.equal(
      stableIrTypeKey(distinctTuple)
    );
    expect(irTypesEqual(sharedTuple, distinctTuple)).to.equal(true);
  });

  it("builds stable keys for freshly materialized named recursive references", () => {
    const left = createFreshNamedRecursiveBox(stringType);
    const right = createFreshNamedRecursiveBox(stringType);

    expect(() => stableIrTypeKey(left)).not.to.throw();
    expect(stableIrTypeKey(left)).to.contain("cycle:");
    expect(stableIrTypeKey(left)).to.equal(stableIrTypeKey(right));
    expect(irTypesEqual(left, right)).to.equal(true);
  });

  it("distinguishes freshly materialized named recursive references by type arguments", () => {
    const left = createFreshNamedRecursiveBox(stringType);
    const right = createFreshNamedRecursiveBox(numberType);

    expect(stableIrTypeKey(left)).not.to.equal(stableIrTypeKey(right));
    expect(irTypesEqual(left, right)).to.equal(false);
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

  it("substitutes recursive structural graphs without overflowing", () => {
    const recursive = createRecursiveGenericBox();

    const substituted = substituteIrType(
      recursive,
      new Map<string, IrType>([["T", stringType]])
    );

    expect(() => stableIrTypeKey(substituted)).not.to.throw();
    expect(substituted.kind).to.equal("referenceType");
    if (substituted.kind !== "referenceType") return;

    const valueMember = substituted.structuralMembers?.find(
      (member) => member.kind === "propertySignature" && member.name === "value"
    );
    expect(valueMember).to.not.equal(undefined);
    if (!valueMember || valueMember.kind !== "propertySignature") return;
    expect(valueMember.type).to.deep.equal(stringType);

    const nextMember = substituted.structuralMembers?.find(
      (member) => member.kind === "propertySignature" && member.name === "next"
    );
    expect(nextMember).to.not.equal(undefined);
    if (!nextMember || nextMember.kind !== "propertySignature") return;
    expect(stableIrTypeKey(nextMember.type)).to.equal(
      stableIrTypeKey(substituted)
    );
  });
});
