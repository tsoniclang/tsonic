import type { AstReader, Node } from "@tsonic/tsts";
import { sourceParameterIsProperty } from "../../source-navigation/class-members.js";

export type SourceStorageProjection =
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number };

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

export function sourceStorageIsDataMember(node: Node, ast: AstReader): boolean {
  return ast.is.IsPropertyDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node) ||
    ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node) || sourceParameterIsProperty(ast, node);
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
    if (kind === "array-element") normalized.push(Object.freeze({ kind }));
    else if (kind === "tuple-element" && typeof ordinal === "number" && Number.isSafeInteger(ordinal) && ordinal >= 0)
      normalized.push(Object.freeze({ kind, index: ordinal }));
    else valid = false;
  }
  return valid ? Object.freeze(normalized) : undefined;
}

export function createSourceStorageSubjects(
  admit: (cost: number) => boolean,
  reject: (reason: string) => void,
): SourceStorageSubjectQuery {
  const kinds = new Map<SourceStorageSubject["kind"], Map<Node, Map<string, SourceStorageSubject>>>();
  return (node, kind = "value", projection = []) => {
    if (node === undefined) return undefined;
    const normalized = sourceStorageProjectionPath(projection);
    if (normalized === undefined) {
      reject("Source storage projection requires a finite exact array/tuple component path.");
      return undefined;
    }
    const subjects = kinds.get(kind) ?? new Map<Node, Map<string, SourceStorageSubject>>();
    const components = subjects.get(node) ?? new Map<string, SourceStorageSubject>();
    const key = normalized.map(component => component.kind === "array-element" ? "a" : `t${component.index}`).join("/");
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
