import type {
  AstReader,
  ExtensionFactSubject,
  SourceFile,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type { TargetSourceAnalysisQueries } from "@tsonic/target-api";
import {
  createLazyTargetSourceAnalysis,
} from "@tsonic/target-api";
import { asNode, asSymbol } from "./guards.js";
import {
  getProjectSourceDeclarationForNode,
  getProjectSourceModuleDependencies,
  getProjectSourceMethodDispatch,
  getProjectSourceReferenceForNode,
  hasParameterlessConstruction,
} from "./project-source.js";
import {
  getPrimaryDeclaration,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
} from "./symbols.js";

export function createTargetSourceAnalysisQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  sourceFiles: readonly SourceFile[],
): TargetSourceAnalysisQueries {
  const projectSourceMethodDispatchCache = new WeakMap<object, ReturnType<TargetSourceAnalysisQueries["getProjectSourceMethodDispatch"]> | null>();
  const lazy = createLazyTargetSourceAnalysis(ast, checker, sourceFiles);
  return {
    lazy,
    getSymbolName(subject) {
      const symbol = asSymbol(subject);
      return symbol === undefined ? undefined : checker.getSymbolName(symbol);
    },
    getSymbolDeclarations(subject) {
      const symbol = asSymbol(subject);
      return symbol === undefined
        ? []
        : checker.getSymbolDeclarations(symbol).filter((declaration): declaration is NonNullable<typeof declaration> => declaration !== undefined);
    },
    getSymbolAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSymbolAtReferenceNode(ast, checker, node, options);
    },
    getResolvedSymbol(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getResolvedSymbolForReferenceNode(ast, checker, node, options);
    },
    getTypeSymbol(type) {
      return type === undefined ? undefined : checker.getTypeSymbol(type);
    },
    getTypeAliasSymbol(type) {
      return type === undefined ? undefined : checker.getTypeAliasSymbol(type);
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
    getResolvedCallParameterDeclarations(subject, options) {
      const signature = getResolvedSignatureForNode(subject, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map(getPrimaryDeclaration);
    },
    getResolvedCallParameterTypes(subject, options) {
      const signature = getResolvedSignatureForNode(subject, options);
      return signature === undefined
        ? undefined
        : signature.parameters.map((parameter) => checker.getTypeOfSymbol(parameter, options));
    },
    getEnumMemberConstant(subject, options) {
      const node = asNode(subject);
      const value = node === undefined ? undefined : checker.getConstantValue(node, options);
      return typeof value === "number" || typeof value === "string" || value === undefined ? { value } : undefined;
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

  function getResolvedSignatureForNode(
    subject: ExtensionFactSubject | undefined,
    options: { readonly sourceFile: SourceFile },
  ) {
    const node = asNode(subject);
    return node === undefined ? undefined : checker.getResolvedSignature(node, options);
  }
}
