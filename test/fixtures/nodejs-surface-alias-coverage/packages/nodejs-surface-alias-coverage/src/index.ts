import { assert } from "node:assert";
import { buffer } from "node:buffer";
import { child_process } from "node:child_process";
import { dgram } from "node:dgram";
import { dns } from "node:dns";
import { events } from "node:events";
import { net } from "node:net";
import { querystring } from "node:querystring";
import { readline } from "node:readline";
import { stream } from "node:stream";
import { timers } from "node:timers";
import { tls } from "node:tls";
import { url } from "node:url";
import { util } from "node:util";
import { zlib } from "node:zlib";
import { Console } from "@tsonic/dotnet/System.js";

type AssertModule = typeof assert;
type BufferModule = typeof buffer;
type ChildProcessModule = typeof child_process;
type DgramModule = typeof dgram;
type DnsModule = typeof dns;
type EventsModule = typeof events;
type NetModule = typeof net;
type QuerystringModule = typeof querystring;
type ReadlineModule = typeof readline;
type StreamModule = typeof stream;
type TimersModule = typeof timers;
type TlsModule = typeof tls;
type UrlModule = typeof url;
type UtilModule = typeof util;
type ZlibModule = typeof zlib;

export function main(): void {
  Console.WriteLine("ok");
}
