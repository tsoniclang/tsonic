export const minimalSourceGlobals = `
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Boolean {}
interface Number {}
interface String {}
interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;
