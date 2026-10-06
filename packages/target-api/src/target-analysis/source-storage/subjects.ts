import type { Node } from "@tsonic/tsts";

export type SourceStorageProjection =
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number };

export interface SourceStorageSubject {
  readonly kind: "value" | "return" | "receiver";
  readonly node: Node;
  readonly projection: readonly SourceStorageProjection[];
}

export type SourceStorageSubjectQuery = (
  node: Node | undefined,
  kind?: SourceStorageSubject["kind"],
  projection?: readonly SourceStorageProjection[],
) => SourceStorageSubject | undefined;

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
  const values = new Map<Node, Map<string, SourceStorageSubject>>();
  const returns = new Map<Node, Map<string, SourceStorageSubject>>();
  const receivers = new Map<Node, Map<string, SourceStorageSubject>>();
  return (node, kind = "value", projection = []) => {
    if (node === undefined) return undefined;
    const normalized = sourceStorageProjectionPath(projection);
    if (normalized === undefined) {
      reject("Source storage projection requires a finite exact array/tuple component path.");
      return undefined;
    }
    const subjects = kind === "value" ? values : kind === "return" ? returns : receivers;
    const components = subjects.get(node) ?? new Map<string, SourceStorageSubject>();
    const key = normalized.map(component => component.kind === "array-element" ? "a" : `t${component.index}`).join("/");
    let selected = components.get(key);
    if (selected === undefined) {
      if (!admit(1 + normalized.length)) return undefined;
      selected = Object.freeze({ kind, node, projection: Object.freeze(normalized) });
      components.set(key, selected);
      subjects.set(node, components);
    }
    return selected;
  };
}
