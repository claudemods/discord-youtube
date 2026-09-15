const { app, BrowserWindow, Notification } = require('./Electron');
const { Client: RPCClient } = require('./RPC');   // ✅ RPC exports { Client }
const path = require('path');

app.setAppUserModelId('DiscordYouTube');

const icon = path.join(__dirname, '../assets/icon.png');

// ── REPLACE with YOUR OWN Discord application ID ─────────────
// 1. Go to https://discord.com/developers/applications
// 2. Create a new application (name it "Discord YouTube" or similar)
// 3. Copy its Application ID and paste it below
// 4. Under "Rich Presence → Art Assets", upload a square PNG
//    named "youtube" (the asset key must be exactly: youtube)
// ─────────────────────────────────────────────────────────────
const clientId = '1549492396763648111';

let mainWindow;

// transport is set inside RPCClient's constructor (ipc)
const rpc = new RPCClient({ clientId });

// Linux sandbox fix
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
}

// ── Polling management ───────────────────────────────────────
let pollInterval = null;

function startPolling() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (pollInterval) return; // avoid double intervals on reconnect
  mainWindow.checkYouTube();
  pollInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.checkYouTube();
  }, 2E3);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

rpc.on('ready', () => {
  console.log('[main] RPC ready — starting poll');
  startPolling();
});

rpc.on('disconnected', () => {
  console.log('[main] RPC disconnected — stopping poll');
  stopPolling();
});

// ── App lifecycle ────────────────────────────────────────────
app.on('ready', () => {
  mainWindow = new BrowserWindow({ rpc, icon });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopPolling();
  });

  mainWindow.maximize();
  mainWindow.loadURL('https://www.youtube.com/');
});

app.whenReady();

app.on('window-all-closed', () => {
  app.quit();
});

// ── RPC bootstrap ────────────────────────────────────────────
function connectRPC() {
  rpc.start().catch(() => {
    const notification = new Notification({
      title: 'Could not connect to Discord',
      body: 'Click here to try again',
      icon,
    });
    notification.show();
    notification.on('click', () => connectRPC());
  });
}

app.on('rpc', connectRPC);
app.whenReady().then(() => app.emit('rpc'));