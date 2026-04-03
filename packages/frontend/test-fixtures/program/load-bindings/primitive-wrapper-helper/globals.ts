import { Number as SourceNumberStatics } from "./src/number-object.js";

declare global {
  interface Number {
    toString(): string;
  }
  const Number: typeof SourceNumberStatics;
}

export {};
