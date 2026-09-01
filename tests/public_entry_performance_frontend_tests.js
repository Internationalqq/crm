const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const welcome = read('frontend/templates/welcome.html');
const login = read('frontend/templates/login.html');
const connectionCss = read('frontend/assets/css/connection-shell.css');
const connectionJs = read('frontend/assets/js/connection-shell.js');

assert.doesNotMatch(welcome, /assets\/app\.css/);
assert.doesNotMatch(login, /assets\/app\.css/);
assert.doesNotMatch(login, /assets\/js\/app\.js/);

[
    'tokens.css',
    'base.css',
    'public-entry.css',
    'connection-shell.css',
].forEach((asset) => assert.match(welcome, new RegExp(asset.replace('.', '\\.'))));

[
    'tokens.css',
    'base.css',
    'shell.css',
    'components.css',
    'ui-system.css',
    'ui-final.css',
    'connection-shell.css',
    'connection-shell.js',
    'core.js',
    'login.js',
].forEach((asset) => assert.match(login, new RegExp(asset.replace('.', '\\.'))));

assert.match(welcome, /data-connection-link/);
assert.match(login, /data-connection-shell[^>]*data-autostart="true"/);
assert.match(connectionCss, /data-state="slow"/);
assert.match(connectionCss, /data-state="offline"/);
assert.match(connectionCss, /data-state="done"/);
assert.match(connectionCss, /prefers-reduced-motion: reduce/);
assert.match(connectionJs, /setTimeout\(function \(\) \{[\s\S]*?dataset\.state !== 'loading'/);
assert.match(connectionJs, /window\.addEventListener\('offline'/);
assert.match(connectionJs, /window\.addEventListener\('online'/);

assert.ok(Buffer.byteLength(connectionCss, 'utf8') < 5 * 1024, 'connection shell CSS must stay below 5 KiB');
assert.ok(Buffer.byteLength(connectionJs, 'utf8') < 4 * 1024, 'connection shell JS must stay below 4 KiB');

const logo = fs.readFileSync(path.join(root, 'frontend/assets/logo.png'));
assert.equal(logo.toString('ascii', 1, 4), 'PNG');
assert.equal(logo.readUInt32BE(16), 192);
assert.equal(logo.readUInt32BE(20), 192);
assert.ok(logo.length < 32 * 1024, 'entry logo must stay below 32 KiB');

console.log('public_entry_performance_frontend_ok');
