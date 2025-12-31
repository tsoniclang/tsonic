import { int } from "@tsonic/core/types.js";

// Array spread with int type - spread elements get array type
const source: int[] = [1, 2, 3];
export const withSpread: int[] = [...source, 4, 5];

// Multiple spreads
const more: int[] = [10, 20];
export const multiSpread: int[] = [...source, ...more, 100];
