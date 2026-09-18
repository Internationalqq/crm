/* Recorded product walkthroughs. No CRM API calls or customer data. */
(() => {
    'use strict';
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const compact = window.matchMedia('(max-width: 600px)');
    const wide = window.matchMedia('(min-width: 1101px)');
    const players = [];
    const automatic = () => !preference.matches && !connection?.saveData;
    const reflectMotion = () => document.body.classList.toggle('motion-ready', automatic());

    document.querySelectorAll('[data-tour]').forEach(root => {
        const tabs = Array.from(root.querySelectorAll('[data-tour-tab]'));
        const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
        const videos = panels.map(panel => panel.querySelector('video'));
        const orient = () => root.querySelector('.tour-tabs').setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
        orient();
        wide.addEventListener('change', orient);
        const denied = new WeakSet();
        const pending = new WeakSet();
        let selected = 0;
        let visible = false;
        const canPlay = () => visible && !document.hidden && automatic();
        let progressFrame = 0;
        const stopProgress = () => {
            cancelAnimationFrame(progressFrame);
            progressFrame = 0;
        };
        const paintProgress = () => {
            progressFrame = 0;
            const video = videos[selected];
            if (!canPlay() || video.paused || video.ended) return;
            if (Number.isFinite(video.duration) && video.duration > 0) {
                tabs[selected].style.setProperty('--tour-progress', String(Math.min(1, video.currentTime / video.duration)));
            }
            progressFrame = requestAnimationFrame(paintProgress);
        };
        const startProgress = () => {
            stopProgress();
            paintProgress();
        };
        const poster = video => video.closest('.tour-screen').classList.remove('is-playing');
        const sync = () => {
            if (!canPlay()) stopProgress();
            videos.forEach((video, index) => {
                if (index !== selected || !canPlay() || denied.has(video)) {
                    video.pause();
                    if (!automatic()) poster(video);
                    return;
                }
                const source = compact.matches ? (video.dataset.previewMobile || video.dataset.mobile) : (video.dataset.preview || video.dataset.src);
                if (video.getAttribute('src') !== source) {
                    denied.delete(video);
                    video.src = source;
                }
                if (!video.paused) {
                    startProgress();
                    return;
                }
                if (pending.has(video)) return;
                pending.add(video);
                video.muted = true;
                video.play().then(() => {
                    if (videos[selected] !== video || !canPlay()) video.pause();
                }).catch(error => {
                    if (error.name === 'AbortError') return;
                    denied.add(video);
                    poster(video);
                }).finally(() => {
                    pending.delete(video);
                    if (videos[selected] === video && canPlay() && video.paused && !denied.has(video)) sync();
                });
            });
        };
        const activate = index => {
            stopProgress();
            selected = index;
            tabs.forEach((tab, i) => {
                tab.setAttribute('aria-selected', String(i === index));
                tab.tabIndex = i === index ? 0 : -1;
                tab.style.setProperty('--tour-progress', '0');
                panels[i].hidden = i !== index;
                if (i !== index) videos[i].pause();
            });
            const video = videos[index];
            // Keep the selected chapter in the horizontal strip without moving the page.
            if (!wide.matches) {
                const list = root.querySelector('.tour-tabs');
                const tab = tabs[index];
                if (tab.offsetLeft < list.scrollLeft) list.scrollLeft = tab.offsetLeft;
                else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
                    list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth;
                }
            }
            if (video.readyState) video.currentTime = 0;
            poster(video);
            sync();
        };
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(index));
            tab.addEventListener('keydown', event => {
                const key = event.key;
                let next;
                if (key === (wide.matches ? 'ArrowDown' : 'ArrowRight')) next = (index + 1) % tabs.length;
                if (key === (wide.matches ? 'ArrowUp' : 'ArrowLeft')) next = (index + tabs.length - 1) % tabs.length;
                if (key === 'Home') next = 0;
                if (key === 'End') next = tabs.length - 1;
                if (next === undefined) return;
                event.preventDefault();
                activate(next);
                tabs[next].focus();
            });
        });
        videos.forEach((video, index) => {
            video.addEventListener('playing', () => {
                if (index === selected && canPlay()) {
                    video.closest('.tour-screen').classList.add('is-playing');
                    startProgress();
                }
            });
            ['pause', 'waiting', 'ended', 'error'].forEach(event => video.addEventListener(event, () => {
                if (index === selected) stopProgress();
            }));
            video.addEventListener('ended', () => {
                if (index === selected && canPlay()) activate((index + 1) % tabs.length);
            });
            video.addEventListener('error', () => {
                denied.add(video);
                poster(video);
                panels[index].querySelector('.tour-media-status').hidden = false;
            });
        });
        root.classList.add('tour-ready');
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                visible = entries[0].isIntersecting;
                sync();
            }, {threshold: 0.12}).observe(root);
        } else visible = true;
        players.push({sync});
        sync();
    });

    const preferenceChanged = () => {
        reflectMotion();
        players.forEach(player => player.sync());
    };
    preference.addEventListener('change', preferenceChanged);
    compact.addEventListener('change', preferenceChanged);
    connection?.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', preferenceChanged);
    reflectMotion();
})();
