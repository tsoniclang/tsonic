import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, orderGraph } from "../dataflow/index.js";
import { throwInvariant } from "../diag/index.js";
import type { ModuleId } from "../ids/contract.js";
import type { CheckedPhase, SourceFile } from "../ir-hir/contract.js";
import type { SourceBarrier } from "./source-barrier.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export function planModuleInitialization(entryPoint: ModuleId, source: SourceBarrier,
  externalEntries: readonly { readonly module: ModuleId }[],
  account: DataflowAccount): DataflowResult<readonly SourceFile<CheckedPhase>[]> {
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (start !== null) return start;
  const positions = new Map<ModuleId, number>();
  const successors: number[][] = [];
  const deferred = new Set<number>();
  const roots: number[] = [];
  const plan: SourceFile<CheckedPhase>[] = [];
  for (let index = 0; index < source.modules.length; index += 1) {
    const admit = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (admit !== null) return admit;
    const module = source.modules[index];
    if (module === undefined) return fail("The actual checked module inventory is dense.");
    positions.set(module.module.module, index);
    successors.push([]);
  }
  for (let index = 0; index < source.modules.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const ready = source.modules[index];
    const edges = successors[index];
    if (ready === undefined || edges === undefined) return fail("Each graph row requires its actual checked module.");
    if (ready.role !== "source") continue;
    for (let position = 0; position < ready.module.moduleLinks.length; position += 1) {
      const visit = chargeWork(account, 1);
      if (visit !== null) return visit;
      const link = ready.module.moduleLinks[position];
      if (link === undefined) return fail("The checked module evaluation inventory is dense.");
      if (link.evaluation === "erased") continue;
      if (link.evaluation === "deferred") {
        if (!deferred.has(index)) {
          const admit = chargeResultEntries(account, 1);
          if (admit !== null) return admit;
          deferred.add(index);
        }
        continue;
      }
      const statement = ready.nodes[link.declaration];
      if (statement?.kind !== "ImportDeclaration" && statement?.kind !== "JSImportDeclaration" && statement?.kind !== "ExportDeclaration")
        return fail("An eager module link must retain its actual authored import or export.");
      const target = statement.tsonic.target;
      if (target.kind !== "available" || target.value === null) return fail("An eager module link requires its actual checked target.");
      if (target.value.target !== "project") continue;
      const destination = positions.get(target.value.module);
      if (destination === undefined) return fail("An eager project dependency requires its actual checked module.");
      const targetRead = chargeWork(account, 1);
      if (targetRead !== null) return targetRead;
      const targetModule = source.modules[destination];
      if (targetModule === undefined) return fail("An eager project dependency requires its actual checked module.");
      if (targetModule.role !== "source") continue;
      const admit = chargeResultEntries(account, 1);
      if (admit !== null) return admit;
      edges.push(destination);
    }
  }
  const entry = positions.get(entryPoint);
  const entryRead = chargeWork(account, 1);
  if (entryRead !== null) return entryRead;
  if (entry === undefined || source.modules[entry]?.role !== "source") return fail("The entry requires its actual executable source module.");
  const entryWork = chargeResultEntries(account, 1);
  if (entryWork !== null) return entryWork;
  roots.push(entry);
  for (let index = 0; index < externalEntries.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const external = externalEntries[index];
    if (external === undefined) return fail("The actual selected external entry inventory is dense.");
    const position = positions.get(external.module);
    const targetRead = chargeWork(account, 1);
    if (targetRead !== null) return targetRead;
    const module = position === undefined ? undefined : source.modules[position];
    if (module === undefined || position === undefined) return fail("An external root requires its actual checked module.");
    if (module.role !== "source") continue;
    const admit = chargeResultEntries(account, 1);
    if (admit !== null) return admit;
    roots.push(position);
  }
  const ordered = orderGraph({ successors }, roots, account);
  if (ordered.kind !== "complete") return ordered;
  for (let index = 0; index < ordered.value.postorder.length; index += 1) {
    const next = chargeWork(account, 1);
    if (next !== null) return next;
    const position = ordered.value.postorder[index];
    if (position === undefined) return fail("The actual runtime dependency traversal is dense.");
    if (deferred.has(position)) return fail("A reached deferred module link requires its actual deferred activation.");
    const ready = source.modules[position];
    if (ready === undefined) return fail("The module plan requires its actual checked module.");
    const admit = chargeResultEntries(account, 1);
    if (admit !== null) return admit;
    plan.push(ready.module.tree);
  }
  return { kind: "complete", value: plan };
}
