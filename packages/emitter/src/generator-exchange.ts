/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 *
 * Exchange classes are built as CSharpTypeDeclarationAst internally.
 * generateGeneratorExchanges returns [string, EmitterContext] because
 * the wrapper class (generator-wrapper.ts) is still text-based.
 */

import { IrModule, IrFunctionDeclaration } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { printTypeDeclaration } from "./core/format/backend-ast/printer.js";
import {
  needsBidirectionalSupport,
  generateWrapperClass,
} from "./generator-wrapper.js";
import { getCSharpName } from "./naming-policy.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

/**
 * Collect all generator functions from a module
 */
const collectGenerators = (module: IrModule): IrFunctionDeclaration[] => {
  const generators: IrFunctionDeclaration[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      generators.push(stmt);
    }
  }

  return generators;
};

/**
 * Generate exchange object class as CSharpTypeDeclarationAst
 */
export const generateExchangeClassAst = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [CSharpTypeDeclarationAst, EmitterContext] => {
  let currentContext = context;
  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const exchangeName = `${csharpBaseName}_exchange`;

  // Determine output/input types from return type
  let outputTypeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };
  let inputTypeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };

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
 * Generate all exchange objects, wrapper classes, and IteratorResult struct for generators in a module.
 *
 * Returns text because the wrapper class is still text-based.
 * The exchange classes are built as AST internally.
 */
export const generateGeneratorExchanges = (
  module: IrModule,
  context: EmitterContext
): [string, EmitterContext] => {
  const generators = collectGenerators(module);

  if (generators.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  for (const generator of generators) {
    // Exchange class (AST-based, printed to text)
    const [exchangeAst, exchangeContext] = generateExchangeClassAst(
      generator,
      currentContext
    );
    currentContext = exchangeContext;
    parts.push(printTypeDeclaration(exchangeAst, "    "));
    parts.push("");

    // Wrapper class (text-based, only for bidirectional generators)
    if (needsBidirectionalSupport(generator)) {
      const [wrapperCode, wrapperContext] = generateWrapperClass(
        generator,
        currentContext
      );
      currentContext = wrapperContext;
      parts.push(wrapperCode);
      parts.push("");
    }
  }

  return [parts.join("\n"), currentContext];
};
