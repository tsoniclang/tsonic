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
import { specializeStatement } from "./overload-specialization.js";
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
} from "./overload-wrapper-helpers.js";
import type { ProgramContext } from "../../../../program-context.js";

/** Convert a TypeScript overload group (`sig; sig; impl {}`) into one C# method per signature. */
export const convertMethodOverloadGroup = (
  nodes: readonly ts.MethodDeclaration[],
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): readonly IrMethodDeclaration[] => {
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

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
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
    const helperMethod: IrMethodDeclaration = {
      ...implMethod,
      name: helperName,
      overloadFamily: buildImplementationOverloadFamilyMember(
        memberName,
        sigs.length,
        helperName
      ),
      body: implMethod.body
        ? (adaptReturnStatements(
            implMethod.body,
            implMethod.returnType
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
          isStatic,
          implMethod.returnType,
          returnType,
          (sig.typeParameters ?? []).map((tp) => tp.name.text)
        ),
        overloadFamily: buildPublicOverloadFamilyMember(
          memberName,
          signatureIndex,
          sigs.length,
          helperName
        ),
        isStatic,
        isAsync: false,
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

    const adapted = adaptReturnStatements(
      specialized as IrBlockStatement,
      returnType
    ) as IrBlockStatement;

    out.push({
      kind: "methodDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(sig.typeParameters, ctx),
      parameters,
      returnType,
      body: adapted,
      overloadFamily: buildPublicOverloadFamilyMember(
        memberName,
        signatureIndex,
        sigs.length
      ),
      isStatic,
      isAsync,
      isGenerator,
      accessibility,
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    });
  }

  return out;
};
