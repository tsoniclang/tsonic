import * as ts from "typescript";
import {
  IrBlockStatement,
  IrFunctionDeclaration,
  IrParameter,
  IrType,
} from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { convertBlockStatement } from "../control.js";
import {
  convertParameters,
  convertTypeParameters,
  hasExportModifier,
} from "../helpers.js";
import { convertFunctionDeclaration } from "./functions.js";
import {
  adaptReturnStatements,
  assertNoIsTypeCalls,
  assertNoMissingParamRefs,
  buildImplementationOverloadFamilyMember,
  buildPublicOverloadFamilyMember,
  createWrapperBody,
  getOverloadImplementationName,
  specializeStatement,
} from "./overload-lowering.js";

const undefinedType: IrType = {
  kind: "primitiveType",
  name: "undefined",
};

const resolveFunctionReturnType = (
  node: ts.FunctionDeclaration,
  ctx: ProgramContext
): IrType | undefined =>
  node.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;

export const convertFunctionOverloadGroup = (
  nodes: readonly ts.FunctionDeclaration[],
  ctx: ProgramContext
): readonly IrFunctionDeclaration[] => {
  const impls = nodes.filter((node) => !!node.body);
  if (impls.length !== 1) {
    throw new Error(
      `ICE: function overload group must contain exactly one implementation body (found ${impls.length})`
    );
  }

  const impl = impls[0] as ts.FunctionDeclaration;
  const memberName = impl.name?.text;
  if (!memberName) {
    throw new Error("ICE: function overload implementation must have a name");
  }

  const sigs = nodes.filter((node) => !node.body);
  if (sigs.length === 0) {
    const single = convertFunctionDeclaration(impl, ctx);
    return single ? [single] : [];
  }

  const implBody = convertBlockStatement(impl.body!, ctx, undefined);
  const implParams = convertParameters(impl.parameters, ctx);
  const implParamDeclIds: number[] = [];
  for (const parameter of impl.parameters) {
    if (!ts.isIdentifier(parameter.name)) {
      throw new Error(
        `ICE: overload implementations currently require identifier parameters (got non-identifier in '${memberName}')`
      );
    }
    const id = ctx.binding.resolveIdentifier(parameter.name);
    if (!id) {
      throw new Error(
        `ICE: could not resolve parameter '${parameter.name.text}'`
      );
    }
    implParamDeclIds.push(id.id);
  }

  const implFunction = convertFunctionDeclaration(impl, ctx);
  if (!implFunction) {
    throw new Error(
      `ICE: failed to convert overload implementation '${memberName}'`
    );
  }

  const isExported = nodes.some(hasExportModifier);
  const isAsync = !!impl.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
  );
  const isGenerator = !!impl.asteriskToken;

  const requiresWrapperLowering = sigs.some((sig) => {
    const sigParams = convertParameters(sig.parameters, ctx);
    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let index = 0; index < implParamDeclIds.length; index++) {
      const declId = implParamDeclIds[index] as number;
      const type =
        index < sigParams.length ? sigParams[index]?.type : undefinedType;
      if (type) {
        paramTypesByDeclId.set(declId, type);
      }
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      return false;
    }

    if (sigParams.length >= implParams.length) {
      return false;
    }

    const missing = new Set<number>();
    for (
      let index = sigParams.length;
      index < implParamDeclIds.length;
      index++
    ) {
      missing.add(implParamDeclIds[index] as number);
    }

    return missing.size > 0 && !assertNoMissingParamRefs(specialized, missing);
  });

  if (requiresWrapperLowering) {
    if (!assertNoIsTypeCalls(implBody)) {
      throw new Error(
        `ICE: overload '${memberName}' requires wrapper lowering but still depends on compile-time-only istype<T>(...).`
      );
    }

    const helperName = getOverloadImplementationName(memberName);
    const helperFunction: IrFunctionDeclaration = {
      ...implFunction,
      name: helperName,
      isExported: false,
      overloadFamily: buildImplementationOverloadFamilyMember({
        ownerKind: "function",
        publicName: memberName,
        isStatic: false,
        publicSignatureCount: sigs.length,
        implementationName: helperName,
      }),
      body: adaptReturnStatements(
        implFunction.body,
        implFunction.returnType
      ) as IrBlockStatement,
    };

    const wrappers = sigs.map((sig, signatureIndex) => {
      const sigParams = convertParameters(sig.parameters, ctx);
      const returnType = resolveFunctionReturnType(sig, ctx);
      const parameters: IrParameter[] = sigParams.map((parameter, index) => ({
        ...parameter,
        pattern: (implParams[index] as IrParameter).pattern,
      }));

      return {
        kind: "functionDeclaration",
        name: memberName,
        typeParameters: convertTypeParameters(sig.typeParameters, ctx),
        parameters,
        returnType,
        body: createWrapperBody(
          helperName,
          parameters,
          implFunction.parameters,
          true,
          implFunction.returnType,
          returnType,
          (sig.typeParameters ?? []).map(
            (typeParameter) => typeParameter.name.text
          )
        ),
        isAsync: false,
        isGenerator: false,
        isExported,
        overloadFamily: buildPublicOverloadFamilyMember({
          ownerKind: "function",
          publicName: memberName,
          isStatic: false,
          signatureIndex,
          publicSignatureCount: sigs.length,
          implementationName: helperName,
        }),
      } satisfies IrFunctionDeclaration;
    });

    return [helperFunction, ...wrappers];
  }

  const specializedFunctions: IrFunctionDeclaration[] = [];
  for (const [signatureIndex, sig] of sigs.entries()) {
    const sigParams = convertParameters(sig.parameters, ctx);
    const returnType = resolveFunctionReturnType(sig, ctx);
    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const parameters: IrParameter[] = sigParams.map((parameter, index) => ({
      ...parameter,
      pattern: (implParams[index] as IrParameter).pattern,
    }));

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let index = 0; index < implParamDeclIds.length; index++) {
      const declId = implParamDeclIds[index] as number;
      const type =
        index < parameters.length ? parameters[index]?.type : undefinedType;
      if (type) {
        paramTypesByDeclId.set(declId, type);
      }
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      throw new Error(
        `ICE: istype<T>(...) must be erased during overload specialization for '${memberName}'.`
      );
    }

    if (sigParams.length < implParams.length) {
      const missing = new Set<number>();
      for (
        let index = sigParams.length;
        index < implParamDeclIds.length;
        index++
      ) {
        missing.add(implParamDeclIds[index] as number);
      }
      if (missing.size > 0 && !assertNoMissingParamRefs(specialized, missing)) {
        throw new Error(
          `ICE: overload '${memberName}' implementation references parameters not present in the current signature (sigParams=${sigParams.length}, implParams=${implParams.length}).`
        );
      }
    }

    specializedFunctions.push({
      kind: "functionDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(sig.typeParameters, ctx),
      parameters,
      returnType,
      body: adaptReturnStatements(
        specialized as IrBlockStatement,
        returnType
      ) as IrBlockStatement,
      isAsync,
      isGenerator,
      isExported,
      overloadFamily: buildPublicOverloadFamilyMember({
        ownerKind: "function",
        publicName: memberName,
        isStatic: false,
        signatureIndex,
        publicSignatureCount: sigs.length,
      }),
    });
  }

  return specializedFunctions;
};
