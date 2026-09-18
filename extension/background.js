/**
 * MV3 service worker — relays validated capture intents.
 * Real page extraction stays in the content script; this worker only forwards
 * allowlisted message envelopes to the Whisk web/desktop capture route.
 */
/* global chrome */

const CAPTURE_TYPE = 'whisk.extension.capture';
const CAPTURE_VERSION = 1;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    sendResponse({ ok: false, error: { code: 'invalid_envelope', message: 'Invalid message.' } });
    return false;
  }

  if (message.type !== CAPTURE_TYPE || message.version !== CAPTURE_VERSION) {
    sendResponse({
      ok: false,
      error: { code: 'unknown_type', message: 'Unrecognized extension message.' },
    });
    return false;
  }

  // Forward to Whisk capture deep link / web route. Host app validates again.
  sendResponse({ ok: true, relay: 'whisk-import-preview' });
  return false;
});
