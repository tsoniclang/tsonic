import type { MemberSelectionKey, ParseTir, PrintTir, TirOperationsOf, VerifyTir, VerifyTirModule } from "./contract.js";
import { parseTypedBody } from "./parse.js";
import { printTypedBody } from "./print.js";
import { selectionKey } from "./selection-key.js";
import { tirOperationsOf as operationsOf, verifyTypedBody, verifyTypedModule } from "./verify.js";

export const printTir: PrintTir = printTypedBody;
export const parseTir: ParseTir = parseTypedBody;
export const verifyTir: VerifyTir = verifyTypedBody;
export const verifyTirModule: VerifyTirModule = verifyTypedModule;
export const memberSelectionKey: MemberSelectionKey = selectionKey;
export const tirOperationsOf: TirOperationsOf = operationsOf;
