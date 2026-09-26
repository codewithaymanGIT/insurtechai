// Collects every translatable English string in the app into
// scripts/i18n/source.json (string -> [files]). Run: node scripts/extract-strings.mjs
//
// What counts as translatable:
//  - the first argument of t(), tr(), N_() and apiT() calls (both branches of a ?: too)
//  - string values of display properties (label, title, description, ...) in
//    module-level constant tables, which are translated at render time
//  - every string in the constant maps listed in TABLES
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require(path.resolve("frontend/node_modules/typescript"));

const ROOTS = ["frontend/src", "backend/src", "shared/src"];
const SKIP = [/\/i18n\/catalogs\//, /landing\/sample\.ts$/, /\/seed\//, /\/scripts\//, /\.test\./];
const CALLS = new Set(["t", "tr", "N_", "apiT"]);
const PROPS = new Set(["label", "line", "title", "description", "hint", "what", "caution", "kind", "note", "reason", "band", "phrase", "page"]);
const TABLES = new Set([
  "TYPE_LABEL", "COVER_LABEL", "RISK_ORDER", "SEGMENT_LABEL", "MARITAL", "CLAIM_STATUS", "RISK_PHRASE", "POSITION_TEXT",
  "SUGGESTIONS", "AGE_LABEL", "VEHICLE", "CONDITIONS", "FAMILY", "WEIGHT_COLS", "ADEQUACY",
]);

const out = new Map();
const add = (s, file) => {
  if (!s || !/[A-Za-z]/.test(s)) return;
  if (/^[A-Z0-9_]+$/.test(s)) return; // enum ids
  if (/^(https?:|\/\S|#|mailto:)/.test(s)) return;
  if (/^(text|bg|border)-/.test(s) || /^(neutral|positive|warning|danger|accent|regression|classification|under_review)$/.test(s)) return;
  if (!out.has(s)) out.set(s, new Set());
  out.get(s).add(file);
};

function literals(node, file) {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, file);
  else if (ts.isConditionalExpression(node)) {
    literals(node.whenTrue, file);
    literals(node.whenFalse, file);
  } else if (ts.isParenthesizedExpression(node)) literals(node.expression, file);
  else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) literals(node.right, file);
}

function allStrings(node, file) {
  const visit = (n) => {
    if (ts.isPropertyAssignment(n)) {
      const key = n.name.getText();
      if (/^(to|url|value|id|icon|code|href)$/.test(key)) return;
      visit(n.initializer);
      return;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) add(n.text, file);
    else if (ts.isRegularExpressionLiteral(n)) return;
    else ts.forEachChild(n, visit);
  };
  visit(node);
}

function walk(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(process.cwd(), file);
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (CALLS.has(name) && n.arguments.length) literals(n.arguments[0], rel);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && TABLES.has(n.name.text) && n.initializer) allStrings(n.initializer, rel);
    if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText()) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      // Only module-level tables (not JSX props, which are attributes, not property assignments).
      add(n.initializer.text, rel);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(d.name) && !d.name.endsWith(".d.ts") && !SKIP.some((re) => re.test(p)) ? [p] : [];
  });
}

for (const root of ROOTS) for (const f of files(root)) walk(f);

const sorted = Object.fromEntries([...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]));
fs.mkdirSync("scripts/i18n", { recursive: true });
fs.writeFileSync("scripts/i18n/source.json", JSON.stringify(sorted, null, 2) + "\n");
const words = Object.keys(sorted).reduce((n, s) => n + s.split(/\s+/).length, 0);
console.log(`${Object.keys(sorted).length} strings, ${words} words -> scripts/i18n/source.json`);
