import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('routes mount one speech owner and preserve typed fallback', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { location: { search: '' } };
    const { default: App } = await server.ssrLoadModule('/src/App.tsx');
    const workspace = renderToStaticMarkup(createElement(App));
    assert.equal((workspace.match(/class="speech-panel"/g) ?? []).length, 1);
    assert.match(workspace, /Floating voice panel/);
    assert.match(workspace, /Dictation and editing workspace/);
    assert.match(workspace, /Editable transcript/);
    assert.match(workspace, /Speech recognition is unavailable/);
    assert.match(workspace, /Use transcript/);
    assert.match(workspace, /aria-label="Google integration"/);
    assert.match(workspace, /aria-label="Reusable workflows"/);
    assert.match(workspace, /aria-label="Screen context"/);
    globalThis.window.location.search = '?panel';
    const floating = renderToStaticMarkup(createElement(App));
    assert.match(floating, /class="vp-panel"/);
    assert.doesNotMatch(floating, /class="speech-panel"|Dictation and editing workspace|vs-shell/);
  } finally {
    globalThis.window = previousWindow;
    await server.close();
  }
});
