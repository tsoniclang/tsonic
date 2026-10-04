import type { Node } from "@tsonic/tsts";

export interface SourceErrorStorageSubject {
  readonly kind: "value" | "return" | "receiver";
  readonly node: Node;
}

export function createSourceErrorStorageSubjects() {
  const values = new Map<Node, SourceErrorStorageSubject>();
  const returns = new Map<Node, SourceErrorStorageSubject>();
  const receivers = new Map<Node, SourceErrorStorageSubject>();
  return (node: Node | undefined, kind: SourceErrorStorageSubject["kind"] = "value"): SourceErrorStorageSubject | undefined => {
    if (node === undefined) return undefined;
    const subjects = kind === "value" ? values : kind === "return" ? returns : receivers;
    let selected = subjects.get(node);
    if (selected === undefined) {
      selected = Object.freeze({ kind, node });
      subjects.set(node, selected);
    }
    return selected;
  };
}
