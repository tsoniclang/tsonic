import type { AstReader, Node } from "@tsonic/tsts";
import { sourceParameterIsProperty } from "../../../source-navigation/class-members.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { TargetSourceProgram } from "../../../source-semantics/types.js";

export type SourceStorageProjection =
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number }
  | { readonly kind: "member"; readonly declaration: Node }
  | { readonly kind: "method-value"; readonly declaration: Node };

export function sourceStorageIsMemberProjection(
  component: SourceStorageProjection,
): component is Extract<SourceStorageProjection, { readonly declaration: Node }> {
  return component.kind === "member" || component.kind === "method-value";
}

export interface SourceStorageSubject {
  readonly kind: "input" | "value" | "member" | "return" | "receiver";
  readonly node: Node;
  readonly projection: readonly SourceStorageProjection[];
}

export type SourceStorageSubjectQuery = (
  node: Node | undefined,
  kind?: SourceStorageSubject["kind"],
  projection?: readonly SourceStorageProjection[],
) => SourceStorageSubject | undefined;

export function sourceStorageFormalOwner(subject: SourceStorageSubject, source: TargetSourceProgram): Node | undefined {
  const { ast } = source;
  if (subject.kind === "receiver") return subject.node;
  if (subject.kind !== "input" || !ast.is.IsParameterDeclaration(subject.node)) return undefined;
  const owner = ast.parent(subject.node);
  const file = owner === undefined ? undefined : ast.getSourceFile(owner);
  if (owner === undefined || file === undefined || !source.semantics.includes(file)) return undefined;
  const parameters = sourceCallableValueParameters(ast, owner, source.semantics.forFile(file), { kind: "declaration" });
  return parameters?.includes(subject.node) === true ? owner : undefined;
}

export function sourceStorageObjectRestOwner(node: Node, ast: AstReader): Node | undefined {
  if (!ast.is.IsBindingElement(node)) return undefined;
  const element = ast.as.AsBindingElement(node);
  const pattern = element?.DotDotDotToken === undefined ? undefined : ast.parent(node);
  const owner = pattern === undefined || !ast.is.IsObjectBindingPattern(pattern) ? undefined : ast.parent(pattern);
  return owner !== undefined && ast.name(owner) === pattern ? owner : undefined;
}

export function sourceStorageIsDataMember(node: Node, ast: AstReader): boolean {
  return ast.is.IsPropertyDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node) ||
    ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node) || sourceParameterIsProperty(ast, node);
}

export function sourceStorageIsMethodMember(node: Node, ast: AstReader): boolean {
  return ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node);
}

export function sourceStorageMemberSubject(
  node: Node,
  ast: AstReader,
  subject: SourceStorageSubjectQuery,
  projection?: readonly SourceStorageProjection[],
): SourceStorageSubject | undefined {
  return subject(node, ast.is.IsGetAccessorDeclaration(node) ? "return" : sourceStorageIsDataMember(node, ast) ? "member" : "value", projection);
}

export function sourceStorageHasOriginalCallableValue(subject: SourceStorageSubject, ast: AstReader): boolean {
  return subject.kind === "value" && subject.projection.length === 0 && ast.body(subject.node) !== undefined &&
    (ast.is.IsArrowFunction(subject.node) || ast.is.IsFunctionExpression(subject.node) ||
      ast.is.IsFunctionDeclaration(subject.node) || ast.is.IsMethodDeclaration(subject.node));
}

export function sourceStorageHasOriginalValue(subject: SourceStorageSubject, ast: AstReader, hasIncoming: boolean): boolean {
  return sourceStorageHasOriginalCallableValue(subject, ast) || !hasIncoming &&
    (!ast.is.IsArrayLiteralExpression(subject.node) || subject.projection.length === 0);
}

export function sourceStorageProjectionPath(projection: readonly SourceStorageProjection[]):
  readonly SourceStorageProjection[] | undefined {
  const normalized: SourceStorageProjection[] = [];
  let valid = Array.isArray(projection) && projection.length <= 256;
  for (let index = 0; valid && index < projection.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(projection, index);
    const component: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    const kind: unknown = component !== null && typeof component === "object"
      ? Object.getOwnPropertyDescriptor(component, "kind")?.value : undefined;
    const ordinal: unknown = component !== null && typeof component === "object"
      ? Object.getOwnPropertyDescriptor(component, "index")?.value : undefined;
    const declaration: unknown = component !== null && typeof component === "object"
      ? Object.getOwnPropertyDescriptor(component, "declaration")?.value : undefined;
    if (kind === "array-element") normalized.push(Object.freeze({ kind }));
    else if (kind === "tuple-element" && typeof ordinal === "number" && Number.isSafeInteger(ordinal) && ordinal >= 0)
      normalized.push(Object.freeze({ kind, index: ordinal }));
    else if ((kind === "member" || kind === "method-value") && declaration !== null && typeof declaration === "object")
      normalized.push(Object.freeze({ kind, declaration: declaration as Node }));
    else valid = false;
  }
  return valid ? Object.freeze(normalized) : undefined;
}

export function createSourceStorageSubjects(
  admit: (cost: number) => boolean,
  reject: (reason: string) => void,
): SourceStorageSubjectQuery {
  const kinds = new Map<SourceStorageSubject["kind"], Map<Node, Map<string, SourceStorageSubject>>>();
  const members = new Map<Node, number>();
  return (node, kind = "value", projection = []) => {
    if (node === undefined) return undefined;
    const normalized = sourceStorageProjectionPath(projection);
    if (normalized === undefined) {
      reject("Source storage projection requires a finite exact member/array/tuple component path.");
      return undefined;
    }
    const subjects = kinds.get(kind) ?? new Map<Node, Map<string, SourceStorageSubject>>();
    const components = subjects.get(node) ?? new Map<string, SourceStorageSubject>();
    const componentsKey: string[] = [];
    for (const component of normalized) {
      if (sourceStorageIsMemberProjection(component)) {
        let identity = members.get(component.declaration);
        if (identity === undefined) {
          if (!admit(1)) return undefined;
          identity = members.size;
          members.set(component.declaration, identity);
        }
        componentsKey.push(`${component.kind === "member" ? "m" : "v"}${identity}`);
      } else componentsKey.push(component.kind === "array-element" ? "a"
        : `${component.kind === "tuple-element" ? "t" : "g"}${component.index}`);
    }
    const key = componentsKey.join("/");
    let selected = components.get(key);
    if (selected === undefined) {
      if (!admit(1 + normalized.length)) return undefined;
      selected = Object.freeze({ kind, node, projection: Object.freeze(normalized) });
      components.set(key, selected);
      subjects.set(node, components);
      kinds.set(kind, subjects);
    }
    return selected;
  };
}
