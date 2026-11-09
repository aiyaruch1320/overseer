const tabs = await (await fetch('http://127.0.0.1:9417/json')).json();
const ws = tabs.find((t) => t.type === 'page').webSocketDebuggerUrl;
const s = new WebSocket(ws); await new Promise((r) => s.addEventListener('open', r));
const [,, url, sz] = process.argv;
s.send(JSON.stringify({ id: 1, method: 'Emulation.setDeviceMetricsOverride', params: { width: 1300, height: 850, deviceScaleFactor: 1, mobile: false } }));
s.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url } }));
setTimeout(() => process.exit(0), 2500);
