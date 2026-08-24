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

interface JsRegExpNamedGroups {
  [key: string]: import("@tsonic/js/types.js").JsString | undefined;
}

interface JsRegExpNamedIndices {
  [key: string]: [number, number] | undefined;
}

interface JsRegExpMatchArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  index?: number;
  input?: import("@tsonic/js/types.js").JsString;
  groups?: JsRegExpNamedGroups;
  indices?: JsRegExpIndicesArray;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpExecArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  index: number;
  input: import("@tsonic/js/types.js").JsString;
  groups?: JsRegExpNamedGroups;
  indices?: JsRegExpIndicesArray;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpIndicesArray extends Array<[number, number] | undefined> {
  groups?: JsRegExpNamedIndices;
}

interface JsRegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): JsRegExpStringIterator<T>;
}
`.trim();
