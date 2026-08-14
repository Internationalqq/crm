const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/core.js'), 'utf8');
const dailyTasksJs = fs.readFileSync(path.join(root, 'frontend/assets/daily-tasks.js'), 'utf8');
const planningJs = fs.readFileSync(path.join(root, 'frontend/assets/planning.js'), 'utf8');
const procurementJs = fs.readFileSync(path.join(root, 'frontend/assets/procurement.js'), 'utf8');
const operationsJs = fs.readFileSync(path.join(root, 'frontend/assets/operations.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/app.js'), 'utf8');
const frontendJs = [coreJs, dailyTasksJs, planningJs, procurementJs, operationsJs, appJs].join('\n');
const authPy = fs.readFileSync(path.join(root, 'backend/auth.py'), 'utf8');
const serverPy = fs.readFileSync(path.join(root, 'backend/server.py'), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

function normalizedQuantityNumber(value) {
  const number = Number(String(value == null ? '' : value).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function finalSectionSummaryNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  const rounded = Math.round(number * 10) / 10;
  return Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : String(rounded);
}

function unitTextParts(unit) {
  const raw = String(unit || '').trim();
  const compact = raw.replace(/\s+/g, ' ');
  const numericOnly = compact.match(/^(\d+(?:[\.,]\d+)?)$/);
  if (numericOnly) {
    return { multiplier: normalizedQuantityNumber(numericOnly[1]), unit: 'штук', rawUnit: raw, hasMultiplier: true };
  }
  const withUnit = compact.match(/^(\d+(?:[\.,]\d+)?)\s*(.+)$/);
  if (withUnit) {
    const multiplier = normalizedQuantityNumber(withUnit[1]);
    return {
      multiplier: multiplier > 0 ? multiplier : 1,
      unit: withUnit[2].trim() || 'штук',
      rawUnit: raw,
      hasMultiplier: multiplier > 0 && multiplier !== 1,
    };
  }
  return { multiplier: 1, unit: raw || 'штук', rawUnit: raw, hasMultiplier: false };
}

function quantityPlanInfo(item) {
  const qty = normalizedQuantityNumber(item && (item.plannedQty != null ? item.plannedQty : item.planned_qty));
  const parts = unitTextParts(item && item.unit);
  let normalizedQty = qty;
  if (parts.hasMultiplier && parts.multiplier >= 100 && qty >= parts.multiplier) normalizedQty = qty / parts.multiplier;
  const total = Math.max(0, normalizedQty * (parts.multiplier || 1));
  return { totalQty: total, unit: parts.unit || 'штук' };
}

function quantityText(value) {
  return finalSectionSummaryNumber(Math.max(0, normalizedQuantityNumber(value)));
}

test('Remember Me uses an HttpOnly session cookie and logout deletes server session', () => {
  assert.match(authPy, /SESSION_COOKIE = "pmbi_session"/);
  assert.match(authPy, /HttpOnly; SameSite=Lax/);
  assert.match(authPy, /session_cookie_secure_attr/);
  assert.match(authPy, /DELETE FROM sessions WHERE token_hash = \?/);
  assert.match(authPy, /Max-Age=0; HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(frontendJs, /localStorage\.setItem\([^,\n]*token/i);
});

test('Morning standup is user-scoped and protected from duplicate POST inserts', () => {
  assert.match(frontendJs, /last_standup_date_'\s*\+\s*userId/);
  const canCheckStart = frontendJs.indexOf('function dailyStandupCanCheckNow()');
  const canCheckEnd = frontendJs.indexOf('function markDailyStandupDone', canCheckStart);
  const canCheckBlock = frontendJs.slice(canCheckStart, canCheckEnd);
  assert.doesNotMatch(canCheckBlock, /getItem\('last_standup_date'\)/);
  assert.match(frontendJs, /now\.getHours\(\) < 8/);
  assert.match(serverPy, /BEGIN IMMEDIATE/);
  assert.match(serverPy, /alreadySaved/);
  assert.ok(serverPy.indexOf('SELECT 1 FROM daily_standups') < serverPy.indexOf('INSERT INTO daily_tasks (user_id, text, status, task_date, created_by, created_at, updated_at)'));
});

test('Daily task loads ignore stale responses and checkbox saves are de-duped', () => {
  assert.match(frontendJs, /dailyTasksRequestToken/);
  assert.match(frontendJs, /requestToken !== state\.dailyTasksRequestToken/);
  assert.match(appJs, /progressSyncPending/);
  const bindStart = appJs.indexOf('function bindMaterialManualChecks(projectId)');
  const bindEnd = appJs.indexOf('var baseBindProjectChainActionsFinal', bindStart);
  assert.ok(bindStart > -1 && bindEnd > bindStart, 'bindMaterialManualChecks block not found');
  const bindBlock = appJs.slice(bindStart, bindEnd);
  assert.doesNotMatch(bindBlock, /addEventListener\('change'/);
  assert.equal((appJs.match(/saveManualQuantityCheckbox\(checkbox\)/g) || []).length, 1);
  assert.equal((appJs.match(/^\s*saveManualQuantityCheckbox\(input\)/gm) || []).length, 0);
});

test('Calendar material quantities render as one calculated value, not glued values', () => {
  const plan = quantityPlanInfo({ plannedQty: 100, unit: '4 м2' });
  const label = `${quantityText(plan.totalQty)} ${plan.unit}`;
  assert.equal(label, '400 м2');
  assert.notEqual(label, '100 400м2');
  assert.match(frontendJs, /materialModalQuantityMeta/);
  assert.match(frontendJs, /quantityText\(plan\.totalQty\) \+ ' ' \+ unit/);
});

if (process.exitCode) process.exit(process.exitCode);
