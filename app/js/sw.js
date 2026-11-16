/* MV3 service worker. Stateless by design (Chrome stops it after ~30 s idle).
 *  - The toolbar button opens Steady's own pages.
 *  - The helper agent's optional AI fallback: for a page the verified playbook doesn't know, it asks Claude for ONE
 *    next action. Input is the MASKED snapshot built by agent-core.maskSnapshot (labels, filled/empty, list options,
 *    errors with numbers removed). No field values, Aadhaar, OTP, names or phone numbers are ever sent.
 *    The answer is untrusted: the content script runs it through agent-core.validateAction before anything happens.
 *  - Only runs if the person (or their helper) has added an API key in the options page and turned the fallback on.
 *
 * Raw fetch instead of the Anthropic SDK: the extension has no build step and no dependencies (it must load
 * unpacked from the folder), and MV3 forbids loading remote code.
 */
const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5-5';

// Toolbar button: on ANY website, it brings up the helper for that tab (activeTab: access to this tab only, and only
// after the click; nothing runs on other sites). On pages where extensions can't run (new tab, chrome://), it opens
// the practice portal instead.
const PORTAL_URL = 'https://steady-helper-alpha.vercel.app/portal/index.html'; // the live practice portal (localhost:8080 also works)
async function attach(tabId) {
  const target = { tabId };
  await chrome.scripting.executeScript({ target, files: ['js/core.js', 'js/bridge.js'] });                 // settings, never the profile
  await chrome.scripting.executeScript({ target, files: ['js/core.js', 'js/adapt.js'], world: 'MAIN' });   // bigger targets, slip guard
  await chrome.scripting.executeScript({ target, files: ['js/core.js', 'js/agent-core.js', 'js/flowmap-portal.js', 'js/model-struggle.js', 'js/agent.js'] });
}
// Don't rely on tab.url (it isn't always filled in): ping the helper, else attach; if Chrome refuses
// (new tab, chrome:// pages, the Web Store, extension pages), open the practice portal instead.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  const r = await chrome.tabs.sendMessage(tab.id, { type: 'steady:show' }).catch(() => null);
  if (r && r.ok) return;
  try { await attach(tab.id); } catch (e) { chrome.tabs.create({ url: PORTAL_URL }); }
});

const ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'elementId', 'value', 'say', 'reason'],
  properties: {
    action: { type: 'string', enum: ['click', 'select', 'fill_from_vault', 'ask_user', 'explain', 'wait', 'handoff', 'done'] },
    elementId: { type: 'string', description: 'The ref of one element from the snapshot, or "" if the action does not touch the page.' },
    value: { type: 'string', description: 'For select: the exact option text. For fill_from_vault: one of state, district, ward, scheme. Otherwise "".' },
    say: { type: 'string', description: 'One short, plain sentence for the person.' },
    reason: { type: 'string', description: 'One short sentence for the activity log, in English.' },
  },
};
const EXPLAIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'explanation', 'next_step'],
  properties: {
    title: { type: 'string' },
    explanation: { type: 'string' },
    next_step: { type: 'string' },
  },
};

const langName = (l) => (l === 'hi' ? 'Hindi (Devanagari script)' : 'simple English');

function planSystem(lang) {
  return `You are the planning step inside an accessibility helper. It guides older people in India, many living with Parkinson's disease or low vision, through websites (often government health portals) one step at a time. The helper knows the verified steps of a few portals; you are asked for every other page. Work towards the person's goal if one is given.

You receive a MASKED description of the current page: element refs and labels, whether each field is filled or empty (never its value), the options of non-private lists, and messages with numbers removed. Choose exactly ONE next action.

What you may do:
- click: a button that moves the task forward on this site (Next, Continue, Search, Try again, OK).
- select: choose an option in a non-private list. value must be the exact option text.
- fill_from_vault: refill a non-private field from the person's saved answers. value must be one of: state, district, ward, scheme.
- handoff with an elementId: a private field the person must fill (Aadhaar, OTP, captcha, name, phone...). The helper opens a large keypad or keyboard for that field. Use this whenever the next step is typing.
- ask_user, explain, wait, done: no page change. Use done when the goal is reached.

What you must never do (the helper also blocks these): act on private fields or buttons. Private means Aadhaar, OTP or codes, captcha, consent, declarations, final submit, payment, and personal details such as name, phone, date of birth and address. For those, use handoff and tell the person, in one sentence, exactly what to do themselves. Never click links that leave the site, or anything that deletes or cancels.

When unsure, prefer ask_user or handoff: doing nothing is better than a wrong action.
"say" is for the person: one short, kind, plain sentence in ${langName(lang)}. "reason" is one short sentence for the activity log, in English. elementId must be a ref from the snapshot, or "" when the action does not touch the page.`;
}

async function callClaude({ apiKey, system, user, schema, maxTokens }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || 16000,
      fallbacks: 'default', // if a safety classifier declines, the API retries on a fallback model inside the same call
      system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}${res.status === 401 ? ' (check the API key)' : res.status === 429 ? ' (rate limited, try again shortly)' : ''}: ${body.slice(0, 160)}`);
  }
  const msg = await res.json();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this request.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The model ran out of room before answering.');
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

async function getKey() {
  const { 'steady.agent.opts': o } = await chrome.storage.local.get('steady.agent.opts');
  if (!o || !o.apiKey) throw new Error('No API key. Add one in the Steady helper options.');
  return o;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('steady:')) return false;
  (async () => {
    try {
      if (msg.type === 'steady:plan') {
        const o = await getKey();
        if (!o.aiFallback) throw new Error('The AI fallback is turned off.');
        const user = `${msg.goal ? `The person's goal on this page: "${String(msg.goal).slice(0, 200)}"\n\n` : ''}Masked page snapshot:\n${JSON.stringify(msg.snapshot)}\n\nRecent helper actions (most recent last):\n${(msg.history || []).map((h) => '- ' + h).join('\n') || '- none'}\n\nChoose the one next action.`;
        const result = await callClaude({ apiKey: o.apiKey, system: planSystem(msg.lang), user, schema: ACTION_SCHEMA });
        sendResponse({ ok: true, result, model: MODEL });
      } else if (msg.type === 'steady:explain') {
        const o = await getKey();
        if (!o.aiFallback) throw new Error('The AI fallback is turned off.');
        const system = `You explain messages from Indian government health portals to older people. Be kind, short and concrete. Write in ${langName(msg.lang)}. Never ask for or mention Aadhaar digits, OTPs or personal details. If the message is a server problem, say it is not their mistake.`;
        const result = await callClaude({ apiKey: o.apiKey, system, user: `The portal showed this message (numbers removed): "${String(msg.text).slice(0, 400)}"`, schema: EXPLAIN_SCHEMA });
        sendResponse({ ok: true, result });
      } else if (msg.type === 'steady:test') {
        const apiKey = msg.apiKey || (await getKey()).apiKey;
        const result = await callClaude({ apiKey, system: 'Answer with the requested JSON only.', user: 'Return status "ok".', schema: { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string' } } }, maxTokens: 2048 });
        sendResponse({ ok: result.status === 'ok', result });
      } else {
        sendResponse({ ok: false, error: 'unknown message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep the channel open for the async answer
});
