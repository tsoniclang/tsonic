export const nativeNetworkCompletionSource = `
import { createServer } from "node:net";

export function main(): void {
  const server = createServer();
  server.listen(0, "127.0.0.1", () => {
    server.close();
    console.log("native network completion");
  });
}
`;

export const nativeNetworkFailureSource = `
import { createServer } from "node:net";

let delivered = 0;

export function schedule(): Error {
  const original = new Error("original network failure");
  const first = createServer();
  const second = createServer();
  first.listen(0, "127.0.0.1", () => {
    first.close();
    throw original;
  });
  second.listen(0, "127.0.0.1", () => {
    second.close();
    delivered++;
  });
  return original;
}

export function count(): number {
  return delivered;
}
`;

export const nativeNetworkNoDemandSource = `
import { isIPv4 } from "node:net";

export function main(): void {
  if (!isIPv4("127.0.0.1")) {
    throw new Error("native network query failed");
  }
}
`;
