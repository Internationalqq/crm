/* Recorded product walkthroughs. No CRM API calls or customer data. */
(() => {
    'use strict';
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const compact = window.matchMedia('(max-width: 600px)');
    const wide = window.matchMedia('(min-width: 1101px)');
    const dialog = document.querySelector('.tour-dialog');
    const players = [];
    let expanded = null;
    let expandedGuide = null;
    let expandedVersion = 0;
    let returnFocus = null;
    const automatic = () => !preference.matches && !connection?.saveData;
    const reflectMotion = () => document.body.classList.toggle('motion-ready', automatic());

    document.querySelectorAll('[data-tour]').forEach(root => {
        const tabs = Array.from(root.querySelectorAll('[data-tour-tab]'));
        const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
        const videos = panels.map(panel => panel.querySelector('video'));
        const guides = panels.map((panel, index) => window.PMBITourGuide?.create({
            video: videos[index], screen: panel.querySelector('.tour-screen'),
            title: panel.querySelector('h3'), description: panel.querySelector('.tour-route'),
            host: panel.querySelector('.tour-caption')
        }));
        const expand = root.querySelector('[data-tour-expand]');
        const orient = () => root.querySelector('.tour-tabs').setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
        orient();
        wide.addEventListener('change', orient);
        const denied = new WeakSet();
        const pending = new WeakSet();
        let selected = 0;
        let visible = false;
        const canPlay = () => visible && !document.hidden && automatic() && !dialog?.open;
        const poster = video => {
            video.closest('.tour-screen').classList.remove('is-playing');
            guides[videos.indexOf(video)]?.hide();
        };
        const sync = () => {
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
                if (!video.paused || pending.has(video)) return;
                pending.add(video);
                video.muted = true;
                video.playbackRate = 0.85;
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
                    guides[index]?.show();
                }
            });
            video.addEventListener('timeupdate', () => {
                if (index === selected && video.duration) tabs[index].style.setProperty('--tour-progress', String(video.currentTime / video.duration));
            });
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
        if (expand && dialog?.showModal) {
            expand.hidden = false;
            expand.addEventListener('click', () => {
                expanded = {panel: panels[selected], video: videos[selected], title: guides[selected]?.title || panels[selected].querySelector('h3').textContent};
                returnFocus = expand;
                document.querySelector('#tour-dialog-title').textContent = expanded.title;
                dialog.showModal();
                document.body.classList.add('tour-is-expanded');
                renderExpanded();
                players.forEach(player => player.sync());
            });
        }
        players.push({sync});
        sync();
    });

    function renderExpanded() {
        if (!expanded || !dialog.open) return;
        const version = ++expandedVersion;
        expandedGuide?.destroy();
        expandedGuide = null;
        const guideHost = dialog.querySelector('.tour-dialog-guide');
        guideHost.hidden = true;
        guideHost.replaceChildren();
        const container = dialog.querySelector('.tour-dialog-media');
        container.querySelector('video')?.pause();
        const original = expanded.panel.querySelector('.tour-screen img');
        const image = original.cloneNode();
        image.src = (compact.matches ? original.dataset.fullMobile : original.dataset.full) || original.currentSrc || original.src;
        image.loading = 'eager';
        container.replaceChildren(image);
        if (!automatic() || document.hidden) return;
        const video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.playbackRate = 0.85;
        video.playsInline = true;
        video.setAttribute('aria-label', expanded.video.getAttribute('aria-label'));
        video.src = compact.matches ? expanded.video.dataset.mobile : expanded.video.dataset.src;
        if (window.PMBITourGuide) {
            const copy = document.createElement('div'), title = document.createElement('h3'), description = document.createElement('p');
            description.className = 'tour-route';
            copy.append(title, description); guideHost.append(copy);
            expandedGuide = window.PMBITourGuide.create({video, screen: container, title, description, host: guideHost});
        }
        const guide = expandedGuide;
        video.addEventListener('playing', () => {
            if (version !== expandedVersion) return;
            image.hidden = true; video.classList.add('is-playing');
            guideHost.hidden = !guide; guide?.show();
        });
        const failed = () => {
            if (version !== expandedVersion) return;
            image.hidden = false; video.remove(); guide?.hide(); guideHost.hidden = true;
        };
        video.addEventListener('error', failed);
        container.append(video);
        video.play().catch(failed);
    }
    dialog?.querySelector('[data-tour-close]').addEventListener('click', () => dialog.close());
    dialog?.addEventListener('close', () => {
        expandedVersion++;
        dialog.querySelector('video')?.pause();
        expandedGuide?.destroy(); expandedGuide = null;
        dialog.querySelector('.tour-dialog-guide').replaceChildren();
        dialog.querySelector('.tour-dialog-media').replaceChildren();
        document.body.classList.remove('tour-is-expanded');
        expanded = null;
        players.forEach(player => player.sync());
        returnFocus?.focus({preventScroll: true});
    });
    const preferenceChanged = () => {
        reflectMotion();
        players.forEach(player => player.sync());
        renderExpanded();
    };
    preference.addEventListener('change', preferenceChanged);
    compact.addEventListener('change', preferenceChanged);
    connection?.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', preferenceChanged);
    reflectMotion();
})();
