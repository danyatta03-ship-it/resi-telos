// Schermata di accesso. Occupa tutta la pagina: fuori dalla shell, perche'
// prima del login non c'e' navigazione da mostrare.

import { h, mount, clear } from '../ui/dom.js';
import { getBrand } from '../core/config.js';
import { signIn, sendPasswordReset, authErrorText } from '../core/auth.js';
import { toast } from '../ui/toast.js';

export function renderLogin(container) {
  const brand = getBrand();
  clear(container);
  document.documentElement.classList.add('is-login');

  const emailInput = h('input.input', {
    type: 'email',
    id: 'lg-email',
    placeholder: 'nome@azienda.it',
    autocomplete: 'username',
    required: true,
    autocapitalize: 'off',
    spellcheck: false
  });

  const passInput = h('input.input', {
    type: 'password',
    id: 'lg-pass',
    placeholder: '••••••••',
    autocomplete: 'current-password',
    required: true
  });

  const errBox = h('div.banner.banner-err.hidden');
  const submitBtn = h('button.btn.btn-primary.btn-lg.btn-block', { type: 'submit' }, 'Accedi');

  function showError(message) {
    mount(errBox, [h('div', '⛔'), h('div', message)]);
    errBox.classList.remove('hidden');
  }

  function hideError() {
    errBox.classList.add('hidden');
  }

  async function onSubmit(e) {
    e.preventDefault();
    hideError();
    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) {
      showError('Inserisci email e password.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';
    try {
      await signIn(email, password);
      // Il router reagisce al cambio di auth: nessun redirect da fare qui.
    } catch (err) {
      showError(authErrorText(err));
      passInput.value = '';
      passInput.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Accedi';
    }
  }

  async function onReset(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      showError('Scrivi la tua email qui sopra, poi premi di nuovo "Password dimenticata".');
      emailInput.focus();
      return;
    }
    try {
      await sendPasswordReset(email);
      hideError();
      toast('Email di reimpostazione inviata a ' + email, 'ok', 7000);
    } catch (err) {
      // Non confermiamo se l'indirizzo esiste: sarebbe un modo per scoprire
      // quali account sono registrati.
      toast('Se l\'indirizzo e\' registrato riceverai una email a breve.', 'info', 7000);
    }
  }

  const logo = brand.logoUrl
    ? h('img', { src: brand.logoUrl, alt: brand.companyName || '', style: { width: '54px', height: '54px', borderRadius: '12px', margin: '0 auto 14px', objectFit: 'cover' } })
    : h('div', {
        style: {
          width: '54px', height: '54px', borderRadius: '12px', margin: '0 auto 14px',
          background: 'var(--brand-primary)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: '24px', fontWeight: '800'
        }
      }, (brand.companyName || 'T').charAt(0).toUpperCase());

  const form = h('form', { onsubmit: onSubmit, novalidate: true }, [
    h('div.field', [
      h('label.label', { for: 'lg-email' }, 'Email'),
      emailInput
    ]),
    h('div.field', [
      h('label.label', { for: 'lg-pass' }, 'Password'),
      passInput
    ]),
    errBox,
    submitBtn,
    h('div.txt-c', { style: { marginTop: '14px' } }, [
      h('a', { href: '#', onclick: onReset, style: { fontSize: '13px' } }, 'Password dimenticata?')
    ])
  ]);

  const box = h('div.fullscreen-box', [
    h('div.txt-c', { style: { marginBottom: '22px' } }, [
      logo,
      h('h1', { style: { marginBottom: '4px' } }, brand.appName || 'Tracking Resi'),
      h('div.muted', { style: { fontSize: '13.5px' } }, brand.loginTagline || brand.companyName || '')
    ]),
    h('div.card', form),
    h('div.txt-c.dim', { style: { marginTop: '18px', fontSize: '12px', lineHeight: '1.7' } }, [
      brand.supportEmail
        ? h('div', ['Problemi di accesso? ', h('a', { href: 'mailto:' + brand.supportEmail }, brand.supportEmail)])
        : null,
      brand.footerNote ? h('div', brand.footerNote) : null
    ])
  ]);

  container.appendChild(h('div.fullscreen', box));
  setTimeout(() => emailInput.focus(), 60);
}

export function leaveLogin() {
  document.documentElement.classList.remove('is-login');
}
