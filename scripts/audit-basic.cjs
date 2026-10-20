// Audit output contains locations and counts only, never credential values.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['node_modules', '.git', 'dist', '.angular'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}
const secrets = new Set();
const occurrences = [];
for (const file of files('src').filter(p => p.endsWith('.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const spans = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node)) {
      const value = node.text;
      const encoded = value.replace(/^Basic\s+/i, '');
      // Detect literal Basic and standalone Base64 user:password representations.
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) && encoded.length >= 8) {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        if (/^Basic\s+/i.test(value) || (/^[\x20-\x7e]+:[\x20-\x7e]+$/.test(decoded) && !decoded.startsWith('{') && Buffer.from(decoded).toString('base64').replace(/=+$/, '') === encoded.replace(/=+$/, ''))) {
          secrets.add(encoded);
          let parent = node.parent;
          while (parent && !ts.isMethodDeclaration(parent) && !ts.isPropertyDeclaration(parent)) parent = parent.parent;
          occurrences.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            method: parent?.name?.getText(source) ?? '(literal)', kind: 'code' });
          spans.push([node.getStart(), node.end]);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const match of text.matchAll(/Basic\s+([A-Za-z0-9+/]+={0,2})/g)) {
    const encoded = match[1];
    if (!/^[\x20-\x7e]+:[\x20-\x7e]+$/.test(Buffer.from(encoded, 'base64').toString('utf8'))) continue;
    secrets.add(encoded);
    if (!spans.some(([start, end]) => match.index >= start && match.index < end))
      occurrences.push({ file, line: text.slice(0, match.index).split('\n').length, method: '(comment)', kind: 'comment' });
  }
}
const bundleDir = 'dist/ng-tailadmin/browser';
const bundles = fs.existsSync(bundleDir) ? fs.readdirSync(bundleDir).filter(f => f.endsWith('.js')).map(file => {
  const text = fs.readFileSync(path.join(bundleDir, file), 'utf8');
  const count = value => text.split(value).length - 1;
  return { file, basicCredentialOccurrences: [...secrets].reduce((n, s) => n + count('Basic ' + s), 0),
    credentials: [...secrets].map((s, i) => ({ id: `BASIC-${i + 1}`, withBasicPrefix: count('Basic ' + s) })),
    getBalance: count('getBalance/'), getTotalsReport: count('getTotalsReport'), bffBalance: count('/api/account/balance') };
}).filter(b => b.basicCredentialOccurrences || b.getBalance || b.getTotalsReport || b.bffBalance) : [];
console.log(JSON.stringify({ distinctBasicCredentials: secrets.size, occurrences, bundles }, null, 2));
