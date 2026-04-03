type Entry = { readonly name: string; readonly value: string };
declare const params: Entry[];

export const entries = (): Array<[string, string]> =>
  params.map((param) => [param.name, param.value]);
