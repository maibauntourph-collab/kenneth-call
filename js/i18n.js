// ===== i18n Language Switcher =====
(function() {
  const langNames = { en: 'EN', ko: '한국어', tl: 'TL', ceb: 'CEB' };
  const langFlags = { en: '🇺🇸', ko: '🇰🇷', tl: '🇵🇭', ceb: '🇵🇭' };

  let currentLang = localStorage.getItem('lang') || 'en';

  function applyTranslations(lang) {
    const t = translations[lang];
    if (!t) return;

    // data-i18n → textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] != null) el.textContent = t[key];
    });

    // data-i18n-html → innerHTML (for tags with <br>, <span>, etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (t[key] != null) el.innerHTML = t[key];
    });

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Update switcher UI
    const flagEl = document.querySelector('.lang-flag');
    const currentEl = document.querySelector('.lang-current');
    if (flagEl) flagEl.textContent = langFlags[lang] || '🌐';
    if (currentEl) currentEl.textContent = langNames[lang] || lang.toUpperCase();

    // Update active state in dropdown
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    currentLang = lang;
    localStorage.setItem('lang', lang);
  }

  // ===== Dropdown toggle =====
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.lang-btn');
    const dropdown = document.querySelector('.lang-dropdown');

    if (btn) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      return;
    }

    const option = e.target.closest('.lang-option');
    if (option) {
      const lang = option.dataset.lang;
      applyTranslations(lang);
      dropdown.classList.remove('open');
      return;
    }

    // Close dropdown on outside click
    if (dropdown) dropdown.classList.remove('open');
  });

  // Apply saved language on load
  if (currentLang !== 'en') {
    applyTranslations(currentLang);
  }
})();
