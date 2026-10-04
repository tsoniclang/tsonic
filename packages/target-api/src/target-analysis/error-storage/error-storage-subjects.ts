import type { Node } from "@tsonic/tsts";

export type SourceErrorStorageProjection =
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number };

export interface SourceErrorStorageSubject {
  readonly kind: "value" | "return" | "receiver";
  readonly node: Node;
  readonly projection: readonly SourceErrorStorageProjection[];
}

export type SourceErrorStorageSubjectQuery = (
  node: Node | undefined,
  kind?: SourceErrorStorageSubject["kind"],
  projection?: readonly SourceErrorStorageProjection[],
) => SourceErrorStorageSubject | undefined;

export function createSourceErrorStorageSubjects(
  admit: (cost: number) => boolean = () => true,
  reject: (reason: string) => void = () => {},
): SourceErrorStorageSubjectQuery {
  const values = new Map<Node, Map<string, SourceErrorStorageSubject>>();
  const returns = new Map<Node, Map<string, SourceErrorStorageSubject>>();
  const receivers = new Map<Node, Map<string, SourceErrorStorageSubject>>();
  return (node, kind = "value", projection = []) => {
    if (node === undefined) return undefined;
    const normalized: SourceErrorStorageProjection[] = [];
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
    if (!valid) {
      reject("Error storage projection requires a finite exact array/tuple component path.");
      return undefined;
    }
    const subjects = kind === "value" ? values : kind === "return" ? returns : receivers;
    const components = subjects.get(node) ?? new Map<string, SourceErrorStorageSubject>();
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
