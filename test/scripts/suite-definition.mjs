export const suites = ([
  ({ name: "quarantine", files: (["test/architecture/quarantine.test.mjs"]) }),
  ({ name: "host-architecture", files: ([
    "test/architecture/host-structure.test.mjs", "test/architecture/host-isolation.test.mjs", "test/architecture/host-coverage.test.mjs",
  ]) }),
  ({ name: "host-cases", files: (["test/host-cases/case.test.mjs"]) }),
  ({ name: "host-units", files: ([
    "test/host-units/diag.test.mjs", "test/host-units/ids.test.mjs",
  ]) }),
]);
