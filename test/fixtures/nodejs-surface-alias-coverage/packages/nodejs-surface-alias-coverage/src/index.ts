import * as assert from "node:assert";
import * as buffer from "node:buffer";
import * as child_process from "node:child_process";
import * as dgram from "node:dgram";
import * as dns from "node:dns";
import * as events from "node:events";
import * as http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as net from "node:net";
import * as process from "node:process";
import * as querystring from "node:querystring";
import * as readline from "node:readline";
import * as stream from "node:stream";
import * as timers from "node:timers";
import * as tls from "node:tls";
import * as url from "node:url";
import * as util from "node:util";
import * as zlib from "node:zlib";
import { join } from "node:path";

export function main(): void {
  const p = join("a", "b");
  const handleRequest = (_req: IncomingMessage, _res: ServerResponse): void => {
    return;
  };
  void http.createServer;
  void handleRequest;
  void p;
  void process.platform;
  console.log("ok");
}
