// ==UserScript==
// @name         YouTube Enhancements (Full Port)
// @namespace    discord-youtube
// @version      1.0.0
// @description  Full port of Netflix script: max quality, PiP button, smooth scroll, overlay bypass
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* =========================================================
   MAX BITRATE / MAX QUALITY
   Netflix: forced top video+audio bitrate via hidden menu.
   YouTube: no such menu exists. Closest equivalent is
   pinning the player to its highest available quality.
   ========================================================= */
(function () {
    'use strict';

    const QUALITY_ORDER = [
        'highres', 'hd2880', 'hd2160', 'hd1440',
        'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'
    ];

    const pickHighest = (levels) => {
        if (!levels || !levels.length) return null;
        for (const q of QUALITY_ORDER) {
            if (levels.includes(q)) return q;
        }
        return levels[0];
    };

    const getPlayer = () => {
        const el = document.querySelector('#movie_player');
        if (el && typeof el.getAvailableQualityLevels === 'function') return el;
        return null;
    };

    const enforce = () => {
        const player = getPlayer();
        if (!player) return false;
        try {
            const levels = player.getAvailableQualityLevels();
            const target = pickHighest(levels);
            if (target && typeof player.setPlaybackQualityRange === 'function') {
                player.setPlaybackQualityRange(target, target);
            }
            if (target && typeof player.setPlaybackQuality === 'function') {
                player.setPlaybackQuality(target);
            }
            return true;
        } catch (_) {
            return false;
        }
    };

    let lastVideoId = null;

    const run = () => {
        const vid = new URLSearchParams(location.search).get('v');
        if (!vid || vid === lastVideoId) return;
        lastVideoId = vid;

        let tries = 0;
        const tick = () => {
            if (enforce() || ++tries > 100) return;
            setTimeout(tick, 200);
        };
        tick();
    };

    window.addEventListener('yt-navigate-finish', run);
    window.addEventListener('yt-page-data-updated', run);
    document.addEventListener('DOMContentLoaded', run);
    document.addEventListener('yt-player-updated', () => setTimeout(enforce, 500));

    console.log('[YT] MAX QUALITY ENABLED');
})();

/* =========================================================
   PICTURE IN PICTURE (button injected into control bar)
   ========================================================= */
(function () {
    'use strict';

    const ICON_SVG = `
        <svg viewBox="0 0 36 36" width="100%" height="100%"
             xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M4 6a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4zm0 2h28v18H4V8zm16 10a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-5z"/>
        </svg>
    `;

    const getVideo = () => document.querySelector('video.html5-main-video')
        || document.querySelector('video');

    const togglePiP = async () => {
        const video = getVideo();
        if (!video) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (_) { /* user gesture / not allowed — silent */ }
    };

    const buildButton = () => {
        const btn = document.createElement('button');
        btn.className = 'ytp-button ytp-pip-button';
        btn.setAttribute('aria-label', 'Picture in Picture');
        btn.setAttribute('title', 'Picture in Picture');
        btn.innerHTML = ICON_SVG;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePiP();
        });
        return btn;
    };

    const inject = () => {
        const rightControls = document.querySelector('.ytp-right-controls');
        if (!rightControls) return;
        if (rightControls.querySelector('.ytp-pip-button')) return;

        const btn = buildButton();
        const settings = rightControls.querySelector('.ytp-settings-button');
        if (settings && settings.parentElement === rightControls) {
            rightControls.insertBefore(btn, settings);
        } else {
            rightControls.appendChild(btn);
        }
    };

    const injectStyle = () => {
        if (document.getElementById('yt-pip-css')) return;
        const style = document.createElement('style');
        style.id = 'yt-pip-css';
        style.textContent = `
            .ytp-pip-button svg {
                width: 24px;
                height: 24px;
                padding: 6px;
                box-sizing: content-box;
                vertical-align: middle;
                fill: #fff;
                opacity: 0.9;
            }
            .ytp-pip-button:hover svg { opacity: 1; }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const waitForBody = () => {
        if (!document.body) return requestAnimationFrame(waitForBody);
        injectStyle();
        const observer = new MutationObserver(inject);
        observer.observe(document.body, { childList: true, subtree: true });
        inject();
    };

    waitForBody();
    console.log('[YT] PICTURE IN PICTURE ENABLED');
})();

/* =========================================================
   SMOOTH SCROLL
   ========================================================= */
(function () {
    'use strict';

    const STEP = 120;
    const DURATION = 400;
    const PULSE = 8;

    let queue = [];
    let running = false;
    let lastDir = 0;

    const pulse = x => {
        x *= PULSE;
        return x < 1
            ? x - (1 - Math.exp(-x))
            : (1 - Math.exp(-(x - 1))) * (1 - Math.exp(-1)) + Math.exp(-1);
    };

    const findScrollable = el => {
        while (el && el !== document.body) {
            const s = getComputedStyle(el);
            if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight)
                return el;
            el = el.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    };

    const animate = () => {
        const now = performance.now();
        queue = queue.filter(item => {
            const t = Math.min(1, (now - item.start) / DURATION);
            const p = pulse(t);
            const dy = (item.y * p - item.ly) | 0;
            item.ly += dy;
            item.elem.scrollTop += dy;
            return t < 1;
        });
        if (queue.length) {
            requestAnimationFrame(animate);
        } else {
            running = false;
        }
    };

    const onWheel = e => {
        if (e.defaultPrevented) return;
        if (e.ctrlKey) return;

        const delta = e.deltaY;
        if (!delta) return;

        if (e.target.closest && e.target.closest('.html5-video-player')) return;

        const dir = Math.sign(delta);
        if (dir !== lastDir) queue.length = 0;
        lastDir = dir;

        const elem = findScrollable(e.target);
        queue.push({
            elem,
            y: delta * STEP / 120,
            ly: 0,
            start: performance.now()
        });

        if (!running) {
            running = true;
            requestAnimationFrame(animate);
        }
        e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    console.log('[YT] SMOOTH SCROLL ENABLED');
})();

/* =========================================================
   BYPASS OVERLAYS / FORCE PLAY
   Netflix: nuked household-restriction modal + force-played.
   YouTube: nukes equivalent blockers (age gate, bot-check
   interstitial, autopause overlays, ad overlays) and
   force-plays the video. Same pattern, YouTube selectors.
   ========================================================= */
(function () {
    'use strict';

    let hasForced = false;
    let observer = null;

    const getVideo = () =>
        document.querySelector('video.html5-main-video')
        || document.querySelector('video');

    const getPlayer = () => {
        const el = document.querySelector('#movie_player');
        if (el && typeof el.playVideo === 'function') return el;
        return null;
    };

    function tryForcePlay() {
        if (hasForced) return;
        try {
            const video = getVideo();
            if (!video) return;

            const player = getPlayer();
            if (player) {
                // YouTube's own API — plays even if native .play() is blocked
                if (typeof player.playVideo === 'function') {
                    player.playVideo();
                }
                hasForced = true;
                console.log('[YT] Force-play issued.');
            } else if (video.paused) {
                video.play().catch(() => {});
                hasForced = true;
            }
        } catch (_) { /* silent */ }
    }

    function cleanUI() {
        // YouTube interstitials / overlays / modals
        const blockers = document.querySelectorAll([
            'tp-yt-paper-dialog',                       // generic YT modal
            'ytd-enforcement-message-view-model',       // "Ad blockers violate ToS"
            'ytd-popup-container tp-yt-paper-dialog',   // bot / sign-in prompt
            'yt-confirm-dialog-renderer',               // confirm dialogs
            '.ytp-ad-overlay-container',                // ad overlay banners
            '.ytp-ad-overlay-slot',
            '.ytp-ad-player-overlay',                   // ad overlay on player
            '#player-ads',
            'ytd-mealbar-promo-renderer',               // "YouTube Premium" bar
            'ytd-statement-banner-renderer',
            'tp-yt-paper-toast'                         // nag toasts
        ].join(','));

        blockers.forEach(el => {
            // Keep the player itself intact; only strip overlays/modals
            if (el.id === 'movie_player') return;
            try { el.remove(); } catch (_) {}
        });

        if (document.body) {
            document.body.style.pointerEvents = 'auto';
            document.body.style.overflow = 'auto';
        }

        // Un-mute state YouTube sometimes forces when blocking
        const player = getPlayer();
        if (player && typeof player.unMute === 'function') {
            try { player.unMute(); } catch (_) {}
        }
    }

    function setupObserver() {
        if (!document.body) {
            requestAnimationFrame(setupObserver);
            return;
        }

        observer = new MutationObserver(() => {
            const blocker = document.querySelector(
                'tp-yt-paper-dialog, ytd-enforcement-message-view-model, .ytp-ad-overlay-container'
            );

            if (blocker) {
                cleanUI();
                if (!hasForced) setTimeout(tryForcePlay, 500);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupObserver();

    /* INPUT CONTROLS — preserved from Netflix script,
       but YouTube already handles these natively, so we
       only override where YouTube's behavior differs. */
    window.addEventListener('keydown', function (e) {
        const video = getVideo();
        if (!video) return;

        // Skip if focus is in a text input (search, comments)
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

        switch (e.code) {
            case 'Space':
                // YouTube handles Space natively; only act if player not focused
                if (document.activeElement === document.body) {
                    e.preventDefault();
                    video.paused ? video.play().catch(()=>{}) : video.pause();
                }
                break;
            case 'KeyM':
                // YouTube handles M natively (mute). Only act on mobile fallback.
                if (location.hostname === 'm.youtube.com') {
                    video.muted = !video.muted;
                }
                break;
            case 'ArrowRight':
                // YouTube natively seeks; only act on mobile
                if (location.hostname === 'm.youtube.com') {
                    video.currentTime += 10;
                }
                break;
            case 'ArrowLeft':
                if (location.hostname === 'm.youtube.com') {
                    video.currentTime -= 10;
                }
                break;
        }
    });

    window.addEventListener('click', function (e) {
        // Desktop YouTube toggles play/pause natively on video click.
        // Only handle mobile fallback.
        if (location.hostname !== 'm.youtube.com') return;
        const video = getVideo();
        if (!video) return;
        if (e.target.tagName.toLowerCase() === 'video') {
            video.paused ? video.play().catch(()=>{}) : video.pause();
        }
    });

    console.log('[YT] OVERLAY BYPASS ENABLED');
})();