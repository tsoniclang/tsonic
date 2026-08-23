export const jsRegExpResultDeclarations = `
interface RegExpNamedGroups {
  [key: string]: string | undefined;
}

interface RegExpNamedIndices {
  [key: string]: [number, number] | undefined;
}

interface RegExpMatchArray extends Array<string | undefined> {
  index?: number;
  input?: string;
  groups?: RegExpNamedGroups;
  indices?: RegExpIndicesArray;
  0: string;
}

interface RegExpExecArray extends Array<string | undefined> {
  index: number;
  input: string;
  groups?: RegExpNamedGroups;
  indices?: RegExpIndicesArray;
  0: string;
}

interface RegExpIndicesArray extends Array<[number, number] | undefined> {
  groups?: RegExpNamedIndices;
}

interface RegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): RegExpStringIterator<T>;
}
`.trim();
