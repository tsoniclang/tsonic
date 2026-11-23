import type { TirBodyRoot, TirChapterSyntax, TirChapterSyntaxSlot, TirFormalInitializer, TirModuleRoot,
  TirReadyCallable, TirTypedSyntax, TypedPhase } from "../ir-tir/contract.js";
import { admitFormalInitializer, chapterStatementSyntax, chapterSyntaxSlots, formalInitializerSyntax } from "../ir-tir/index.js";
import type { ModuleBodies } from "./contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { BinaryExpression, BinarySyntaxReceipt, Block, BlockSyntaxReceipt, CheckedPhase, CheckedUnopenedDeclaration, Expression, HirNode, SourceFile,
  SyntaxChildSlot, SyntaxCopyResult, SyntaxImage, SyntaxMaterialization, SyntaxNode, SyntaxPhaseCopy } from "../ir-hir/contract.js";
import { prepareSyntaxCopy } from "../ir-hir/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";

export interface ChapterRootSlot {
  readonly path: string;
  readonly read: () => TirChapterSyntax;
}

interface ChapterPath {
  readonly parent: ChapterPath | null;
  readonly fields: readonly (string | number)[];
}

interface ChapterSyntaxAdmission<Stop> {
  readonly root: (path: ChapterPath) => Stop | null;
  readonly node: (path: ChapterPath, subject: TirChapterSyntax, ordinal: number) => SyntaxCopyResult<ChapterNodeShape | null, Stop>;
  readonly edge: (path: ChapterPath, slot: TirChapterSyntaxSlot) => Stop | null;
  readonly formal: (path: ChapterPath) => Stop | null;
  readonly close: (subject: TirTypedSyntax) => void;
}

export type ChapterNodeShape = BlockSyntaxReceipt<TypedPhase> | BinarySyntaxReceipt<TypedPhase> |
  PreparedChapterHeader;

export interface CheckedChapterImage {
  readonly expressionOf: (source: Expression<CheckedPhase>) => Expression<CheckedPhase>;
  readonly declarationOf: (source: CheckedUnopenedDeclaration) => CheckedUnopenedDeclaration;
  readonly sourceFileOf: (source: SourceFile<CheckedPhase>) => SourceFile<CheckedPhase>;
}

export interface HeaderOperands {
  readonly references: TypeReferenceRewrite;
  readonly typed: SyntaxImage<TypedPhase>;
  readonly checked: CheckedChapterImage;
  readonly callableOf: (source: TirReadyCallable) => TirReadyCallable;
}

export type PreparedChapterHeader =
  { readonly ordinal: number; readonly slots: Iterable<TirChapterSyntaxSlot> } &
  ({ readonly kind: "module"; readonly finish: (operands: HeaderOperands) => TirModuleRoot } |
   { readonly kind: "callable"; readonly finish: (operands: HeaderOperands) => TirReadyCallable });

interface ChapterFormalReceipt {
  readonly kind: "formal";
  readonly ordinal: number;
  readonly initializer: TirFormalInitializer;
}

export interface ChapterSyntaxInventory {
  readonly checkedRoots: readonly HirNode[];
  readonly typed: readonly TirTypedSyntax[];
  readonly wireOf: (node: TirTypedSyntax["node"]) => number | undefined;
}

type ReadCheckedDefault = (root: Expression<CheckedPhase>) => Expression<CheckedPhase>;

type ChapterWires = ReadonlyMap<TirTypedSyntax["node"], number | ChapterNodeShape | ChapterFormalReceipt>;

const missingParameter: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A syntax chapter must retain its actual dense formal inventory." };

export function chapterBodyRoot(node: TirBodyRoot): TirTypedSyntax {
  return node.kind === "SourceFile" ? { kind: "module-root", node } : { kind: "ordinary", node };
}

export function* moduleChapterRoots(module: ModuleBodies, at: string): Generator<ChapterRootSlot> {
  yield { read: () => {
    const actual = module.tree;
    return actual.kind === "checked-root" ? { kind: "checked", node: actual.root } : { kind: "module-root", node: actual.root };
  }, path: at + ".tree.root" };
  for (const [position, body] of module.bodies.entries()) {
    yield { read: () => chapterBodyRoot(body.tir.root), path: at + ".bodies[" + position + "].tir.root" };
    const params = body.tir.params;
    for (let index = 0; index < params.length; index += 1) {
      const parameter = index;
      yield { read: () => ({ kind: "formal", node: requirePresent(params[parameter], missingParameter) }),
        path: at + ".bodies[" + position + "].tir.params[" + parameter + "]" };
    }
  }
}

function pathText(path: ChapterPath): string {
  const all: ChapterPath[] = [];
  for (let current: ChapterPath | null = path; current !== null; current = current.parent) all.push(current);
  const segments: string[] = [];
  for (let part = all.pop(); part !== undefined; part = all.pop()) for (const field of part.fields) {
    if (typeof field === "number") segments.push("[", String(field), "]");
    else if (segments.length === 0) segments.push(field);
    else segments.push(".", field);
  }
  return segments.join("");
}

function* preparedSlots(slots: Iterable<SyntaxChildSlot<TypedPhase>>): Generator<TirChapterSyntaxSlot> {
  for (const slot of slots) yield { kind: "syntax", fields: slot.fields, read: () => ({
    kind: "ordinary", node: slot.read(),
  }) };
}

function walkChapterSyntax<Stop, Value>(
  roots: Iterable<ChapterRootSlot>, admission: ChapterSyntaxAdmission<Stop>,
  retainFormals: boolean, finish: (inventory: ChapterSyntaxInventory, wires: ChapterWires) => Value,
): { readonly kind: "complete"; readonly value: Value } | Stop {
  const checkedRoots: HirNode[] = [];
  const checkedSeen = new Set<HirNode>();
  const typed: TirTypedSyntax[] = [];
  const wires = new Map<TirTypedSyntax["node"], number | ChapterNodeShape | ChapterFormalReceipt>();
  const active = new Set<TirTypedSyntax["node"]>();
  type Frame = { readonly kind: "enter"; readonly subject: TirChapterSyntax; readonly path: ChapterPath }
    | { readonly kind: "children"; readonly subject: TirTypedSyntax; readonly cursor: Iterator<TirChapterSyntaxSlot>; readonly path: ChapterPath };
  for (const root of roots) {
    const path = { parent: null, fields: [root.path] };
    const rootStop = admission.root(path);
    if (rootStop !== null) return rootStop;
    const pending: Frame[] = [{ kind: "enter", subject: root.read(), path }];
    for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
      if (frame.kind === "children") {
        const child = frame.cursor.next();
        if (child.done) {
          active.delete(frame.subject.node);
          admission.close(frame.subject);
          continue;
        }
        const path = { parent: frame.path, fields: child.value.fields };
        const slot = child.value;
        let next: TirChapterSyntax | null;
        if (slot.kind === "formal-initializer") {
          const formal = frame.subject.node;
          if (formal.kind !== "Parameter") return throwInvariant({ owner: "ir-program", query: null, origin: formal.origin,
            message: "Only the actual formal can retain its initializer slot." });
          const initializer = admitFormalInitializer(slot, () => admission.formal(path), () => admission.edge(path, slot));
          if (initializer.kind === "refused") return initializer.stop;
          if (retainFormals) {
            const ordinal = wires.get(formal);
            if (typeof ordinal !== "number") return throwInvariant(missingParameter);
            wires.set(formal, { kind: "formal", ordinal, initializer: initializer.value });
          }
          next = formalInitializerSyntax(initializer.value);
        } else {
          const edge = admission.edge(path, slot);
          if (edge !== null) return edge;
          if (slot.kind === "statement") {
            const module = frame.subject;
            if (module.kind !== "module-root") return throwInvariant({ owner: "ir-program", query: null, origin: module.node.origin,
              message: "Only the actual module role can retain its authored statement slot." });
            const statement = slot.read();
            next = chapterStatementSyntax(statement);
          } else next = slot.read();
        }
        pending.push(frame);
        if (next !== null) pending.push({ kind: "enter", subject: next, path });
        continue;
      }
      const subject = frame.subject;
      if (subject.kind === "checked") {
        if (checkedSeen.has(subject.node)) continue;
        const retained = admission.node(frame.path, subject, checkedRoots.length);
        if (retained.kind === "refused") return retained.stop;
        checkedSeen.add(subject.node);
        checkedRoots.push(subject.node);
        continue;
      }
      if (active.has(subject.node)) throw new TypeError(`Syntax child cycle at ${pathText(frame.path)}`);
      const retained = wires.get(subject.node);
      const prior = typeof retained === "number" ? retained : retained?.ordinal;
      if (prior !== undefined) {
        if (typed[prior]?.kind !== subject.kind)
          return throwInvariant({ owner: "ir-program", query: null, origin: subject.node.origin,
            message: "A Typed wire object cannot serve two different authored roles." });
        continue;
      }
      const admitted = admission.node(frame.path, subject, typed.length);
      if (admitted.kind === "refused") return admitted.stop;
      const shape = admitted.value;
      wires.set(subject.node, shape ?? typed.length);
      active.add(subject.node);
      typed.push(subject);
      const slots = shape === null ? chapterSyntaxSlots(subject)
        : shape.kind === "module" || shape.kind === "callable" ? shape.slots : preparedSlots(shape.slots);
      pending.push({ kind: "children", subject, cursor: slots[Symbol.iterator](), path: frame.path });
    }
  }
  const inventory: ChapterSyntaxInventory = { typed, checkedRoots, wireOf: node => {
    const entry = wires.get(node);
    return typeof entry === "number" ? entry : entry?.ordinal;
  } };
  return { kind: "complete", value: finish(inventory, wires) };
}

export function inventoryChapterSyntax<Stop>(
  roots: Iterable<ChapterRootSlot>, admission: ChapterSyntaxAdmission<Stop>,
): { readonly kind: "complete"; readonly value: ChapterSyntaxInventory } | Stop {
  return walkChapterSyntax(roots, admission, false, inventory => inventory);
}

interface ChapterNodeCopyAdmission<Stop> {
  readonly root: (path: ChapterPath) => Stop | null;
  readonly edge: (path: ChapterPath, slot: TirChapterSyntaxSlot) => Stop | null;
  readonly formal: (path: ChapterPath) => Stop | null;
  readonly prepare: (subject: TirChapterSyntax, ordinal: number, copy: (node: SyntaxNode<TypedPhase>) => Stop | null) =>
    SyntaxCopyResult<ChapterNodeShape | null, Stop>;
}

export interface PreparedChapterNodeCopy<Image, Stop> {
  readonly checkedRoots: readonly HirNode[];
  readonly headerOf: (node: TirTypedSyntax["node"]) => PreparedChapterHeader | null;
  readonly ordinaryOf: (node: TirTypedSyntax["node"]) => SyntaxNode<TypedPhase> | null;
  readonly materialize: (image: Image, checkedDefault: ReadCheckedDefault) => SyntaxCopyResult<SyntaxImage<TypedPhase>, Stop>;
}

export function prepareChapterNodeCopy<Image, Stop extends { readonly kind: "resource-limit" | "refused" }>(
  roots: Iterable<ChapterRootSlot>, phase: SyntaxPhaseCopy<TypedPhase, Stop, Image>,
  beforeNode: (node: SyntaxNode<TypedPhase>) => Stop | null, admission: ChapterNodeCopyAdmission<Stop>,
): SyntaxCopyResult<PreparedChapterNodeCopy<Image, Stop>, Stop> {
  let checked: ReadCheckedDefault | undefined;
  let inventory: ChapterSyntaxInventory | undefined;
  let headerWires: ChapterWires | undefined;
  const prepared = prepareSyntaxCopy<TypedPhase, Stop, Image>(phase, beforeNode, copy => {
    const postorder: SyntaxNode<TypedPhase>[] = [];
    const discovered = walkChapterSyntax(roots, {
      root: admission.root, edge: admission.edge, formal: admission.formal,
      node: (_path, subject, ordinal) => admission.prepare(subject, ordinal, node => copy(node, ordinal)),
      close: subject => {
        if (subject.kind === "ordinary" || subject.kind === "formal") postorder.push(subject.node);
      },
    }, true, (value, wires): SyntaxMaterialization<TypedPhase, Image> => {
      inventory = value;
      headerWires = wires;
      return {
        postorder, wireOf: value.wireOf,
        blockOf: node => blockReceipt(wires, node),
        binaryOf: node => binaryReceipt(wires, node),
        copyInitializer: (node, expression) => {
          const entry = wires.get(node);
          if (entry === undefined || typeof entry === "number" || entry.kind !== "formal") return throwInvariant(missingParameter);
          const initializer = entry.initializer;
          if (initializer.kind === "checked-default")
            return { kind: "checked-default", root: requirePresent(checked, missingParameter)(initializer.root) };
          if (initializer.kind === "ready-default") return { kind: "ready-default", root: expression(initializer.root) };
          return initializer;
        },
      };
    });
    return discovered.kind === "complete" ? { kind: "copied", value: discovered.value } : { kind: "refused", stop: discovered };
  });
  if (prepared.kind === "refused") return prepared;
  const admitted = requirePresent(inventory, missingParameter);
  return { kind: "copied", value: { checkedRoots: admitted.checkedRoots,
    headerOf: node => {
      const row = requirePresent(headerWires, missingParameter).get(node);
      return typeof row === "object" && (row.kind === "module" || row.kind === "callable") ? row : null;
    },
    ordinaryOf: node => {
      const ordinal = admitted.wireOf(node);
      const original = ordinal === undefined ? undefined : admitted.typed[ordinal];
      return original?.kind === "ordinary" && original.node === node ? original.node : null;
    },
    materialize: (image, checkedDefault) => {
      checked ??= checkedDefault;
      return prepared.value(image);
    },
  } };
}

function blockReceipt(wires: ChapterWires, node: Block<TypedPhase>): BlockSyntaxReceipt<TypedPhase> {
  const entry = wires.get(node);
  if (entry !== undefined && typeof entry !== "number" && entry.kind === "block") return entry;
  return throwInvariant({ owner: "ir-program", query: null, origin: node.origin, message: "Block needs its actual paid chapter receipt." });
}

function binaryReceipt(wires: ChapterWires, node: BinaryExpression<TypedPhase>): BinarySyntaxReceipt<TypedPhase> {
  const entry = wires.get(node);
  if (entry !== undefined && typeof entry !== "number" && entry.kind === "binary") return entry;
  return throwInvariant({ owner: "ir-program", query: null, origin: node.origin, message: "Binary needs its actual paid chapter receipt." });
}
