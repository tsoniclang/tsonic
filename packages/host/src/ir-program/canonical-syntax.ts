import type { HirNode, SyntaxCopyResult } from "../ir-hir/contract.js";
import type { TirBody, TirChapterTree } from "../ir-tir/contract.js";
import type { InstantiationStop } from "./work.js";
import type { PreparedTypedSyntax } from "./instantiate-syntax.js";
import { prepareTypedChapter } from "./instantiate-syntax.js";
import type { AdmittedTirSyntax } from "./instantiate-tir.js";
import { inventoryTirBody } from "./instantiate-tir.js";
import type { ModuleBodies, PublishedBody } from "./contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import { projectBodyFacts, projectInstance, projectObservations } from "./canonical-facts.js";
import { projectMirBody } from "./canonical-tir.js";
import type { ProjectionInventory, ProjectionResult } from "./program-values.js";
import { copiedProjection, projectRead, projectRecord, projectRows } from "./program-values.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import { typedSyntaxPhaseCopy } from "./canonical-phase.js";
import type { ChapterRootSlot } from "./syntax-arena.js";
import { chapterBodyRoot } from "./syntax-arena.js";
import type { BodyInstance } from "../ir-types/contract.js";

const missingSyntax: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A syntax chapter can only project a node from its admitted forest." };

export function rewriteBodySyntax(
  rewrite: TypeReferenceRewrite, roots: AdmittedTirSyntax, syntax: PreparedTypedSyntax,
): SyntaxCopyResult<Pick<TirBody, "root" | "params">, InstantiationStop> {
  const projected = syntax.materialize(rewrite);
  if (projected.kind === "refused") return projected;
  const image = projected.value;
  for (const [index, parameter] of roots.params.entries())
    roots.params[index] = requirePresent(image.parameterOf(parameter) ?? undefined, missingSyntax);
  return { kind: "copied", value: { root: requirePresent(image.bodyRootOf(roots.root) ?? undefined, missingSyntax), params: roots.params } };
}

export interface PreparedPublishedBody {
  readonly instance: BodyInstance;
  readonly materialize: (syntax: ResolvedChapterSyntax) => PublishedBody;
}

export interface PreparedModuleSyntax {
  readonly checkedRoots: readonly HirNode[];
  readonly originalTree: TirChapterTree;
  readonly bodies: readonly PreparedPublishedBody[];
  readonly materialize: (checked: ReadChapterChecked, bodies: readonly PreparedPublishedBody[]) => ModuleBodies;
}

export type ReadChapterChecked = (node: HirNode) => HirNode;

export type ResolvedChapterSyntax = {
  readonly bodyRootOf: (node: TirBody["root"]) => TirBody["root"];
  readonly formalOf: (node: TirBody["params"][number]) => TirBody["params"][number];
  readonly treeOf: (tree: TirChapterTree) => TirChapterTree;
};

export type RememberProgramBody = (
  original: TirBody, source: PublishedBody, selected: Omit<Extract<PublishedBody, { readonly kind: "selected" }>, "tir"> | null,
) => ProjectionResult<(projected: TirBody) => void>;

export function prepareModuleSyntax(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, module: ModuleBodies, at: string,
  remember: RememberProgramBody,
): ProjectionResult<PreparedModuleSyntax> {
  return projectRecord(scan, 3, () => {
    const rows = projectRows(scan, module.bodies, read => projectRecord(scan, 3, () => {
      const source = read();
      const instance = projectInstance(scan, rewrite, source.instance);
      if (instance.kind === "refused") return instance;
      const original = source.tir;
      const body = inventoryTirBody(scan, original);
      if (body.kind !== "complete") return { kind: "refused", stop: body };
      return copiedProjection({ source, original, instance: instance.value, body: body.value });
    }));
    if (rows.kind === "refused") return rows;
    const admittedRows = rows.value;
    const originalTree = module.tree;
    const moduleId = module.module;
    function* slots(): Generator<ChapterRootSlot> {
      yield { read: () => originalTree.kind === "checked-root" ? { kind: "checked", node: originalTree.root }
        : { kind: "module-root", node: originalTree.root }, path: at + ".tree" };
      for (const [position, { body }] of admittedRows.entries()) {
        const path = at + ".bodies[" + position + "].tir";
        yield { read: () => chapterBodyRoot(body.roots.root), path: path + ".root" };
        for (const [index, parameter] of body.roots.params.entries())
          yield { read: () => ({ kind: "formal", node: parameter }), path: path + ".params[" + index + "]" };
      }
    }
    const syntax = prepareTypedChapter(scan, slots(), typedSyntaxPhaseCopy(scan, at));
    if (syntax.kind !== "complete") return { kind: "refused", stop: syntax };
    const bodies: PreparedPublishedBody[] = [];
    for (const [position, { source, original, instance, body }] of admittedRows.entries()) {
      let selected: Omit<Extract<PublishedBody, { readonly kind: "selected" }>, "tir"> | null = null;
      if (source.kind === "selected") {
        const mir = projectMirBody(scan, source.mir, rewrite, at + ".bodies[" + position + "].mir");
        if (mir.kind === "refused") return mir;
        const observations = projectObservations(scan, rewrite, source.observations);
        if (observations.kind === "refused") return observations;
        const facts = projectRows(scan, source.facts, read => projectRead(scan, () => projectBodyFacts(scan, rewrite, read())));
        if (facts.kind === "refused") return facts;
        selected = { kind: "selected", instance, mir: mir.value, observations: observations.value, facts: facts.value };
      }
      const ready = remember(original, source, selected);
      if (ready.kind === "refused") return ready;
      const arm = selected;
      bodies.push({ instance, materialize: image => {
        const roots = body.roots;
        for (const [index, parameter] of roots.params.entries()) roots.params[index] = image.formalOf(parameter);
        const tir = body.project(rewrite, image.bodyRootOf(roots.root), roots.params, instance.bindings);
        ready.value(tir);
        return arm === null ? { kind: "template", instance, tir } : { ...arm, tir };
      } });
    }
    return copiedProjection({ checkedRoots: syntax.value.checkedRoots, originalTree, bodies,
      materialize: (checked, ranked) => {
        const image = syntax.value.materialize(rewrite, checked);
        return { module: moduleId, tree: image.treeOf(originalTree), bodies: ranked.map(body => body.materialize(image)) };
      },
    });
  });
}
