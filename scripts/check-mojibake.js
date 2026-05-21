import fs from "node:fs";
import path from "node:path";

const roots = [
  "App.tsx",
  "index.tsx",
  "index.html",
  "server.ts",
  "helpers",
  "endpoints",
  "pages",
  "components",
];

const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".json",
  ".md",
  ".sql",
]);

const ignoredPathFragments = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}helpers${path.sep}migrations${path.sep}`,
];

// Detects common mojibake signatures from UTF-8 text interpreted as Latin-1/Windows-1252.
const mojibakePattern = new RegExp(
  "(?:\\u00C3[\\u00A0-\\u00FF]|\\u00C2[\\u00A0-\\u00FF_]|\\u00E2[\\u0080-\\u00FF\\u201A-\\u2122]|\\uFFFD)",
  "g"
);

function shouldIgnore(filePath) {
  return ignoredPathFragments.some((fragment) => filePath.includes(fragment));
}

function collectFiles(entryPath, output) {
  if (!fs.existsSync(entryPath)) return;

  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const childName of fs.readdirSync(entryPath)) {
      collectFiles(path.join(entryPath, childName), output);
    }
    return;
  }

  if (!allowedExtensions.has(path.extname(entryPath))) return;

  const normalized = path.resolve(entryPath);
  if (shouldIgnore(normalized)) return;

  output.push(normalized);
}

const files = [];
for (const root of roots) {
  collectFiles(root, files);
}

const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  const lineFindings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (mojibakePattern.test(line)) {
      lineFindings.push({
        line: i + 1,
        text: line.trim().slice(0, 180),
      });
    }
    mojibakePattern.lastIndex = 0;
  }

  if (lineFindings.length > 0) {
    findings.push({ file, lineFindings });
  }
}

if (findings.length === 0) {
  console.log("OK: nenhum mojibake detectado nos arquivos de runtime.");
  process.exit(0);
}

console.error("ERRO: mojibake detectado. Corrija antes de prosseguir.");
for (const finding of findings) {
  console.error(`\n${finding.file}`);
  for (const lineFinding of finding.lineFindings.slice(0, 8)) {
    console.error(`  L${lineFinding.line}: ${lineFinding.text}`);
  }
  if (finding.lineFindings.length > 8) {
    console.error(`  ... +${finding.lineFindings.length - 8} ocorrência(s)`);
  }
}

process.exit(1);
