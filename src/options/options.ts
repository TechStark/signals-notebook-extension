import { getConfig, setConfig } from '@shared/config';

const app = document.getElementById('app');
if (!app) throw new Error('options root element not found');

const form = document.createElement('form');

const label = document.createElement('label');
label.textContent = 'Signals Notebook URL';
form.appendChild(label);

const input = document.createElement('input');
input.type = 'url';
input.placeholder = 'https://my-instance.signalsnotebook.com';
input.required = true;
form.appendChild(input);

const submit = document.createElement('button');
submit.type = 'submit';
submit.textContent = 'Save';
form.appendChild(submit);

const status = document.createElement('p');
form.appendChild(status);

app.appendChild(form);

const existing = await getConfig();
if (existing.snbOrigin) input.value = existing.snbOrigin;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const origin = new URL(input.value).origin;

  const granted = await chrome.runtime.sendMessage({ type: 'REQUEST_HOST_PERMISSION', origin });
  if (!granted) {
    status.textContent = 'Permission denied — enhancements will not run on this domain.';
    return;
  }

  await setConfig({ snbOrigin: origin });
  status.textContent = 'Saved.';
});
