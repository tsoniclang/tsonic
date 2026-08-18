import { finding, sortFindings } from "./architecture-rules.mjs";

export function evaluateTestSuiteOwnership(files, suites) {
  const findings = [];
  for (const file of [...files].sort()) {
    const owners = suites.filter((suite) => suiteOwnsFile(suite, file));
    if (owners.length !== 1) {
      findings.push(finding(
        "ARCH-TEST-001",
        file,
        undefined,
        owners.length === 0
          ? "Test file has no recursive suite owner."
          : `Test file has multiple suite owners: ${owners.map((owner) => owner.id).sort().join(", ")}.`,
      ));
    }
  }
  return Object.freeze(sortFindings(findings));
}

function suiteOwnsFile(suite, file) {
  if (!pathIsWithin(file, suite.directory)) {
    return false;
  }
  if (suite.recursive !== false) {
    return true;
  }
  const normalized = suite.directory.replace(/\/+$/u, "");
  const relative = file.slice(normalized.length + 1);
  const nestedDirectoryCount = Math.max(0, relative.split("/").length - 1);
  return nestedDirectoryCount <= (suite.maxDepth ?? 0);
}

export function evaluateTestDomainOwnership(files, rules, productDomains) {
  const findings = [];
  for (const file of [...files].sort()) {
    const owners = rules.filter((rule) => pathIsWithin(file, rule.directory));
    if (owners.length !== 1) {
      findings.push(finding(
        "ARCH-TEST-002",
        file,
        undefined,
        owners.length === 0
          ? "Test file does not mirror a declared product domain."
          : `Test file matches multiple product domains: ${owners.map((owner) => owner.productDomain).sort().join(", ")}.`,
      ));
      continue;
    }
    if (!productDomains.has(owners[0].productDomain)) {
      findings.push(finding(
        "ARCH-TEST-002",
        file,
        undefined,
        `Test domain '${owners[0].productDomain}' has no product owner.`,
      ));
    }
  }
  return Object.freeze(sortFindings(findings));
}

function pathIsWithin(path, directory) {
  const normalized = directory.replace(/\/+$/u, "");
  return path === normalized || path.startsWith(`${normalized}/`);
}
