/**
 * IR Builder types
 */

export type IrBuildOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly namingPolicy?: {
    readonly classes?: "PascalCase";
  };
};
