/*
  General site JS:
  - modal open/close + focus trap
  - contact form handler (mailto fallback)
  - footer feedback + subscribe handlers
  - simple hero slider (controls + dots + auto)
  - small utilities
*/
(function () {
  'use strict';

  // API base: '' uses same origin. For local dev use 'http://localhost:4000'
  const API_BASE = window.API_BASE || '';

  const RECIPIENT_EMAIL = 'sniyonsenga123@gmail.com';
  const WHATSAPP_NUMBER = '250782567921'; // without +

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));
  const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || '').trim());

  /* ---------- modal behaviour + focus trap ---------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('aria-hidden', 'false');
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    trapFocus(m);
    const first = m.querySelector('input, button, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  }

  function closeModal(m) {
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    m.classList.remove('open');
    document.body.style.overflow = '';
    releaseFocusTrap(m);
  }

  const traps = new Map();
  function trapFocus(modal) {
    if (!modal) return;
    const focusable = $$(
      'a[href], button:not([disabled]):not([aria-hidden]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      modal
    ).filter(Boolean);
    function handleKey(e) {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    modal.__trapHandler = handleKey;
    modal.addEventListener('keydown', handleKey);
    traps.set(modal, handleKey);
  }
  function releaseFocusTrap(modal) {
    const h = traps.get(modal);
    if (h) modal.removeEventListener('keydown', h);
    traps.delete(modal);
  }

  function setupModals() {
    $$('.btn-auth').forEach((btn) => {
      const target = btn.dataset.target;
      if (!target) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(target);
      });
    });

    $$('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
      const close = overlay.querySelector('.modal-close');
      if (close) close.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(overlay);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal-overlay.open').forEach(closeModal);
      }
    });
  }

  /* ---------- form message helper ---------- */
  function setFormMessage(el, text, type = 'info') {
    if (!el) return;
    el.classList.remove('success', 'error');
    if (type === 'success') el.classList.add('success');
    if (type === 'error') el.classList.add('error');
    el.textContent = text || '';
  }

  /* ---------- mailto fallback (used when server unavailable) ---------- */
  function mailtoFallback(form) {
    const name = (form.querySelector('[name="name"]') || {}).value || '';
    const email = (form.querySelector('[name="email"]') || {}).value || '';
    const message = (form.querySelector('[name="message"], [name="messageText"], [name="messageBody"]') || {}).value || '';
    const subject = encodeURIComponent('Website message from ' + (name || 'visitor'));
    const body = encodeURIComponent((message || '') + '\n\n---\nFrom: ' + (name || '') + '\nEmail: ' + (email || ''));
    window.location.href = `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`;
  }

  /* ---------- POST helper for JSON endpoints ---------- */
  async function postJson(path, payload) {
    const url = (API_BASE || '') + path;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  /* ---------- contact form (POST to server, recaptcha v3 optional) ---------- */
  function setupContactForm() {
    const form = document.getElementById('contact-form');
    const msgEl = document.getElementById('form-msg');
    if (!form) return;

    const SITE_KEY = window.RECAPTCHA_SITE_KEY || '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFormMessage(msgEl, '', 'info');

      const name = (form.querySelector('[name="name"]') || {}).value || '';
      const email = (form.querySelector('[name="email"]') || {}).value || '';
      const message = (form.querySelector('[name="message"]') || {}).value || '';

      if (!name.trim() || !email.trim() || !message.trim()) {
        setFormMessage(msgEl, 'Please fill all fields.', 'error');
        return;
      }
      if (!isEmail(email)) {
        setFormMessage(msgEl, 'Please enter a valid email.', 'error');
        return;
      }

      setFormMessage(msgEl, 'Sending...', 'info');

      let recaptchaToken = '';
      if (SITE_KEY && window.grecaptcha && window.grecaptcha.execute) {
        try {
          recaptchaToken = await window.grecaptcha.execute(SITE_KEY, { action: 'contact' });
        } catch (err) {
          // proceed without token
          console.warn('reCAPTCHA execute failed', err);
        }
      }

      // prefer server endpoint if available
      try {
        const res = await postJson('/api/contact', { name, email, message, recaptchaToken });
        if (res.ok && res.data && res.data.ok) {
          setFormMessage(msgEl, 'Message sent — thank you!', 'success');
          form.reset();
        } else {
          // server error -> fallback to mailto
          setFormMessage(msgEl, res.data && res.data.error ? res.data.error : 'Server error — opening email client as fallback.', 'error');
          mailtoFallback(form);
        }
      } catch (err) {
        setFormMessage(msgEl, 'Network error — opening email client as fallback.', 'error');
        mailtoFallback(form);
      }
    });
  }

  /* ---------- footer feedback and subscribe (POST to server, then fallback) ---------- */
  function setupFooterForms() {
    const fbForm = document.getElementById('footer-feedback-form');
    const fbMsg = document.getElementById('fb-msg');
    if (fbForm) {
      fbForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFormMessage(fbMsg, '', 'info');
        const name = (fbForm.querySelector('[name="name"]') || {}).value || '';
        const message = (fbForm.querySelector('[name="message"]') || {}).value || '';
        if (!message.trim()) {
          setFormMessage(fbMsg, 'Please write a short message.', 'error');
          return;
        }
        setFormMessage(fbMsg, 'Sending...', 'info');
        try {
          const res = await postJson('/api/feedback', { name, message });
          if (res.ok && res.data && res.data.ok) {
            setFormMessage(fbMsg, 'Feedback sent — thank you!', 'success');
            fbForm.reset();
          } else {
            setFormMessage(fbMsg, 'Server error — opening email client as fallback.', 'error');
            mailtoFallback(fbForm);
          }
        } catch (err) {
          setFormMessage(fbMsg, 'Network error — opening email client as fallback.', 'error');
          mailtoFallback(fbForm);
        }
      });
    }

    const subForm = document.getElementById('subscribe-form');
    const subMsg = document.getElementById('sub-msg');
    if (subForm) {
      subForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFormMessage(subMsg, '', 'info');
        const email = (subForm.querySelector('[name="email"]') || {}).value || '';
        if (!email.trim() || !isEmail(email)) {
          setFormMessage(subMsg, 'Please enter a valid email.', 'error');
          return;
        }
        setFormMessage(subMsg, 'Subscribing...', 'info');
        try {
          const res = await postJson('/api/subscribe', { email });
          if (res.ok && res.data && res.data.ok) {
            setFormMessage(subMsg, 'Subscribed — check your email for confirmation.', 'success');
            subForm.reset();
          } else {
            setFormMessage(subMsg, 'Server error — opening email client as fallback.', 'error');
            mailtoFallback(subForm);
          }
        } catch (err) {
          setFormMessage(subMsg, 'Network error — opening email client as fallback.', 'error');
          mailtoFallback(subForm);
        }
      });
    }
  }

  /* ---------- footer year ---------- */
  function setFooterYear() {
    const el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- simple hero slider ---------- */
  function setupSlider() {
    const slidesWrap = $('.slides');
    if (!slidesWrap) return;

    const slides = $$('.slide', slidesWrap);
    if (!slides || slides.length === 0) return;

    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
    const dotsContainer = $('#dots');
    let index = 0;
    let autoTimer = null;
    const AUTO_MS = 4500;

    function go(to) {
      index = ((to % slides.length) + slides.length) % slides.length;
      slidesWrap.style.transform = `translateX(${-index * 100}%)`;
      updateDots();
    }

    function prev() { go(index - 1); }
    function next() { go(index + 1); }

    function createDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      slides.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dot';
        if (i === 0) btn.classList.add('active');
        btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        btn.addEventListener('click', () => {
          go(i);
          restartAuto();
        });
        dotsContainer.appendChild(btn);
      });
    }

    function updateDots() {
      if (!dotsContainer) return;
      $$('.dot', dotsContainer).forEach((d, i) => d.classList.toggle('active', i === index));
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAuto(); });

    createDots();
    go(0);

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(() => next(), AUTO_MS);
    }
    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }
    function restartAuto() { startAuto(); }

    try {
      slidesWrap.addEventListener('mouseenter', stopAuto);
      slidesWrap.addEventListener('mouseleave', startAuto);
      slidesWrap.addEventListener('touchstart', stopAuto, { passive: true });
      slidesWrap.addEventListener('touchend', startAuto, { passive: true });
    } catch (e) {
      slidesWrap.addEventListener('mouseenter', stopAuto);
      slidesWrap.addEventListener('mouseleave', startAuto);
      slidesWrap.addEventListener('touchstart', stopAuto);
      slidesWrap.addEventListener('touchend', startAuto);
    }

    startAuto();
  }

  /* ---------- init ---------- */
  function init() {
    setupModals();
    setupContactForm();
    setupFooterForms();
    setFooterYear();
    setupSlider();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();