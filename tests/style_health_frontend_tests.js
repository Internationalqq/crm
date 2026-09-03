const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('frontend/assets/js/style-health.js');
const baseHtml = read('frontend/templates/base.html');
const tokensCss = read('frontend/assets/css/tokens.css');
const shellCss = read('frontend/assets/css/shell.css');

assert.doesNotMatch(source, /location\.(?:reload|assign|replace)\s*\(/);
assert.match(source, /autoRetryUsed/);
assert.match(source, /Оформление загрузилось не полностью/);
assert.match(source, /aria-live/);
assert.match(source, /data-pmbi-style-retry/);
assert.match(tokensCss, /--pmbi-style-tokens-ready:\s*1/);
assert.match(shellCss, /--pmbi-style-shell-ready:\s*1/);
assert.match(source, /--pmbi-style-reports-ready/);
assert.match(source, /--pmbi-style-planning-ready/);

const appCssUrl = baseHtml.match(/href="([^"]*\/assets\/app\.css[^"]*)"/)[1];
const routerUrl = baseHtml.match(/src="([^"]*\/assets\/js\/router\.js[^"]*)"/)[1];
const healthUrl = baseHtml.match(/src="([^"]*\/assets\/js\/style-health\.js[^"]*)"/)[1];
assert.equal(appCssUrl, '/assets/app.css?v=20260902-report-ux-r1-production-scroll-wheel-fix-1');
assert.equal(routerUrl, '/assets/js/router.js?v=20260903-report-ux-r1-production-print-pdf-2-production-scroll-wheel-fix-1-autobot-foreman-bridge-1-production-print-scale-1-multi-estimate-bundle-1');
assert.equal(healthUrl, '/assets/js/style-health.js?v=20260902-report-ux-r1');
assert.ok(baseHtml.indexOf(healthUrl) < baseHtml.indexOf(routerUrl), 'style health must load before the router');

function element(tagName) {
    const listeners = Object.create(null);
    return {
        tagName: String(tagName || '').toUpperCase(),
        dataset: {},
        children: [],
        parentNode: null,
        hidden: false,
        disabled: false,
        textContent: '',
        className: '',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        addEventListener(type, listener) { listeners[type] = listener; },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
            child.parentNode = null;
            return child;
        },
        dispatch(type) {
            if (listeners[type]) return listeners[type]({ preventDefault() {} });
            return undefined;
        },
    };
}

function createHarness(options = {}) {
    const probeValues = Object.assign({}, options.probes || {});
    const head = element('head');
    const body = element('body');
    body.dataset.page = options.page || 'projects';
    const documentElement = element('html');
    const document = {
        body,
        head,
        documentElement,
        readyState: 'complete',
        createElement: element,
        querySelectorAll(selector) {
            const match = selector.match(/^link\[data-pmbi-style-retry="([^"]+)"\]$/);
            if (!match) return [];
            return head.children.filter((node) => node.dataset.pmbiStyleRetry === match[1]);
        },
    };
    const windowListeners = Object.create(null);
    const window = {
        __PMBI_STYLE_HEALTH_TEST__: true,
        location: { href: 'https://crm.example/app/projects' },
        getComputedStyle() {
            return {
                getPropertyValue(property) { return probeValues[property] || ''; },
            };
        },
        addEventListener(type, listener) { windowListeners[type] = listener; },
        MutationObserver: function MutationObserver(callback) {
            this.observe = () => { this.callback = callback; };
        },
    };
    window.window = window;
    window.document = document;
    const navigator = { onLine: options.online !== false };
    const addedLinks = [];
    let mode = options.linkMode || 'success';
    head.appendChild = function appendChild(link) {
        link.parentNode = head;
        head.children.push(link);
        addedLinks.push(link);
        queueMicrotask(() => {
            const key = link.dataset.pmbiStyleRetry;
            if (mode === 'success') {
                if (key === 'app') {
                    probeValues['--pmbi-style-tokens-ready'] = '1';
                    probeValues['--pmbi-style-shell-ready'] = '1';
                }
                if (key === 'reports') probeValues['--pmbi-style-reports-ready'] = '1';
                if (key === 'planning') probeValues['--pmbi-style-planning-ready'] = '1';
                if (link.onload) link.onload();
            } else if (link.onerror) {
                link.onerror();
            }
        });
        return link;
    };

    vm.runInNewContext(source, {
        window,
        document,
        navigator,
        MutationObserver: window.MutationObserver,
        URL,
        Date,
        Promise,
        Array,
        setTimeout,
        clearTimeout,
    }, { filename: 'style-health.js' });

    return {
        api: window.PMBIStyleHealth,
        addedLinks,
        body,
        navigator,
        probeValues,
        windowListeners,
        setLinkMode(nextMode) { mode = nextMode; },
        notice() { return body.children.find((node) => node.attributes['data-style-health-notice'] === ''); },
    };
}

(async () => {
    const ready = createHarness({
        probes: {
            '--pmbi-style-tokens-ready': '1',
            '--pmbi-style-shell-ready': '1',
            '--pmbi-style-reports-ready': '1',
            '--pmbi-style-planning-ready': '1',
        },
    });
    assert.equal(await ready.api.checkNow(), true);
    assert.equal(ready.addedLinks.length, 0);

    const recovered = createHarness();
    assert.equal(await recovered.api.checkNow(), true);
    assert.deepEqual(
        recovered.addedLinks.map((link) => link.dataset.pmbiStyleRetry),
        ['app', 'tokens', 'shell', 'reports', 'planning'],
    );
    assert.equal(recovered.api.getState().autoRetryUsed, true);
    assert.equal(recovered.notice(), undefined, 'successful automatic recovery stays silent');

    const failed = createHarness({ linkMode: 'error' });
    assert.equal(await failed.api.checkNow(), false);
    const automaticLinkCount = failed.addedLinks.length;
    assert.equal(automaticLinkCount, 5);
    assert.equal(failed.notice().hidden, false);
    assert.match(failed.notice().children[0].textContent, /Оформление загрузилось не полностью/);
    assert.equal(await failed.api.checkNow(), false);
    assert.equal(failed.addedLinks.length, automaticLinkCount, 'automatic retry must happen at most once');

    failed.setLinkMode('success');
    assert.equal(await failed.api.retryManually(), true);
    assert.equal(failed.addedLinks.length, automaticLinkCount + 5);
    assert.equal(failed.notice().hidden, true);

    const offline = createHarness({ online: false });
    assert.equal(await offline.api.checkNow(), false);
    assert.equal(offline.addedLinks.length, 0);
    assert.match(offline.notice().children[0].textContent, /Нет сети/);
    offline.navigator.onLine = true;
    offline.windowListeners.online();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(offline.addedLinks.length, 5);
    assert.equal(offline.notice().hidden, true);

    console.log('style health frontend tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
