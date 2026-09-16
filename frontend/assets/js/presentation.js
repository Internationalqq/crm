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

    const tabs = Array.from(document.querySelectorAll('[data-role]'));
    const activateTab = (tab) => {
        tabs.forEach((candidate) => {
            const selected = candidate === tab;
            candidate.setAttribute('aria-selected', String(selected));
            candidate.tabIndex = selected ? 0 : -1;
            const panel = document.getElementById(candidate.getAttribute('aria-controls'));
            if (panel) panel.hidden = !selected;
        });
    };
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tab));
        tab.addEventListener('keydown', (event) => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            activateTab(tabs[next]);
            tabs[next].focus();
        });
    });

    const plan = document.querySelector('#request-plan');
    const scale = document.querySelector('#request-scale');
    const message = document.querySelector('#request-message');
    const status = document.querySelector('#request-status');
    const copy = document.querySelector('.copy-request');
    if (!plan || !scale || !message || !status || !copy) return;
    const updateMessage = () => {
        message.value = `Здравствуйте! Хочу посмотреть PM.bi. Формат: ${plan.value}. Масштаб: ${scale.value}. Давайте обсудим рабочий сценарий и условия внедрения.`;
        status.textContent = 'Здесь ничего не отправляется автоматически.';
    };
    plan.addEventListener('change', updateMessage);
    scale.addEventListener('change', updateMessage);
    message.addEventListener('input', () => {
        status.textContent = 'Здесь ничего не отправляется автоматически.';
    });
    document.querySelectorAll('[data-plan]').forEach((link) => {
        link.addEventListener('click', () => {
            plan.value = link.dataset.plan;
            updateMessage();
        });
    });
    copy.hidden = false;
    copy.addEventListener('click', async () => {
        try {
            if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard unavailable');
            await navigator.clipboard.writeText(message.value);
            status.textContent = 'Запрос скопирован. Отправьте его человеку, который поделился презентацией.';
        } catch (_) {
            message.focus();
            message.select();
            message.setSelectionRange(0, message.value.length);
            status.textContent = 'Выделили текст запроса. Скопируйте его через меню устройства или Ctrl+C и отправьте своему контакту.';
        }
    });
})();
