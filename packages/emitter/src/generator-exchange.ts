/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 *
 * Exchange and wrapper classes are built as typed CSharpTypeDeclarationAst.
 */

import { IrModule, IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { identifierType } from "./core/format/backend-ast/builders.js";
import {
  emitGeneratorHelperTypeParameters,
  type GeneratorLike,
  getGeneratorHelperBaseName,
  needsBidirectionalSupport,
  generateWrapperClass,
  usesExchangeBasedGeneratorLowering,
} from "./generator-wrapper.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

type CollectedGenerator = {
  readonly generator: GeneratorLike;
  readonly helperBaseName: string;
  readonly typeParameters: readonly IrTypeParameter[];
};

/**
 * Collect all generator declarations from a module, including class methods.
 */
const collectGenerators = (
  module: IrModule,
  context: EmitterContext
): CollectedGenerator[] => {
  const generators: CollectedGenerator[] = [];

  for (const stmt of module.body) {
    if (
      stmt.kind === "functionDeclaration" &&
      stmt.isGenerator &&
      usesExchangeBasedGeneratorLowering(stmt)
    ) {
      generators.push({
        generator: stmt,
        helperBaseName: getGeneratorHelperBaseName(stmt, context),
        typeParameters: stmt.typeParameters ?? [],
      });
      continue;
    }

    if (stmt.kind === "classDeclaration") {
      const ownerTypeParameters = stmt.typeParameters ?? [];
      for (const member of stmt.members) {
        if (
          member.kind !== "methodDeclaration" ||
          !member.isGenerator ||
          !usesExchangeBasedGeneratorLowering(member)
        ) {
          continue;
        }
        generators.push({
          generator: member,
          helperBaseName: getGeneratorHelperBaseName(
            member,
            context,
            stmt.name
          ),
          typeParameters: [
            ...ownerTypeParameters,
            ...(member.typeParameters ?? []),
          ],
        });
      }
    }
  }

  return generators;
};

/**
 * Generate exchange object class as CSharpTypeDeclarationAst
 */
export const generateExchangeClassAst = (
  func: GeneratorLike,
  context: EmitterContext,
  helperBaseName = getGeneratorHelperBaseName(func, context),
  helperTypeParameters: readonly IrTypeParameter[] = []
): [CSharpTypeDeclarationAst, EmitterContext] => {
  const helperTypes = emitGeneratorHelperTypeParameters(
    helperTypeParameters,
    context
  );
  let currentContext = helperTypes.context;
  const exchangeName = `${helperBaseName}_exchange`;

  // Determine output/input types from return type
  let outputTypeAst: CSharpTypeAst = identifierType("object");
  let inputTypeAst: CSharpTypeAst = identifierType("object");

  if (func.returnType && func.returnType.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [yieldAst, ctx1] = emitTypeAst(yieldTypeArg, currentContext);
        currentContext = ctx1;
        outputTypeAst = yieldAst;
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (
          nextTypeArg &&
          nextTypeArg.kind !== "voidType" &&
          !(
            nextTypeArg.kind === "primitiveType" &&
            nextTypeArg.name === "undefined"
          )
        ) {
          const [nextAst, ctx2] = emitTypeAst(nextTypeArg, currentContext);
          currentContext = ctx2;
          inputTypeAst = nextAst;
        }
      }
    }
  }

  const members: CSharpMemberAst[] = [
    // Input property (nullable)
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: { kind: "nullableType", underlyingType: inputTypeAst },
      name: "Input",
      hasGetter: true,
      hasSetter: true,
      isAutoProperty: true,
    },
    // Output property
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: outputTypeAst,
      name: "Output",
      hasGetter: true,
      hasSetter: true,
      isAutoProperty: true,
    },
  ];

  const declAst: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers: ["public", "sealed"],
    name: exchangeName,
    typeParameters:
      helperTypes.typeParameters.length > 0
        ? helperTypes.typeParameters
        : undefined,
    interfaces: [],
    members,
    constraints:
      helperTypes.constraints.length > 0 ? helperTypes.constraints : undefined,
  };

  return [declAst, currentContext];
};

/**
 * Generate all exchange objects and wrapper classes for generators in a module.
 */
export const generateGeneratorExchanges = (
  module: IrModule,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const generators = collectGenerators(module, context);

  if (generators.length === 0) {
    return [[], context];
  }

  const decls: CSharpTypeDeclarationAst[] = [];
  let currentContext = context;

  for (const { generator, helperBaseName, typeParameters } of generators) {
    // Exchange class (fully AST)
    const [exchangeAst, exchangeContext] = generateExchangeClassAst(
      generator,
      currentContext,
      helperBaseName,
      typeParameters
    );
    currentContext = exchangeContext;
    decls.push(exchangeAst);

    // Wrapper class
    if (needsBidirectionalSupport(generator)) {
      const [wrapperDecl, wrapperContext] = generateWrapperClass(
        generator,
        currentContext,
        helperBaseName,
        typeParameters
      );
      currentContext = wrapperContext;
      decls.push(wrapperDecl);
    }
  }

  return [decls, currentContext];
};
