import assert from "node:assert/strict";
import { chargeResultEntries, chargeWork, createAccount } from "../../../packages/host/dist/dataflow/index.js";

const fixtureLimits = { maximumWork: 100000000, maximumCreatedRecords: 100000000 };

export function fixtureTypeWork(product) {
  return product.createTypePublicationWork(fixtureLimits);
}

export function insertFixtureGraph(product, types, terms, signatures = []) {
  const table = product.viewTypes(types);
  const result = product.internTypeGraph({ types, work: fixtureTypeWork(product) }, {
    typeBase: table.terms.length, signatureBase: table.signatures.length, terms, signatures,
  });
  assert.equal(result.kind, "complete", result.dimension);
  return result.value;
}

export function insertFixtureType(product, types, term) {
  return insertFixtureGraph(product, types, [term]).types[0];
}

export function insertFixtureSignature(product, types, signature) {
  return insertFixtureGraph(product, types, [], [signature]).signatures[0];
}

export function fixtureTypeAdmission() {
  const account = createAccount({ maximumWork: fixtureLimits.maximumWork, maximumResultEntries: fixtureLimits.maximumCreatedRecords });
  return {
    work: count => chargeWork(account, count),
    retain: count => chargeResultEntries(account, count),
  };
}

export function admitFixtureTable(product, table) {
  const admitted = product.admitTypeTable(table, fixtureTypeAdmission());
  assert.equal(admitted.kind, "complete", admitted.violations?.map(row => row.rule).join(", ") ?? admitted.dimension);
  return admitted.types;
}
