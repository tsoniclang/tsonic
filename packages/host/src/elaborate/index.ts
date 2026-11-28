import type { AttachDefault, Elaborate, ElaborateSelectedCall } from "./contract.js";
import { elaborateBody, elaborateSelectedCall as selectedCall } from "./elaborate.js";
import { attachDefault as attachPlacedDefault } from "./module.js";

export const elaborate: Elaborate = elaborateBody;
export const elaborateSelectedCall: ElaborateSelectedCall = selectedCall;
export const attachDefault: AttachDefault = attachPlacedDefault;
