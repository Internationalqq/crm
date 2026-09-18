/* Public marketing interactions use only the examples on this page, never CRM data. */
(() => {
    'use strict';
    document.documentElement.classList.add('js-ready');

    const menuToggle = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('#site-nav');
    if (menuToggle && navigation) {
        menuToggle.hidden = false;
        const closeMenu = () => {
            menuToggle.setAttribute('aria-expanded', 'false');
            navigation.classList.remove('is-open');
        };
        menuToggle.addEventListener('click', () => {
            const open = menuToggle.getAttribute('aria-expanded') !== 'true';
            menuToggle.setAttribute('aria-expanded', String(open));
            navigation.classList.toggle('is-open', open);
        });
        navigation.addEventListener('click', (event) => {
            if (event.target.closest('a')) closeMenu();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
                closeMenu();
                menuToggle.focus();
            }
        });
    }

    const bindTabs = (selector, cycleRegion) => {
        const tabs = Array.from(document.querySelectorAll(selector));
        if (!tabs.length) return;
        let selectedTab, timer, visible = false;
        const preference = cycleRegion ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        const connection = cycleRegion ? window.navigator.connection : null;
        const schedule = () => {
            if (!cycleRegion) return;
            window.clearTimeout(timer);
            if (!visible || document.hidden || preference.matches || connection?.saveData) return;
            timer = window.setTimeout(() => activate(tabs[(tabs.indexOf(selectedTab) + 1) % tabs.length]), 8000);
        };
        const activate = (tab) => {
            selectedTab = tab;
            tabs.forEach(candidate => {
                const selected = candidate === tab;
                candidate.setAttribute('aria-selected', String(selected));
                candidate.tabIndex = selected ? 0 : -1;
                const panel = document.getElementById(candidate.getAttribute('aria-controls'));
                if (panel) panel.hidden = !selected;
            });
            schedule();
        };
        activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(tab));
            tab.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = tabs.length - 1;
                if (next === undefined) return;
                event.preventDefault();
                activate(tabs[next]);
                tabs[next].focus();
            });
        });
        if (cycleRegion) {
            const observer = new window.IntersectionObserver(entries => {
                visible = entries[0].isIntersecting;
                schedule();
            }, {threshold: 0.15});
            observer.observe(cycleRegion);
            document.addEventListener('visibilitychange', schedule);
            preference.addEventListener('change', schedule);
            connection?.addEventListener('change', schedule);
            window.addEventListener('pagehide', () => { visible = false; schedule(); });
            window.addEventListener('pageshow', () => { observer.unobserve(cycleRegion); observer.observe(cycleRegion); });
        }
    };
    bindTabs('[data-role]', document.querySelector('#demo'));
    bindTabs('[data-plan]');
    bindTabs('[data-future]');
    const planOptions = document.querySelector('.plan-options');
    if (planOptions) planOptions.hidden = false;
    const futureOptions = document.querySelector('.future-options');
    if (futureOptions) futureOptions.hidden = false;
})();
