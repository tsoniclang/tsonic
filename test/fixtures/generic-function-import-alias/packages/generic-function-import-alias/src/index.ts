import { id } from "./lib.js";

const copy = id;
const n = copy<number>(1);
const s = copy<string>("ok");

void n;
void s;
