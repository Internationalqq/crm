const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Feature behavior belongs in the calling suite. Asset checks only enforce
// a real local resource with a nonempty cache version, not past release names.
function assertVersionedAsset(source, assetPath) {
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = assetPath.startsWith('css/') ? '(?:/assets/|\\./)' : '/assets/';
    const match = source.match(new RegExp(prefix + escape(assetPath) + '\\?v=([^\\s"\'<>\\)]+)'));
    assert.ok(match && match[1], `${assetPath} must have a versioned local reference`);
    assert.ok(fs.statSync(path.join(__dirname, '../frontend/assets', assetPath)).isFile(), `${assetPath} must exist`);
    return match[0];
}

module.exports = { assertVersionedAsset };
