// tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs — hand-rolled YAML-subset parser (P2-T2, FR-6,
// 02 §4.3).
//
// Per this tool's README ("Design decisions" — no `yaml`/JSON-Schema npm dependency): this repo
// has a deliberate zero-runtime-dependency posture. `scripts/evidence/vendor-rf-bundle.mjs`
// already hand-rolls a small YAML-subset parser for `rf` source-card frontmatter; this module is
// the "shared, hand-rolled YAML-subset parser" the README instructs P2-T2 to extend rather than
// adding a dependency. It is not a byte-for-byte reuse of that file (this module additionally
// folds multi-line plain/quoted scalars — needed for `claims/claim_ledger.yaml`'s wrapped `text:`
// fields, which that script never had to parse), but it keeps the same fail-closed posture: any
// YAML construct outside the subset below (block scalars `|`/`>`, anchors `&`, aliases `*`, tags
// `!`, multi-document `---` separators inside a single parse, multi-line flow collections) raises
// rather than silently guessing or dropping content. A future task that hits such a construct in a
// real `rf` bundle should escalate (new finding), not quietly relax this parser or add a
// dependency (this tool's README, "Ruling for P2-T2... and any schema-validating task").
//
// Supported subset: block mappings, block lists (list items may be either a nested mapping or a
// scalar), single-line flow mappings/lists, double- and single-quoted scalars (foldable across
// multiple physical lines when the closing quote does not appear on the first line), plain
// scalars (foldable across multiple physical lines the same way block-style YAML folds them — a
// single space per line break, since none of the bundles this parser reads use blank-line
// paragraph breaks inside a scalar), and `#`-prefixed whole-line comments.

export class YamlParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'YamlParseError';
  }
}

// ---------------------------------------------------------------------------------------------
// Line helpers
// ---------------------------------------------------------------------------------------------

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function isBlankOrComment(line) {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function skipBlankLines(lines, i) {
  let cursor = i;
  while (cursor < lines.length && isBlankOrComment(lines[cursor])) cursor += 1;
  return cursor;
}

const KEY_RE = /^([A-Za-z_][\w-]*)\s*:(?:[ \t]+(.*))?$/;

// ---------------------------------------------------------------------------------------------
// Scalar interpretation (plain scalars only — quoted scalars are always strings)
// ---------------------------------------------------------------------------------------------

function interpretPlain(raw) {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);
  return raw;
}

// ---------------------------------------------------------------------------------------------
// Flow (single-line) collections — used only for values that open with `{` or `[`. This subset's
// bundles never span a flow collection across multiple physical lines; an unterminated flow
// collection raises rather than guessing where it continues.
// ---------------------------------------------------------------------------------------------

function skipFlowSpace(s, i) {
  let cursor = i;
  while (cursor < s.length && (s[cursor] === ' ' || s[cursor] === '\t')) cursor += 1;
  return cursor;
}

function readInlineQuoted(s, start, quoteChar) {
  let i = start + 1;
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (quoteChar === '"' && ch === '\\') {
      const next = s[i + 1];
      const map = { '"': '"', '\\': '\\', n: '\n', t: '\t', '/': '/' };
      if (!(next in map)) {
        throw new YamlParseError(`unsupported escape \\${next} in double-quoted string at position ${i}`);
      }
      out += map[next];
      i += 2;
      continue;
    }
    if (ch === quoteChar) {
      if (quoteChar === "'" && s[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, next: i + 1 };
    }
    out += ch;
    i += 1;
  }
  throw new YamlParseError(`unterminated ${quoteChar}-quoted string`);
}

function parseFlowValue(s, start) {
  const i0 = skipFlowSpace(s, start);
  if (i0 >= s.length) return { value: null, next: i0 };
  const c = s[i0];
  if (c === '"') return readInlineQuoted(s, i0, '"');
  if (c === "'") return readInlineQuoted(s, i0, "'");
  if (c === '{') return parseFlowMapping(s, i0);
  if (c === '[') return parseFlowList(s, i0);
  let j = i0;
  while (j < s.length && s[j] !== ',' && s[j] !== '}' && s[j] !== ']') j += 1;
  const raw = s.slice(i0, j).trimEnd();
  return { value: interpretPlain(raw), next: i0 + raw.length };
}

function parseFlowKey(s, start) {
  if (s[start] === '"') return readInlineQuoted(s, start, '"');
  if (s[start] === "'") return readInlineQuoted(s, start, "'");
  let i = start;
  while (i < s.length && /[A-Za-z0-9_-]/.test(s[i])) i += 1;
  if (i === start) throw new YamlParseError(`expected flow-mapping key at position ${start}: ${s.slice(start, start + 20)}`);
  return { value: s.slice(start, i), next: i };
}

function parseFlowMapping(s, start) {
  if (s[start] !== '{') throw new YamlParseError('parseFlowMapping: expected {');
  let i = start + 1;
  const obj = {};
  i = skipFlowSpace(s, i);
  if (s[i] === '}') return { value: obj, next: i + 1 };
  for (;;) {
    const keyResult = parseFlowKey(s, i);
    i = skipFlowSpace(s, keyResult.next);
    if (s[i] !== ':') throw new YamlParseError(`expected ':' in flow mapping at position ${i}: ${s.slice(i, i + 20)}`);
    i = skipFlowSpace(s, i + 1);
    const valueResult = parseFlowValue(s, i);
    obj[keyResult.value] = valueResult.value;
    i = skipFlowSpace(s, valueResult.next);
    if (s[i] === ',') {
      i = skipFlowSpace(s, i + 1);
      continue;
    }
    if (s[i] === '}') return { value: obj, next: i + 1 };
    throw new YamlParseError(`expected ',' or '}' in flow mapping at position ${i}`);
  }
}

function parseFlowList(s, start) {
  if (s[start] !== '[') throw new YamlParseError('parseFlowList: expected [');
  let i = skipFlowSpace(s, start + 1);
  const arr = [];
  if (s[i] === ']') return { value: arr, next: i + 1 };
  for (;;) {
    const valueResult = parseFlowValue(s, i);
    arr.push(valueResult.value);
    i = skipFlowSpace(s, valueResult.next);
    if (s[i] === ',') {
      i = skipFlowSpace(s, i + 1);
      continue;
    }
    if (s[i] === ']') return { value: arr, next: i + 1 };
    throw new YamlParseError(`expected ',' or ']' in flow list at position ${i}`);
  }
}

function checkNoTrailingFlowContent(text, next, lineNumber) {
  const rest = text.slice(next).trim();
  if (rest !== '' && !rest.startsWith('#')) {
    throw new YamlParseError(`trailing content after value at line ${lineNumber}: ${JSON.stringify(rest)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Scalar values at block level — these MAY fold across multiple physical lines (the construct
// `vendor-rf-bundle.mjs`'s narrower parser never needed): a value is a continuation of the same
// scalar as long as the next physical line is strictly more indented than the `key:`/`- ` line
// that started it. A blank line ends folding in this subset (none of the bundles this parser
// reads use blank-line paragraph breaks inside a scalar) — encountering one immediately after an
// unterminated quoted scalar is treated as a parse error (fail closed) rather than silently
// truncating the string.
// ---------------------------------------------------------------------------------------------

function readBlockQuotedScalar(lines, lineIndex, keyIndent, firstLineRest, quoteChar) {
  let out = '';
  let closed = false;
  let trailingAfterClose = '';
  let i = lineIndex;

  const consume = (text) => {
    let idx = 0;
    while (idx < text.length) {
      const ch = text[idx];
      if (quoteChar === '"' && ch === '\\') {
        const next = text[idx + 1];
        const map = { '"': '"', '\\': '\\', n: '\n', t: '\t', '/': '/' };
        if (!(next in map)) {
          throw new YamlParseError(`unsupported escape \\${next} in double-quoted string at line ${i + 1}`);
        }
        out += map[next];
        idx += 2;
        continue;
      }
      if (ch === quoteChar) {
        if (quoteChar === "'" && text[idx + 1] === "'") {
          out += "'";
          idx += 2;
          continue;
        }
        trailingAfterClose = text.slice(idx + 1);
        closed = true;
        return;
      }
      out += ch;
      idx += 1;
    }
    // End of physical line reached without a closing quote: fold with a single space, matching
    // block-YAML line-folding, before appending the next physical line's content.
    out += ' ';
  };

  consume(firstLineRest);
  while (!closed) {
    i += 1;
    if (i >= lines.length) {
      throw new YamlParseError(`unterminated ${quoteChar}-quoted string starting at line ${lineIndex + 1}`);
    }
    const nextRaw = lines[i];
    if (isBlankOrComment(nextRaw)) {
      throw new YamlParseError(
        `blank/comment line inside a ${quoteChar}-quoted scalar starting at line ${lineIndex + 1} is not supported by this parser`,
      );
    }
    if (indentOf(nextRaw) <= keyIndent) {
      throw new YamlParseError(
        `unterminated ${quoteChar}-quoted string starting at line ${lineIndex + 1} (dedent before closing quote)`,
      );
    }
    consume(nextRaw.trim());
  }

  const rest = trailingAfterClose.trim();
  if (rest !== '' && !rest.startsWith('#')) {
    throw new YamlParseError(`trailing content after closing quote at line ${i + 1}: ${JSON.stringify(rest)}`);
  }
  return [out, i + 1];
}

function readBlockScalarValue(lines, lineIndex, keyIndent, valueText) {
  const rest = valueText.replace(/^[ \t]+/, '');
  const firstChar = rest[0];

  if (firstChar === '"' || firstChar === "'") {
    return readBlockQuotedScalar(lines, lineIndex, keyIndent, rest.slice(1), firstChar);
  }
  if (firstChar === '{') {
    const parsed = parseFlowMapping(rest, 0);
    checkNoTrailingFlowContent(rest, parsed.next, lineIndex + 1);
    return [parsed.value, lineIndex + 1];
  }
  if (firstChar === '[') {
    const parsed = parseFlowList(rest, 0);
    checkNoTrailingFlowContent(rest, parsed.next, lineIndex + 1);
    return [parsed.value, lineIndex + 1];
  }
  if (firstChar === '|' || firstChar === '>' || firstChar === '&' || firstChar === '*' || firstChar === '!') {
    throw new YamlParseError(
      `unsupported YAML construct "${firstChar}" at line ${lineIndex + 1} — block scalars, anchors, aliases, ` +
        'and tags are outside this hand-rolled parser\'s subset',
    );
  }

  // Plain scalar — fold continuation lines strictly more indented than this key/item.
  const parts = [rest.trim()];
  let i = lineIndex + 1;
  while (i < lines.length) {
    const raw = lines[i];
    if (isBlankOrComment(raw)) break;
    if (indentOf(raw) <= keyIndent) break;
    parts.push(raw.trim());
    i += 1;
  }
  return [interpretPlain(parts.join(' ')), i];
}

// ---------------------------------------------------------------------------------------------
// Block mappings / lists
// ---------------------------------------------------------------------------------------------

function readOptionalChildBlock(lines, startLine, parentIndent) {
  const first = skipBlankLines(lines, startLine);
  if (first >= lines.length) return [null, first];
  const line = lines[first];
  const indent = indentOf(line);
  if (indent < parentIndent) return [null, startLine];
  const body = line.slice(indent);
  if (body.startsWith('- ') || body === '-') {
    // A nested block list may sit at the same indent as its parent key (the shape every
    // `sources:` / `checks:` block in these bundles uses) or deeper.
    return parseBlockList(lines, first, indent);
  }
  if (indent > parentIndent) return parseBlockMapping(lines, first, indent);
  // Same indent, not a list dash: this is the parent's next sibling key, not a child.
  return [null, startLine];
}

function parseBlockMapping(lines, startLine, indent) {
  const obj = {};
  let i = startLine;
  while (i < lines.length) {
    const raw = lines[i];
    if (isBlankOrComment(raw)) {
      i += 1;
      continue;
    }
    const currentIndent = indentOf(raw);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new YamlParseError(`unexpected indent at line ${i + 1}: expected ${indent}, got ${currentIndent}`);
    }
    const body = raw.slice(indent);
    if (body.startsWith('- ') || body === '-') break;
    const match = body.match(KEY_RE);
    if (!match) throw new YamlParseError(`expected "key: value" at line ${i + 1}: ${raw}`);
    const key = match[1];
    const valueText = match[2];
    if (valueText === undefined || valueText === '') {
      const [child, nextI] = readOptionalChildBlock(lines, i + 1, indent);
      obj[key] = child;
      i = nextI;
    } else {
      const [value, nextI] = readBlockScalarValue(lines, i, indent, valueText);
      obj[key] = value;
      i = nextI;
    }
  }
  return [obj, i];
}

function parseBlockList(lines, startLine, indent) {
  const arr = [];
  let i = startLine;
  while (i < lines.length) {
    const raw = lines[i];
    if (isBlankOrComment(raw)) {
      i += 1;
      continue;
    }
    const currentIndent = indentOf(raw);
    if (currentIndent < indent) break;
    if (currentIndent > indent) throw new YamlParseError(`unexpected indent inside list at line ${i + 1}`);
    const body = raw.slice(indent);
    if (!(body.startsWith('- ') || body === '-')) break;

    const itemIndent = indent + 2;
    const afterDash = body === '-' ? '' : body.slice(2);
    const km = afterDash.match(KEY_RE);

    if (!km) {
      // Scalar list item (e.g. `- skill_research_swarm_v0`).
      const [value, nextI] = readBlockScalarValue(lines, i, indent, afterDash);
      arr.push(value);
      i = nextI;
      continue;
    }

    // Mapping list item: the first key sits inline with the dash; subsequent keys of the same
    // item are read at `itemIndent`.
    const item = {};
    const firstKey = km[1];
    const firstValueText = km[2];
    if (firstValueText === undefined || firstValueText === '') {
      const [child, nextI] = readOptionalChildBlock(lines, i + 1, itemIndent);
      item[firstKey] = child;
      i = nextI;
    } else {
      const [value, nextI] = readBlockScalarValue(lines, i, itemIndent, firstValueText);
      item[firstKey] = value;
      i = nextI;
    }

    while (i < lines.length) {
      const l = lines[i];
      if (isBlankOrComment(l)) {
        i += 1;
        continue;
      }
      const ci = indentOf(l);
      if (ci < itemIndent) break;
      if (ci > itemIndent) throw new YamlParseError(`unexpected indent inside list item at line ${i + 1}`);
      const b = l.slice(itemIndent);
      if (b.startsWith('- ') || b === '-') {
        throw new YamlParseError(`unexpected nested list dash inside a mapping item's own keys at line ${i + 1}`);
      }
      const km2 = b.match(KEY_RE);
      if (!km2) throw new YamlParseError(`expected "key: value" at line ${i + 1}: ${l}`);
      const key2 = km2[1];
      const valueText2 = km2[2];
      if (valueText2 === undefined || valueText2 === '') {
        const [child, nextI] = readOptionalChildBlock(lines, i + 1, itemIndent);
        item[key2] = child;
        i = nextI;
      } else {
        const [value, nextI] = readBlockScalarValue(lines, i, itemIndent, valueText2);
        item[key2] = value;
        i = nextI;
      }
    }
    arr.push(item);
  }
  return [arr, i];
}

function parseBlockAt(lines, startLine, minIndent) {
  const first = skipBlankLines(lines, startLine);
  if (first >= lines.length) return [null, first];
  const line = lines[first];
  const indent = indentOf(line);
  if (indent < minIndent) return [null, startLine];
  const rest = line.slice(indent);
  if (rest.startsWith('- ') || rest === '-') return parseBlockList(lines, first, indent);
  return parseBlockMapping(lines, first, indent);
}

// ---------------------------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------------------------

/**
 * Parses a full YAML document (no `---` frontmatter delimiters) — the shape every top-level `rf`
 * bundle artifact this converter reads uses (`evidence_bundle.yaml`, `claims/claim_ledger.yaml`,
 * `reviews/verification.yaml`, `extractions/ext_*.yaml`, `swarm_plan.yaml`,
 * `writebacks/ccdash_event.yaml`).
 *
 * @param {string} text
 * @returns {object|Array}
 */
export function parseYamlDocument(text) {
  const lines = text.split(/\r?\n/);
  const [value, next] = parseBlockAt(lines, 0, 0);
  for (let i = next; i < lines.length; i += 1) {
    if (!isBlankOrComment(lines[i])) {
      throw new YamlParseError(`unexpected trailing content at line ${i + 1}: ${lines[i]}`);
    }
  }
  return value ?? {};
}

/**
 * Parses a `---`-delimited YAML frontmatter block (the `sources/src_*.md` source-card shape) and
 * returns the parsed frontmatter object plus the raw markdown body that follows the closing
 * delimiter, verbatim.
 *
 * @param {string} text
 * @returns {{ frontmatter: object, body: string }}
 */
export function parseYamlFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new YamlParseError('YAML frontmatter delimiter (---) not found');
  const frontmatter = parseYamlDocument(match[1]);
  const body = text.slice(match[0].length);
  return { frontmatter, body };
}
