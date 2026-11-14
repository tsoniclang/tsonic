import type { ConstantKeyOfMir, ParseMir, PrintMir, VerifyMir } from "./contract.js";
import { parseBody } from "./parse.js";
import { printBody } from "./print.js";
import { constantKey, verifyBody } from "./verify.js";

export const printMir: PrintMir = body => printBody(body);
export const parseMir: ParseMir = text => parseBody(text);
export const verifyMir: VerifyMir = (body, context) => verifyBody(body, context);
export const constantKeyOfMir: ConstantKeyOfMir = (type, value) => constantKey(type, value);
