/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 *
 * Exchange and wrapper classes are built as typed CSharpTypeDeclarationAst.
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { identifierType } from "./core/format/backend-ast/builders.js";
import {
  type GeneratorLike,
  getGeneratorHelperBaseName,
  needsBidirectionalSupport,
  generateWrapperClass,
} from "./generator-wrapper.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

type CollectedGenerator = {
  readonly generator: GeneratorLike;
  readonly helperBaseName: string;
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
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      generators.push({
        generator: stmt,
        helperBaseName: getGeneratorHelperBaseName(stmt, context),
      });
      continue;
    }

    if (stmt.kind === "classDeclaration") {
      for (const member of stmt.members) {
        if (member.kind !== "methodDeclaration" || !member.isGenerator) {
          continue;
        }
        generators.push({
          generator: member,
          helperBaseName: getGeneratorHelperBaseName(
            member,
            context,
            stmt.name
          ),
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
  helperBaseName = getGeneratorHelperBaseName(func, context)
): [CSharpTypeDeclarationAst, EmitterContext] => {
  let currentContext = context;
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
        if (nextTypeArg) {
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
    interfaces: [],
    members,
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

  for (const { generator, helperBaseName } of generators) {
    // Exchange class (fully AST)
    const [exchangeAst, exchangeContext] = generateExchangeClassAst(
      generator,
      currentContext,
      helperBaseName
    );
    currentContext = exchangeContext;
    decls.push(exchangeAst);

    // Wrapper class
    if (needsBidirectionalSupport(generator)) {
      const [wrapperDecl, wrapperContext] = generateWrapperClass(
        generator,
        currentContext,
        helperBaseName
      );
      currentContext = wrapperContext;
      decls.push(wrapperDecl);
    }
  }

  return [decls, currentContext];
};
