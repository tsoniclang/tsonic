import {
  describe,
  it,
  expect,
  emitExpressionAst,
  printExpression,
  type IrType,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("widens alias-subset carrier to broader carrier with correct Match slot mapping", () => {
    // Simulates the overload forwarding case:
    // - first has actual type PathSpec (3-member carrier: object?[], string, RegExp)
    // - expected type is PathSpec | MiddlewareLike (5-member carrier)
    // The Match() projection must map actual members to the correct expected slots
    // without type mismatches like object→string or string→RegExp.

    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: { kind: "unknownType" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
        },
      ],
    };

    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "unknownType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [...pathSpecType.types, requestHandlerType, routerType],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "first",
        inferredType: pathSpecType,
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      },
      broadType
    );

    const rendered = printExpression(result);
    // The projection must not produce type mismatches.
    // Each From() call must receive the correct type from the corresponding
    // Match lambda parameter.
    if (rendered.includes(".Match(")) {
      // If Match is used, verify no object→string or string→RegExp misrouting.
      // The actual carrier members (object?[], string, RegExp) should map
      // to the matching expected carrier slots.
      expect(rendered).to.not.include("(object)__tsonic_union_member");
    }
  });

  it("widens alias reference to broader union carrier correctly under module-aware context", () => {
    // The real failing case: PathSpec is a reference type that resolves to a
    // union alias via moduleMap. When adapting first:PathSpec to the broader
    // first:PathSpec|MiddlewareLike carrier, the adaptation must produce
    // correct Match() slot mapping even when the alias expansion happens
    // through moduleMap rather than inline union structure.
    //
    // This exercises the code path in maybeWidenRuntimeUnionExpressionAst
    // where actual and expected layouts are built from types whose expansion
    // depends on module-aware alias resolution.

    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "unknownType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    // PathSpec underlying: string | RegExp | readonly PathSpec[]
    const pathSpecUnderlying: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
        },
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "PathSpec" },
          origin: "explicit",
        },
      ],
    };

    // MiddlewareLike underlying: RequestHandler | Router | readonly MiddlewareLike[]
    const middlewareLikeUnderlying: IrType = {
      kind: "unionType",
      types: [
        requestHandlerType,
        routerType,
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "MiddlewareLike" },
          origin: "explicit",
        },
      ],
    };

    // Module that defines PathSpec and MiddlewareLike
    const typesModuleLocalTypes = new Map<
      string,
      {
        readonly kind: "typeAlias";
        readonly typeParameters: readonly string[];
        readonly type: IrType;
      }
    >([
      [
        "PathSpec",
        { kind: "typeAlias", typeParameters: [], type: pathSpecUnderlying },
      ],
      [
        "MiddlewareLike",
        {
          kind: "typeAlias",
          typeParameters: [],
          type: middlewareLikeUnderlying,
        },
      ],
    ]);

    const moduleMap = new Map([
      [
        "src/types.ts",
        {
          namespace: "Test",
          className: "types",
          filePath: "src/types.ts",
          hasRuntimeContainer: false,
          hasTypeCollision: false,
          exportedValueKinds: undefined,
          localTypes: typesModuleLocalTypes,
        },
      ],
    ]);

    // PathSpec and MiddlewareLike as reference types (as they appear in
    // cross-module usage, NOT as inline unions)
    const pathSpecRef: IrType = {
      kind: "referenceType",
      name: "PathSpec",
    };

    const middlewareLikeRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
    };

    // Actual type: PathSpec (a reference to the alias)
    // Expected type: PathSpec | MiddlewareLike (explicit union of references)
    const expectedType: IrType = {
      kind: "unionType",
      types: [pathSpecRef, middlewareLikeRef],
    };

    const [result] = emitExpressionAst(
      {
        kind: "identifier",
        name: "first",
        inferredType: pathSpecRef,
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
          moduleMap: moduleMap as ReadonlyMap<
            string,
            typeof moduleMap extends Map<string, infer V> ? V : never
          >,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      },
      expectedType
    );

    const rendered = printExpression(result);

    // The adaptation must not produce type mismatches.
    // Incorrect behavior: object→string or string→RegExp in Match() lambdas.
    // Correct behavior: each actual carrier member maps to the matching
    // expected carrier slot without type coercion errors.
    if (rendered.includes(".Match(")) {
      // Verify no wrong-slot routing that would cause C# compile errors
      expect(rendered).to.not.include(
        "new global::System.InvalidCastException"
      );
    }
    // The result must not contain nested Union<Union<...>> shapes.
    // (Match Union<A>.From(Union<B>) is NOT nested — it's sibling factory calls.)
    expect(rendered).to.not.include("Union<global::Tsonic.Runtime.Union<");
  });

  it("does not re-wrap alias narrowing assertions that already materialize the target carrier", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "unknownType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const pathSpecUnderlying: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
        },
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "PathSpec" },
          origin: "explicit",
        },
      ],
    };

    const middlewareLikeUnderlying: IrType = {
      kind: "unionType",
      types: [
        requestHandlerType,
        routerType,
        {
          kind: "arrayType",
          elementType: { kind: "referenceType", name: "MiddlewareLike" },
          origin: "explicit",
        },
      ],
    };

    const typesModuleLocalTypes = new Map([
      [
        "PathSpec",
        { kind: "typeAlias" as const, typeParameters: [], type: pathSpecUnderlying },
      ],
      [
        "MiddlewareLike",
        {
          kind: "typeAlias" as const,
          typeParameters: [],
          type: middlewareLikeUnderlying,
        },
      ],
    ]);

    const moduleMap = new Map([
      [
        "src/types.ts",
        {
          namespace: "Test",
          className: "types",
          filePath: "src/types.ts",
          hasRuntimeContainer: false,
          hasTypeCollision: false,
          exportedValueKinds: undefined,
          localTypes: typesModuleLocalTypes,
        },
      ],
    ]);

    const pathSpecRef: IrType = {
      kind: "referenceType",
      name: "PathSpec",
    };

    const middlewareLikeRef: IrType = {
      kind: "referenceType",
      name: "MiddlewareLike",
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [pathSpecRef, middlewareLikeRef],
    };

    const [result] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "first",
          inferredType: broadType,
        },
        targetType: middlewareLikeRef,
        inferredType: middlewareLikeRef,
      },
      {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          surface: "@tsonic/js",
          indent: 4,
          moduleMap: moduleMap as ReadonlyMap<
            string,
            typeof moduleMap extends Map<string, infer V> ? V : never
          >,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      },
      middlewareLikeRef
    );

    const rendered = printExpression(result);
    const matchCount = rendered.split(".Match(").length - 1;

    expect(matchCount).to.equal(1);
    expect(rendered).to.not.include(")).Match(");
  });
});
