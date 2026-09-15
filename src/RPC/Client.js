const { Client } = require('@xhayper/discord-rpc');
const util = require('util');
const sleep = util.promisify(setTimeout);
const { ActivityType } = require('discord-api-types/v10');

module.exports = class RPCClient extends Client {
  constructor({ clientId }) {
    super({ clientId, transport: 'ipc' });

    this.clientId = clientId;
    this.currentState = null;
    this.ready = false;

    this.on('connected', () => console.log('[RPC] Connected to Discord'));
    this.on('ready', () => {
      console.log('[RPC] RPC Ready');
      this.ready = true;
    });
    this.on('disconnected', () => {
      console.log('[RPC] Disconnected from Discord');
      this.ready = false;
    });
  }

  /**
   * Attempts to start the RPC connection, retrying up to 3 times.
   * Resolves true on success, false after exhausting retries.
   */
  async start(tries = 0) {
    try {
      await this.login();
      return true;
    } catch (error) {
      console.error(`[RPC] Login failed (attempt ${tries + 1}):`, error.message);
      if (tries + 1 >= 3) {
        console.error('[RPC] Giving up after 3 attempts.');
        return false;
      }
      await sleep(10000);
      return this.start(tries + 1);
    }
  }

  /**
   * Resolves once the RPC client is ready, or after timeoutMs.
   */
  waitUntilReady(timeoutMs = 15000) {
    if (this.ready && this.user) return Promise.resolve(true);
    return new Promise((resolve) => {
      const startTime = Date.now();
      const check = () => {
        if (this.ready && this.user) return resolve(true);
        if (Date.now() - startTime > timeoutMs) return resolve(false);
        setTimeout(check, 250);
      };
      check();
    });
  }

  /**
   * Builds the button array for Discord, capped at 2 (API limit)
   * and filtered for valid http(s) URLs.
   */
  _buildButtons({ watchUrl, buttons }) {
    const list = [];

    if (watchUrl && /^https?:\/\//i.test(watchUrl)) {
      list.push({ label: 'Watch on YouTube', url: watchUrl });
    }

    if (Array.isArray(buttons)) {
      for (const b of buttons) {
        if (!b || !b.label || !b.url) continue;
        if (!/^https?:\/\//i.test(b.url)) continue;
        // Skip if identical URL already added
        if (list.some(existing => existing.url === b.url)) continue;
        list.push({ label: String(b.label), url: b.url });
      }
    }

    return list.slice(0, 2);
  }

  /**
   * Sets the Discord Rich Presence activity to "Watching".
   * Handles paused state and media duration timestamps.
   *
   * @param {object} opts
   * @param {string} opts.title            Video title
   * @param {string} [opts.state]          Channel name / secondary line
   * @param {string} [opts.avatar]         smallImageKey (must be a registered asset)
   * @param {string} [opts.userName]       smallImageText
   * @param {boolean} [opts.paused]
   * @param {number} [opts.elapsedMs]
   * @param {number} [opts.durationMs]
   * @param {string} [opts.watchUrl]       Video URL -> auto "Watch on YouTube" button
   * @param {Array}  [opts.buttons]        Extra buttons (max 2 total incl. watchUrl)
   * @param {string} [opts.serviceName]    Defaults to 'YouTube'
   * @param {string} [opts.largeImageKey]  Defaults to 'youtube'
   */
  async setWatchingActivity({
    title,
    state,
    avatar,
    userName,
    paused,
    elapsedMs,
    durationMs,
    watchUrl,
    buttons,
    serviceName = 'YouTube',
    largeImageKey = 'youtube',
  }) {
    if (!this.ready || !this.user) {
      console.warn('[RPC] Cannot set activity: not ready or user unavailable');
      return;
    }

    const now = Date.now();
    const finalButtons = this._buildButtons({ watchUrl, buttons });

    const activity = {
      type: ActivityType.Watching,
      details: title || `Watching ${serviceName}`,
      state: paused
        ? `Paused${state ? ` • ${state}` : ''}`
        : state || '',
      largeImageKey,
      largeImageText: `${title || serviceName} on ${serviceName}`,
      smallImageKey: avatar || undefined,
      smallImageText: userName || undefined,
      instance: false,
      buttons: finalButtons.length ? finalButtons : undefined,
    };

    if (!paused && typeof elapsedMs === 'number') {
      const start = now - elapsedMs;
      activity.startTimestamp = new Date(start);

      if (typeof durationMs === 'number') {
        activity.endTimestamp = new Date(start + durationMs);
      }
    }

    this.currentState = activity;

    try {
      await this.user.setActivity(activity);
    } catch (err) {
      console.error('[RPC] Failed to set activity:', err);
    }
  }
};