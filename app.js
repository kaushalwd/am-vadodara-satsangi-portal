const GOOGLE_CLIENT_ID = '551160151706-1edi6o2p7m6nb837nb5cdab7d7c27gve.apps.googleusercontent.com';
const APPS_SCRIPT_WEB_URL = 'https://script.google.com/macros/s/AKfycbxd9I_IaV91DdELhtstW9vU9JH91vTYxdddu52TN4c08dZp9tL_s57DQrMAkbG-4uVM/exec';

let directoryRecords = [];

window.addEventListener('load', initializeSignIn);

function initializeSignIn() {
  const notice = document.getElementById('loginNotice');

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('PASTE_')) {
    setNotice('Set the Google Web client ID in app.js before publishing the site.', 'error');
    return;
  }

  if (!APPS_SCRIPT_WEB_URL || APPS_SCRIPT_WEB_URL.includes('PASTE_')) {
    setNotice('Set the Apps Script web app URL in app.js before publishing the site.', 'error');
    return;
  }

  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential
    });

    google.accounts.id.renderButton(document.getElementById('signInButton'), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      width: 280
    });

    setNotice('Sign in with the Google account approved by the portal administrator.');
  } else {
    setNotice('Google sign-in library is still loading. Please refresh in a moment.', 'error');
  }
}

function handleGoogleCredential(response) {
  setNotice('Verifying your account…');

  fetch(APPS_SCRIPT_WEB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'idToken=' + encodeURIComponent(response.credential)
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || 'Sign-in failed. Please try again.');
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('The server returned an invalid response.');
      }

      if (!payload || !Array.isArray(payload.records)) {
        throw new Error('Unable to load member directory data.');
      }

      showDirectory(payload);
    })
    .catch((error) => {
      setNotice(error && error.message ? error.message : 'Sign-in failed. Please try again.', 'error');
    });
}

function showDirectory(result) {
  directoryRecords = Array.isArray(result.records) ? result.records : [];
  document.getElementById('loginPanel').hidden = true;
  document.getElementById('directoryPanel').hidden = false;
  renderPeople(directoryRecords);
  document.getElementById('searchInput').focus();
}

function setNotice(message, kind) {
  const notice = document.getElementById('loginNotice');
  notice.textContent = message;
  notice.className = 'notice' + (kind ? ' ' + kind : '');
}

document.getElementById('searchInput').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  const filtered = directoryRecords.filter((person) => person.name.toLowerCase().includes(query));
  renderPeople(filtered);
});

function renderPeople(people) {
  const list = document.getElementById('peopleList');
  list.replaceChildren();
  document.getElementById('resultCount').textContent = people.length + (people.length === 1 ? ' person' : ' people');

  if (!people.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No matching names found.';
    list.appendChild(empty);
    return;
  }

  people.forEach((person) => list.appendChild(createPersonCard(person)));
}

function createPersonCard(person) {
  const card = document.createElement('article');
  card.className = 'person';

  const name = document.createElement('h2');
  name.textContent = person.name;
  card.appendChild(name);

  if (person.address) {
    const address = document.createElement('p');
    address.className = 'person-address';
    address.textContent = person.address;
    card.appendChild(address);
  }

  if (person.mobile) {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const digits = person.mobile.replace(/[^\d+]/g, '');

    const callLink = document.createElement('a');
    callLink.className = 'action call';
    callLink.href = 'tel:' + digits;
    callLink.textContent = '📞 Call';
    actions.appendChild(callLink);

    const whatsappNumber = person.mobile.replace(/\D/g, '');
    const internationalNumber = whatsappNumber.length === 10 ? '91' + whatsappNumber : whatsappNumber;
    if (internationalNumber) {
      const whatsapp = document.createElement('a');
      whatsapp.className = 'action';
      whatsapp.href = 'https://wa.me/' + internationalNumber;
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener noreferrer';
      whatsapp.textContent = '💬 WhatsApp';
      actions.appendChild(whatsapp);
    }

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'action save';
    save.textContent = '💾 Save contact';
    save.addEventListener('click', () => downloadVCard(person.name, person.mobile));
    actions.appendChild(save);

    card.appendChild(actions);
  } else {
    const missing = document.createElement('p');
    missing.className = 'muted';
    missing.textContent = 'No phone number listed.';
    card.appendChild(missing);
  }

  return card;
}

function downloadVCard(name, mobile) {
  const escapeVCard = (value) => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

  const contents = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + escapeVCard(name),
    'TEL;TYPE=CELL:' + escapeVCard(mobile),
    'END:VCARD'
  ].join('\r\n');

  const file = new Blob([contents], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.vcf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
