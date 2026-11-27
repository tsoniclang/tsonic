import type { MirBlock, MirBody, MirClosureCapture, MirStorageExposureVisitor, MirTerminator } from "./contract.js";

export function visitStorageExposures<Stop>(body: MirBody, visitor: MirStorageExposureVisitor<Stop>): Stop | null {
  const captures = (rows: readonly MirClosureCapture[], block: MirBlock, placed: Extract<MirTerminator, { readonly kind: "call" }> | null): Stop | null => {
    for (let index = 0; index < rows.length; index += 1) {
      const stop = visitor.admit();
      if (stop !== null) return stop;
      const capture = rows[index];
      if (capture === undefined) throw new TypeError("ir-mir: a verified storage exposure has a dense capture list");
      const visited = visitor.capture(capture, block, placed);
      if (visited !== null) return visited;
    }
    return null;
  };
  for (let position = 0; position < body.blocks.length; position += 1) {
    const stop = visitor.admit();
    if (stop !== null) return stop;
    const block = body.blocks[position];
    if (block === undefined) throw new TypeError("ir-mir: a verified storage exposure has a dense block list");
    for (let index = 0; index < block.statements.length; index += 1) {
      const statementStop = visitor.admit();
      if (statementStop !== null) return statementStop;
      const statement = block.statements[index];
      if (statement === undefined) throw new TypeError("ir-mir: a verified storage exposure has a dense statement list");
      if (statement.kind !== "assign") continue;
      const value = statement.value;
      const visited = value.kind === "address-of" ? visitor.address(value.place)
        : value.kind === "closure" ? captures(value.captures, block, null) : null;
      if (visited !== null) return visited;
    }
    const terminator = block.terminator;
    if (terminator.kind !== "call") continue;
    for (let index = 0; index < terminator.arguments.length; index += 1) {
      const argumentStop = visitor.admit();
      if (argumentStop !== null) return argumentStop;
      const argument = terminator.arguments[index];
      if (argument === undefined) throw new TypeError("ir-mir: a verified storage exposure has a dense argument list");
      if (argument.kind !== "place") continue;
      const visited = visitor.address(argument.place);
      if (visited !== null) return visited;
    }
    if (terminator.callee.kind === "body") {
      const visited = captures(terminator.callee.captures, block, terminator);
      if (visited !== null) return visited;
    }
  }
  return null;
}
