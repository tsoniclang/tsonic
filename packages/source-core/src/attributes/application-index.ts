import type {
  AstReader,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
} from "@tsonic/tsts";
import {
  tsonicAttributeBuilderFactKey,
  type TsonicAttributeApplicationFact,
  type TsonicAttributeBuilderFact,
} from "./facts.js";

export interface TsonicAttributeApplicationFactIndex {
  readonly all: readonly TsonicAttributeApplicationFact[];
  forSourceFile(sourceFile: SourceFile): readonly TsonicAttributeApplicationFact[];
  forSubject(subject: Node): TsonicAttributeBuilderFact | undefined;
}

export function createTsonicAttributeApplicationFactIndex(input: {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
}): TsonicAttributeApplicationFactIndex {
  const all: TsonicAttributeApplicationFact[] = [];
  const bySourceFile = new Map<SourceFile, readonly TsonicAttributeApplicationFact[]>();
  const bySubject = new Map<Node, TsonicAttributeBuilderFact>();
  for (const sourceFile of input.sourceFiles) {
    const applications: TsonicAttributeApplicationFact[] = [];
    const pending: Node[] = [sourceFile];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node === undefined) continue;
      const fact = input.sourceFacts.getFact(node, tsonicAttributeBuilderFactKey);
      if (fact !== undefined) {
        bySubject.set(node, fact);
        if (fact.kind === "application") {
          applications.push(fact);
          all.push(fact);
        }
      }
      const children: Node[] = [];
      input.ast.forEachChild(node, child => {
        if (child !== undefined) children.push(child);
      });
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) pending.push(child);
      }
    }
    bySourceFile.set(sourceFile, Object.freeze(applications));
  }
  return Object.freeze({
    all: Object.freeze(all),
    forSourceFile: (sourceFile: SourceFile) => bySourceFile.get(sourceFile) ?? emptyApplications,
    forSubject: (subject: Node) => bySubject.get(subject),
  });
}

const emptyApplications: readonly TsonicAttributeApplicationFact[] = Object.freeze([]);
