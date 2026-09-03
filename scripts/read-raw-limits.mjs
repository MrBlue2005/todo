import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const appData = path.join(process.env.APPDATA, 'codex-limit-monitor');
const config = JSON.parse(await readFile(path.join(appData, 'config.json'), 'utf8'));
const codex = execFileSync('where.exe', ['codex'], { encoding: 'utf8' }).split(/\r?\n/).find(Boolean).trim();

async function inspect(workspace) {
  const env = { ...process.env };
  if (workspace.auth === 'isolated') env.CODEX_HOME = path.join(appData, 'profiles', workspace.id);
  const child = spawn(codex, ['app-server', '--stdio'], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let nextId = 1;
  let buffer = '';
  const pending = new Map();

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        const resolve = pending.get(message.id);
        pending.delete(message.id);
        resolve(message);
      }
    }
  });

  function request(method, params) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ method, id, ...(params !== undefined ? { params } : {}) })}\n`);
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => reject(new Error(`${method} timeout`)), 20_000).unref();
    });
  }

  try {
    await request('initialize', {
      clientInfo: { name: 'codex-limit-diagnostic', title: 'Codex Limit Diagnostic', version: '1.0.0' },
      capabilities: { experimentalApi: true, requestAttestation: false }
    });
    child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
    const account = await request('account/read', { refreshToken: false });
    const limits = await request('account/rateLimits/read');
    const usage = await request('account/usage/read', {});
    return { workspace: workspace.name, account, limits, usage };
  } finally {
    child.kill();
  }
}

const results = [];
for (const workspace of config.workspaces) results.push(await inspect(workspace));
console.log(JSON.stringify(results, null, 2));
