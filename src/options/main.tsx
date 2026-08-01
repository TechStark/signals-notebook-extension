import { createRoot } from 'react-dom/client';
import { OptionsApp } from './OptionsApp';

const container = document.getElementById('app');
if (!container) throw new Error('options root element not found');

createRoot(container).render(<OptionsApp />);
