const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const page = read('frontend/pages/autobot.html');
const script = read('frontend/assets/js/autobot.js');
const router = read('frontend/assets/js/router.js');
const app = read('frontend/assets/js/app.js');
const css = read('frontend/assets/css/autobot.css');

assert(page.includes('data-autobot-root'), 'AutoBot page must expose a stable workspace root');
assert(page.includes('data-autobot-loading'), 'AutoBot page must show a dedicated loading state');
assert(page.includes('data-autobot-offline'), 'AutoBot page must provide an offline recovery state');
assert(page.includes('data-autobot-retry') && page.includes('data-autobot-reload'), 'AutoBot page must expose retry and reload actions');
assert(page.includes('target="_blank"') && page.includes('rel="noopener noreferrer"'), 'external AutoBot link must open safely');
assert(/body\[data-page="autobot"\] \.autobot-offline\s*\{[^}]*display:\s*grid;[^}]*grid-auto-flow:\s*row;/s.test(css), 'AutoBot offline state must stack icon, message, and actions vertically');

assert(router.includes("autobot: '/assets/js/autobot.js"), 'router must load the AutoBot workspace module');
assert(router.includes("autobot: ['autobot']"), 'AutoBot route must declare its page module');
assert(app.includes("PMBI.autobot.init"), 'app page initialization must start AutoBot');
assert(app.includes("PMBI.autobot.cleanup"), 'SPA cleanup must stop AutoBot timers');

assert(script.includes("frame.addEventListener('load'"), 'AutoBot module must react to a successful frame load');
assert(script.includes("frame.addEventListener('error'"), 'AutoBot module must react to a frame error');
assert(script.includes('12000'), 'AutoBot module must expose an offline state after a bounded wait');
assert(script.includes("searchParams.set('_pmbi_reload'"), 'reload must bypass a stale iframe response');

assert(css.includes('grid-template-rows: auto minmax(0, 1fr)'), 'workspace must reserve the remaining viewport for AutoBot');
assert(css.includes('position: static !important'), 'CRM topbar must not stay pinned over AutoBot');
assert(css.includes('body[data-page="autobot"].autobot-modal-open .topbar'), 'feature modals must reclaim the CRM topbar space');
assert(css.includes('body[data-page="autobot"].autobot-modal-open .autobot-workspace-head'), 'feature modals must reclaim the workspace heading space');
assert(script.includes("event.data.type !== 'autobot:feature-modal'"), 'AutoBot frame messages must control modal workspace mode');
assert(script.includes("classList.toggle('autobot-modal-open'"), 'modal workspace mode must be reflected on the CRM body');
assert(css.includes('@media (max-width: 720px)'), 'workspace must include a mobile layout');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'workspace must respect reduced-motion preferences');

console.log('autobot_workspace_frontend_ok');
