export function keelNativeTokens(text) {
  const tokens = [];
  let offset = 0;
  scan();
  return Object.freeze(tokens.map(token => Object.freeze(token)));

  function scan(interpolationBraces = 0) {
    let depth = 0;
    while (offset < text.length) {
      const start = offset;
      const character = text[offset];
      if (interpolationBraces > 0 && depth === 0 && text.startsWith("}".repeat(interpolationBraces), offset)) {
        offset += interpolationBraces;
        return;
      }
      if (/\s/u.test(character)) { offset += 1; continue; }
      if (text.startsWith("//", offset)) {
        offset = text.indexOf("\n", offset + 2);
        if (offset < 0) offset = text.length;
        append("comment", start);
        continue;
      }
      if (text.startsWith("/*", offset)) {
        let comments = 1;
        offset += 2;
        while (offset < text.length && comments > 0) {
          if (text.startsWith("/*", offset)) { comments += 1; offset += 2; }
          else if (text.startsWith("*/", offset)) { comments -= 1; offset += 2; }
          else offset += 1;
        }
        if (comments !== 0) throw new Error(`Unterminated native comment at ${start}.`);
        append("comment", start);
        continue;
      }
      const rustRaw = /^(?:br|r)(#+)?"/u.exec(text.slice(offset));
      if (rustRaw !== null) {
        const closing = `"${rustRaw[1] ?? ""}`;
        const end = text.indexOf(closing, offset + rustRaw[0].length);
        if (end < 0) throw new Error(`Unterminated native raw string at ${start}.`);
        offset = end + closing.length;
        append("literal", start);
        continue;
      }
      const escapedIdentifier = /^(?:r#|@)[\p{L}_][\p{L}\p{N}_]*/u.exec(text.slice(offset));
      if (escapedIdentifier !== null) {
        offset += escapedIdentifier[0].length;
        append("identifier", start);
        continue;
      }
      const quoted = /^(?:\$+@?|@\$?|b)?("+|'(?:[^'\\\r\n]|\\(?:.|u\{[^}]*\}))')/u.exec(text.slice(offset));
      if (quoted !== null) {
        readQuoted(quoted, start);
        continue;
      }
      const identifier = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(text.slice(offset));
      if (identifier !== null) {
        offset += identifier[0].length;
        append("identifier", start);
        continue;
      }
      const punctuation = text.startsWith("::", offset) ? "::" : character;
      offset += punctuation.length;
      if (punctuation === "{") depth += 1;
      if (punctuation === "}") depth -= 1;
      append("punctuation", start);
    }
    if (interpolationBraces > 0) throw new Error("Unterminated native interpolation.");
  }

  function readQuoted(quoted, start) {
    const opening = quoted[1];
    if (opening.startsWith("'") || opening.length === 2) {
      offset += quoted[0].length;
      append("literal", start);
      return;
    }
    const quotes = opening.length;
    const verbatim = quoted[0].includes("@");
    const dollars = quoted[0].split("").filter(character => character === "$").length;
    const braces = quotes >= 3 ? dollars : dollars > 0 ? 1 : 0;
    offset += quoted[0].length;
    while (offset < text.length) {
      if (quotes >= 3 && text.startsWith('"'.repeat(quotes), offset)) {
        offset += quotes; append("literal", start); return;
      }
      if (quotes < 3 && text[offset] === '"') {
        if (verbatim && text[offset + 1] === '"') { offset += 2; continue; }
        offset += 1; append("literal", start); return;
      }
      if (!verbatim && quotes < 3 && text[offset] === "\\") { offset += 2; continue; }
      if (braces > 0 && text.startsWith("{".repeat(braces), offset)) {
        if (quotes < 3 && text.startsWith("{{", offset)) { offset += 2; continue; }
        offset += braces;
        scan(braces);
        continue;
      }
      offset += 1;
    }
    throw new Error(`Unterminated native string at ${start}.`);
  }

  function append(kind, start) {
    tokens.push({ kind, text: text.slice(start, offset), offset: start });
  }
}

export function keelNativeUnsafeSites(text) {
  const tokens = keelNativeTokens(text);
  const code = tokens.filter(token => token.kind !== "comment" && token.kind !== "literal");
  const result = [];
  for (let index = 0; index < code.length; index += 1) {
    if (code[index].kind === "identifier" && code[index].text === "unsafe") {
      result.push(code.slice(Math.max(0, index - 8), index + 9).map(part => part.text).join(" "));
    }
  }
  return Object.freeze(result);
}

export function keelNativeNodeDomains(text) {
  const tokens = keelNativeTokens(text).filter(token => token.kind === "identifier" || token.kind === "punctuation");
  const domains = new Set(["JsTimers", "Signals", "Timers", "Http", "Net", "Tls", "Watchers", "Workers", "Ports"]);
  const result = [];
  let phaseEnumDepth;
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.text === "enum" && tokens[index + 1]?.text === "DispatchPhase") phaseEnumDepth = depth + 1;
    if (token.text === "{") depth += 1;
    if (token.text === "}") {
      if (depth === phaseEnumDepth) phaseEnumDepth = undefined;
      depth -= 1;
    }
    if (domains.has(token.text) && (depth === phaseEnumDepth ||
      tokens[index - 2]?.text === "DispatchPhase" && ["::", "."].includes(tokens[index - 1]?.text))) {
      result.push(Object.freeze({ domain: token.text, offset: token.offset }));
    }
    if (token.text === "tsonic_rust_node" || token.text === "Tsonic" &&
      tokens.slice(index, index + 5).map(part => part.text).join("") === "Tsonic.CSharp.Node") {
      result.push(Object.freeze({ domain: "Node runtime dependency", offset: token.offset }));
    }
  }
  return Object.freeze(result);
}
