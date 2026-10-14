// 用法：node scripts/render-diagrams.mjs
// 渲染 diagrams/*.mmd → public/diagrams/*.svg（透明底、站点深色主题）
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SRC = 'diagrams';
const OUT = 'public/diagrams';

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.mmd') && f !== 'theme.mmd');
if (!existsSync('/tmp/diag-puppeteer.json')) {
  writeFileSync('/tmp/diag-puppeteer.json', JSON.stringify({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }));
}

let ok = 0, fail = 0;
for (const f of files) {
  const name = f.replace('.mmd', '');
  const src = readFileSync(`${SRC}/${f}`, 'utf8');
  const theme = readFileSync(`${SRC}/theme.mmd`, 'utf8');
  // 把 theme.mmd 的 init 指令拼到每个图前面
  const initLine = theme.match(/%%\{init:[^}]+\}%%/)?.[0] ?? '';
  const full = `${initLine}\n${src}`;
  const tmp = `/tmp/diag-${name}.mmd`;
  writeFileSync(tmp, full);

  try {
    execSync(
      `PUPPETEER_EXECUTABLE_PATH="${CHROME}" mmdc -i ${tmp} -o ${OUT}/${name}.svg -b transparent -p /tmp/diag-puppeteer.json`,
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    console.log(`ok  ${name}.svg`);
    ok++;
  } catch (e) {
    console.error(`FAIL ${name}:`, String(e.stderr || e.message).slice(0, 300));
    fail++;
  }
}
console.log(`\n${ok} ok, ${fail} failed`);
if (fail > 0) process.exit(1);
