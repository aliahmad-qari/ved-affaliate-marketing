// Isolated visual preview: does not import the application, environment or database.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { registrationDocument } from '../server/utils/registrationView.ts';

createServer((req, res) => {
  if (req.url === '/registration-assets/unlock-success-hero.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(readFileSync(new URL('../public/registration-assets/unlock-success-hero.png', import.meta.url)));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(registrationDocument({ registered: req.url === '/already-registered', action: '/preview-only' }));
}).listen(4285, '127.0.0.1', () => console.log('Isolated UI preview: http://127.0.0.1:4285 (new), /already-registered (returning). No submissions are stored.'));
