import { resolve } from "node:path";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

let req: IncomingMessage | undefined;
let server: Server | undefined;
let res: ServerResponse | undefined;

const handler = (req: IncomingMessage, res: ServerResponse) => {
  void req;
  void res;
};

void resolve;
void createServer;
void handler;
void req;
void server;
void res;
