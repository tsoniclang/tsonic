/**
 * Generator wrapper declaration emission.
 *
 * Builds wrapper classes as typed CSharp AST declarations (no text templates).
 */

import { IrFunctionDeclaration, IrType } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { emitCSharpName, getCSharpName } from "./naming-policy.js";
import {
  booleanLiteral,
  identifierType,
} from "./core/format/backend-ast/builders.js";
import type {
  CSharpMemberAst,
  CSharpTypeAst,
  CSharpTypeDeclarationAst,
} from "./core/format/backend-ast/types.js";
import {
  boolTypeAst,
  buildConstructor,
  buildNextMethod,
  buildReturnMethod,
  buildReturnValueProperty,
  buildThrowMethod,
  funcType,
  suppressDefault,
} from "./generator-wrapper-builders.js";

type GeneratorTypeArgs = {
  readonly yieldType: CSharpTypeAst;
  readonly returnType?: CSharpTypeAst;
  readonly nextType: CSharpTypeAst;
  readonly hasNextType: boolean;
  readonly newContext: EmitterContext;
};

const objectTypeAst: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "object",
};
/**
 * Extract generator type arguments as CSharpTypeAst.
 *
 * Generator<TYield, TReturn, TNext> -> { yieldType, returnType?, nextType }
 */
export const extractGeneratorTypeArgs = (
  returnType: IrType | undefined,
  context: EmitterContext
): GeneratorTypeArgs => {
  let yieldType: CSharpTypeAst = objectTypeAst;
  let returnTypeAst: CSharpTypeAst | undefined;
  let nextType: CSharpTypeAst = objectTypeAst;
  let hasNextType = false;
  let currentContext = context;

  if (returnType?.kind === "referenceType") {
    const typeRef = returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [ytAst, ctx1] = emitTypeAst(yieldTypeArg, currentContext);
        currentContext = ctx1;
        yieldType = ytAst;
      }

      if (typeRef.typeArguments.length > 1) {
        const returnTypeArg = typeRef.typeArguments[1];
        if (
          returnTypeArg &&
          returnTypeArg.kind !== "voidType" &&
          !(
            returnTypeArg.kind === "primitiveType" &&
            returnTypeArg.name === "undefined"
          )
        ) {
          const [rtAst, ctx2] = emitTypeAst(returnTypeArg, currentContext);
          currentContext = ctx2;
          returnTypeAst = rtAst;
        }
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (
          nextTypeArg &&
          !(
            nextTypeArg.kind === "primitiveType" &&
            nextTypeArg.name === "undefined"
          )
        ) {
          const [ntAst, ctx3] = emitTypeAst(nextTypeArg, currentContext);
          currentContext = ctx3;
          nextType = ntAst;
          hasNextType = true;
        }
      }
    }
  }

  return {
    yieldType,
    returnType: returnTypeAst,
    nextType,
    hasNextType,
    newContext: currentContext,
  };
};

/**
 * Generate wrapper class declaration for a generator function.
 */
export const generateWrapperClass = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [CSharpTypeDeclarationAst, EmitterContext] => {
  let currentContext = context;

  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const wrapperName = `${csharpBaseName}_Generator`;
  const exchangeName = `${csharpBaseName}_exchange`;
  const nextMethodName = emitCSharpName("next", "methods", context);
  const returnMethodName = emitCSharpName("return", "methods", context);
  const throwMethodName = emitCSharpName("throw", "methods", context);
  const returnValuePropertyName = emitCSharpName(
    "returnValue",
    "properties",
    context
  );

  const {
    yieldType,
    returnType,
    nextType,
    hasNextType,
    newContext: typeContext,
  } = extractGeneratorTypeArgs(func.returnType, currentContext);
  currentContext = typeContext;

  const enumeratorType: CSharpTypeAst = identifierType(
    func.isAsync
      ? "global::System.Collections.Generic.IAsyncEnumerator"
      : "global::System.Collections.Generic.IEnumerator",
    [identifierType(exchangeName)]
  );

  const members: CSharpMemberAst[] = [
    {
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private", "readonly"],
      type: enumeratorType,
      name: "_enumerator",
    },
    {
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private", "readonly"],
      type: identifierType(exchangeName),
      name: "_exchange",
    },
  ];

  if (returnType) {
    members.push(
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private", "readonly"],
        type: funcType(returnType),
        name: "_getReturnValue",
      },
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private"],
        type: returnType,
        name: "_returnValue",
        initializer: suppressDefault(),
      },
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private"],
        type: boolTypeAst,
        name: "_wasExternallyTerminated",
        initializer: booleanLiteral(false),
      }
    );
  }

  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["private"],
    type: boolTypeAst,
    name: "_done",
    initializer: booleanLiteral(false),
  });

  members.push(
    buildConstructor(wrapperName, exchangeName, func.isAsync, returnType)
  );
  members.push(
    buildNextMethod(
      yieldType,
      nextType,
      hasNextType,
      func.isAsync,
      nextMethodName
    )
  );

  if (returnType) {
    members.push(buildReturnValueProperty(returnType, returnValuePropertyName));
  }

  members.push(
    buildReturnMethod(yieldType, returnType, func.isAsync, returnMethodName)
  );
  members.push(buildThrowMethod(yieldType, func.isAsync, throwMethodName));

  const classAst: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers: ["public", "sealed"],
    name: wrapperName,
    interfaces: [],
    members,
  };

  return [classAst, currentContext];
};

/**
 * Check if a generator function needs bidirectional support
 * (i.e., has TNext type parameter that isn't undefined)
 */
export const needsBidirectionalSupport = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 2) {
      const nextTypeArg = typeRef.typeArguments[2];
      if (
        nextTypeArg &&
        !(
          nextTypeArg.kind === "primitiveType" &&
          nextTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if a generator function has a return type (TReturn is not void/undefined)
 */
export const hasGeneratorReturnType = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 1) {
      const returnTypeArg = typeRef.typeArguments[1];
      if (
        returnTypeArg &&
        returnTypeArg.kind !== "voidType" &&
        !(
          returnTypeArg.kind === "primitiveType" &&
          returnTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};
