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

})();
