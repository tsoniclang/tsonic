export const jsRegExpResultDeclarations = `
interface RegExpNamedGroups {
  readonly [key: string]: string | undefined;
}

interface RegExpNamedIndices {
  readonly [key: string]: [int32, int32] | undefined;
}

interface RegExpMatchArray extends Array<string | undefined> {
  readonly index: int32 | undefined;
  readonly input: string | undefined;
  readonly groups: RegExpNamedGroups | undefined;
  readonly indices: RegExpIndicesArray | undefined;
  0: string;
}

interface RegExpExecArray extends Array<string | undefined> {
  readonly index: int32;
  readonly input: string;
  readonly groups: RegExpNamedGroups | undefined;
  readonly indices: RegExpIndicesArray | undefined;
  0: string;
}

interface RegExpIndicesArray extends Array<[int32, int32] | undefined> {
  readonly groups: RegExpNamedIndices | undefined;
}

interface RegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): RegExpStringIterator<T>;
}

interface JsRegExpNamedGroups {
  readonly [key: string]: import("@tsonic/js/types.js").JsString | undefined;
}

interface JsRegExpNamedIndices {
  readonly [key: string]: [int32, int32] | undefined;
}

interface JsRegExpMatchArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  readonly index: int32 | undefined;
  readonly input: import("@tsonic/js/types.js").JsString | undefined;
  readonly groups: JsRegExpNamedGroups | undefined;
  readonly indices: JsRegExpIndicesArray | undefined;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpExecArray extends Array<import("@tsonic/js/types.js").JsString | undefined> {
  readonly index: int32;
  readonly input: import("@tsonic/js/types.js").JsString;
  readonly groups: JsRegExpNamedGroups | undefined;
  readonly indices: JsRegExpIndicesArray | undefined;
  0: import("@tsonic/js/types.js").JsString;
}

interface JsRegExpIndicesArray extends Array<[int32, int32] | undefined> {
  readonly groups: JsRegExpNamedIndices | undefined;
}

interface JsRegExpStringIterator<T> extends IterableIterator<T> {
  [Symbol.iterator](): JsRegExpStringIterator<T>;
}
`.trim();
