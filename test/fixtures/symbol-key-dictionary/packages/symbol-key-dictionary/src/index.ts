import { Console } from "@tsonic/dotnet/System.js";

type SymbolTable = Record<symbol, number>;
type MixedTable = Record<string | symbol, number>;

function build(): number {
  const table: SymbolTable = {};
  const mixed: MixedTable = {};

  const keyA = { tag: "a" } as unknown as symbol;
  const keyB = { tag: "b" } as unknown as symbol;

  table[keyA] = 10;
  table[keyB] = 20;

  mixed["count"] = 1;
  mixed[keyA] = table[keyA];

  if (table[keyA] !== undefined) {
    delete table[keyA];
  }

  const deleted = table[keyA] === undefined ? 1 : 0;
  return mixed["count"] + mixed[keyA] + table[keyB] + deleted;
}

Console.WriteLine(build());
