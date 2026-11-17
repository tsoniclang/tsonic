const imports = `import assert from "node:assert/strict";
import { Duplex, PassThrough, Readable, Transform } from "node:stream";
import { setImmediate } from "node:timers";
const turn = () => new Promise(resolve => setImmediate(resolve));
`;

function streamProgram(id, body) {
  return Object.freeze({ id, family: "streams", nodeOutput: Object.freeze([`${id} passed`]),
    source: `${imports}
async function main() {
${body}
}
await main();
console.log("${id} passed");
`,
  });
}

export const streamOraclePrograms = Object.freeze([
  streamProgram("I-0006", `
  const source = new Readable({ read() {} });
  let ends = 0;
  source.on("end", () => ends++);
  source.push("data");
  source.push(null);
  assert.equal(source.readableEnded, false);
  assert.equal(ends, 0);
  await turn();
  assert.equal(source.readableEnded, false);
  assert.equal(ends, 0);
  assert.equal(String(source.read()), "data");
  assert.equal(source.readableEnded, false);
  await turn();
  assert.equal(source.readableEnded, true);
  assert.equal(ends, 1);
  assert.equal(source.read(), null);
  await turn();
  assert.equal(ends, 1);`),
  streamProgram("I-0008", `
  const source = new Readable({ read() {} });
  const received = [];
  source.on("data", chunk => received.push(String(chunk)));
  source.push("chunk1");
  source.resume();
  source.push("chunk2");
  source.push("chunk3");
  assert.deepEqual(received, []);
  await turn();
  assert.deepEqual(received, ["chunk1", "chunk2", "chunk3"]);
  await turn();
  assert.deepEqual(received, ["chunk1", "chunk2", "chunk3"]);`),
  streamProgram("I-0009", `
  const source = new Readable({ read() {} });
  let readables = 0;
  let ends = 0;
  source.on("readable", () => readables++);
  source.on("end", () => ends++);
  source.push("data");
  assert.equal(readables, 0);
  source.push(null);
  assert.equal(String(source.read()), "data");
  assert.equal(ends, 0);
  await turn();
  assert.equal(readables, 1);
  assert.equal(ends, 1);
  assert.equal(source.readableEnded, true);
  assert.equal(source.read(), null);
  await turn();
  assert.equal(readables, 1);
  assert.equal(ends, 1);`),
  streamProgram("I-0012", `
  const source = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
  let ends = 0;
  let finishes = 0;
  source.on("end", () => ends++);
  source.on("finish", () => finishes++);
  assert.equal(source.write("write data"), true);
  source.end();
  source.push("read data");
  source.push(null);
  assert.equal(source.writableEnded, true);
  assert.equal(source.readableEnded, false);
  assert.equal(ends, 0);
  await turn();
  assert.equal(source.readableEnded, false);
  assert.equal(finishes, 1);
  assert.equal(String(source.read()), "read data");
  assert.equal(source.readableEnded, false);
  await turn();
  assert.equal(source.readableEnded, true);
  assert.equal(ends, 1);
  assert.equal(finishes, 1);
  await turn();
  assert.equal(ends, 1);
  assert.equal(finishes, 1);`),
  streamProgram("I-0005", `
  const source = new Transform({ transform(chunk, _encoding, callback) { callback(null, chunk); } });
  const received = [];
  source.on("data", chunk => received.push(String(chunk)));
  source.resume();
  source.write("test data");
  assert.deepEqual(received, ["test data"]);
  await turn();
  assert.deepEqual(received, ["test data"]);`),
  streamProgram("I-0010", `
  const source = new PassThrough();
  const received = [];
  source.on("data", chunk => received.push(String(chunk)));
  source.resume();
  source.write("chunk1");
  source.write("chunk2");
  source.write("chunk3");
  assert.deepEqual(received, ["chunk1", "chunk2", "chunk3"]);
  await turn();
  assert.deepEqual(received, ["chunk1", "chunk2", "chunk3"]);`),
]);
