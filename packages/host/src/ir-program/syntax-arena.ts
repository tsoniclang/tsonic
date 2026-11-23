import type { TypedPhase } from "../ir-tir/contract.js";
import type { ModuleBodies } from "./contract.js";
import type { SyntaxForest, SyntaxRootSlot } from "../ir-hir/contract.js";
import { walkSyntaxForest } from "../ir-hir/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";

export type SyntaxInventory = SyntaxForest<TypedPhase>;

const missingParameter: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A syntax chapter must retain its actual dense formal inventory." };

export function* moduleSyntaxRoots(module: ModuleBodies, at: string): Generator<SyntaxRootSlot<TypedPhase>> {
  yield { read: () => module.tree, path: at + ".tree" };
  for (const [position, body] of module.bodies.entries()) {
    yield { read: () => body.tir.root, path: at + ".bodies[" + position + "].tir.root" };
    const params = body.tir.params;
    for (let index = 0; index < params.length; index += 1) {
      const parameter = index;
      yield { read: () => requirePresent(params[parameter], missingParameter),
        path: at + ".bodies[" + position + "].tir.params[" + parameter + "]" };
    }
  }
}

export function inventorySyntax(roots: Iterable<SyntaxRootSlot<TypedPhase>>): SyntaxInventory {
  return walkSyntaxForest<TypedPhase, never>(roots, { root: () => null, edge: () => null, node: () => null }).value;
}
