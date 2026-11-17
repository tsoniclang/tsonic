import { readCertificationOptions } from "../certification/contract.mjs";
import { certifyWave } from "../certification/select.mjs";
import { validateWaveManifests } from "./npm-wave.mjs";

certifyWave(validateWaveManifests(), readCertificationOptions(process.argv.slice(2)));
