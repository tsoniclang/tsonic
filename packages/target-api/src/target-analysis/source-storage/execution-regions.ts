import type { Node, Type } from "@tsonic/tsts";
import { Node_Initializer, sourceClassFieldIsTypeOnly } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageConstructedClass } from "./construction.js";

export function createSourceStorageExecutionRegions(source: TargetSourceProgram, step: () => boolean) {
  const { ast, semantics, navigation } = source;
  const typeMayBeAbsent = (type: Type, owner: Node): boolean => {
    const types = semantics.forNode(owner).types;
    const pending = [type];
    const checked = new Set<Type>();
    while (pending.length !== 0) {
      const selected = pending.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      if (!step()) return true;
      if (types.isAny(selected) || types.isUnknown(selected) || types.isNullish(selected) ||
        types.isVoidLike(selected) || types.couldContainTypeVariables(selected)) return true;
      if (types.isUnion(selected)) {
        for (const member of types.unionOrIntersectionTypes(selected)) {
          if (member === undefined) return true;
          pending.push(member);
        }
      }
    }
    return false;
  };
  const callable = (declaration: Node, invocation: Node | undefined): readonly Node[] => {
    const body = ast.body(declaration);
    if (body === undefined) return [];
    const regions = [body];
    const selection = invocation === undefined ? undefined : semantics.forNode(invocation).operations.call(invocation);
    for (const [index, parameter] of ast.parameters(declaration).entries()) {
      if (!step()) break;
      const initializer = parameter === undefined ? undefined : Node_Initializer(ast, parameter);
      if (initializer === undefined) continue;
      const bindings = selection?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === index);
      if (bindings === undefined || bindings.length === 0 || bindings.some(binding =>
        binding.sourceForm === "spread-sequence" || typeMayBeAbsent(binding.selectedArgumentType, invocation!))) {
        regions.push(initializer);
      }
    }
    return regions;
  };
  const instance = (invocation: Node): readonly { readonly owner: Node; readonly node: Node }[] => {
    const declaration = sourceStorageConstructedClass(invocation, source, step);
    if (declaration === undefined || !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration)) return [];
    const classes = [declaration];
    const checked = new Set<Node>();
    const regions: { readonly owner: Node; readonly node: Node }[] = [];
    while (classes.length !== 0) {
      const selected = classes.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      if (!step()) break;
      if (!ast.is.IsClassDeclaration(selected) && !ast.is.IsClassExpression(selected)) continue;
      for (const member of ast.members(selected)) {
        if (!step()) break;
        if (member === undefined || !ast.is.IsPropertyDeclaration(member) ||
          ast.hasModifierKind(member, "static") || sourceClassFieldIsTypeOnly(ast, member)) continue;
        const initializer = Node_Initializer(ast, member);
        if (initializer !== undefined) regions.push({ owner: selected, node: initializer });
      }
      const heritage = navigation.declaredHeritage(selected);
      if (heritage.kind === "resolved") {
        for (const edge of heritage.edges) if (edge.kind === "extends") classes.push(edge.target.declaration);
      }
    }
    return regions;
  };
  const enclosing = (node: Node): Node | undefined => {
    let child = node;
    for (let parent = ast.parent(node); parent !== undefined && step(); child = parent, parent = ast.parent(parent)) {
      if ((ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
        Node_Initializer(ast, parent) === child) return child;
      if (ast.is.IsFunctionDeclaration(parent) || ast.is.IsFunctionExpression(parent) ||
        ast.is.IsArrowFunction(parent) || ast.is.IsMethodDeclaration(parent) ||
        ast.is.IsConstructorDeclaration(parent) || ast.is.IsGetAccessorDeclaration(parent) ||
        ast.is.IsSetAccessorDeclaration(parent)) return ast.body(parent);
      if (ast.is.IsSourceFile(parent)) return parent;
    }
    return undefined;
  };
  return Object.freeze({ callable, instance, enclosing });
}
