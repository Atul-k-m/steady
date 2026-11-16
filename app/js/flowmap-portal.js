/* Flow map: the agent's verified playbook for one portal.
 * A flow map describes each step of a portal: which fields it has, which are private, and which button moves on.
 * The agent follows it step by step, and the language model is used only when a page is not in the map.
 * Drafted with tools/flowmap-draft.mjs, then checked by a person against the live page: see `verified`.
 *
 * Task kinds:
 *   fill    a typed field. privacy 'personal' | 'aadhaar': the person types it in the helper's keypad, or it is refilled
 *           from the on-device vault after a session reset (Aadhaar only if they agreed to keep it).
 *   choose  a select. Non-private: filled from a saved answer, or the person picks from a big list. Safe for the agent.
 *   pick    a fixed radio choice the flow requires (safe).
 *   captcha the person types it (never solved by the helper). otp: the person types the code.
 *   consent the person agrees; only then does the helper tick the box.
 *   photo   camera helper (auto-capture when steady) or the practice photo.
 *   review  read back, then the person presses Submit.
 *   click   a safe button that moves to the next step.
 */
(function (root) {
  const S = (root.Steady = root.Steady || {});
  S.FLOWMAPS = S.FLOWMAPS || {};
  const L = (en, hi) => ({ en, hi });

  S.FLOWMAPS['portal-practice'] = {
    id: 'portal-practice',
    version: '1.0.0',
    verified: { by: 'STEADY team (manual check against the practice portal)', date: '2026-11-16' },
    matches: (loc) => /\/portal\/(index\.html)?$/.test(loc.pathname),
    stepOf: (doc) => doc.body && doc.body.dataset.step,
    errorSelector: '#error-msg',
    sessionModal: '#session-modal', sessionOk: '#session-ok',
    order: ['login', 'otp', 'search', 'ekyc', 'ekyc-otp', 'details', 'photo', 'review', 'done'],
    steps: {
      login: {
        title: L('Log in', 'लॉग इन'),
        tasks: [
          { kind: 'fill', field: '#mobile', vaultKey: 'mobile', input: 'digits', len: 10, privacy: 'personal', title: L('Type the mobile number', 'मोबाइल नंबर लिखें') },
          { kind: 'captcha', img: '#captcha-img', field: '#captcha-input', refresh: '#captcha-refresh' },
          { kind: 'click', target: '#btn-get-otp', label: L('Get OTP', 'OTP पाएँ') },
        ],
      },
      otp: {
        title: L('Login code', 'लॉग इन कोड'),
        tasks: [
          { kind: 'otp', field: '#otp-input', timer: '#otp-timer', resend: '#otp-resend', sentTo: '#otp-sent-to', to: 'login' },
          { kind: 'click', target: '#btn-verify-otp', label: L('Verify', 'सत्यापित करें') },
        ],
      },
      search: {
        title: L('Find the person', 'व्यक्ति खोजें'),
        tasks: [
          { kind: 'pick', target: '#scheme-senior', vaultKey: 'scheme', value: 'senior', label: L('Senior citizen 70+ card', 'वरिष्ठ नागरिक 70+ कार्ड') },
          { kind: 'fill', field: '#aadhaar-input', vaultKey: 'aadhaar', input: 'digits', len: 12, privacy: 'aadhaar', title: L('Type the Aadhaar number', 'आधार नंबर लिखें') },
          { kind: 'captcha', img: '#captcha2-img', field: '#captcha2-input', refresh: '#captcha2-refresh' },
          { kind: 'click', target: '#btn-search', label: L('Search', 'खोजें'), retryable: true },
          { kind: 'click', target: '#btn-proceed-ekyc', label: L('Proceed to e-KYC', 'e-KYC पर आगे बढ़ें'), when: '#search-result:not([hidden])' },
        ],
      },
      ekyc: {
        title: L('Permission for Aadhaar check', 'आधार जाँच की अनुमति'),
        tasks: [
          { kind: 'consent', field: '#consent-check', then: '#btn-send-aadhaar-otp' },
        ],
      },
      'ekyc-otp': {
        title: L('Aadhaar code', 'आधार कोड'),
        tasks: [
          { kind: 'otp', field: '#aotp-input', timer: '#aotp-timer', resend: '#aotp-resend', sentTo: '#aotp-sent-to', to: 'helper' },
          { kind: 'click', target: '#btn-verify-aotp', label: L('Verify', 'सत्यापित करें') },
        ],
      },
      details: {
        title: L('Address details', 'पते की जानकारी'),
        tasks: [
          { kind: 'fill', field: '#d-mobile', vaultKey: 'mobile', input: 'digits', len: 10, privacy: 'personal', title: L('Type the mobile number', 'मोबाइल नंबर लिखें'), prefilled: true },
          { kind: 'choose', field: '#d-state', vaultKey: 'state', what: L('the state', 'राज्य') },
          { kind: 'choose', field: '#d-district', vaultKey: 'district', what: L('the district', 'ज़िला') },
          { kind: 'choose', field: '#d-ward', vaultKey: 'ward', what: L('the ward or village', 'वार्ड या गाँव') },
          { kind: 'fill', field: '#d-address', vaultKey: 'address', input: 'text', privacy: 'personal', title: L('Type the house address', 'घर का पता लिखें') },
          { kind: 'click', target: '#btn-save-details', label: L('Save & Continue', 'सहेजें और आगे बढ़ें') },
        ],
      },
      photo: {
        title: L('Photo', 'फ़ोटो'),
        tasks: [
          { kind: 'photo', input: '#photo-input', sample: '#btn-sample-photo', preview: '#photo-preview' },
          { kind: 'click', target: '#btn-upload-photo', label: L('Upload Photo', 'फ़ोटो अपलोड करें'), retryable: true },
        ],
      },
      review: {
        title: L('Check and submit', 'जाँचें और जमा करें'),
        tasks: [
          { kind: 'review', summary: '#review-summary', declare: '#declare-check', submit: '#btn-submit' },
        ],
      },
      done: {
        title: L('Sent', 'भेज दिया'),
        tasks: [{ kind: 'finish', ref: '#ref-no' }],
      },
    },
    errors: [
      { match: 'Server not responding', kind: 'server', recover: 'retry',
        title: L('The portal is busy', 'पोर्टल व्यस्त है'),
        explain: L('The government server did not answer. This is not your mistake.', 'सरकारी सर्वर ने जवाब नहीं दिया। यह आपकी गलती नहीं है।'),
        next: L('I will try again in a moment.', 'मैं थोड़ी देर में फिर से कोशिश करूँगा।') },
      { match: 'Upload failed', kind: 'server', recover: 'retry',
        title: L('The photo did not upload', 'फ़ोटो अपलोड नहीं हुई'),
        explain: L('The upload failed on the portal’s side. Your photo is fine.', 'अपलोड पोर्टल की तरफ से विफल हुआ। आपकी फ़ोटो ठीक है।'),
        next: L('I will try the upload again.', 'मैं फिर से अपलोड करूँगा।') },
      { match: 'Invalid Captcha', kind: 'captcha', recover: 'captcha',
        title: L('The letters did not match', 'अक्षर मेल नहीं खाए'),
        explain: L('The security letters were not accepted. That happens often; they are hard to read.', 'सुरक्षा अक्षर स्वीकार नहीं हुए। ऐसा अक्सर होता है; इन्हें पढ़ना मुश्किल है।'),
        next: L('Here is the new picture. Type the letters again.', 'यह नया चित्र है। अक्षर फिर से लिखें।') },
      { match: 'OTP has expired', kind: 'otp-expired', recover: 'resend',
        title: L('The code ran out of time', 'कोड का समय खत्म हो गया'),
        explain: L('Codes only work for 2 minutes.', 'कोड केवल 2 मिनट तक काम करते हैं।'),
        next: L('I asked for a new code. Type the new one.', 'मैंने नया कोड माँगा है। नया कोड लिखें।') },
      { match: 'Invalid OTP', kind: 'otp', recover: 'otp',
        title: L('The code did not match', 'कोड मेल नहीं खाया'),
        explain: L('The code was not accepted. Check the newest message: an older code no longer works.', 'कोड स्वीकार नहीं हुआ। सबसे नया संदेश देखें: पुराना कोड काम नहीं करता।'),
        next: L('Type the code again.', 'कोड फिर से लिखें।') },
      { match: 'No beneficiary found', kind: 'no-record', recover: 'stop',
        title: L('No record found for this Aadhaar', 'इस आधार के लिए कोई रिकॉर्ड नहीं मिला'),
        explain: L('The portal could not find this person in its list. This is a gap in the government records, not something the helper can fix.', 'पोर्टल को अपनी सूची में यह व्यक्ति नहीं मिला। यह सरकारी रिकॉर्ड की कमी है, सहायक इसे ठीक नहीं कर सकता।'),
        next: L('Check that the Aadhaar number is right. If it is, visit the help desk at an empanelled hospital or a Common Service Centre (CSC) with the Aadhaar card.', 'जाँचें कि आधार नंबर सही है। अगर सही है, तो आधार कार्ड लेकर किसी सूचीबद्ध अस्पताल के हेल्प डेस्क या कॉमन सर्विस सेंटर (CSC) जाएँ।') },
      { match: 'No PM-JAY record', kind: 'scheme', recover: 'redo',
        title: L('Wrong card type chosen', 'गलत कार्ड प्रकार चुना गया'),
        explain: L('The family card was chosen, but this person should use the 70+ card.', 'परिवार कार्ड चुना गया, लेकिन इस व्यक्ति के लिए 70+ कार्ड है।'),
        next: L('I will choose the 70+ card.', 'मैं 70+ कार्ड चुनूँगा।') },
      { match: 'valid 10-digit mobile', kind: 'mobile', recover: 'refill', field: '#mobile',
        title: L('The mobile number looks wrong', 'मोबाइल नंबर गलत लग रहा है'),
        explain: L('It needs exactly 10 digits.', 'इसमें ठीक 10 अंक होने चाहिए।'),
        next: L('Type the number again.', 'नंबर फिर से लिखें।') },
      { match: 'valid 12-digit Aadhaar', kind: 'aadhaar', recover: 'refill', field: '#aadhaar-input',
        title: L('The Aadhaar number looks wrong', 'आधार नंबर गलत लग रहा है'),
        explain: L('It needs exactly 12 digits.', 'इसमें ठीक 12 अंक होने चाहिए।'),
        next: L('Type the number again.', 'नंबर फिर से लिखें।') },
      { match: 'Please select (State|District|Ward)', kind: 'choose', recover: 'redo',
        title: L('A list was left empty', 'एक सूची खाली रह गई'),
        explain: L('Every list on this page needs a choice.', 'इस पेज की हर सूची में चुनाव ज़रूरी है।'),
        next: L('Let’s choose it.', 'चलिए चुनते हैं।') },
      { match: 'enter address', kind: 'address', recover: 'redo',
        title: L('The address is empty', 'पता खाली है'), explain: L('The portal needs a house address.', 'पोर्टल को घर का पता चाहिए।'), next: L('Let’s type it.', 'चलिए लिखते हैं।') },
      { match: 'choose a photo', kind: 'photo', recover: 'redo',
        title: L('No photo yet', 'अभी फ़ोटो नहीं है'), explain: L('The portal needs a photo first.', 'पोर्टल को पहले फ़ोटो चाहिए।'), next: L('Let’s take it.', 'चलिए फ़ोटो लेते हैं।') },
      { match: 'accept the (consent|declaration)', kind: 'consent', recover: 'redo',
        title: L('Permission needed', 'अनुमति चाहिए'), explain: L('The portal needs your agreement to continue.', 'आगे बढ़ने के लिए पोर्टल को आपकी सहमति चाहिए।'), next: L('Only you can agree.', 'केवल आप सहमति दे सकते हैं।') },
    ],
  };
})(typeof self !== 'undefined' ? self : this);
