export function constructedNativeCells(execution, statement, source) {
  const targets = [...new Set(statement.writes.map(write => write.target))];
  const captureCells = statement.captures.map((capture, index) => ({ index: capture.index, cell: targets.length + index }));
  return { execution, origin: statement.identity,
    cells: [...targets, ...captureCells].map((_target, id) => ({ id, role: { kind: "detached" },
      occurrence: { kind: "declared", at: { kind: "node", node: source } }, lifetimes: [] })),
    producers: targets.map((producer, cell) => ({ producer, cell })),
    captures: captureCells,
  };
}

export function constructedNativeRelations(execution, source, callbacks = []) {
  const points = callbacks.map(callback => ({ kind: "before", at: { kind: "declared", execution, source }, subject: callback.subject }));
  points.push({ kind: "return" });
  return { callbacks, resultCells: [], backing: [], concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [],
    returns: true, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points,
      rows: points.map((_point, point) => ({ point, cell: null, condition: 0 })) } };
}
