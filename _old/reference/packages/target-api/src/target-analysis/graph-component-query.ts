export interface TargetGraphComponentRows {
  add(cost: number): boolean;
  release(): void;
}

export interface TargetGraphComponentResources {
  step(): boolean;
  createRows(): TargetGraphComponentRows;
}

export interface TargetGraphComponentInput<Vertex, Data> {
  readonly data: Data;
  readonly neighbours: ReadonlySet<Vertex>;
}

export interface TargetGraphComponentMember<Vertex, Data, Value> {
  readonly vertex: Vertex;
  readonly data: Data;
  readonly successors: readonly Value[];
}

interface Pending<Vertex, Data, Value> {
  readonly kind: "pending";
  readonly vertex: Vertex;
  index: number;
  lowlink: number;
  active: boolean;
  parent: Pending<Vertex, Data, Value> | undefined;
  input: TargetGraphComponentInput<Vertex, Data> | undefined;
  iterator: Iterator<Vertex> | undefined;
  primary: Value | undefined;
  additional: Set<Value> | undefined;
  value: Value | undefined;
}

type ComponentEntry<Vertex, Data, Value> = Pending<Vertex, Data, Value> |
  { readonly kind: "complete"; readonly value: Value };

export function createTargetGraphComponentQuery<Vertex, Data, Value>(
  load: (vertex: Vertex) => TargetGraphComponentInput<Vertex, Data> | undefined,
  reduce: (members: readonly TargetGraphComponentMember<Vertex, Data, Value>[]) => Value | undefined,
  resources: TargetGraphComponentResources,
) {
  const entries = new Map<Vertex, ComponentEntry<Vertex, Data, Value>>();
  let running = false;
  return (vertex: Vertex): Value | undefined => {
    if (!resources.step()) return undefined;
    const retained = entries.get(vertex);
    if (retained?.kind === "complete") return retained.value;
    if (running) return undefined;
    const indexes = resources.createRows();
    const temporary = resources.createRows();
    const wave: Pending<Vertex, Data, Value>[] = [];
    const active: Pending<Vertex, Data, Value>[] = [];
    let nextIndex = 0;
    let completed = false;
    running = true;
    try {
      const admit = (selected: Vertex): Pending<Vertex, Data, Value> | undefined => {
        const known = entries.get(selected);
        if (known !== undefined) return known.kind === "pending" ? known : undefined;
        if (!indexes.add(1)) return undefined;
        const entry: Pending<Vertex, Data, Value> = { kind: "pending", vertex: selected, index: -1, lowlink: -1,
          active: false, parent: undefined, input: undefined, iterator: undefined, primary: undefined,
          additional: undefined, value: undefined };
        entries.set(selected, entry);
        wave.push(entry);
        return entry;
      };
      const append = (entry: Pending<Vertex, Data, Value>, value: Value): boolean => {
        if (entry.primary === undefined) { entry.primary = value; return true; }
        if (Object.is(entry.primary, value) || entry.additional?.has(value)) return true;
        if (!temporary.add(entry.additional === undefined ? 2 : 1)) return false;
        (entry.additional ??= new Set()).add(value);
        return true;
      };
      const root = admit(vertex);
      if (root === undefined) return undefined;
      let current: Pending<Vertex, Data, Value> | undefined = root;
      while (current !== undefined) {
        if (!resources.step()) return undefined;
        if (current.index === -1) {
          current.index = nextIndex++;
          current.lowlink = current.index;
          current.active = true;
          active.push(current);
          current.input = load(current.vertex);
          if (current.input === undefined) return undefined;
          for (const input of current.input.neighbours) {
            if (!resources.step()) return undefined;
            const known = entries.get(input);
            if (known === undefined && admit(input) === undefined) return undefined;
          }
          current.iterator = current.input.neighbours[Symbol.iterator]();
        }
        const next: IteratorResult<Vertex> = current.iterator!.next();
        if (!next.done) {
          const child: ComponentEntry<Vertex, Data, Value> = entries.get(next.value)!;
          if (child.kind === "complete") { if (!append(current, child.value)) return undefined; continue; }
          if (child.index === -1) { child.parent = current; current = child; continue; }
          if (child.active) current.lowlink = Math.min(current.lowlink, child.index);
          else if (!append(current, child.value!)) return undefined;
          continue;
        }
        if (current.lowlink === current.index) {
          const members: Pending<Vertex, Data, Value>[] = [];
          let member: Pending<Vertex, Data, Value>;
          do { member = active.pop()!; members.push(member); } while (member !== current);
          const result = reduce(members.map(selected => ({ vertex: selected.vertex, data: selected.input!.data,
            successors: selected.primary === undefined ? [] : [selected.primary, ...selected.additional ?? []] })));
          if (result === undefined) return undefined;
          for (const selected of members) { selected.active = false; selected.value = result; }
        }
        const parent: Pending<Vertex, Data, Value> | undefined = current.parent;
        if (parent !== undefined) {
          if (current.active) parent.lowlink = Math.min(parent.lowlink, current.lowlink);
          else if (!append(parent, current.value!)) return undefined;
        }
        current = parent;
      }
      if (root.value === undefined) return undefined;
      for (const entry of wave) entries.set(entry.vertex, { kind: "complete", value: entry.value! });
      completed = true;
      return root.value;
    } finally {
      running = false;
      temporary.release();
      if (!completed) {
        for (const entry of wave) entries.delete(entry.vertex);
        indexes.release();
      }
    }
  };
}
