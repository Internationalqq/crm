/* Public, illustrative motion only. No CRM requests or user data. */
(() => {
    'use strict';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const automaticMotion = () => !reduced.matches && !connection?.saveData;
    const setControl = (button, playing, label) => {
        button.querySelector('span').textContent = label;
        button.querySelector('use').setAttribute('href', playing ? '#icon-pause' : '#icon-play');
    };
    const watchVisibility = (element, changed) => {
        let visible = false;
        const update = () => changed(visible && !document.hidden);
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => {
                visible = entries[0].isIntersecting;
                update();
            }, { threshold: 0.1 });
            observer.observe(element);
        } else {
            visible = true;
            update();
        }
        document.addEventListener('visibilitychange', update);
    };

    const video = document.querySelector('#construction-film');
    const filmButton = document.querySelector('.film-toggle');
    if (video && filmButton) {
        const frame = video.closest('.hero-film');
        const status = document.querySelector('.film-status');
        let visible = false;
        let intent = null;
        let starting = false;
        let failed = false;
        let firstPaintReady = false;
        const wantsPlayback = () => visible && !failed && (intent ?? automaticMotion()) && (firstPaintReady || intent === true);
        const updateControl = () => setControl(filmButton, !video.paused, video.paused ? 'Включить видео' : 'Пауза видео');
        const sync = () => {
            if (!wantsPlayback()) {
                video.pause();
                updateControl();
                return;
            }
            if (!video.paused || starting) return;
            if (!video.getAttribute('src')) {
                video.src = window.matchMedia('(max-width: 600px)').matches ? video.dataset.mobile : video.dataset.desktop;
                video.muted = true;
            }
            starting = true;
            video.play().then(() => {
                if (!wantsPlayback()) video.pause();
            }).catch(() => {
                // Autoplay may be denied (e.g. low power mode). Keep an explicit play action.
                if (wantsPlayback()) intent = false;
            }).finally(() => {
                starting = false;
                updateControl();
            });
        };
        filmButton.hidden = false;
        filmButton.addEventListener('click', () => {
            intent = video.paused && !starting;
            sync();
        });
        video.addEventListener('loadeddata', () => { if (!failed) frame.classList.add('is-ready'); });
        video.addEventListener('play', updateControl);
        video.addEventListener('pause', updateControl);
        video.addEventListener('error', () => {
            failed = true;
            video.pause();
            frame.classList.remove('is-ready');
            filmButton.hidden = true;
            if (status) status.hidden = false;
        });
        const poster = frame.querySelector('img');
        const posterReady = !poster || poster.complete ? Promise.resolve() : new Promise(resolve => {
            poster.addEventListener('load', resolve, { once: true });
            poster.addEventListener('error', resolve, { once: true });
        });
        // Let the first-screen image and lettering load before decorative video competes for bandwidth.
        Promise.all([posterReady, document.fonts?.ready]).then(() => {
            firstPaintReady = true;
            sync();
        });
        watchVisibility(frame, value => { visible = value; sync(); });
        reduced.addEventListener('change', () => { if (reduced.matches && intent === true) intent = false; sync(); });
        connection?.addEventListener('change', sync);
    }

    const story = document.querySelector('.work-story');
    const storyButton = document.querySelector('.story-toggle');
    if (!story || !storyButton) return;
    const tabs = Array.from(story.querySelectorAll('[data-story-step]'));
    const panels = Array.from(story.querySelectorAll('.story-panel'));
    let index = 0;
    let elapsed = 0;
    let previous = 0;
    let frameId = 0;
    let visible = false;
    let intent = null;
    let finished = false;
    const duration = 6500;
    const wantsPlayback = () => visible && !finished && (intent ?? automaticMotion());
    const updateControl = () => setControl(storyButton, !!frameId, finished ? 'Повторить показ' : frameId ? 'Пауза показа' : 'Включить показ');
    const render = () => {
        story.dataset.scene = String(index);
        tabs.forEach((tab, position) => {
            tab.setAttribute('aria-selected', String(position === index));
            tab.tabIndex = position === index ? 0 : -1;
            panels[position].hidden = position !== index;
        });
        story.style.setProperty('--scene-progress', String(elapsed / duration));
    };
    const stop = () => {
        cancelAnimationFrame(frameId);
        frameId = 0;
        previous = 0;
        updateControl();
    };
    const tick = timestamp => {
        if (!wantsPlayback()) { stop(); return; }
        if (previous) elapsed += Math.min(timestamp - previous, 100);
        previous = timestamp;
        if (elapsed >= duration) {
            if (index === panels.length - 1) {
                finished = true;
                elapsed = duration;
                render();
                stop();
                return;
            }
            index += 1;
            elapsed = 0;
            render();
        }
        story.style.setProperty('--scene-progress', String(elapsed / duration));
        frameId = requestAnimationFrame(tick);
    };
    const sync = () => {
        if (!wantsPlayback()) stop();
        else if (!frameId) {
            previous = 0;
            frameId = requestAnimationFrame(tick);
            updateControl();
        }
    };
    const choose = (position, focus) => {
        intent = false;
        finished = false;
        index = position;
        elapsed = 0;
        stop();
        render();
        if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, position) => {
        tab.addEventListener('click', () => choose(position, false));
        tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (position + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (position + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            choose(next, true);
        });
    });
    storyButton.hidden = false;
    storyButton.addEventListener('click', () => {
        intent = !frameId;
        if (finished) { finished = false; index = 0; elapsed = 0; render(); }
        sync();
    });
    story.classList.add('story-enhanced');
    watchVisibility(story.querySelector('.story-scenes') || story, value => { visible = value; sync(); });
    reduced.addEventListener('change', () => { if (reduced.matches && intent === true) intent = false; sync(); });
    connection?.addEventListener('change', sync);
})();
