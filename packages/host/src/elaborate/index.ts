import type { AttachFormalDefault, Elaborate } from "./contract.js";
import { elaborateBody } from "./elaborate.js";
import { attachFormalDefault as attachDefault } from "./module.js";

export const elaborate: Elaborate = elaborateBody;
export const attachFormalDefault: AttachFormalDefault = attachDefault;
