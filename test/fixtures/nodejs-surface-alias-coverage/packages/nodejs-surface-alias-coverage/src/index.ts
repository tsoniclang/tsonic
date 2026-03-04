import * as assert from "node:assert";
import * as buffer from "node:buffer";
import * as child_process from "node:child_process";
import * as dgram from "node:dgram";
import * as dns from "node:dns";
import * as events from "node:events";
import * as net from "node:net";
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
  void p;
  console.log("ok");
}
