import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CustomerRegistrationScreen, type RegistrationScreenProps } from '../../src/components/CustomerRegistrationScreen.tsx';

const css = readFileSync(new URL('../../src/styles/customer-registration.css', import.meta.url), 'utf8');
export function registrationDocument(props: RegistrationScreenProps) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="same-origin"><title>Complete Your Application | VED Affiliate</title><style>body{margin:0}${css}</style></head><body>${renderToStaticMarkup(React.createElement(CustomerRegistrationScreen, props))}<script>const form=document.querySelector('[data-registration-form]');if(form)form.addEventListener('submit',function(event){if(form.dataset.submitting){event.preventDefault();return}form.dataset.submitting='true';const button=form.querySelector('button[type="submit"]');if(button){button.disabled=true;button.querySelector('span').textContent='CONTINUING…'}const status=form.querySelector('[role="status"]');if(status)status.textContent='Saving your application securely…'});window.addEventListener('pageshow',function(){if(form){delete form.dataset.submitting;const button=form.querySelector('button[type="submit"]');if(button){button.disabled=false;button.querySelector('span').textContent='CONTINUE SECURELY'}}});</script></body></html>`;
}
