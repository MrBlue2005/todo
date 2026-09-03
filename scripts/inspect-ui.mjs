const pages = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = pages.find((candidate) => candidate.title === 'Codex Limit Monitor');
if (!page) throw new Error('Fereastra Codex Limit Monitor nu a fost găsită.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 1;
function request(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => {
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', listener);
      resolve(message);
    };
    socket.addEventListener('message', listener);
  });
}

if (process.argv.includes('--settings')) {
  await request('Runtime.evaluate', { expression: `document.querySelector('#settings').click()` });
}

const response = await request('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    text: document.body.innerText,
    logo: {
      src: document.querySelector('.brand-mark')?.getAttribute('src') || null,
      width: document.querySelector('.brand-mark')?.naturalWidth || 0,
      height: document.querySelector('.brand-mark')?.naturalHeight || 0
    },
    workspaces: document.querySelectorAll('.workspace').length,
    errors: [...document.querySelectorAll('.status-dot.error')].length
  })`,
  returnByValue: true
});

if (process.argv.includes('--screenshot')) {
  const { writeFile } = await import('node:fs/promises');
  const capture = await request('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile('ui-smoke.png', Buffer.from(capture.result.data, 'base64'));
}

socket.close();
console.log(JSON.stringify(JSON.parse(response.result.result.value), null, 2));
