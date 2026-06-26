import type {
  AstReader,
  ExtensionConsumerQueries,
  SourceFile,
  Symbol,
  TargetTypeRef,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type { TargetFactQueries } from "@tsonic/target-api";
import { asNode } from "../analysis/guards.js";
import { isTypeSyntaxNode } from "../analysis/guards.js";
import {
  getAliasedSymbolIfAlias,
  getPrimaryDeclaration,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
  isTypeReferenceQuery,
} from "../analysis/symbols.js";
import {
  getRuntimeCarrier,
  getRuntimeCarrierForType,
  getRuntimeCarrierForSemanticType,
  getRuntimeCarrierFromDeclaredFactGraph,
  targetTypeRefContainsSourcePrimitive,
} from "./runtime-carriers.js";

export function createTargetFactQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  sourceFiles: readonly SourceFile[],
): TargetFactQueries {
  return {
    getRuntimeCarrier(subject) {
      return getRuntimeCarrier(facts, subject);
    },
    getRuntimeCarrierForNode(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
      if (isTypeSyntaxNode(ast, node)) {
        return refineTargetNamedCarrier(getRuntimeCarrier(facts, node), semanticCarrier) ??
          getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles);
      }
      const declaredCarrier = getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles);
      const directCarrier = refineTargetNamedCarrier(getRuntimeCarrier(facts, node), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options)), semanticCarrier);
      if (
        declaredCarrier !== undefined &&
        (directCarrier === undefined || targetTypeRefContainsSourcePrimitive(declaredCarrier))
      ) {
        return declaredCarrier;
      }
      return directCarrier ??
        declaredCarrier ??
        semanticCarrier;
    },
    getTargetBinding(subject) {
      return facts.getTargetBindingFact(subject);
    },
    getTargetBindingForReference(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const referenceBinding = facts.getTargetBindingFact(node) ??
        facts.getTargetBindingFact(getSymbolAtReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)) ??
        facts.getTargetBindingFact(getResolvedSymbolForReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options));
      const semanticType = getSemanticTypeForNode(ast, checker, node, options);
      const typeBinding = facts.getTargetBindingFact(semanticType) ??
        facts.getTargetBindingFact(semanticType?.symbol);
      if (isTypeReferenceQuery(ast, node)) {
        return referenceBinding ?? typeBinding;
      }
      return referenceBinding;
    },
    getResolvedCallReturnRuntimeCarrier(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      const returnType = signature === undefined
        ? undefined
        : checker.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrierForType(ast, types, facts, returnType, options);
    },
    getResolvedCallParameterRuntimeCarriers(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map((parameter) => getRuntimeCarrierForParameter(parameter, options));
    },
    getReturnTypeCarrierFromDeclaration(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const declarationType = checker.getTypeAtLocation(node, options);
      const declarationName = ast.name(node);
      const declarationNameType = declarationName === undefined
        ? undefined
        : checker.getTypeAtLocation(declarationName, options);
      const declarationSymbol = declarationName === undefined
        ? undefined
        : checker.getSymbolAtLocation(declarationName, options);
      const resolvedDeclarationSymbol = declarationName === undefined
        ? undefined
        : checker.getResolvedSymbol(declarationName, options);
      const declarationSymbolType = declarationName === undefined
        ? undefined
        : checker.getTypeOfSymbol(declarationSymbol, options);
      const resolvedDeclarationSymbolType = declarationName === undefined
        ? undefined
        : checker.getTypeOfSymbol(resolvedDeclarationSymbol, options);
      const signature = types.getCallSignatures(declarationType, options)[0] ??
        types.getCallSignatures(declarationNameType, options)[0] ??
        types.getCallSignatures(declarationSymbolType, options)[0] ??
        types.getCallSignatures(resolvedDeclarationSymbolType, options)[0];
      const returnType = signature === undefined
        ? undefined
        : types.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrier(facts, returnType) ??
        getRuntimeCarrier(facts, returnType?.symbol) ??
        getRuntimeCarrierForType(ast, types, facts, returnType, options);
    },
  };

  function getRuntimeCarrierForParameter(
    parameter: Symbol | undefined,
    options: { readonly sourceFile: SourceFile },
  ): TargetTypeRef | undefined {
    const direct = getRuntimeCarrier(facts, parameter);
    if (direct !== undefined) {
      return direct;
    }
    const declaration = getPrimaryDeclaration(parameter);
    const declarationFile = ast.getSourceFile(declaration) ?? options.sourceFile;
    const declarationCarrier = declaration === undefined
      ? undefined
      : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, declaration, { sourceFile: declarationFile }, sourceFiles);
    if (declarationCarrier !== undefined) {
      return declarationCarrier;
    }
    const type = checker.getTypeOfSymbol(parameter, options);
    return getRuntimeCarrier(facts, type) ?? getRuntimeCarrier(facts, type?.symbol);
  }
}

function refineTargetNamedCarrier(
  direct: TargetTypeRef | undefined,
  semantic: TargetTypeRef | undefined,
): TargetTypeRef | undefined {
  if (
    direct?.kind === "target-named" &&
    semantic?.kind === "target-named" &&
    direct.id === semantic.id &&
    (semantic.typeArguments?.length ?? 0) > 0
  ) {
    return semantic;
  }
  return direct;
}
