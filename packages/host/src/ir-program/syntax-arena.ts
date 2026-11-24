import type { ChapterSyntaxSlots, TirBodyRoot, TirCallArguments, TirChapterSyntax, TirChapterSyntaxSlot, TirFormalInitializer, TirLayoutOperand, TirModuleRoot,
  TirReadyCallable, TirTypedSyntax, TypedPhase } from "../ir-tir/contract.js";
import { admitFormalInitializer, chapterStatementSyntax, chapterSyntaxSlots, formalInitializerSlot, formalInitializerSyntax,
  layoutArgumentSlots, readChapterSyntaxSlot } from "../ir-tir/index.js";
import type { ModuleBodies } from "./contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { ApplicationSyntaxReceipt, ArrowFunction, CheckedPhase, CheckedUnopenedDeclaration, Expression, HirNode, ObjectLiteralExpression,
  ParameterSyntaxReceipt, RetainedSyntaxNode, SourceFile, SyntaxChildSlot, SyntaxCopyResult, SyntaxExpressionImage,
  SyntaxImage, SyntaxMaterialization, SyntaxNode, SyntaxPhaseCopy, SyntaxStructureReceipt } from "../ir-hir/contract.js";
import { prepareSyntaxArgumentList, prepareSyntaxCopy } from "../ir-hir/index.js";
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
  readonly layout: (path: ChapterPath) => Stop | null;
  readonly close: (subject: TirTypedSyntax) => void;
}

export type ChapterNodeShape = SyntaxStructureReceipt<TypedPhase> | PreparedChapterHeader;

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
  readonly header: ParameterSyntaxReceipt<TypedPhase>;
}

interface ChapterCallReceipt {
  readonly kind: "call";
  readonly ordinal: number;
  readonly header: ApplicationSyntaxReceipt<TypedPhase>;
  readonly slots: Iterable<TirChapterSyntaxSlot>;
  readonly copy: (typed: SyntaxExpressionImage<TypedPhase>, checked: ReadCheckedDefault) => TirCallArguments;
}

export interface ChapterSyntaxInventory {
  readonly checkedRoots: readonly HirNode[];
  readonly typed: readonly TirTypedSyntax[];
  readonly wireOf: (node: TirTypedSyntax["node"]) => number | undefined;
}

type ReadCheckedDefault = (root: Expression<CheckedPhase>) => Expression<CheckedPhase>;

type ChapterWire = number | ChapterNodeShape | ChapterFormalReceipt | ChapterCallReceipt;
type ChapterWires = ReadonlyMap<TirTypedSyntax["node"], ChapterWire>;

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

function* preparedSlots(slots: Iterable<SyntaxChildSlot<TypedPhase>>, subject: TirTypedSyntax): Generator<TirChapterSyntaxSlot> {
  for (const slot of slots) yield { kind: "syntax", fields: slot.fields, read: () => {
    const node = slot.read();
    return node.kind === "Parameter" ? { kind: "formal", node } : { kind: "ordinary", node };
  } };
  if (subject.kind === "formal") yield formalInitializerSlot(subject.node);
}

function retainCallArguments(header: ApplicationSyntaxReceipt<TypedPhase>, argumentList: TirCallArguments,
  subject: TirTypedSyntax): ChapterCallReceipt {
  if (!("kind" in argumentList)) {
    const arguments_ = prepareSyntaxArgumentList<TypedPhase>(argumentList);
    return { kind: "call", ordinal: header.ordinal, header, slots: preparedSlots(arguments_.slots, subject), copy: arguments_.copy };
  }
  const layout = argumentList;
  const loc = layout.loc;
  if (layout.kind === "field-offset-quote") {
    const source = layout;
    let operand: Expression<TypedPhase> | undefined;
    let selector: ArrowFunction<CheckedPhase> | undefined;
    function* slots(): Generator<TirChapterSyntaxSlot> {
      for (const slot of layoutArgumentSlots(source)) {
        if (slot.kind === "field-layout") yield { ...slot, read: () => (operand = slot.read()) };
        else if (slot.kind === "field-selector") yield { ...slot, read: () => (selector = slot.read()) };
      }
    }
    return { kind: "call", ordinal: header.ordinal, header, slots: slots(), copy: (typed, checked) => {
      const mapped = checked(requirePresent(selector, missingParameter));
      if (mapped.kind !== "ArrowFunction") return throwInvariant(missingParameter);
      return { kind: "field-offset-quote", loc, layout: typed(requirePresent(operand, missingParameter)), selector: mapped };
    } };
  }
  let descriptor: ObjectLiteralExpression<CheckedPhase> | undefined;
  const operands: (Pick<TirLayoutOperand, "source"> & { root: Expression<TypedPhase> })[] = [];
  function* slots(): Generator<TirChapterSyntaxSlot> {
    for (const slot of layoutArgumentSlots(layout)) {
      if (slot.kind === "layout-descriptor") yield { ...slot, read: () => (descriptor = slot.read()) };
      else if (slot.kind === "layout-operand") yield { ...slot, read: () => {
        const { source, root } = slot.read();
        const operand = { source, root };
        operands.push(operand);
        return operand;
      } };
    }
  }
  return { kind: "call", ordinal: header.ordinal, header, slots: slots(), copy: (typed, checked) => {
    const source = requirePresent(descriptor, missingParameter);
    const mapped = checked(source);
    if (mapped.kind !== "ObjectLiteralExpression") return throwInvariant(missingParameter);
    for (const operand of operands) operand.root = typed(operand.root);
    return { kind: "layout-quote", loc, descriptor: mapped, operands };
  } };
}

function walkChapterSyntax<Stop, Value>(
  roots: Iterable<ChapterRootSlot>, admission: ChapterSyntaxAdmission<Stop>,
  rawSlots: ChapterSyntaxSlots, retainFormals: boolean, finish: (inventory: ChapterSyntaxInventory, wires: ChapterWires) => Value,
): { readonly kind: "complete"; readonly value: Value } | Stop {
  const checkedRoots: HirNode[] = [];
  const checkedSeen = new Set<HirNode>();
  const typed: TirTypedSyntax[] = [];
  const wires = new Map<TirTypedSyntax["node"], ChapterWire>();
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
            const header = wires.get(formal);
            if (typeof header !== "object" || header.kind !== "formal-header") return throwInvariant(missingParameter);
            wires.set(formal, { kind: "formal", ordinal: header.ordinal, initializer: initializer.value, header });
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
          } else next = readChapterSyntaxSlot(slot);
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
      let call: ChapterCallReceipt | null = null;
      if (shape?.kind === "application" && shape.form === "call") {
        const args = shape.arguments();
        if ("kind" in args) {
          const layout = admission.layout(frame.path);
          if (layout !== null) return layout;
        }
        call = retainCallArguments(shape, args, subject);
      }
      wires.set(subject.node, call ?? shape ?? typed.length);
      active.add(subject.node);
      typed.push(subject);
      function* slots(typedSubject: TirTypedSyntax): Generator<TirChapterSyntaxSlot> {
        if (shape === null) yield* rawSlots(typedSubject);
        else if (shape.kind === "module" || shape.kind === "callable") yield* shape.slots;
        else {
          yield* preparedSlots(shape.slots, typedSubject);
          if (call !== null) yield* call.slots;
        }
      }
      pending.push({ kind: "children", subject, cursor: slots(subject), path: frame.path });
    }
  }
  const inventory: ChapterSyntaxInventory = { typed, checkedRoots, wireOf: node => {
    const entry = wires.get(node);
    return typeof entry === "number" ? entry : entry?.ordinal;
  } };
  return { kind: "complete", value: finish(inventory, wires) };
}

export function inventoryChapterSyntax<Stop>(
  roots: Iterable<ChapterRootSlot>, admission: ChapterSyntaxAdmission<Stop>, rawSlots: ChapterSyntaxSlots,
): { readonly kind: "complete"; readonly value: ChapterSyntaxInventory } | Stop {
  return walkChapterSyntax(roots, admission, rawSlots, false, inventory => inventory);
}

interface ChapterNodeCopyAdmission<Stop> {
  readonly root: (path: ChapterPath) => Stop | null;
  readonly edge: (path: ChapterPath, slot: TirChapterSyntaxSlot) => Stop | null;
  readonly formal: (path: ChapterPath) => Stop | null;
  readonly layout: (path: ChapterPath) => Stop | null;
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
      root: admission.root, edge: admission.edge, formal: admission.formal, layout: admission.layout,
      node: (_path, subject, ordinal) => admission.prepare(subject, ordinal, node => copy(node, ordinal)),
      close: subject => {
        if (subject.kind === "ordinary" || subject.kind === "formal") postorder.push(subject.node);
      },
    }, chapterSyntaxSlots, true, (value, wires): SyntaxMaterialization<TypedPhase, Image> => {
      inventory = value;
      headerWires = wires;
      return {
        postorder, wireOf: value.wireOf,
        structure: node => structureReceipt(wires, node),
        copyInitializer: (node, expression) => {
          const entry = wires.get(node);
          if (entry === undefined || typeof entry === "number" || entry.kind !== "formal") return throwInvariant(missingParameter);
          const initializer = entry.initializer;
          if (initializer.kind === "checked-default")
            return { kind: "checked-default", root: requirePresent(checked, missingParameter)(initializer.root) };
          if (initializer.kind === "ready-default") return { kind: "ready-default", root: expression(initializer.root) };
          return initializer;
        },
        copyCallArguments: (node, expression) => {
          const entry = wires.get(node);
          if (typeof entry !== "object" || entry.kind !== "call") return throwInvariant(missingParameter);
          return entry.copy(expression, root => requirePresent(checked, missingParameter)(root));
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

function structureReceipt(wires: ChapterWires, node: RetainedSyntaxNode<TypedPhase>): SyntaxStructureReceipt<TypedPhase> {
  const entry = wires.get(node);
  if (entry !== undefined && typeof entry !== "number" && entry.kind !== "module" && entry.kind !== "callable")
    return entry.kind === "formal" || entry.kind === "call" ? entry.header : entry;
  return throwInvariant({ owner: "ir-program", query: null, origin: node.origin, message: "Syntax needs its actual paid chapter receipt." });
}
