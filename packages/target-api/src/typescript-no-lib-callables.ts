export const typescriptNoLibCallableDeclarations = `
export {};

declare const callable: unique symbol;

declare global {
  interface Function {
    readonly [callable]: never;
  }
  interface CallableFunction extends Function {}
  interface NewableFunction extends Function {}
}
`.trim();
