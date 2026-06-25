import type {
  AstReader,
  ExtensionConsumerQueries,
  SourceFile,
  Symbol,
  TargetTypeRef,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type { TargetSemanticQueries } from "@tsonic/target-api";
import { asNode, asSymbol, isTypeSyntaxNode } from "./guards.js";
import {
  getProjectSourceDeclarationForNode,
  getProjectSourceModuleDependencies,
  getProjectSourceMethodDispatch,
  getProjectSourceReferenceForNode,
  hasParameterlessConstruction,
} from "./project-source.js";
import {
  getRuntimeCarrier,
  getRuntimeCarrierForType,
  getRuntimeCarrierForSemanticType,
  getRuntimeCarrierFromDeclaredFactGraph,
  targetTypeRefContainsSourcePrimitive,
} from "./runtime-carriers.js";
import {
  getAliasedSymbolIfAlias,
  getPrimaryDeclaration,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
  isTypeReferenceQuery,
} from "./symbols.js";

export function createTargetSemanticQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  sourceFiles: readonly SourceFile[],
): TargetSemanticQueries {
  const projectSourceMethodDispatchCache = new WeakMap<object, ReturnType<TargetSemanticQueries["getProjectSourceMethodDispatch"]> | null>();
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
    getSymbolAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSymbolAtReferenceNode(ast, checker, node, options);
    },
    getResolvedSymbol(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getResolvedSymbolForReferenceNode(ast, checker, node, options);
    },
    getTypeOfSymbol(subject, options) {
      const symbol = asSymbol(subject);
      return symbol === undefined ? undefined : checker.getTypeOfSymbol(symbol, options);
    },
    getTypeAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSemanticTypeForNode(ast, checker, node, options);
    },
    getTypeFromTypeNode(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : checker.getTypeFromTypeNode(node, options);
    },
    getResolvedCallReturnType(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      return signature === undefined
        ? undefined
        : checker.getReturnTypeOfSignature(signature, options);
    },
    getResolvedCallReturnRuntimeCarrier(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      const returnType = signature === undefined
        ? undefined
        : checker.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrierForType(ast, types, facts, returnType, options);
    },
    getResolvedCallParameterDeclarations(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map(getPrimaryDeclaration);
    },
    getResolvedCallParameterTypes(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map((parameter) => checker.getTypeOfSymbol(parameter, options));
    },
    getResolvedCallParameterRuntimeCarriers(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map((parameter) => getRuntimeCarrierForParameter(parameter, options));
    },
    getEnumMemberConstant(subject, options) {
      const node = asNode(subject);
      const value = node === undefined ? undefined : checker.getConstantValue(node, options);
      return typeof value === "number" || typeof value === "string" || value === undefined ? { value } : undefined;
    },
    getReturnTypeCarrierFromDeclaration(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const declarationType = checker.getTypeAtLocation(node, options);
      const signature = types.getCallSignatures(declarationType, options)[0];
      const returnType = types.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrier(facts, returnType) ?? getRuntimeCarrier(facts, returnType?.symbol);
    },
    isProjectSourceShapeForNode(subject, options) {
      const declaration = getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
      return declaration !== undefined && (
        ast.is.IsClassDeclaration(declaration) ||
        ast.is.IsInterfaceDeclaration(declaration) ||
        ast.is.IsEnumDeclaration(declaration) ||
        ast.is.IsEnumMember(declaration)
      );
    },
    isProjectSourceConstructibleObjectForNode(subject, options) {
      const declaration = getProjectSourceReferenceForNode(ast, checker, types, asNode(subject), options, sourceFiles)?.declaration ??
        getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
      return declaration !== undefined &&
        ast.is.IsClassDeclaration(declaration) &&
        hasParameterlessConstruction(ast, declaration);
    },
    getProjectSourceDeclarationForNode(subject, options) {
      return getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
    },
    getProjectSourceReferenceForNode(subject, options) {
      return getProjectSourceReferenceForNode(ast, checker, types, asNode(subject), options, sourceFiles);
    },
    getProjectSourceModuleDependencies(sourceFile) {
      return getProjectSourceModuleDependencies(ast, checker, sourceFile, sourceFiles);
    },
    getProjectSourceMethodDispatch(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const cached = projectSourceMethodDispatchCache.get(node);
      if (cached !== undefined) {
        return cached ?? undefined;
      }
      const dispatch = getProjectSourceMethodDispatch(ast, checker, types, node, options, sourceFiles);
      projectSourceMethodDispatchCache.set(node, dispatch ?? null);
      return dispatch;
    },
    describeTypeAtLocation(subject, options) {
      const node = asNode(subject);
      const type = node === undefined ? undefined : getSemanticTypeForNode(ast, checker, node, options);
      return type === undefined ? undefined : checker.typeToString(type, options);
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
