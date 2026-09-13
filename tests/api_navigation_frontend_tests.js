const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../frontend/assets/js', file), 'utf8');
function functionSource(source, name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0);
  const end = source.indexOf('\n    function ', start + 10);
  return source.slice(start, end);
}
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const response = projects => ({ok: true, json: () => Promise.resolve({projects})});

(async () => {
  const requests = [];
  const context = {
    window: {}, AbortController, console,
    apiInFlight: {}, apiMemoryCache: {}, apiRequestGroups: {},
    cloneApiValue: value => JSON.parse(JSON.stringify(value)),
    authHeaders: () => Promise.resolve({}),
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({url, options, resolve, reject})),
  };
  vm.createContext(context);
  for (const name of ['clearApiCache','abortApiRequests','api']) vm.runInContext(functionSource(read('core.js'), name), context);
  const options = {cacheKey: 'projects', cacheTtl: 60000, requestGroup: 'projects-list'};
  const old = context.api('/api/projects', options);
  const oldResult = old.catch(error => error);
  assert.equal(context.api('/api/projects', options), old, 'Live requests are still deduplicated');
  await settle();
  context.abortApiRequests('projects-list');
  const next = context.api('/api/projects', options);
  assert.notEqual(next, old, 'A new page must not inherit an aborted promise');
  await settle();
  assert.equal(requests.length, 2);
  // Simulate a response body finishing after navigation cancelled the fetch.
  requests[0].resolve(response([{id: 1}]));
  assert.equal((await oldResult).name, 'AbortError');
  assert.equal(context.apiMemoryCache.projects, undefined, 'Cancelled data must not enter the cache');
  assert.equal(context.api('/api/projects', options), next, 'Old cleanup must not discard the replacement request');
  requests[1].resolve(response([{id: 25}]));
  assert.equal((await next).projects[0].id, 25);
  assert.equal((await context.api('/api/projects', options)).projects[0].id, 25);
  assert.equal(requests.length, 2, 'Successful data is still cached');

  const loads = [];
  let callbacks = 0;
  const projectContext = {
    page: 'logs', projectsLoadToken: 0, state: {}, console,
    qs: () => null,
    api: () => new Promise((resolve, reject) => loads.push({resolve,reject})),
  };
  vm.createContext(projectContext);
  vm.runInContext(functionSource(read('app.js'), 'loadProjects'), projectContext);
  const first = projectContext.loadProjects(() => callbacks++);
  const second = projectContext.loadProjects(() => callbacks++);
  loads[1].resolve({projects: [{id: 25}]});
  await second;
  loads[0].reject(Object.assign(new Error('cancelled'), {name: 'AbortError'}));
  await first;
  assert.equal(projectContext.state.projects[0].id, 25);
  assert.equal(projectContext.state.projectsLoaded, true);
  assert.equal(callbacks, 1, 'Only the current page may render after loading');
  console.log('api_navigation_frontend_ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
