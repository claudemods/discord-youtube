module.exports = function () {
  const pathname = document.location.pathname;
  const url = document.location.href;

  // YouTube has no exposed "logged-in user" info on the page.
  // We repurpose these fields for the CHANNEL (uploader) instead,
  // which is what most YouTube RPC presences show.
  let avatar = '';   // left blank: raw URLs do NOT work as smallImageKey
  let userName = '';

  // ── Video ID helper (used both for state and the button) ─────────
  const getVideoId = () => {
    try {
      const p = new URLSearchParams(location.search);
      const v = p.get('v');
      if (v) return v;
      // Shorts URL: /shorts/<id>
      const shorts = location.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return shorts[1];
    } catch (_) {}
    return null;
  };

  // ── Shared helpers for the watch page ────────────────────────────
  const getVideoEl = () =>
    document.querySelector('video.html5-main-video') ||
    document.querySelector('#movie_player video') ||
    document.querySelector('video');

  const getTitle = () => {
    // Primary: the h1 in the watch metadata
    const h1 = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
      || document.querySelector('#title h1 yt-formatted-string')
      || document.querySelector('h1.ytd-video-primary-info-renderer');
    let t = h1?.textContent?.trim();

    if (!t) {
      // Fallback: strip YouTube suffix from <title>
      t = document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
    }
    return t || '';
  };

  const getChannel = () => {
    // Channel name: several possible containers depending on layout
    const el =
      document.querySelector('ytd-video-owner-renderer #channel-name a') ||
      document.querySelector('#owner #channel-name a') ||
      document.querySelector('ytd-channel-name a');
    const name = el?.textContent?.trim() || '';
    const href = el?.getAttribute('href') || '';
    return { name, url: href ? `https://www.youtube.com${href}` : '' };
  };

  // ── Browsing (any page that isn't a watch page) ──────────────────
  const videoId = getVideoId();
  const isWatch = pathname.startsWith('/watch') || pathname.startsWith('/shorts');

  if (!isWatch || !videoId) {
    // Distinguish a few common browsing contexts for a nicer state line
    let state = 'Browsing';
    if (pathname.startsWith('/feed/subscriptions')) state = 'In Subscriptions';
    else if (pathname.startsWith('/feed/trending')) state = 'In Trending';
    else if (pathname.startsWith('/results')) state = 'Searching';
    else if (pathname.startsWith('/channel') || pathname.startsWith('/@')) state = 'On a Channel';
    else if (pathname.startsWith('/playlist')) state = 'In a Playlist';
    else if (pathname === '/' || pathname.startsWith('/feed')) state = 'On the Home Feed';

    return {
      name: 'Browsing',
      title: 'Browsing YouTube',
      state,
      avatar,
      userName,
      paused: false,
      buttons: [],
    };
  }

  // ── Watch page ───────────────────────────────────────────────────
  try {
    const videoEl = getVideoEl();
    if (!videoEl) return null;

    const duration = videoEl.duration;
    const currentTime = videoEl.currentTime;
    const paused = videoEl.paused;

    const title = getTitle();
    const { name: channelName, url: channelUrl } = getChannel();
    userName = channelName;

    // Build the button
    const buttons = [{
      label: 'Watch on YouTube',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }];

    return {
      name: 'Watching',
      title,
      state: channelName,
      duration,
      currentTime,
      paused,
      avatar,          // intentionally blank — see note above
      userName,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      buttons,
    };
  } catch (e) {
    console.error('[YouTube RPC] Failed to parse watching data:', e);
    return null;
  }
};