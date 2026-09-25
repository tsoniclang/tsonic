export function validateCertificationEntry(entry) {
  const keys = ["banks", "command", "inputs", "profile", "repository", "skipped", "tools", "worker"];
  if (entry === null || typeof entry !== "object" ||
      Object.keys(entry).sort().join() !== keys.sort().join() ||
      !/^[a-z][a-z0-9-]*$/u.test(entry.repository) ||
      !["host", "rust", "native"].includes(entry.profile) ||
      !Number.isSafeInteger(entry.skipped) || entry.skipped < 0) {
    throw new Error("Invalid release certification definition.");
  }
  for (const field of ["banks", "command", "worker", "inputs", "tools"]) {
    if (!Array.isArray(entry[field]) || entry[field].length === 0 ||
        entry[field].some(value => typeof value !== "string" || value.length === 0)) {
      throw new Error(`Certification ${field} must be a nonempty string array.`);
    }
  }
  for (const field of ["banks", "inputs", "tools"]) {
    if (new Set(entry[field]).size !== entry[field].length) throw new Error(`Duplicate certification ${field}.`);
  }
  if (!entry.inputs.includes(entry.repository) || !entry.inputs.includes("tsonic") ||
      entry.inputs.some(value => !/^[a-z][a-z0-9-]*$/u.test(value)) ||
      entry.tools.some(value => !["node", "npm", "dotnet", "rustc", "cargo", "rustfmt"].includes(value)) ||
      entry.banks.some(value => !["host", "node", "cargo"].includes(value))) {
    throw new Error("Invalid certification input closure or toolchain.");
  }
  return Object.freeze(Object.fromEntries(Object.entries(entry).map(([key, value]) =>
    [key, Array.isArray(value) ? Object.freeze([...value]) : value])));
}

export function readCertificationOptions(args, { publisher = false } = {}) {
  const options = { check: false, validate: false, suites: [] };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--suite" && !publisher) {
      const suite = args[++index];
      if (!suite || options.suites.includes(suite)) throw new Error("--suite requires a unique suite repository.");
      options.suites.push(suite);
      continue;
    }
    if (seen.has(argument)) throw new Error(`Duplicate release option '${argument}'.`);
    seen.add(argument);
    if (argument === "--check" && !publisher) options.check = true;
    else if (argument === "--validate" && publisher) options.validate = true;
    else throw new Error(`Unknown release option '${argument}'.`);
  }
  if (options.validate && options.check) throw new Error("--validate only validates manifests and cannot select certification.");
  return Object.freeze(options);
}
