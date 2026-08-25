const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const coreJs = read('frontend/assets/js/core.js');
const shellCss = read('frontend/assets/css/shell.css');
const overridesCss = read('frontend/assets/css/overrides.css');
const uiSystemCss = read('frontend/assets/css/ui-system.css');
const appCss = read('frontend/assets/app.css');
const baseHtml = read('frontend/templates/base.html');

function classList(initial) {
  const values = new Set(initial || []);
  return {
    contains(name) {
      return values.has(name);
    },
    remove(name) {
      values.delete(name);
    },
    toggle(name, force) {
      if (arguments.length > 1) {
        if (force) values.add(name);
        else values.delete(name);
        return force;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
  };
}

const sidebarStart = coreJs.indexOf('function isMobileSidebarViewport()');
const sidebarEnd = coreJs.indexOf('function bindSidebarControls()', sidebarStart);
assert.ok(sidebarStart >= 0 && sidebarEnd > sidebarStart, 'sidebar state helpers must exist');
const sidebarSource = coreJs.slice(sidebarStart, sidebarEnd);

const preferenceStart = sidebarSource.indexOf('function applySidebarLayoutPreference()');
const preferenceEnd = sidebarSource.indexOf('function toggleDesktopSidebar()', preferenceStart);
const preferenceSource = sidebarSource.slice(preferenceStart, preferenceEnd);
assert.ok(
  preferenceSource.indexOf("document.body.classList.toggle('sidebar-collapsed'") <
    preferenceSource.indexOf("document.documentElement.classList.remove('sidebar-pref-collapsed')"),
  'the body state must be set before removing the prepaint class',
);

const storage = new Map([['pmbi_sidebar_collapsed', '1']]);
const windowStub = {
  innerWidth: 1280,
  localStorage: {
    getItem(name) {
      return storage.has(name) ? storage.get(name) : null;
    },
    setItem(name, value) {
      storage.set(name, value);
    },
  },
};
const documentStub = {
  body: { classList: classList() },
  documentElement: { classList: classList(['sidebar-pref-collapsed']) },
};

const sidebarApi = new Function(
  'window',
  'document',
  'qsa',
  `${sidebarSource}; return { applySidebarLayoutPreference, toggleDesktopSidebar };`,
)(windowStub, documentStub, () => []);

sidebarApi.applySidebarLayoutPreference();
assert.equal(documentStub.body.classList.contains('sidebar-collapsed'), true);
assert.equal(documentStub.documentElement.classList.contains('sidebar-pref-collapsed'), false);

sidebarApi.toggleDesktopSidebar();
assert.equal(documentStub.body.classList.contains('sidebar-collapsed'), false);
assert.equal(storage.get('pmbi_sidebar_collapsed'), '0');

windowStub.innerWidth = 900;
storage.set('pmbi_sidebar_collapsed', '1');
documentStub.documentElement.classList.toggle('sidebar-pref-collapsed', true);
sidebarApi.applySidebarLayoutPreference();
assert.equal(documentStub.body.classList.contains('sidebar-collapsed'), false);
assert.equal(documentStub.documentElement.classList.contains('sidebar-pref-collapsed'), false);

windowStub.innerWidth = 901;
documentStub.documentElement.classList.toggle('sidebar-pref-collapsed', true);
sidebarApi.applySidebarLayoutPreference();
assert.equal(documentStub.body.classList.contains('sidebar-collapsed'), true);
assert.equal(documentStub.documentElement.classList.contains('sidebar-pref-collapsed'), false);

assert.match(uiSystemCss, /@media \(max-width: 900px\) \{\s*\.app-shell,\s*body\.sidebar-collapsed \.app-shell,/);

const layoutGuardStart = overridesCss.indexOf('Final layout guard: fixed full-height desktop sidebar');
const layoutGuardEnd = overridesCss.indexOf('Calendar/progress final density pass', layoutGuardStart);
const layoutGuard = overridesCss.slice(layoutGuardStart, layoutGuardEnd);
assert.ok(layoutGuardStart >= 0 && layoutGuardEnd > layoutGuardStart, 'final sidebar layout guard must exist');
assert.match(layoutGuard, /@media \(min-width: 901px\)/);
assert.match(layoutGuard, /\.sidebar \{[\s\S]*?width: 224px !important;[\s\S]*?min-width: 0 !important;[\s\S]*?max-width: none !important;[\s\S]*?transform: none !important;[\s\S]*?transition: width \.18s/);
assert.match(layoutGuard, /\.main \{[\s\S]*?width: auto !important;[\s\S]*?max-width: none !important;[\s\S]*?margin-left: 224px !important;[\s\S]*?transition: margin-left \.18s/);
assert.match(layoutGuard, /body\.sidebar-collapsed \.sidebar,[\s\S]*?width: 72px !important;[\s\S]*?min-width: 0 !important;[\s\S]*?max-width: none !important;/);
assert.match(layoutGuard, /body\.sidebar-collapsed \.main,[\s\S]*?margin-left: 72px !important;/);
assert.doesNotMatch(layoutGuard, /transition:[^;]*(?:min-width|max-width)/);
assert.doesNotMatch(layoutGuard, /transition: width \.18s[^;]*!important/);

const motionStart = shellCss.lastIndexOf('.app-shell {');
const motionEnd = shellCss.indexOf('.login-brand', motionStart);
const motionCss = shellCss.slice(motionStart, motionEnd);
assert.ok(motionStart >= 0 && motionEnd > motionStart, 'sidebar motion styles must exist');
assert.match(motionCss, /@media \(min-width: 901px\) \{/);
assert.match(motionCss, /\.sidebar-toggle \{[\s\S]*?position: absolute;[\s\S]*?right: 0;/);
assert.match(motionCss, /\.sidebar-toggle:hover \{\s*transform: none;/);
assert.match(motionCss, /\.sidebar-toggle-lines i:nth-child\(2\) \{[\s\S]*?transform: rotate\(45deg\);/);
assert.match(motionCss, /body\.sidebar-collapsed \.sidebar-toggle-lines i:nth-child\(2\),[\s\S]*?transform: rotate\(225deg\);/);
assert.match(motionCss, /body\.sidebar-collapsed \.sidebar-toggle,[\s\S]*?right: calc\(50% - 18px\);/);
assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.sidebar,[\s\S]*?\.main,[\s\S]*?\.sidebar-toggle,[\s\S]*?transition: none !important;/);
assert.doesNotMatch(shellCss, /sidebar-toggle[^}]*transform:\s*rotate\(180deg\)/);
assert.match(shellCss, /body\.sidebar-collapsed \.brand,[\s\S]*?visibility: hidden;[\s\S]*?transition-delay: 0s, 0s, \.12s;/);

assert.match(appCss, /shell\.css\?v=[^"\n]*sidebar-motion-2/);
assert.match(appCss, /overrides\.css\?v=[^"\n]*sidebar-motion-2/);
assert.match(baseHtml, /app\.css\?v=[^"\n]*sidebar-motion-2/);
assert.match(baseHtml, /core\.js\?v=[^"\n]*sidebar-motion-2/);
assert.match(baseHtml, /matchMedia\('\(min-width: 901px\)'\)\.matches/);

console.log('sidebar_animation_frontend_ok');
