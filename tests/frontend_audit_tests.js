const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreJs = fs.readFileSync(path.join(root, 'frontend/assets/js/core.js'), 'utf8');
const dailyTasksJs = fs.readFileSync(path.join(root, 'frontend/assets/js/daily-tasks.js'), 'utf8');
const planningJs = fs.readFileSync(path.join(root, 'frontend/assets/js/planning.js'), 'utf8');
const procurementJs = fs.readFileSync(path.join(root, 'frontend/assets/js/procurement.js'), 'utf8');
const operationsJs = fs.readFileSync(path.join(root, 'frontend/assets/js/operations.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const frontendJs = [coreJs, dailyTasksJs, planningJs, procurementJs, operationsJs, appJs].join('\n');
const authPy = fs.readFileSync(path.join(root, 'backend/auth.py'), 'utf8');
const serverPy = fs.readFileSync(path.join(root, 'backend/server.py'), 'utf8');
const projectsPy = fs.readFileSync(path.join(root, 'backend/projects.py'), 'utf8');
const communicationsDocsPy = fs.readFileSync(path.join(root, 'backend/communications_docs.py'), 'utf8');
const projectsHtml = fs.readFileSync(path.join(root, 'frontend/pages/projects.html'), 'utf8');
const planningCss = fs.readFileSync(path.join(root, 'frontend/assets/css/planning.css'), 'utf8');

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

test('Logout click is delegated so rerendered topbar buttons keep working', () => {
  assert.match(appJs, /function logoutCurrentUser\(\)/);
  assert.match(appJs, /document\.addEventListener\('click', function \(event\)/);
  assert.match(appJs, /event\.target\.closest\('\[data-logout\]'\)/);
  assert.match(appJs, /document\.documentElement\.dataset\.logoutBound/);
});

test('Logout opens the public welcome only after the session is cleared', () => {
  const logoutStart = appJs.indexOf('function logoutCurrentUser()');
  const logoutEnd = appJs.indexOf('function bindLogoutButtons()', logoutStart);
  assert.ok(logoutStart > -1 && logoutEnd > logoutStart, 'logoutCurrentUser block not found');
  const logoutBlock = appJs.slice(logoutStart, logoutEnd);

  assert.match(logoutBlock, /var publicLandingPath = '\/'/);
  assert.match(logoutBlock, /setRememberSession\(false\)/);
  assert.match(logoutBlock, /clearAutoLoginAttempt\(\)/);
  assert.match(logoutBlock, /api\('\/api\/auth\/logout', \{ method: 'POST' \}\)\.then/);
  assert.match(logoutBlock, /location\.replace\(publicLandingPath\)/);
  assert.match(logoutBlock, /clerk\.signOut\(\{[\s\S]*?redirectUrl: state\.authConfig\.clerkAfterSignOutUrl \|\| publicLandingPath/);
  assert.match(logoutBlock, /\.catch\(showLogoutFailure\)/);
  assert.doesNotMatch(logoutBlock, /\.finally\(/);
  assert.doesNotMatch(logoutBlock, /\/login/);
  assert.match(authPy, /"clerkAfterSignOutUrl": "\/"/);
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

test('Daily task all-user visibility is separate from completion ownership', () => {
  assert.match(serverPy, /is_assignee = int\(row\["user_id"\]\) == int\(user\["id"\]\)/);
  assert.match(serverPy, /if status == "done" and not is_assignee:/);
  assert.match(serverPy, /"error": "not_task_assignee"/);
  assert.doesNotMatch(serverPy, /if not self\.daily_task_manager\(user\):\s*requested_user_id = int\(user\["id"\]\)/);
  assert.match(serverPy, /"createdAt": row\["created_at"\]/);
  assert.match(frontendJs, /function dailyTaskCanComplete\(task\)/);
  assert.match(frontendJs, /data-daily-task-owner-id/);
  assert.match(frontendJs, /function dailyTaskCreatedText\(task\)/);
  assert.match(frontendJs, /Выполнить задачу может только ее исполнитель\./);
});

test('Calendar material quantities render as one calculated value, not glued values', () => {
  const plan = quantityPlanInfo({ plannedQty: 100, unit: '4 м2' });
  const label = `${quantityText(plan.totalQty)} ${plan.unit}`;
  assert.equal(label, '400 м2');
  assert.notEqual(label, '100 400м2');
  assert.match(frontendJs, /materialModalQuantityMeta/);
  assert.match(frontendJs, /quantityText\(plan\.totalQty\) \+ ' ' \+ unit/);
});

test('Project delete success is not reported as an API failure when UI refresh stumbles', () => {
  assert.match(operationsJs, /function removeDeletedProjectFromUi\(projectId\)/);
  assert.match(operationsJs, /Project delete UI refresh failed/);
  assert.match(operationsJs, /removeDeletedProjectFromUi\(projectId\);\s*closeProjectEditCard\(\);\s*showAppNotice\('Объект удален\.', 'success'\);/);
  assert.match(operationsJs, /params\.delete\('openProject'\)/);
});

test('Main admin account is only visible to itself in user directories', () => {
  assert.match(authPy, /def user_is_main_admin_account/);
  assert.match(authPy, /role == "main_admin"/);
  assert.match(serverPy, /def row_is_main_admin_account/);
  assert.match(serverPy, /not row_is_main_admin_account\(row\) or viewer_is_same_user\(row\)/);
  assert.match(serverPy, /def viewer_is_same_user\(row: sqlite3\.Row\) -> bool/);
  assert.match(serverPy, /not user_is_main_admin_account\(row\)[\s\S]+or viewer_is_same_user\(row\)/);
  assert.match(serverPy, /u\.role = 'main_admin'/);
});

test('Project card editing follows project permission, while project delete is admin-only', () => {
  assert.match(appJs, /function canEditProjectFromCard\(\) \{\s*return isAdminRole\(\) \|\| currentPermissions\(\)\.projects === 'edit';/);
  assert.match(appJs, /if \(canEditProjectFromCard\(\)\) menuItems\.push/);
  assert.match(appJs, /var editButton = menuItems\.length/);
  assert.match(coreJs, /function canDeleteProject\(\) \{\s*return isMainAdminRole\(\) \|\| hasRole\('admin'\);/);
  assert.match(operationsJs, /deleteButton\.hidden = !canDeleteProject\(\)/);
  assert.match(operationsJs, /Удалять объект может только Админ\./);
  assert.match(projectsPy, /user = handler\.require_user\(\)[\s\S]+if not can_access_project\(handler, user, project_id\):/);
  assert.match(projectsPy, /if not \(user_is_main_admin\(user\) or user_has_any_role\(user, \{"admin"\}\)\):/);
});

test('Reminder bell loads visible projects before showing what is urgent', () => {
  assert.match(appJs, /state\.reminderProjectsLoading/);
  assert.match(appJs, /api\('\/api\/projects', \{ silentLoader: true \}\)/);
  assert.match(appJs, /document\.documentElement\.dataset\.reminderBellBound/);
  assert.match(appJs, /event\.target\.closest\('\[data-reminder-toggle\]'\)/);
  assert.doesNotMatch(appJs, /button\.addEventListener\('click',[\s\S]{0,300}refreshReminderBell/);
});

test('Project shortages live in the reminder bell instead of a large projects card', () => {
  assert.doesNotMatch(projectsHtml, /data-project-critical-card/);
  assert.match(communicationsDocsPy, /"shortageAlerts": shortage_alerts/);
  assert.match(appJs, /Array\.isArray\(notifications\.shortageAlerts\)/);
  assert.match(appJs, /reminderShortageText\(shortage\)/);
  assert.doesNotMatch(appJs, /items\.slice\(0, 20\)/);
});

test('Employee contacts are visible while team and access mutations stay role-protected', () => {
  assert.match(coreJs, /function canManageTeam\(\) \{\s*return hasRole\('admin'\) \|\| isMainAdminRole\(\);/);
  assert.match(serverPy, /"email": row\["email"\]/);
  assert.match(serverPy, /"phone": row\["phone"\]/);
  assert.match(serverPy, /can_set_project_access = \([\s\S]+user_is_main_admin\(viewer\)[\s\S]+user_has_any_role\(viewer, \{"admin", "director"\}\)/);
  assert.match(serverPy, /action not in \{"set_project_foremen", "set_access"\} and not user_is_main_admin\(viewer\)/);
  assert.doesNotMatch(serverPy, /viewer_roles & \{"admin", "director", "main_admin"\}/);
  assert.match(operationsJs, /var avatarUrl = safeAvatarUrl\(user\.avatarUrl \|\| user\.avatar_url \|\| user\.avatar \|\| ''\);/);
  assert.match(operationsJs, /'<div class="employee-profile-avatar" aria-hidden="true">' \+ avatar \+ '<\/div>'/);
});

test('Production schedule has a project tab, editable cells, and a sticky day table', () => {
  assert.match(projectsHtml, /data-tab="production-schedule"/);
  assert.match(projectsHtml, /data-panel="production-schedule"/);
  assert.match(coreJs, /productionScheduleByProject/);
  assert.match(appJs, /loadSelectedProjectProductionSchedule/);
  assert.match(planningJs, /data-production-cell/);
  assert.match(planningJs, /action: 'set_cell'/);
  assert.match(planningJs, /action: 'recalculate'/);
  assert.match(planningJs, /preserve_manual: true/);
  for (const action of ['add_operation', 'update_operation', 'delete_operation', 'split_operation', 'reorder_operations', 'save_template']) {
    assert.match(planningJs, new RegExp(`['"]${action}['"]`));
  }
  assert.match(planningJs, /operation_id: productionPayloadId\(button\.dataset\.operationId\)/);
  assert.match(planningJs, /data-production-operation-form/);
  assert.match(planningJs, /data-production-operation-row/);
  const payloadBuilder = planningJs.slice(
    planningJs.indexOf('function productionOperationFormPayload'),
    planningJs.indexOf('function productionOperationOrder')
  );
  assert.match(payloadBuilder, /if \(!operationId\)/);
  assert.match(payloadBuilder, /planned_qty: values\.plannedQty/);
  assert.match(payloadBuilder, /values\.plannedQty !== initial\.plannedQty/);
  assert.doesNotMatch(payloadBuilder, /values\.plannedQty == null \? 0/);
  assert.match(payloadBuilder, /values\.durationDays !== initial\.durationDays/);
  assert.match(payloadBuilder, /values\.linkedIds\.join\('\|'\) !== productionSortedLinkIds\(initial\.linkedIds\)\.join\('\|'\)/);
  assert.match(planningJs, /data-production-duration data-project-id/);
  assert.match(planningJs, /data-production-duration-reset/);
  assert.match(planningJs, /data-production-confirm-operation/);
  assert.match(planningJs, /status: 'confirmed'/);
  assert.match(planningJs, /data-production-reset-cells/);
  assert.match(planningJs, /action: 'reset_cells'/);
  assert.match(planningJs, /Связано со сметой/);
  assert.match(planningJs, /Вне сметы/);
  assert.match(planningJs, /Требует проверки/);
  assert.match(planningJs, /data-slot-number/);
  assert.match(planningJs, /data-production-duration-step="-0\.5"/);
  assert.match(planningJs, /data-production-duration-step="0\.5"/);
  assert.match(planningJs, /Объём работ/);
  assert.match(planningCss, /\.production-schedule-table/);
  assert.match(planningCss, /\.production-duration-stepper/);
  assert.match(planningCss, /\.production-operation-drawer/);
  assert.match(planningCss, /\.production-work-row\.production-phase-teal/);
  assert.doesNotMatch(planningCss, /production-phase-(?:amber|yellow)/);
  assert.doesNotMatch(planningCss, /\.production-section-row th\s*\{[^}]*#f1e33b/s);
  assert.match(planningCss, /position: sticky/);
});

test('Visible works register omits graph duration and deadline controls', () => {
  const sectionRowRender = planningJs.slice(
    planningJs.indexOf('function renderSectionScheduleRow'),
    planningJs.indexOf('function renderSectionScheduleForecast')
  );
  const sectionForecastRender = planningJs.slice(
    planningJs.indexOf('function renderSectionScheduleForecast'),
    planningJs.indexOf('function bindSectionScheduleRefresh')
  );
  const visibleWorksRegister = sectionRowRender + sectionForecastRender;
  for (const removedVisibleToken of [
    'data-graph-duration-editor',
    'data-graph-duration-input',
    'data-graph-duration-reset',
    'schedule-work-duration-metrics',
    'Авторасчёт',
    'Длительность',
    'Срок работ',
    'Осталось',
    '\\u0410\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442',
    '\\u0414\\u043b\\u0438\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c',
  ]) {
    assert.equal(
      visibleWorksRegister.includes(removedVisibleToken),
      false,
      `Visible works register still contains removed planning field: ${removedVisibleToken}`,
    );
  }
  const summaryStart = sectionForecastRender.indexOf('works-register-summary');
  const summaryEnd = sectionForecastRender.indexOf('renderPinnedScheduleBrief', summaryStart);
  const summaryBlock = sectionForecastRender.slice(summaryStart, summaryEnd);
  assert.equal((summaryBlock.match(/works-register-summary-item/g) || []).length, 4);
  assert.match(summaryBlock, /<span>Разделов<\/span>[\s\S]*?<span>Работ<\/span>[\s\S]*?<span>Выполнено<\/span>[\s\S]*?<span>Готовность<\/span>/);
  assert.match(appJs, /section-schedule-override/);
  assert.doesNotMatch(planningJs, /<small>Чел\/час<\/small>/);
  assert.match(planningJs, /item\.crewSize/);
});

if (process.exitCode) process.exit(process.exitCode);
