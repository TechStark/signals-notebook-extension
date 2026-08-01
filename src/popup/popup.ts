import type { ExtensionConfig } from '@shared/config';

const app = document.getElementById('app');
if (!app) throw new Error('popup root element not found');

const config = (await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })) as ExtensionConfig;

const status = document.createElement('p');
status.textContent =
  config.snbHosts.length > 0 ? `Active on: ${config.snbHosts.join(', ')}` : 'No Signals Notebook host configured yet.';
app.appendChild(status);

const optionsLink = document.createElement('button');
optionsLink.textContent = 'Open settings';
optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());
app.appendChild(optionsLink);
