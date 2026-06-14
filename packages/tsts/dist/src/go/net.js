import * as nodeNet from "node:net";
class nodeListener {
    server;
    networkName;
    addressText;
    pending = [];
    constructor(server, networkName, addressText) {
        this.server = server;
        this.networkName = networkName;
        this.addressText = addressText;
        server.on("connection", (socket) => {
            this.pending.push(socket);
        });
    }
    Accept() {
        const socket = this.pending.shift();
        if (socket === undefined) {
            return [undefined, new globalThis.Error("net: no pending connection")];
        }
        return [socket, undefined];
    }
    Close() {
        try {
            this.server.close();
            return undefined;
        }
        catch (error) {
            return normalizeError(error);
        }
    }
    Addr() {
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
export function Listen(network, address) {
    try {
        const server = nodeNet.createServer();
        if (network === "unix" || network === "unixpacket") {
            server.listen(address);
        }
        else {
            const [host, portText] = splitHostPort(address);
            server.listen(Number(portText), host === "" ? undefined : host);
        }
        return [new nodeListener(server, network, address), undefined];
    }
    catch (error) {
        return [undefined, normalizeError(error)];
    }
}
function splitHostPort(address) {
    const index = address.lastIndexOf(":");
    if (index < 0) {
        return ["", address];
    }
    return [address.slice(0, index), address.slice(index + 1)];
}
function normalizeError(error) {
    return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
//# sourceMappingURL=net.js.map