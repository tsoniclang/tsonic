import type { OrderPragmaArguments, PragmaArgumentEntry } from "./contract.js";

export const orderPragmaArguments: OrderPragmaArguments = value => {
  const result: PragmaArgumentEntry[] = [];
  const work = [{ entries: value, position: 0, bit: 15 }];
  let previous: string | null = null;
  let task = work.pop();
  while (task !== undefined) {
    const left: PragmaArgumentEntry[] = [];
    const right: PragmaArgumentEntry[] = [];
    for (const entry of task.entries) {
      const name = entry.name;
      if (name.length === task.position) {
        if (previous === name) throw new TypeError("HIR pragma argument names must be unique.");
        result.push(entry);
        previous = name;
      } else if ((name.charCodeAt(task.position) & (1 << task.bit)) === 0) left.push(entry);
      else right.push(entry);
    }
    const position = task.bit === 0 ? task.position + 1 : task.position;
    const bit = task.bit === 0 ? 15 : task.bit - 1;
    if (right.length > 0) work.push({ entries: right, position, bit });
    if (left.length > 0) work.push({ entries: left, position, bit });
    task = work.pop();
  }
  return result;
};
