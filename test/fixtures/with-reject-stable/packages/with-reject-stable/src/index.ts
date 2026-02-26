const scope = { value: 42 };
let out = 0;

with (scope) {
  out = value;
}

console.log(out);
