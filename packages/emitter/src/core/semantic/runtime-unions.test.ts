import { describe, it } from "mocha";
import { expect } from "chai";
import {
  normalizedUnionType,
  stampRuntimeUnionAliasCarrier,
  type IrType,
  type IrInterfaceMember,
} from "@tsonic/frontend";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findExactRuntimeUnionMemberIndices,
  getCanonicalRuntimeUnionMembers,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import { resolveNarrowedUnionMembers } from "./narrowed-union-resolution.js";
import { emitTypeAst } from "../../types/emitter.js";
import { createContext } from "../../emitter-types/context.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { printType } from "../format/backend-ast/printer-precedence.js";
import type { TypeAliasIndex } from "../../emitter-types/core.js";
import type { LocalTypeInfo } from "../../types.js";
import { substituteTypeArgs } from "./type-resolution.js";
import { createRuntimeUnionRegistry } from "./runtime-union-registry.js";

const property = (
  name: string,
  type: IrType
): Extract<IrInterfaceMember, { kind: "propertySignature" }> => ({
  kind: "propertySignature",
  name,
  type,
  isOptional: false,
  isReadonly: false,
});

describe("runtime-unions", () => {
  it("orders structural union members by semantic shape instead of carrier name", () => {
    const successMember: IrType = {
      kind: "referenceType",
      name: "__Anon_success",
      resolvedClrType: "Test.__Anon_success",
      structuralMembers: [
        property("success", { kind: "literalType", value: true }),
        property("rendered", { kind: "primitiveType", name: "string" }),
      ],
    };

    const errorMember: IrType = {
      kind: "referenceType",
      name: "RenderResult__0",
      resolvedClrType: "Test.RenderResult__0",
      structuralMembers: [
        property("success", { kind: "literalType", value: false }),
        property("error", { kind: "primitiveType", name: "string" }),
      ],
    };

    const unionType: IrType = {
      kind: "unionType",
      types: [successMember, errorMember],
    };

    const context = createContext({ rootNamespace: "Test" });
    const [layout] = buildRuntimeUnionLayout(unionType, context, emitTypeAst);

    expect(
      layout?.members.map((member) => {
        if (member.kind !== "referenceType") return member.kind;
        return member.name;
      })
    ).to.deep.equal(["RenderResult__0", "__Anon_success"]);
  });

  it("does not exact-match same-name reference members with conflicting TypeIds", () => {
    const repoItem: IrType = {
      kind: "referenceType",
      name: "Item",
      resolvedClrType: "Fixture.Channels.repo.Item",
      typeId: {
        stableId: "source:@fixture/channels:repo.Item",
        tsName: "Item",
        clrName: "Fixture.Channels.repo.Item",
        assemblyName: "@fixture/channels",
      },
      structuralMembers: [
        property("id", { kind: "primitiveType", name: "int" }),
      ],
    };
    const domainItem: IrType = {
      kind: "referenceType",
      name: "Item",
      resolvedClrType: "Fixture.Channels.domain.Item",
      typeId: {
        stableId: "source:@fixture/channels:domain.Item",
        tsName: "Item",
        clrName: "Fixture.Channels.domain.Item",
        assemblyName: "@fixture/channels",
      },
      structuralMembers: [
        property("id", { kind: "primitiveType", name: "int" }),
      ],
    };

    const indices = findExactRuntimeUnionMemberIndices(
      [repoItem],
      domainItem,
      createContext({ rootNamespace: "Fixture" })
    );

    expect(indices).to.deep.equal([]);
  });

  it("preserves order for opaque nominal union members without forcing local type emission", () => {
    const unionType: IrType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "MyApp.OkEvents" },
        { kind: "referenceType", name: "MyApp.ErrEvents" },
      ],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(unionType, context);

    expect(
      frame?.members.map((member) => {
        if (member.kind !== "referenceType") return member.kind;
        return member.name;
      })
    ).to.deep.equal(["MyApp.OkEvents", "MyApp.ErrEvents"]);
    expect(frame?.runtimeUnionArity).to.equal(2);
  });

  it("keeps emitted runtime-union layout order aligned with narrowing frame order", () => {
    const bindOptions: IrType = {
      kind: "referenceType",
      name: "BindOptions",
      resolvedClrType: "Test.BindOptions",
      structuralMembers: [
        property("fd", { kind: "primitiveType", name: "int" }),
        property("port", { kind: "primitiveType", name: "int" }),
      ],
    };

    const callback: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const unionType: IrType = {
      kind: "unionType",
      types: [callback, { kind: "primitiveType", name: "int" }, bindOptions],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(unionType, context);
    const [layout] = buildRuntimeUnionLayout(unionType, context, emitTypeAst);

    const frameOrder = frame?.members.map((member) => {
      if (member.kind === "primitiveType") return member.name;
      if (member.kind === "referenceType") return member.name;
      return member.kind;
    });
    const layoutOrder = layout?.members.map((member) => {
      if (member.kind === "primitiveType") return member.name;
      if (member.kind === "referenceType") return member.name;
      return member.kind;
    });

    expect(layoutOrder).to.deep.equal(frameOrder);
  });

  it("reuses anonymous runtime-union carriers across generic specializations", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const openContext = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      typeParameters: new Set(["TElement"]),
    };

    const openUnion: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        {
          kind: "referenceType",
          name: "TypedArrayInput",
          resolvedClrType: "Test.TypedArrayInput",
          typeArguments: [{ kind: "typeParameterType", name: "TElement" }],
        },
      ],
    };

    const [openLayout] = buildRuntimeUnionLayout(
      openUnion,
      openContext,
      emitTypeAst
    );

    const closedUnion = substituteTypeArgs(
      openUnion,
      ["TElement"],
      [{ kind: "primitiveType", name: "string" }]
    );
    const [closedLayout] = buildRuntimeUnionLayout(
      closedUnion,
      createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      emitTypeAst
    );

    expect(openLayout?.carrierName).to.equal(closedLayout?.carrierName);
  });

  it("marks source-owned runtime union carriers public when their alias is promoted", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const middlewareLike = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "int" },
      ]),
      {
        aliasName: "MiddlewareLike",
        fullyQualifiedName: "Test.MiddlewareLike",
      }
    ) as Extract<IrType, { kind: "unionType" }>;

    const context = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "MiddlewareLike",
          {
            kind: "typeAlias" as const,
            isExported: false,
            typeParameters: [],
            type: middlewareLike,
          },
        ],
      ]),
      publicLocalTypes: new Set(["MiddlewareLike"]),
    };

    const [layout] = buildRuntimeUnionLayout(
      {
        kind: "referenceType",
        name: "MiddlewareLike",
        resolvedClrType: "Test.MiddlewareLike",
      },
      context,
      emitTypeAst
    );

    expect(layout?.carrierName).to.equal("MiddlewareLike");
    expect(
      runtimeUnionRegistry.definitionsByName.get("Test.MiddlewareLike")
        ?.accessModifier
    ).to.equal("public");
  });

  it("upgrades source-owned runtime union carriers when a later public registration arrives", () => {
    const runtimeUnionRegistry = createRuntimeUnionRegistry();
    const middlewareLike = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "int" },
      ]),
      {
        aliasName: "MiddlewareLike",
        fullyQualifiedName: "Test.MiddlewareLike",
      }
    ) as Extract<IrType, { kind: "unionType" }>;

    const internalContext = {
      ...createContext({
        rootNamespace: "Test",
        runtimeUnionRegistry,
      }),
      moduleNamespace: "Test",
      localTypes: new Map([
        [
          "MiddlewareLike",
          {
            kind: "typeAlias" as const,
            isExported: false,
            typeParameters: [],
            type: middlewareLike,
          },
        ],
      ]),
    };
    buildRuntimeUnionLayout(
      {
        kind: "referenceType",
        name: "MiddlewareLike",
        resolvedClrType: "Test.MiddlewareLike",
      },
      internalContext,
      emitTypeAst
    );

    const publicContext = {
      ...internalContext,
      publicLocalTypes: new Set(["MiddlewareLike"]),
    };
    buildRuntimeUnionLayout(
      {
        kind: "referenceType",
        name: "MiddlewareLike",
        resolvedClrType: "Test.MiddlewareLike",
      },
      publicContext,
      emitTypeAst
    );

    expect(
      runtimeUnionRegistry.definitionsByName.get("Test.MiddlewareLike")
    ).to.deep.include({
      name: "MiddlewareLike",
      namespaceName: "Test",
      fullName: "Test.MiddlewareLike",
      accessModifier: "public",
    });
  });

  it("preserves original runtime member slots for expr-narrowed unions", () => {
    const bindOptions: IrType = {
      kind: "referenceType",
      name: "BindOptions",
      resolvedClrType: "Test.BindOptions",
      structuralMembers: [
        property("fd", { kind: "primitiveType", name: "int" }),
        property("port", { kind: "primitiveType", name: "int" }),
      ],
    };

    const callback: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const sourceType: IrType = {
      kind: "unionType",
      types: [
        callback,
        { kind: "primitiveType", name: "int" },
        bindOptions,
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const narrowedType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        bindOptions,
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    const context = createContext({ rootNamespace: "Test" });
    const narrowedMembers = resolveNarrowedUnionMembers("value", narrowedType, {
      ...context,
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: identifierExpression("value"),
            type: narrowedType,
            sourceType,
          },
        ],
      ]),
    });

    expect(
      narrowedMembers?.members.map((member) => {
        if (member.kind === "primitiveType") return member.name;
        if (member.kind === "referenceType") return member.name;
        return member.kind;
      })
    ).to.deep.equal(["int", "BindOptions"]);
    expect(narrowedMembers?.candidateMemberNs).to.deep.equal([2, 3]);
    expect(narrowedMembers?.runtimeUnionArity).to.equal(3);
  });

  it("preserves explicit duplicate runtime carrier slots when requested", () => {
    const duplicatedCarrier: IrType = {
      kind: "unionType",
      preserveRuntimeLayout: true,
      types: [
        {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        },
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "object",
            resolvedClrType: "System.Object",
          },
          origin: "explicit",
        },
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "object",
            resolvedClrType: "System.Object",
          },
          origin: "explicit",
        },
      ],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(duplicatedCarrier, context);
    const [layout] = buildRuntimeUnionLayout(
      duplicatedCarrier,
      context,
      emitTypeAst
    );

    expect(frame?.runtimeUnionArity).to.equal(3);
    expect(frame?.members).to.have.length(3);
    expect(layout?.runtimeUnionArity).to.equal(3);
    expect(layout?.members).to.have.length(3);
    expect(layout?.memberTypeAsts).to.have.length(3);
  });

  it("aligns expr-narrowed candidate slots to preserved carrier order even when semantic keys match", () => {
    const anyArrayValue: IrType = {
      kind: "referenceType",
      name: "AnyArrayValue",
      resolvedClrType: "Test.AnyArrayValue",
    };
    const pageArrayValue: IrType = {
      kind: "referenceType",
      name: "PageArrayValue",
      resolvedClrType: "Test.PageArrayValue",
    };
    const stringValue: IrType = {
      kind: "referenceType",
      name: "StringValue",
      resolvedClrType: "Test.StringValue",
    };

    const sourceCarrier = stampRuntimeUnionAliasCarrier(
      {
        kind: "unionType",
        types: [anyArrayValue, pageArrayValue, stringValue],
      },
      {
        aliasName: "Value",
        fullyQualifiedName: "Test.Value",
        namespaceName: "Test",
        typeParameters: [],
      }
    );

    const narrowedType: IrType = {
      kind: "unionType",
      types: [pageArrayValue, stringValue, anyArrayValue],
    };

    const context = createContext({ rootNamespace: "Test" });
    const narrowedMembers = resolveNarrowedUnionMembers("value", narrowedType, {
      ...context,
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: identifierExpression("value"),
            type: narrowedType,
            sourceType: sourceCarrier,
          },
        ],
      ]),
    });

    expect(
      narrowedMembers?.members.map((member) => {
        if (member.kind === "referenceType") return member.name;
        return member.kind;
      })
    ).to.deep.equal(["AnyArrayValue", "PageArrayValue", "StringValue"]);
    expect(narrowedMembers?.candidateMemberNs).to.deep.equal([1, 2, 3]);
    expect(narrowedMembers?.runtimeUnionArity).to.equal(3);
  });

  it("prefers source-owned carrier identity over incidental local semantic ordering", () => {
    const stringValue: IrType = {
      kind: "referenceType",
      name: "StringValue",
      resolvedClrType: "Test.StringValue",
      structuralMembers: [
        property("value", { kind: "primitiveType", name: "string" }),
      ],
    };
    const pageArrayValue: IrType = {
      kind: "referenceType",
      name: "PageArrayValue",
      resolvedClrType: "Test.PageArrayValue",
      structuralMembers: [
        property("value", {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
        }),
      ],
    };
    const anyArrayValue: IrType = {
      kind: "referenceType",
      name: "AnyArrayValue",
      resolvedClrType: "Test.AnyArrayValue",
      structuralMembers: [
        property("value", {
          kind: "referenceType",
          name: "List",
          resolvedClrType: "System.Collections.Generic.List",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        }),
      ],
    };

    const sourceCarrier = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([stringValue, pageArrayValue, anyArrayValue]),
      {
        aliasName: "Value",
        fullyQualifiedName: "Test.Value",
        namespaceName: "Test",
        typeParameters: [],
      }
    );
    const effectiveType: IrType = {
      kind: "unionType",
      types: [pageArrayValue, stringValue, anyArrayValue],
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localSemanticTypes: new Map<string, IrType>([["value", effectiveType]]),
      localValueTypes: new Map<string, IrType>([["value", sourceCarrier]]),
    };

    const narrowedMembers = resolveNarrowedUnionMembers(
      "value",
      effectiveType,
      context
    );

    expect(
      narrowedMembers?.members.map((member) => {
        if (member.kind === "referenceType") return member.name;
        return member.kind;
      })
    ).to.deep.equal(["AnyArrayValue", "PageArrayValue", "StringValue"]);
    expect(narrowedMembers?.candidateMemberNs).to.deep.equal([1, 2, 3]);
    expect(narrowedMembers?.runtimeUnionArity).to.equal(3);
  });

  it("preserves source-owned carrier order when the carrier is referenced through a type alias", () => {
    const stringValue: IrType = {
      kind: "referenceType",
      name: "StringValue",
      resolvedClrType: "Test.StringValue",
      structuralMembers: [
        property("value", { kind: "primitiveType", name: "string" }),
      ],
    };
    const pageArrayValue: IrType = {
      kind: "referenceType",
      name: "PageArrayValue",
      resolvedClrType: "Test.PageArrayValue",
      structuralMembers: [
        property("value", {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
        }),
      ],
    };
    const anyArrayValue: IrType = {
      kind: "referenceType",
      name: "AnyArrayValue",
      resolvedClrType: "Test.AnyArrayValue",
      structuralMembers: [
        property("value", {
          kind: "referenceType",
          name: "List",
          resolvedClrType: "System.Collections.Generic.List",
          typeArguments: [{ kind: "primitiveType", name: "string" }],
        }),
      ],
    };

    const sourceCarrier = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([stringValue, pageArrayValue, anyArrayValue]),
      {
        aliasName: "Value",
        fullyQualifiedName: "Test.Value",
        namespaceName: "Test",
        typeParameters: [],
      }
    );
    const carrierReference: IrType = {
      kind: "referenceType",
      name: "Value",
      resolvedClrType: "Test.Value",
    };
    const effectiveType: IrType = {
      kind: "unionType",
      types: [pageArrayValue, stringValue, anyArrayValue],
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map<string, LocalTypeInfo>([
        [
          "Value",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: sourceCarrier,
          },
        ],
      ]),
      localSemanticTypes: new Map<string, IrType>([["value", effectiveType]]),
      localValueTypes: new Map<string, IrType>([["value", carrierReference]]),
    };

    const narrowedMembers = resolveNarrowedUnionMembers(
      "value",
      effectiveType,
      context
    );

    expect(
      narrowedMembers?.members.map((member) => {
        if (member.kind === "referenceType") return member.name;
        return member.kind;
      })
    ).to.deep.equal(["AnyArrayValue", "PageArrayValue", "StringValue"]);
    expect(narrowedMembers?.candidateMemberNs).to.deep.equal([1, 2, 3]);
    expect(narrowedMembers?.runtimeUnionArity).to.equal(3);
  });

  it("keeps generic template unions on the same carrier family after substitution", () => {
    const genericUnion = stampRuntimeUnionAliasCarrier(
      normalizedUnionType([
        {
          kind: "arrayType",
          elementType: { kind: "typeParameterType", name: "TElement" },
        },
        {
          kind: "referenceType",
          name: "IEnumerable",
          resolvedClrType: "System.Collections.Generic.IEnumerable",
          typeArguments: [{ kind: "primitiveType", name: "number" }],
        },
        { kind: "primitiveType", name: "int" },
      ]),
      {
        aliasName: "IterableOrBytes",
        fullyQualifiedName: "Test.IterableOrBytes",
      }
    ) as Extract<IrType, { kind: "unionType" }>;

    const specializedUnion = substituteTypeArgs(
      genericUnion,
      ["TElement"],
      [
        {
          kind: "referenceType",
          name: "byte",
          resolvedClrType: "System.Byte",
        },
      ]
    );

    const context = createContext({ rootNamespace: "Test" });
    const [genericLayout] = buildRuntimeUnionLayout(
      genericUnion,
      context,
      emitTypeAst
    );
    const [specializedLayout] = buildRuntimeUnionLayout(
      specializedUnion,
      context,
      emitTypeAst
    );

    expect(genericLayout?.carrierName).to.equal(specializedLayout?.carrierName);
  });

  it("maps runtime-union carrier generic void arguments to object", () => {
    const typeAst = buildRuntimeUnionTypeAst({
      members: [],
      memberTypeAsts: [],
      carrierTypeArgumentAsts: [
        { kind: "predefinedType", keyword: "void" },
        { kind: "predefinedType", keyword: "string" },
      ],
      runtimeUnionArity: 2,
      carrierFullName: "Test.Result",
    });

    expect(printType(typeAst)).to.equal("global::Test.Result<object, string>");
  });

  it("preserves original runtime member slots for single-member expr narrowings", () => {
    const interfaceOptions: IrType = {
      kind: "referenceType",
      name: "InterfaceOptions",
      resolvedClrType: "Test.InterfaceOptions",
    };

    const readable: IrType = {
      kind: "referenceType",
      name: "Readable",
      resolvedClrType: "Test.Readable",
    };

    const sourceType: IrType = {
      kind: "unionType",
      types: [interfaceOptions, readable],
    };

    const context = createContext({ rootNamespace: "Test" });
    const narrowedMembers = resolveNarrowedUnionMembers("value", readable, {
      ...context,
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "expr" as const,
            exprAst: identifierExpression("value"),
            type: readable,
            sourceType,
          },
        ],
      ]),
    });

    expect(
      narrowedMembers?.members.map((member) => {
        if (member.kind === "referenceType") {
          return member.name;
        }
        return member.kind;
      })
    ).to.deep.equal(["Readable"]);
    expect(narrowedMembers?.candidateMemberNs).to.deep.equal([2]);
    expect(narrowedMembers?.runtimeUnionArity).to.equal(2);
  });

  it("treats nominal reference members as exact runtime matches even when one side carries structural members", () => {
    const interfaceOptionsMember: IrType = {
      kind: "referenceType",
      name: "InterfaceOptions",
      resolvedClrType: "Test.InterfaceOptions",
      structuralMembers: [
        property("input", { kind: "referenceType", name: "Readable" }),
      ],
    };

    const targetType: IrType = {
      kind: "referenceType",
      name: "InterfaceOptions",
      resolvedClrType: "Test.InterfaceOptions",
    };

    const context = createContext({ rootNamespace: "Test" });
    expect(
      findExactRuntimeUnionMemberIndices(
        [interfaceOptionsMember],
        targetType,
        context
      )
    ).to.deep.equal([0]);
  });

  it("does not treat subclass instanceof targets as exact runtime matches", () => {
    const keyObjectMember: IrType = {
      kind: "referenceType",
      name: "KeyObject",
    };

    const publicKeyTarget: IrType = {
      kind: "referenceType",
      name: "PublicKeyObject",
    };

    const context = createContext({ rootNamespace: "Test" });
    expect(
      findExactRuntimeUnionMemberIndices(
        [keyObjectMember],
        publicKeyTarget,
        context
      )
    ).to.deep.equal([]);
  });

  it("preserves recursive array members semantically in runtime union frames", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "value" },
          type: { kind: "primitiveType", name: "string" },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(handlerType, routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
      origin: "explicit",
    });

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(middlewareLike, context);

    const recursiveArray = frame?.members.find(
      (member) => member?.kind === "arrayType"
    );
    if (!recursiveArray || recursiveArray.kind !== "arrayType") {
      return;
    }

    expect(recursiveArray.elementType).to.deep.equal({
      kind: "referenceType",
      name: "object",
      resolvedClrType: "System.Object",
    });
  });

  it("does not treat erased recursive array members as satisfying a recursive alias subset target", () => {
    const pathSpec = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    pathSpec.types.push(
      { kind: "primitiveType", name: "string" },
      { kind: "referenceType", name: "RegExp", resolvedClrType: "Test.RegExp" },
      {
        kind: "arrayType",
        elementType: pathSpec,
        origin: "explicit",
      }
    );

    const requestHandler: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const sourceUnion: IrType = {
      kind: "unionType",
      types: [pathSpec, requestHandler, routerType],
    };

    const context = createContext({ rootNamespace: "Test" });
    const frame = buildRuntimeUnionFrame(sourceUnion, context);
    expect(frame).to.not.equal(undefined);
    if (!frame) {
      return;
    }

    const matches = findRuntimeUnionMemberIndices(
      frame.members,
      pathSpec,
      context
    );

    expect(matches).to.have.length(2);
    expect(matches.map((index) => frame.members[index]?.kind)).to.deep.equal([
      "primitiveType",
      "referenceType",
    ]);
  });

  it("records semantic recursive element types on erased recursive array members", () => {
    const middlewareLikeRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(
      {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "voidType" },
      },
      {
        kind: "referenceType",
        name: "Router",
        resolvedClrType: "Test.Router",
      },
      {
        kind: "arrayType",
        elementType: middlewareLikeRef,
        origin: "explicit",
      }
    );

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map<string, LocalTypeInfo>([
        [
          "MiddlewareLike",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: middlewareLike,
          },
        ],
      ]),
    };
    const frame = buildRuntimeUnionFrame(middlewareLikeRef, context);
    expect(frame).to.not.equal(undefined);
    if (!frame) {
      return;
    }

    const recursiveArray = frame.members.find(
      (member) => member?.kind === "arrayType"
    );
    expect(recursiveArray).to.not.equal(undefined);
    if (!recursiveArray || recursiveArray.kind !== "arrayType") {
      return;
    }

    expect(recursiveArray.elementType).to.deep.equal({
      kind: "referenceType",
      name: "object",
      resolvedClrType: "System.Object",
    });
    expect(recursiveArray.storageErasedElementType).to.deep.equal(
      middlewareLikeRef
    );
  });

  it("keeps broader recursive alias owners when erased array slots dedupe", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };
    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };
    const middlewareParamRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareParam",
    };
    const middlewareLikeRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
    };
    const middlewareParamUnion: IrType = {
      kind: "unionType",
      types: [
        handlerType,
        {
          kind: "arrayType",
          elementType: middlewareParamRef,
          origin: "explicit",
        },
      ],
    };
    const middlewareLikeUnion: IrType = {
      kind: "unionType",
      types: [
        middlewareParamRef,
        routerType,
        {
          kind: "arrayType",
          elementType: middlewareLikeRef,
          origin: "explicit",
        },
      ],
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localTypes: new Map<string, LocalTypeInfo>([
        [
          "MiddlewareParam",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: middlewareParamUnion,
          },
        ],
        [
          "MiddlewareLike",
          {
            kind: "typeAlias" as const,
            typeParameters: [],
            type: middlewareLikeUnion,
          },
        ],
      ]),
    };

    const frame = buildRuntimeUnionFrame(middlewareLikeRef, context);
    expect(frame).to.not.equal(undefined);
    if (!frame) {
      return;
    }

    const recursiveArray = frame.members.find(
      (member) => member?.kind === "arrayType"
    );
    expect(recursiveArray).to.not.equal(undefined);
    if (!recursiveArray || recursiveArray.kind !== "arrayType") {
      return;
    }

    expect(recursiveArray.storageErasedElementType).to.deep.equal(
      middlewareLikeRef
    );
  });

  describe("cross-module alias stability", () => {
    it("canonical runtime union members must not diverge when typeAliasIndex can expand a cross-module alias", () => {
      // PathSpec is a recursive union alias defined in another module.
      // In a cross-module union like `string | PathSpec`, the canonical
      // members should be [string, PathSpec-as-reference] regardless of
      // whether typeAliasIndex can expand PathSpec.
      //
      // This is the emitter-level invariant behind the PathSpec/mountedAt
      // regression: full-module context must not cause alias expansion to
      // change the canonical member set.

      const pathSpecRef: IrType = {
        kind: "referenceType",
        name: "PathSpec",
        resolvedClrType: "Other.PathSpec",
      };

      // The union as the frontend would emit it: string | PathSpec
      const unionType: IrType = {
        kind: "unionType",
        types: [{ kind: "primitiveType", name: "string" }, pathSpecRef],
      };

      // PathSpec's underlying type (defined in another module)
      const pathSpecUnderlying: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          {
            kind: "referenceType",
            name: "RegExp",
            resolvedClrType: "Other.RegExp",
          },
        ],
      };

      // Context WITHOUT typeAliasIndex: PathSpec is opaque
      const localContext = createContext({ rootNamespace: "Test" });
      const localMembers = getCanonicalRuntimeUnionMembers(
        unionType,
        localContext
      );

      // Context WITH typeAliasIndex: PathSpec can be expanded
      const typeAliasIndex: TypeAliasIndex = {
        byFqn: new Map([
          [
            "Other.PathSpec",
            {
              name: "PathSpec",
              fqn: "Other.PathSpec",
              type: pathSpecUnderlying,
              typeParameters: [],
            },
          ],
        ]),
      };
      const fullContext = createContext({
        rootNamespace: "Test",
        typeAliasIndex,
      });
      const fullMembers = getCanonicalRuntimeUnionMembers(
        unionType,
        fullContext
      );

      // Both contexts should produce the same member count.
      // If typeAliasIndex causes PathSpec to expand into its underlying
      // members (string, RegExp), the full-module path sees 2 distinct
      // members after dedup (string, RegExp) instead of 2 members
      // (string, PathSpec-ref). The member count may be the same but
      // the identity differs — PathSpec as a named reference is lost.
      expect(localMembers?.length).to.equal(2);
      expect(fullMembers?.length).to.equal(localMembers?.length);

      // The members should have the same type kinds.
      // Local: [primitiveType(string), referenceType(PathSpec)]
      // Full (correct): same
      // Full (broken): [primitiveType(string), referenceType(RegExp)] — PathSpec expanded
      const localKinds = localMembers?.map((m) => m.kind);
      const fullKinds = fullMembers?.map((m) => m.kind);
      expect(fullKinds).to.deep.equal(localKinds);

      // If PathSpec survived as a reference, it should still be named PathSpec
      const localPathSpecMember = localMembers?.find(
        (m) => m.kind === "referenceType"
      );
      const fullPathSpecMember = fullMembers?.find(
        (m) => m.kind === "referenceType"
      );
      expect(localPathSpecMember).to.not.be.undefined;
      expect(fullPathSpecMember).to.not.be.undefined;
      if (
        localPathSpecMember?.kind === "referenceType" &&
        fullPathSpecMember?.kind === "referenceType"
      ) {
        expect(fullPathSpecMember.name).to.equal(localPathSpecMember.name);
      }
    });
  });
});
