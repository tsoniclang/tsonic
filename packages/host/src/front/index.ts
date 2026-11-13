import type { CheckerOptionRow, CheckerOptions } from "./contract.js";
import { optionSet, optionTable } from "./options.js";

export const checkerOptionTable: readonly CheckerOptionRow[] = optionTable;
export const checkerOptions: CheckerOptions = optionSet;
