/* An illustrative walkthrough. These controls never upload files or write to CRM. */
(() => {
    'use strict';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const automatic = () => !reduced.matches && !connection?.saveData;
    const demo = document.querySelector('.bot-demo');
    const setMotion = () => document.body.classList.toggle('motion-ready', automatic());
    setMotion();
    reduced.addEventListener('change', setMotion);
    connection?.addEventListener('change', setMotion);
    if (!demo) return;

    const tablist = demo.querySelector('.bot-stage-tabs');
    const tabs = Array.from(demo.querySelectorAll('[data-bot-step]'));
    const panels = Array.from(demo.querySelectorAll('.bot-panel'));
    const disclosure = demo.querySelector('.bot-source-detail');
    const duration = 6500;
    let stage = 0;
    let elapsed = 0;
    let previous = 0;
    let frame = 0;
    let inView = false;
    let sourceShown = false;
    const shouldRun = () => inView && !document.hidden && automatic();

    const render = () => {
        const focusedPanel = panels.find(panel => panel.contains(document.activeElement));
        demo.dataset.botStage = String(stage);
        demo.style.setProperty('--bot-progress', automatic() ? '0' : '1');
        tabs.forEach((tab, index) => {
            tab.setAttribute('aria-selected', String(index === stage));
            tab.tabIndex = index === stage ? 0 : -1;
            panels[index].hidden = index !== stage;
        });
        if (focusedPanel && focusedPanel !== panels[stage]) panels[stage].focus({preventScroll: true});
        disclosure.open = false;
        sourceShown = false;
    };
    const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
        demo.classList.remove('bot-running');
    };
    const tick = timestamp => {
        if (!shouldRun()) { stop(); return; }
        if (previous) elapsed += Math.min(timestamp - previous, 100);
        previous = timestamp;
        if (stage === 2 && elapsed > 1250 && !sourceShown) {
            disclosure.open = true;
            sourceShown = true;
        }
        if (elapsed >= duration) {
            stage = (stage + 1) % panels.length;
            elapsed = 0;
            render();
        }
        demo.style.setProperty('--bot-progress', String(elapsed / duration));
        frame = requestAnimationFrame(tick);
    };
    const sync = () => {
        demo.dataset.botMotion = automatic() ? 'automatic' : 'static';
        if (!shouldRun()) stop();
        else if (!frame) {
            previous = 0;
            demo.classList.add('bot-running');
            frame = requestAnimationFrame(tick);
        }
        if (!automatic()) demo.style.setProperty('--bot-progress', '1');
    };
    const choose = (index, focus) => {
        stage = index;
        elapsed = 0;
        previous = 0;
        render();
        sync();
        if (focus) tabs[stage].focus();
    };
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => choose(index, false));
        tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            choose(next, true);
        });
    });
    demo.querySelectorAll('[data-bot-next]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', () => choose(Number(button.dataset.botNext), false));
        const cursor = document.createElement('span');
        cursor.className = 'bot-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursor.innerHTML = '<svg viewBox="0 0 28 34"><path d="M3 2v25l7-6 5 10 5-3-5-10 9-1z"/></svg>';
        button.parentElement.append(cursor);
    });
    // A visitor's disclosure choice takes precedence for the rest of this stage.
    disclosure.querySelector('summary').addEventListener('click', () => { sourceShown = true; });
    render();
    tablist.hidden = false;
    demo.classList.add('bot-enhanced');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            sync();
        }, {threshold: 0.15});
        observer.observe(demo.querySelector('.bot-panels'));
    } else {
        inView = true;
        sync();
    }
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    connection?.addEventListener('change', sync);
})();
