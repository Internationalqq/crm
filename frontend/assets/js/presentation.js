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

    const bindTabs = (selector) => {
        const tabs = Array.from(document.querySelectorAll(selector));
        if (!tabs.length) return;
        const activate = (tab) => {
            tabs.forEach(candidate => {
                const selected = candidate === tab;
                candidate.setAttribute('aria-selected', String(selected));
                candidate.tabIndex = selected ? 0 : -1;
                const panel = document.getElementById(candidate.getAttribute('aria-controls'));
                if (panel) panel.hidden = !selected;
            });
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
    };
    bindTabs('[data-role]');
    bindTabs('[data-plan]');
    const planOptions = document.querySelector('.plan-options');
    if (planOptions) planOptions.hidden = false;
})();
