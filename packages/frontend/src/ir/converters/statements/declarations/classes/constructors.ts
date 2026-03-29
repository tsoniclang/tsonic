/**
 * Constructor conversion with parameter properties
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrClassMember,
  IrMethodDeclaration,
  IrParameter,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasReadonlyModifier,
  getAccessibility,
  convertParameters,
  makeOptionalType,
} from "../../helpers.js";
import { createWrapperBody } from "./overload-wrapper-helpers.js";
import type { ProgramContext } from "../../../../program-context.js";

const isParameterPropertyParameter = (
  param: ts.ParameterDeclaration
): boolean => {
  const modifiers = ts.getModifiers(param);
  return (
    modifiers?.some(
      (m) =>
        m.kind === ts.SyntaxKind.PublicKeyword ||
        m.kind === ts.SyntaxKind.PrivateKeyword ||
        m.kind === ts.SyntaxKind.ProtectedKeyword ||
        m.kind === ts.SyntaxKind.ReadonlyKeyword
    ) ?? false
  );
};

const isLeadingSuperCallStatement = (statement: IrStatement): boolean => {
  if (statement.kind !== "expressionStatement") {
    return false;
  }

  const expression = statement.expression;
  return (
    expression.kind === "call" &&
    expression.callee.kind === "identifier" &&
    expression.callee.name === "super"
  );
};

/**
 * Convert constructor declaration to IR
 */
export const convertConstructor = (
  node: ts.ConstructorDeclaration,
  ctx: ProgramContext,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember => {
  const parameterPropertyAssignments: IrStatement[] = [];

  // Add assignments for parameter properties (parameters with explicit modifiers)
  if (constructorParams) {
    for (const param of constructorParams) {
      if (isParameterPropertyParameter(param) && ts.isIdentifier(param.name)) {
        // Create: this.name = name;
        parameterPropertyAssignments.push({
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: {
                kind: "this",
              },
              property: param.name.text,
              isComputed: false,
              isOptional: false,
            },
            right: {
              kind: "identifier",
              name: param.name.text,
            },
          },
        });
      }
    }
  }

  // Add existing constructor body statements
  const statements: IrStatement[] = [];
  if (node.body) {
    const existingBody = convertBlockStatement(node.body, ctx, undefined);
    const [first, ...rest] = existingBody.statements;
    if (first && isLeadingSuperCallStatement(first)) {
      statements.push(first, ...parameterPropertyAssignments, ...rest);
    } else {
      statements.push(
        ...parameterPropertyAssignments,
        ...existingBody.statements
      );
    }
  } else {
    statements.push(...parameterPropertyAssignments);
  }

  return {
    kind: "constructorDeclaration",
    parameters: convertParameters(node.parameters, ctx),
    body: { kind: "blockStatement", statements },
    accessibility: getAccessibility(node),
  };
};

const CONSTRUCTOR_IMPL_METHOD_NAME = "__tsonic_ctor_impl";

const VOID_TYPE: IrType = {
  kind: "voidType",
};

const extractImplementationConstructor = (
  nodes: readonly ts.ConstructorDeclaration[]
): ts.ConstructorDeclaration => {
  const impls = nodes.filter((node) => !!node.body);
  if (impls.length !== 1) {
    throw new Error(
      `ICE: constructor overload group must contain exactly one implementation body (found ${impls.length})`
    );
  }

  return impls[0] as ts.ConstructorDeclaration;
};

const stripSuperCallForConstructorHelper = (
  body: IrBlockStatement
): IrBlockStatement => {
  const [first, ...rest] = body.statements;
  if (
    !first ||
    first.kind !== "expressionStatement" ||
    !isLeadingSuperCallStatement(first)
  ) {
    return body;
  }

  const expression = first.expression;
  if (expression.kind !== "call") {
    return body;
  }

  const superCall = expression;
  if (superCall.arguments.length > 0) {
    throw new Error(
      "ICE: overloaded constructors with super(...) arguments are not yet supported for wrapper lowering."
    );
  }

  return {
    ...body,
    statements: rest,
  };
};

export const convertConstructorOverloadGroup = (
  nodes: readonly ts.ConstructorDeclaration[],
  ctx: ProgramContext
): readonly IrClassMember[] => {
  const impl = extractImplementationConstructor(nodes);
  const sigs = nodes.filter((node) => !node.body);

  if (sigs.length === 0) {
    return [convertConstructor(impl, ctx, impl.parameters)];
  }

  const implCtor = convertConstructor(impl, ctx, impl.parameters) as Extract<
    IrClassMember,
    { kind: "constructorDeclaration" }
  >;

  const helperMethod: IrMethodDeclaration = {
    kind: "methodDeclaration",
    name: CONSTRUCTOR_IMPL_METHOD_NAME,
    typeParameters: [],
    parameters: [...implCtor.parameters],
    returnType: VOID_TYPE,
    body: stripSuperCallForConstructorHelper(
      implCtor.body ?? { kind: "blockStatement", statements: [] }
    ),
    isStatic: false,
    isAsync: false,
    isGenerator: false,
    accessibility: "private",
  };

  const wrappers: IrClassMember[] = [];
  const implParams = implCtor.parameters;
  const declaredAccessibility = getAccessibility(impl);

  for (const sig of sigs) {
    const sigParams = convertParameters(sig.parameters, ctx);
    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: constructor overload signature parameter count exceeds implementation (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const parameters: IrParameter[] = sigParams.map((param, index) => ({
      ...param,
      pattern: (implParams[index] as IrParameter).pattern,
    }));

    wrappers.push({
      kind: "constructorDeclaration",
      parameters,
      body: createWrapperBody(
        CONSTRUCTOR_IMPL_METHOD_NAME,
        parameters,
        implParams,
        undefined,
        helperMethod.body,
        [],
        false,
        VOID_TYPE,
        VOID_TYPE,
        []
      ),
      accessibility: declaredAccessibility,
    });
  }

  return [helperMethod, ...wrappers];
};

/**
 * Extract parameter properties from constructor
 */
export const extractParameterProperties = (
  constructor: ts.ConstructorDeclaration | undefined,
  ctx: ProgramContext
): IrClassMember[] => {
  if (!constructor) {
    return [];
  }

  const parameterProperties: IrClassMember[] = [];

  for (const param of constructor.parameters) {
    if (!isParameterPropertyParameter(param)) {
      continue; // Not a parameter property
    }

    // Create a field declaration for this parameter property
    if (ts.isIdentifier(param.name)) {
      // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
      const accessibility = getAccessibility(param);
      const rawType = param.type
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(param.type)
          )
        : undefined;

      const type =
        rawType && param.questionToken ? makeOptionalType(rawType) : rawType;

      parameterProperties.push({
        kind: "propertyDeclaration",
        name: param.name.text,
        type,
        initializer: undefined, // Will be assigned in constructor
        isStatic: false,
        isReadonly: hasReadonlyModifier(param),
        accessibility,
      });
    }
  }

  return parameterProperties;
};
