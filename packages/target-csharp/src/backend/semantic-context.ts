import type { ExtensionConsumerQueries, Node, TypeCheckerQueries } from "@tsonic/tsts";

export interface CsharpSemanticContext {
  readonly checker: TypeCheckerQueries;
  readonly facts: ExtensionConsumerQueries;
  requireFact<T>(node: Node, read: (facts: ExtensionConsumerQueries, node: Node) => T | undefined, purpose: string): T;
}

export function createCsharpSemanticContext(checker: TypeCheckerQueries, facts: ExtensionConsumerQueries): CsharpSemanticContext {
  return {
    checker,
    facts,
    requireFact<T>(node: Node, read: (queries: ExtensionConsumerQueries, subject: Node) => T | undefined, purpose: string): T {
      const fact = read(facts, node);
      if (fact === undefined) {
        throw new Error(`Missing finalized C# target fact: ${purpose}.`);
      }
      return fact;
    },
  };
}
