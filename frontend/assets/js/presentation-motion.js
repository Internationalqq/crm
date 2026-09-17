/* Public, illustrative motion only. No CRM requests or user data. */
(() => {
    'use strict';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const automaticMotion = () => !reduced.matches && !connection?.saveData;
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
    if (video) {
        const frame = video.closest('.hero-film');
        const status = document.querySelector('.film-status');
        let visible = !document.hidden;
        let starting = false;
        let failed = false;
        let denied = false;
        let firstPaintReady = false;
        // The film is continuous by the presentation brief; the interactive demo respects reduced motion.
        const wantsPlayback = () => visible && !failed && !denied && !connection?.saveData && firstPaintReady;
        const sync = () => {
            if (!wantsPlayback()) {
                video.pause();
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
                // The poster remains visible when the browser denies autoplay.
                denied = true;
                frame.classList.remove('is-ready');
            }).finally(() => {
                starting = false;
            });
        };
        video.addEventListener('loadeddata', () => { if (!failed && !denied) frame.classList.add('is-ready'); });
        video.addEventListener('error', () => {
            failed = true;
            video.pause();
            frame.classList.remove('is-ready');
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
        document.addEventListener('visibilitychange', () => { visible = !document.hidden; sync(); });
        connection?.addEventListener('change', sync);
    }

    const story = document.querySelector('.work-story');
    if (!story) return;
    const tabs = Array.from(story.querySelectorAll('[data-story-step]'));
    const panels = Array.from(story.querySelectorAll('.story-panel'));
    let index = 0;
    let elapsed = 0;
    let previous = 0;
    let frameId = 0;
    let visible = false;
    const duration = 6500;
    const wantsPlayback = () => visible && automaticMotion();
    const render = () => {
        story.dataset.scene = tabs[index].dataset.storyStep;
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
    };
    const tick = timestamp => {
        if (!wantsPlayback()) { stop(); return; }
        if (previous) elapsed += Math.min(timestamp - previous, 100);
        previous = timestamp;
        if (elapsed >= duration) {
            index = (index + 1) % panels.length;
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
        }
    };
    const choose = (position, focus) => {
        index = position;
        elapsed = 0;
        previous = 0;
        render();
        sync();
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
    render();
    story.classList.add('story-enhanced');
    watchVisibility(story.querySelector('.story-scenes') || story, value => { visible = value; sync(); });
    reduced.addEventListener('change', sync);
    connection?.addEventListener('change', sync);
})();
