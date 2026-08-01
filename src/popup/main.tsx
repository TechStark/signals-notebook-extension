import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';

const container = document.getElementById('app');
if (!container) throw new Error('popup root element not found');

createRoot(container).render(<PopupApp />);
