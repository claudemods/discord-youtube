const { BrowserWindow: ElectronBrowserWindow } = require('electron');
const scripts = require('../util/scripts');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch').default;
const { dialog, shell, app } = require('electron');

// ── Point this at YOUR repo ──────────────────────────────
const UPDATE_REPO = 'YourName/YourYouTubeApp';
// ─────────────────────────────────────────────────────────

function normalizeTime(time) {
  if (!time || isNaN(time)) return 0;
  return time > 100_000 ? time / 1000 : time;
}

function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

function normalizeVersion(v) {
  return v.replace(/^v/, '');
}

function isNewerVersion(latest, current) {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  return l.some((n, i) => n > (c[i] || 0));
}

module.exports = class BrowserWindow extends ElectronBrowserWindow {
  constructor({ title, icon, rpc }) {
    super({
      backgroundColor: '#0f0f0f',   // YouTube dark
      autoHideMenuBar: true,
      resizable: true,
      center: true,
      fullscreenable: true,
      alwaysOnTop: false,
      title,
      icon,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        plugins: true,
        preload: path.join(__dirname, '../util/scripts/content_script.js'),
      },
    });

    this.rpc = rpc;
    this.browsingStart = null;
    this._checkedForUpdates = false;

    this.webContents.once('did-finish-load', () => {
      setTimeout(() => this.checkForUpdates(), 4000);
    });
  }

  async checkForUpdates() {
    if (this._checkedForUpdates) return;
    this._checkedForUpdates = true;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
        { headers: { 'User-Agent': 'YouTube-RPC-App' } }
      );

      if (!res.ok) return;

      const release = await res.json();
      const latest = normalizeVersion(release.tag_name);
      const current = app.getVersion();

      if (!isNewerVersion(latest, current)) return;

      const result = await dialog.showMessageBox(this, {
        type: 'info',
        title: 'Update available',
        message: 'A new version is available.',
        detail:
          `Current: v${current}\n` +
          `New: v${latest}\n\n` +
          (release.body || ''),
        buttons: ['Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        shell.openExternal(release.html_url);
        app.quit();
      }
    } catch (err) {
      console.error('[update] failed:', err);
    }
  }

  eval(code) {
    return this.webContents.executeJavaScript(code);
  }

  getInfos() {
    return this.eval(`(${scripts.infos})()`);
  }

  /**
   * Reads the current YouTube state and pushes it to Discord RPC.
   * Expects `scripts.infos` to return (at minimum):
   *   { name, title, state, avatar, userName, paused,
   *     currentTime, duration, url, buttons }
   *
   * - `name === 'Browsing'` means no video is open.
   * - `url` should be the canonical watch URL (used for the button).
   */
  async checkYouTube() {
    try {
      const infos = await this.getInfos();
      if (!infos) return;

      const now = Date.now();
      let elapsedMs = 0;

      const isBrowsing = infos.name === 'Browsing';
      const isPaused = !!infos.paused;

      if (isBrowsing) {
        // Browsing YouTube without a specific video
        this.browsingStart ||= now;
        elapsedMs = now - this.browsingStart;
      } else if (infos.duration && infos.currentTime) {
        // Watching a video
        this.browsingStart = null;
        const currentTimeSec = normalizeTime(infos.currentTime);
        elapsedMs = currentTimeSec * 1000;
      } else {
        this.browsingStart = null;
      }

      const durationMs = (!isBrowsing && infos.duration)
        ? normalizeTime(infos.duration) * 1000
        : undefined;

      // Pull a watch URL for the "Watch on YouTube" button
      const watchUrl = (!isBrowsing && infos.url)
        ? infos.url
        : undefined;

      await this.rpc.setWatchingActivity({
        title: infos.title || (isBrowsing ? 'Browsing YouTube' : 'Watching YouTube'),
        state: infos.state || '',
        avatar: infos.avatar ? md5(infos.avatar) : '',
        userName: infos.userName || '',
        paused: isPaused,
        elapsedMs,
        durationMs,
        watchUrl,
        buttons: infos.buttons?.length ? infos.buttons : undefined,
        serviceName: 'YouTube',
        largeImageKey: 'youtube',
      });

      console.log('[checkYouTube] title:', infos.title);
      console.log('[checkYouTube] state:', infos.state);
      console.log('[checkYouTube] elapsedMs:', elapsedMs, 'durationMs:', durationMs);
    } catch (err) {
      console.error('[checkYouTube] error:', err);
    }
  }
};