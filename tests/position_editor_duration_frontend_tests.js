const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('frontend/assets/js/app.js');
const planning = read('frontend/assets/js/planning.js');
const css = read('frontend/assets/css/position-editor.css');

const rowRender = planning.slice(
  planning.indexOf('function renderSectionScheduleRow'),
  planning.indexOf('function renderSectionScheduleForecast'),
);
assert.match(rowRender, /data-position-auto-days=/);
assert.match(rowRender, /data-position-duration-days=/);
assert.match(rowRender, /data-position-duration-overridden=/);
assert.doesNotMatch(rowRender, /data-graph-duration-|schedule-work-duration-metrics|Авторасчёт|Длительность/);

const editor = app.slice(
  app.indexOf('function positionEditorItemFromRow'),
  app.indexOf('var positionHighlightTimer'),
);
assert.match(editor, /data-position-duration-panel hidden/);
assert.match(editor, /data-position-duration-step="-0\.5"/);
assert.match(editor, /name="schedule_duration_days"[^>]*step="0\.5"/);
assert.match(editor, /data-position-duration-step="0\.5"/);
assert.match(editor, /data-position-duration-auto>Авто/);
assert.match(editor, /item\.kind === 'work' && selectedKind === 'work'/);
assert.match(editor, /\/section-schedule-override/);
assert.match(editor, /item_id: item\.itemId, duration_days: durationDays/);
assert.match(editor, /item_id: item\.itemId, reset: true/);
assert.match(editor, /showAppNotice\(message, 'error'\)/);

const estimateStart = editor.indexOf("api('/api/projects/' + item.projectId + '/estimate-items/'");
const estimateEnd = editor.indexOf('}).then(function (response)', estimateStart);
assert.ok(estimateStart >= 0 && estimateEnd > estimateStart);
assert.doesNotMatch(editor.slice(estimateStart, estimateEnd), /duration_days|schedule_duration_days|section-schedule-override/);

assert.match(css, /\.position-editor-duration-stepper/);
assert.match(css, /\.position-editor-duration-auto/);
assert.match(css, /\.position-editor-duration\[hidden\]/);

console.log('position_editor_duration_frontend_ok');
