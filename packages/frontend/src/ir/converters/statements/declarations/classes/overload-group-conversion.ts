/**
 * Overload group conversion -- converts TypeScript overload groups
 * (`sig; sig; impl {}`) into concrete C# method declarations.
 *
 * Handles both wrapper-lowering (when signatures need forwarding to a
 * private implementation) and inline specialization (when signature
 * bodies can be directly specialized).
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrFunctionType,
  IrMethodDeclaration,
  IrParameter,
  IrType,
} from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import { getClassMemberName } from "./member-names.js";
import { convertMethod } from "./method-declaration.js";
import {
  specializeStatement,
} from "./overload-specialization.js";
import {
  assertNoIsTypeCalls,
  assertNoMissingParamRefs,
} from "./overload-validation.js";
import {
  getOverloadImplementationName,
  buildPublicOverloadFamilyMember,
  buildImplementationOverloadFamilyMember,
  adaptReturnStatements,
  createWrapperBody,
  needsAsyncReturnStatementAdaptation,
  needsAsyncWrapperReturnAdaptation,
  preserveTopLevelRuntimeLayout,
} from "./overload-wrapper-helpers.js";
import type { ProgramContext } from "../../../../program-context.js";

/** Convert a TypeScript overload group (`sig; sig; impl {}`) into one C# method per signature. */
export const convertMethodOverloadGroup = (
  nodes: readonly ts.MethodDeclaration[],
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): readonly IrMethodDeclaration[] => {
  const countRequiredFunctionParameters = (
    parameters: readonly IrParameter[]
  ): number => {
    let required = 0;
    for (const parameter of parameters) {
      if (
        parameter.isRest ||
        parameter.isOptional ||
        parameter.initializer !== undefined
      ) {
        break;
      }
      required += 1;
    }
    return required;
  };

  const isNullishType = (type: IrType): boolean =>
    type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined");

  const resolveCallableShape = (
    type: IrType
  ): IrFunctionType | undefined => {
    if (type.kind === "functionType") {
      return type;
    }

    const delegated = ctx.typeSystem.delegateToFunctionType(type);
    if (delegated) {
      return delegated;
    }

    if (type.kind !== "unionType") {
      return undefined;
    }

    const nonNullishMembers = type.types.filter(
      (member) => !isNullishType(member)
    );
    if (nonNullishMembers.length !== 1) {
      return undefined;
    }

    const [callableMember] = nonNullishMembers;
    return callableMember ? resolveCallableShape(callableMember) : undefined;
  };

  const impls = nodes.filter((n) => !!n.body);
  if (impls.length !== 1) {
    throw new Error(
      `ICE: method overload group must contain exactly one implementation body (found ${impls.length})`
    );
  }

  const impl = impls[0] as ts.MethodDeclaration;
  const memberName = getClassMemberName(impl.name);

  const sigs = nodes.filter((n) => !n.body);
  if (sigs.length === 0) {
    return [convertMethod(impl, ctx, superClass) as IrMethodDeclaration];
  }

  const implBody = impl.body
    ? convertBlockStatement(impl.body, ctx, undefined)
    : undefined;
  if (!implBody) {
    throw new Error("ICE: overload implementation must have a body");
  }

  const implParams = convertParameters(impl.parameters, ctx);

  // Map implementation param DeclId.id -> index.
  const implParamDeclIds: number[] = [];
  for (const p of impl.parameters) {
    if (!ts.isIdentifier(p.name)) {
      throw new Error(
        `ICE: overload implementations currently require identifier parameters (got non-identifier in '${memberName}')`
      );
    }
    const id = ctx.binding.resolveIdentifier(p.name);
    if (!id) {
      throw new Error(`ICE: could not resolve parameter '${p.name.text}'`);
    }
    implParamDeclIds.push(id.id);
  }

  const declaredAccessibility = getAccessibility(impl);
  const isStatic = hasStaticModifier(impl);
  const isAsync = !!impl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword
  );
  const isGenerator = !!impl.asteriskToken;

  const implMethod = convertMethod(
    impl,
    ctx,
    superClass
  ) as IrMethodDeclaration;

  const collectMissingRuntimeForwardingDeclIds = (
    signatureParameterCount: number
  ): ReadonlySet<number> => {
    const missingDeclIds = new Set<number>();
    for (
      let index = signatureParameterCount;
      index < implParams.length;
      index += 1
    ) {
      const implParameter = implParams[index];
      const declId = implParamDeclIds[index];
      if (
        implParameter &&
        declId !== undefined &&
        (implParameter.isRest || implParameter.initializer !== undefined)
      ) {
        missingDeclIds.add(declId);
      }
    }
    return missingDeclIds;
  };

  const requiresWrapperLowering = sigs.some((sig) => {
    const sigParams = convertParameters(sig.parameters, ctx);
    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let i = 0; i < implParamDeclIds.length; i++) {
      const declId = implParamDeclIds[i] as number;
      const t =
        i < sigParams.length
          ? sigParams[i]?.type
          : ({ kind: "primitiveType", name: "undefined" } as IrType);
      if (t) paramTypesByDeclId.set(declId, t);
    }

    const missingRuntimeForwardingDeclIds =
      collectMissingRuntimeForwardingDeclIds(sigParams.length);
    const specialized = specializeStatement(
      implBody,
      paramTypesByDeclId,
      missingRuntimeForwardingDeclIds
    );
    if (!assertNoIsTypeCalls(specialized)) {
      return false;
    }

    const requiresCallableAdapter = sigParams.some((parameter, index) => {
      const implParameter = implParams[index];
      const sigType = parameter.type;
      const implType = implParameter?.type;
      if (!sigType || !implType) {
        return false;
      }

      if (ctx.typeSystem.typesEqual(sigType, implType)) {
        return false;
      }

      const sigCallable = resolveCallableShape(sigType);
      const implCallable = resolveCallableShape(implType);
      if (!sigCallable && !implCallable) {
        return false;
      }
      if (!sigCallable || !implCallable) {
        return true;
      }
      if (
        sigCallable.parameters.length !== implCallable.parameters.length ||
        countRequiredFunctionParameters(sigCallable.parameters) !==
          countRequiredFunctionParameters(implCallable.parameters)
      ) {
        return true;
      }
      return true;
    });
    if (requiresCallableAdapter) {
      return true;
    }

    const requiresDefaultForwarding = sigParams.some((parameter, index) => {
      const implParameter = implParams[index];
      if (!implParameter?.initializer) {
        return false;
      }

      return parameter.isOptional && parameter.initializer === undefined;
    });
    if (requiresDefaultForwarding) {
      return true;
    }

    if (
      missingRuntimeForwardingDeclIds.size > 0 &&
      !assertNoMissingParamRefs(specialized, missingRuntimeForwardingDeclIds)
    ) {
      return true;
    }

    if (sigParams.length === implParams.length) {
      return false;
    }

    if (sigParams.length >= implParams.length) {
      return false;
    }

    const missing = new Set<number>();
    for (let i = sigParams.length; i < implParamDeclIds.length; i++) {
      missing.add(implParamDeclIds[i] as number);
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
    const helperIsAsync =
      implMethod.isAsync ||
      (!!implMethod.body &&
        needsAsyncReturnStatementAdaptation(
          implMethod.body,
          implMethod.returnType
        ));
    const helperReturnType = preserveTopLevelRuntimeLayout(
      implMethod.returnType
    );
    const helperMethod: IrMethodDeclaration = {
      ...implMethod,
      name: helperName,
      returnType: helperReturnType,
      isAsync: helperIsAsync,
      overloadFamily: buildImplementationOverloadFamilyMember({
        ownerKind: "method",
        publicName: memberName,
        isStatic,
        publicSignatureCount: sigs.length,
        implementationName: helperName,
      }),
      body: implMethod.body
        ? (adaptReturnStatements(
            implMethod.body,
            helperReturnType,
            helperIsAsync
          ) as IrBlockStatement)
        : undefined,
      accessibility: "private",
      isOverride: undefined,
      isShadow: undefined,
      isVirtual: undefined,
    };

    const wrappers: IrMethodDeclaration[] = [];
    for (const [signatureIndex, sig] of sigs.entries()) {
      const sigParams = convertParameters(sig.parameters, ctx);
      const returnType = sig.type
        ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(sig.type))
        : undefined;

      const parameters: IrParameter[] = sigParams.map((p, i) => ({
        ...p,
        pattern: (implParams[i] as IrParameter).pattern,
      }));
      const wrapperIsAsync = needsAsyncWrapperReturnAdaptation(
        implMethod.returnType,
        returnType
      );

      const overrideInfo = detectOverride(
        memberName,
        "method",
        superClass,
        ctx,
        parameters
      );

      if (overrideInfo.isShadow) {
        continue;
      }

      const accessibility =
        overrideInfo.isOverride && overrideInfo.requiredAccessibility
          ? overrideInfo.requiredAccessibility
          : declaredAccessibility;

      wrappers.push({
        kind: "methodDeclaration",
        name: memberName,
        typeParameters: convertTypeParameters(sig.typeParameters, ctx),
        parameters,
        returnType,
        body: createWrapperBody(
          helperName,
          parameters,
          implMethod.parameters,
          implParamDeclIds,
          implBody,
          (implMethod.typeParameters ?? []).map(
            (typeParameter) => typeParameter.name
          ),
          isStatic,
          helperReturnType,
          returnType,
          (sig.typeParameters ?? []).map((tp) => tp.name.text),
          wrapperIsAsync
        ),
        overloadFamily: buildPublicOverloadFamilyMember({
          ownerKind: "method",
          publicName: memberName,
          isStatic,
          signatureIndex,
          publicSignatureCount: sigs.length,
          implementationName: helperName,
        }),
        isStatic,
        isAsync: wrapperIsAsync,
        isGenerator: false,
        accessibility,
        isOverride: overrideInfo.isOverride ? true : undefined,
        isShadow: overrideInfo.isShadow ? true : undefined,
      });
    }

    return [helperMethod, ...wrappers];
  }

  // Convert each signature into a concrete method emission.
  const out: IrMethodDeclaration[] = [];
  for (const [signatureIndex, sig] of sigs.entries()) {
    const sigParams = convertParameters(sig.parameters, ctx);
    const returnType = sig.type
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(sig.type))
      : undefined;

    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const parameters: IrParameter[] = sigParams.map((p, i) => ({
      ...p,
      pattern: (implParams[i] as IrParameter).pattern,
    }));

    const overrideInfo = detectOverride(
      memberName,
      "method",
      superClass,
      ctx,
      parameters
    );

    // If this signature matches a non-virtual CLR base method, do not emit a new method
    // (avoid accidental `new` shadowing). Users still inherit the base implementation.
    if (overrideInfo.isShadow) {
      continue;
    }

    const accessibility =
      overrideInfo.isOverride && overrideInfo.requiredAccessibility
        ? overrideInfo.requiredAccessibility
        : declaredAccessibility;

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let i = 0; i < implParamDeclIds.length; i++) {
      const declId = implParamDeclIds[i] as number;
      const t =
        i < parameters.length
          ? parameters[i]?.type
          : ({ kind: "primitiveType", name: "undefined" } as IrType);
      if (t) paramTypesByDeclId.set(declId, t);
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      throw new Error(
        `ICE: istype<T>(...) must be erased during overload specialization for '${memberName}'.`
      );
    }
    if (sigParams.length < implParams.length) {
      const missing = new Set<number>();
      for (let i = sigParams.length; i < implParamDeclIds.length; i++) {
        missing.add(implParamDeclIds[i] as number);
      }
      if (missing.size > 0 && !assertNoMissingParamRefs(specialized, missing)) {
        throw new Error(
          `ICE: overload '${memberName}' implementation references parameters not present in the current signature (sigParams=${sigParams.length}, implParams=${implParams.length}).`
        );
      }
    }

    const specializedIsAsync =
      isAsync ||
      needsAsyncReturnStatementAdaptation(
        specialized as IrBlockStatement,
        returnType
      );

    const adapted = adaptReturnStatements(
      specialized as IrBlockStatement,
      returnType,
      specializedIsAsync
    ) as IrBlockStatement;

    out.push({
      kind: "methodDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(sig.typeParameters, ctx),
      parameters,
      returnType,
      body: adapted,
      overloadFamily: buildPublicOverloadFamilyMember({
        ownerKind: "method",
        publicName: memberName,
        isStatic,
        signatureIndex,
        publicSignatureCount: sigs.length,
      }),
      isStatic,
      isAsync: specializedIsAsync,
      isGenerator,
      accessibility,
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    });
  }

  return out;
};
