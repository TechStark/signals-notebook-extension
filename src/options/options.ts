import { getConfig, isValidSnbHost, setConfig } from '@shared/config';

const app = document.getElementById('app');
if (!app) throw new Error('options root element not found');

const list = document.createElement('ul');
app.appendChild(list);

const form = document.createElement('form');

const label = document.createElement('label');
label.textContent = 'Add Signals Notebook host';
form.appendChild(label);

const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'my-instance.signalsnotebook.com or *.signalsnotebook.com';
input.required = true;
form.appendChild(input);

const submit = document.createElement('button');
submit.type = 'submit';
submit.textContent = 'Add';
form.appendChild(submit);

const status = document.createElement('p');
form.appendChild(status);

app.appendChild(form);

let hosts = (await getConfig()).snbHosts;

function renderList(): void {
  list.replaceChildren(
    ...hosts.map((host) => {
      const item = document.createElement('li');
      item.textContent = `${host} `;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', async () => {
        hosts = hosts.filter((h) => h !== host);
        await setConfig({ snbHosts: hosts });
        renderList();
      });

      item.appendChild(removeButton);
      return item;
    }),
  );
}

renderList();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const host = input.value.trim().toLowerCase();

  if (!isValidSnbHost(host)) {
    status.textContent = 'Enter a valid host, e.g. my-instance.signalsnotebook.com or *.signalsnotebook.com';
    return;
  }

  if (hosts.includes(host)) {
    status.textContent = 'That host is already added.';
    return;
  }

  const granted = await chrome.runtime.sendMessage({ type: 'REQUEST_HOST_PERMISSION', host });
  if (!granted) {
    status.textContent = 'Permission denied — enhancements will not run on this domain.';
    return;
  }

  hosts = [...hosts, host];
  await setConfig({ snbHosts: hosts });
  input.value = '';
  status.textContent = 'Saved.';
  renderList();
});
