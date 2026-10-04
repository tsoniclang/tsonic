import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { IsTypeSyntaxNode, Node_Expression } from "../../source-navigation/index.js";
import { sourceErrorIndexedStorageProjection, sourceErrorStorageComponents, sourceErrorStorageSubjectType } from "./error-storage-components.js";
import type { SourceErrorStorageProjection, SourceErrorStorageSubject, SourceErrorStorageSubjectQuery } from "./error-storage-subjects.js";

export function createSourceErrorStorageProjectionFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceErrorStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceErrorStorageSubject | undefined,
  connect: (origin: SourceErrorStorageSubject | undefined, destination: SourceErrorStorageSubject | undefined) => void,
  unresolved: (subject: SourceErrorStorageSubject, reason: string) => void,
) {
  const { ast, semantics } = source;
  const project = (owner: SourceErrorStorageSubject | undefined, component: SourceErrorStorageProjection):
    SourceErrorStorageSubject | undefined => owner === undefined ? undefined
      : subject(owner.node, owner.kind, [...owner.projection, component]);
  const indexed = (node: Node): SourceErrorStorageSubject | undefined => {
    const queries = semantics.forNode(node);
    const access = queries.operations.elementAccess(node);
    const component = access === undefined ? undefined
      : sourceErrorIndexedStorageProjection(access.receiver.type, access.argument.expression, queries);
    const value = component === undefined ? subject(node) : project(subjectFor(access?.receiver.expression), component);
    if (value !== undefined && component === undefined)
      unresolved(value, "An indexed Error has no exact checked array/tuple storage component.");
    return value;
  };
  const binding = (reference: Node): SourceErrorStorageSubject | undefined => {
    const pattern = ast.parent(reference);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (pattern === undefined || owner === undefined || !ast.is.IsArrayBindingPattern(pattern)) return undefined;
    const originalOwner = subjectFor(owner);
    const ownerType = originalOwner === undefined ? undefined : sourceErrorStorageSubjectType(source, originalOwner);
    const queries = semantics.forNode(owner);
    const index = ast.elements(pattern).indexOf(reference);
    const component: SourceErrorStorageProjection | undefined = ownerType === undefined || index < 0 ? undefined
      : queries.types.isTuple(ownerType) ? { kind: "tuple-element", index }
        : queries.types.isArrayLike(ownerType) ? { kind: "array-element" } : undefined;
    const rest = ast.as.AsBindingElement(reference)?.DotDotDotToken !== undefined;
    const value = component === undefined || rest ? subject(reference) : project(originalOwner, component);
    if (value !== undefined) {
      if (component === undefined || rest && component.kind === "tuple-element")
        unresolved(value, "An Error binding has no exact selected array/tuple storage component.");
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
        const spreadType = spread === undefined ? undefined : sourceErrorStorageSubjectType(source, spread);
        if (spreadType !== undefined && (!tuple || queries.types.isTuple(spreadType))) {
          for (const component of sourceErrorStorageComponents(spreadType, queries)) {
            if (!step()) break;
            connect(project(spread, component), project(owner, tuple
              ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
          }
        } else if (owner !== undefined) unresolved(owner, "An Error spread has no exact checked component transport.");
      } else connect(subjectFor(element), project(owner, tuple
        ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
    }
  };
  const ownerFor = (node: Node, projection?: readonly SourceErrorStorageProjection[]): SourceErrorStorageSubject | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !semantics.includes(file)) return undefined;
    const syntaxProjection: SourceErrorStorageProjection[] = [];
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
    const components = projection ?? syntaxProjection;
    return owner === undefined ? undefined : subject(owner.node, owner.kind, [...owner.projection, ...components]);
  };
  return Object.freeze({ indexed, binding, literal, ownerFor });
}
