import type {
  ConstantKeyOfMir, LocalOwnershipOfMir, ParseMir, PrintMir, ProjectMirConstantKey, ProjectMirConstantOrdinals, ProjectMirValues, VerifyMir,
} from "./contract.js";
import { ownershipOfMode } from "./local-ownership.js";
import { parseBody } from "./parse.js";
import { printBody } from "./print.js";
import { constantKey, verifyBody } from "./verify.js";
import { projectMirConstantKey as constantKeyProjection, projectMirConstantOrdinals as constantOrdinalProjection } from "./constant-projection.js";
import { projectMirValues as valuesProjection } from "./project-values.js";

export const printMir: PrintMir = body => printBody(body);
export const parseMir: ParseMir = text => parseBody(text);
export const verifyMir: VerifyMir = (body, context) => verifyBody(body, context);
export const constantKeyOfMir: ConstantKeyOfMir = (type, value) => constantKey(type, value);
export const localOwnershipOfMir: LocalOwnershipOfMir = ownershipOfMode;
export const projectMirConstantKey: ProjectMirConstantKey = constantKeyProjection;
export const projectMirConstantOrdinals: ProjectMirConstantOrdinals = constantOrdinalProjection;
export const projectMirValues: ProjectMirValues = valuesProjection;
