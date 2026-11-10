export const suites = Object.freeze([
  Object.freeze({ name: "quarantine", files: Object.freeze(["test/architecture/quarantine.test.mjs"]) }),
  Object.freeze({ name: "host-architecture", files: Object.freeze([
    "test/architecture/host-structure.test.mjs", "test/architecture/host-isolation.test.mjs", "test/architecture/host-coverage.test.mjs",
  ]) }),
  Object.freeze({ name: "host-cases", files: Object.freeze(["test/host-cases/case.test.mjs"]) }),
  Object.freeze({ name: "host-units", files: Object.freeze([
    "test/host-units/diag.test.mjs", "test/host-units/ids.test.mjs",
  ]) }),
]);
