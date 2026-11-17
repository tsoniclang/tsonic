import { inspectRegistry } from "./release-inspection.mjs";
import { classifyReleaseState, formatReleaseChecklist } from "./release-state.mjs";
import { validateWaveManifests } from "./npm-wave.mjs";

const wave = validateWaveManifests();
const registryState = inspectRegistry(wave.packages);
const action = classifyReleaseState(wave.version, registryState);
process.stdout.write(`\n${formatReleaseChecklist(action, wave.packages.length)}`);
