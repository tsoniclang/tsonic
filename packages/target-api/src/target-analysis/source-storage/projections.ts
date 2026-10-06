import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { IsTypeSyntaxNode, Node_Expression } from "../../source-navigation/index.js";
import { sourceIndexedStorageProjection, sourceStorageComponents, sourceStorageSubjectType } from "./components.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageProjectionPath } from "./subjects.js";

export function createSourceStorageProjectionFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined) => void,
  unresolved: (subject: SourceStorageSubject, reason: string) => void,
) {
  const { ast, semantics } = source;
  const project = (owner: SourceStorageSubject | undefined, component: SourceStorageProjection):
    SourceStorageSubject | undefined => owner === undefined ? undefined
      : subject(owner.node, owner.kind, [...owner.projection, component]);
  const indexed = (node: Node): SourceStorageSubject | undefined => {
    const queries = semantics.forNode(node);
    const access = queries.operations.elementAccess(node);
    const component = access === undefined ? undefined
      : sourceIndexedStorageProjection(access.receiver.type, access.argument.expression, queries);
    const value = component === undefined ? subject(node) : project(subjectFor(access?.receiver.expression), component);
    if (value !== undefined && component === undefined)
      unresolved(value, "An indexed value has no exact checked array/tuple storage component.");
    return value;
  };
  const binding = (reference: Node): SourceStorageSubject | undefined => {
    const pattern = ast.parent(reference);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (pattern === undefined || owner === undefined || !ast.is.IsArrayBindingPattern(pattern)) return undefined;
    const originalOwner = subjectFor(owner);
    const ownerType = originalOwner === undefined ? undefined : sourceStorageSubjectType(source, originalOwner);
    const queries = semantics.forNode(owner);
    const index = ast.elements(pattern).indexOf(reference);
    const component: SourceStorageProjection | undefined = ownerType === undefined || index < 0 ? undefined
      : queries.types.isTuple(ownerType) ? { kind: "tuple-element", index }
        : queries.types.isArrayLike(ownerType) ? { kind: "array-element" } : undefined;
    const rest = ast.as.AsBindingElement(reference)?.DotDotDotToken !== undefined;
    const value = component === undefined || rest ? subject(reference) : project(originalOwner, component);
    if (value !== undefined) {
      if (component === undefined || rest && component.kind === "tuple-element")
        unresolved(value, "A source binding has no exact selected array/tuple storage component.");
      else if (rest) connect(project(originalOwner, component), project(value, { kind: "array-element" }));
    }
    return value;
  };
  const literal = (node: Node): void => {
    const owner = subjectFor(node);
    const queries = semantics.forNode(node);
    const type = queries.types.contextualType(node) ?? queries.types.expressionType(node);
    const tuple = type !== undefined && queries.types.isTuple(type);
    let tupleIndex = 0;
    for (const element of ast.elements(node)) {
      if (!step()) break;
      if (element === undefined || ast.is.IsOmittedExpression(element)) { tupleIndex += 1; continue; }
      if (ast.is.IsSpreadElement(element)) {
        const spread = subjectFor(Node_Expression(ast, element));
        const spreadType = spread === undefined ? undefined : sourceStorageSubjectType(source, spread);
        if (spreadType !== undefined && (!tuple || queries.types.isTuple(spreadType))) {
          for (const component of sourceStorageComponents(spreadType, queries)) {
            if (!step()) break;
            connect(project(spread, component), project(owner, tuple
              ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
          }
        } else if (owner !== undefined) unresolved(owner, "A source spread has no exact checked component transport.");
      } else connect(subjectFor(element), project(owner, tuple
        ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
    }
  };
  const ownerFor = (node: Node, projection?: readonly SourceStorageProjection[]): SourceStorageSubject | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !semantics.includes(file)) return undefined;
    const syntaxProjection: SourceStorageProjection[] = [];
    for (let remaining = 2_048; IsTypeSyntaxNode(ast, node); remaining -= 1) {
      if (remaining === 0 || !step()) return undefined;
      const parent = ast.parent(node);
      if (parent === undefined) break;
      if (ast.is.IsArrayTypeNode(parent)) syntaxProjection.unshift({ kind: "array-element" });
      if (ast.is.IsTupleTypeNode(parent)) {
        const index = ast.elements(parent).indexOf(node);
        if (index >= 0) syntaxProjection.unshift({ kind: "tuple-element", index });
      }
      node = parent;
    }
    const owner = ast.body(node) === undefined ? subjectFor(node) : subject(node, "return");
    const components = sourceStorageProjectionPath(projection === undefined ? syntaxProjection : projection);
    return owner === undefined || components === undefined ? undefined
      : subject(owner.node, owner.kind, [...owner.projection, ...components]);
  };
  return Object.freeze({ indexed, binding, literal, ownerFor });
}
