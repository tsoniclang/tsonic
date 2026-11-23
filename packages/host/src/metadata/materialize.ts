import { throwInvariant } from "../diag/index.js";
import type { LayoutId, MemoryFieldId } from "../ids/contract.js";
import { layoutId, memoryFieldId } from "../ids/index.js";
import type { MemoryField, MemoryLayout } from "../ir-facts/contract.js";
import type { MaterializeMetadata, ReadyLayoutField, ReadyMemoryLayout } from "./contract.js";

type ReadyMember = ReadyMemoryLayout | ReadyLayoutField;
type ReadyValue = Extract<ReadyMemoryLayout, { readonly kind: "value" }>;
type ReadyArray = Extract<ReadyMemoryLayout, { readonly kind: "array" }>;
type Frame =
  | { readonly kind: "enter"; readonly source: ReadyMember }
  | { readonly kind: "field"; readonly source: ReadyLayoutField; readonly child: ReadyMemoryLayout }
  | { readonly kind: "array"; readonly source: ReadyArray; readonly element: ReadyMemoryLayout }
  | { readonly kind: "value"; readonly source: ReadyValue; readonly position: number;
      readonly fields: MemoryFieldId[]; readonly pending: ReadyLayoutField | null };

function invariant(message: string): never {
  return throwInvariant({ owner: "metadata", query: null, origin: null, message });
}

export const materializeMetadata: MaterializeMetadata = (deps, layout) => {
  const start = deps.admit(1, 1);
  if (start !== null) return start;
  if (layout.kind === "data-layout") {
    const stop = deps.admit(5, 1);
    if (stop !== null) return stop;
    const { key, occurrence, fingerprint, byteOrder, addressWidth } = layout;
    return { kind: "complete", value: { key, kind: "data-layout", occurrence, fingerprint, byteOrder, addressWidth } };
  }
  const setup = deps.admit(1, 7);
  if (setup !== null) return setup;
  const layoutIds = new Map<ReadyMemoryLayout, LayoutId>();
  const fieldIds = new Map<ReadyLayoutField, MemoryFieldId>();
  const active = new Set<ReadyMember>();
  const layouts: MemoryLayout[] = [];
  const fields: MemoryField[] = [];
  const frames: Frame[] = [{ kind: "enter", source: layout }];
  const actualLayout = (source: ReadyMemoryLayout): LayoutId =>
    layoutIds.get(source) ?? invariant("Layout materialization requires the actual completed child before its parent.");
  const actualField = (source: ReadyLayoutField): MemoryFieldId =>
    fieldIds.get(source) ?? invariant("Layout materialization requires the actual completed field before its parent.");
  while (frames.length > 0) {
    const read = deps.admit(1, 0);
    if (read !== null) return read;
    const frame = frames.pop();
    if (frame === undefined) return invariant("The layout materialization stack must be dense.");
    const source = frame.source;
    switch (frame.kind) {
      case "enter": {
        if (source.kind === "field" ? fieldIds.has(source) : layoutIds.has(source)) break;
        if (active.has(source)) return invariant("A ready layout graph must be acyclic.");
        const stop = deps.admit(1, 3);
        if (stop !== null) return stop;
        active.add(source);
        switch (source.kind) {
          case "field": {
            const child = source.child;
            frames.push({ kind: "field", source, child }, { kind: "enter", source: child });
            break;
          }
          case "array": {
            const element = source.element;
            frames.push({ kind: "array", source, element }, { kind: "enter", source: element });
            break;
          }
          case "value": frames.push({ kind: "value", source, position: 0, fields: [], pending: null }); break;
        }
        break;
      }
      case "field": {
        const stop = deps.admit(9, 2);
        if (stop !== null) return stop;
        const id = memoryFieldId(fields.length);
        const { occurrence, owner, selector, selection, member, value, byteOffset, byteAlignment } = frame.source;
        fields.push({ id, occurrence, owner, selector, selection, member, value, layout: actualLayout(frame.child), byteOffset, byteAlignment });
        fieldIds.set(frame.source, id);
        active.delete(frame.source);
        break;
      }
      case "array": {
        const stop = deps.admit(8, 2);
        if (stop !== null) return stop;
        const id = layoutId(layouts.length);
        const { occurrence, source, abi, byteSize, byteAlignment, stride, length, runtimeBase } = frame.source;
        layouts.push({ id, occurrence, source, dataLayout: abi.key.definition, byteSize, byteAlignment, stride,
          kind: "array", length, runtimeBase, element: actualLayout(frame.element) });
        layoutIds.set(frame.source, id);
        active.delete(frame.source);
        break;
      }
      case "value": {
        if (frame.pending !== null) {
          const stop = deps.admit(1, 1);
          if (stop !== null) return stop;
          frame.fields.push(actualField(frame.pending));
        }
        if (frame.position < frame.source.fields.length) {
          const stopped = deps.admit(1, 2);
          if (stopped !== null) return stopped;
          const field = frame.source.fields[frame.position];
          if (field === undefined) return invariant("A ready value layout must retain its complete authored field order.");
          frames.push({ ...frame, pending: field, position: frame.position + 1 }, { kind: "enter", source: field });
          break;
        }
        const stop = deps.admit(7, 2);
        if (stop !== null) return stop;
        const id = layoutId(layouts.length);
        const { occurrence, source, abi, byteSize, byteAlignment, stride } = frame.source;
        layouts.push({ id, occurrence, source, dataLayout: abi.key.definition, byteSize, byteAlignment, stride, kind: "value", fields: frame.fields });
        layoutIds.set(frame.source, id);
        active.delete(frame.source);
        break;
      }
    }
  }
  const finish = deps.admit(1, 1);
  if (finish !== null) return finish;
  return { kind: "complete", value: layout.kind === "field"
    ? { key: layout.key, kind: "memory-field", root: actualField(layout), layouts, fields }
    : { key: layout.key, kind: "memory-layout", root: actualLayout(layout), layouts, fields } };
};
