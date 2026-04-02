const xs = [1, 2];
xs.push(3);
const text = (42).toString();
const other = Array.of(1, 2, 3);
export const ok = Array.isArray(other) ? text + xs.join(",") : text;
