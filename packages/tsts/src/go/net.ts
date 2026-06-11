import type { GoError } from "./compat.js";
import * as nodeNet from "node:net";

export interface Addr {
  Network(): string;
  String(): string;
}

export interface Listener {
  Accept(): [nodeNet.Socket | undefined, GoError];
  Close(): GoError;
  Addr(): Addr;
}

class nodeListener implements Listener {
  private readonly pending: nodeNet.Socket[] = [];

  constructor(
    private readonly server: nodeNet.Server,
    private readonly networkName: string,
    private readonly addressText: string,
  ) {
    server.on("connection", (socket) => {
      this.pending.push(socket);
    });
  }

  Accept(): [nodeNet.Socket | undefined, GoError] {
    const socket = this.pending.shift();
    if (socket === undefined) {
      return [undefined, new globalThis.Error("net: no pending connection")];
    }
    return [socket, undefined];
  }

  Close(): GoError {
    try {
      this.server.close();
      return undefined;
    } catch (error) {
      return normalizeError(error);
    }
  }

  Addr(): Addr {
    return {
      Network: () => this.networkName,
      String: () => {
        const address = this.server.address();
        if (typeof address === "string") {
          return address;
        }
        if (address !== null) {
          return `${address.address}:${address.port}`;
        }
        return this.addressText;
      },
    };
  }
}

export function Listen(network: string, address: string): [Listener | undefined, GoError] {
  try {
    const server = nodeNet.createServer();
    if (network === "unix" || network === "unixpacket") {
      server.listen(address);
    } else {
      const [host, portText] = splitHostPort(address);
      server.listen(Number(portText), host === "" ? undefined : host);
    }
    return [new nodeListener(server, network, address), undefined];
  } catch (error) {
    return [undefined, normalizeError(error)];
  }
}

function splitHostPort(address: string): [string, string] {
  const index = address.lastIndexOf(":");
  if (index < 0) {
    return ["", address];
  }
  return [address.slice(0, index), address.slice(index + 1)];
}

function normalizeError(error: unknown): GoError {
  return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
