/**
 * Popup: ask the active tab for a draft, build the protocol envelope, open Whisk preview.
 * Final validation always happens in the Whisk app (lib/extension) — never trust page JS alone.
 */
/* global chrome */

const CAPTURE_TYPE = 'whisk.extension.capture';
const CAPTURE_VERSION = 1;
const FORBIDDEN_SCHEMES = /^(javascript|file|data|http):/i;

const statusEl = document.getElementById('status');
const button = document.getElementById('capture');

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', Boolean(isError));
}

function buildEnvelope(draft) {
  return {
    type: CAPTURE_TYPE,
    version: CAPTURE_VERSION,
    payload: {
      title: draft.title || document.title || 'Untitled recipe',
      sourceUrl: draft.sourceUrl || null,
      sourceName: draft.sourceName || null,
      ingredients: Array.isArray(draft.ingredients) ? draft.ingredients : [],
      instructions: Array.isArray(draft.instructions) ? draft.instructions : [],
      servings: typeof draft.servings === 'number' ? draft.servings : null,
      notes: draft.notes || null,
      sourceEvidence: draft.sourceEvidence || null,
    },
  };
}

function openWhiskPreview(envelope) {
  const encoded = encodeURIComponent(JSON.stringify(envelope));
  // whisk: app scheme (documented) — web/desktop capture route also accepts the same payload.
  const deepLink = `whisk://extension/capture?payload=${encoded}`;
  chrome.tabs.create({ url: deepLink });
}

button.addEventListener('click', async () => {
  button.disabled = true;
  setStatus('Capturing…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('No active tab.', true);
      return;
    }

    if (tab.url && FORBIDDEN_SCHEMES.test(tab.url)) {
      setStatus('This page URL scheme is not allowed.', true);
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title =
          document.querySelector('h1')?.textContent?.trim() ||
          document.title?.trim() ||
          'Untitled recipe';
        const sourceUrl = location.protocol === 'https:' ? location.href : null;
        const text = document.body?.innerText?.slice(0, 4000) || '';
        return {
          title,
          sourceUrl,
          sourceName: location.hostname || null,
          ingredients: [],
          instructions: [],
          servings: null,
          notes: null,
          sourceEvidence: text,
        };
      },
    });

    const envelope = buildEnvelope(result || {});
    if (envelope.payload.sourceUrl && FORBIDDEN_SCHEMES.test(envelope.payload.sourceUrl)) {
      setStatus('Rejected untrusted source URL.', true);
      return;
    }

    chrome.runtime.sendMessage(envelope, () => {
      openWhiskPreview(envelope);
      setStatus('Opened Whisk import preview. Review before saving.');
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Capture failed.', true);
  } finally {
    button.disabled = false;
  }
});
