let currentLang = localStorage.getItem('lang') || 'en';
let translations = {};

async function loadLanguage(lang) {
  try {
    const response = await fetch(`/assets/i18n/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load language: ${lang}`);
    }
    translations = await response.json();
    applyTranslations();
    applyDirection(lang);
    localStorage.setItem('lang', lang);
    currentLang = lang;
  } catch (error) {
    console.error('Error loading language:', error);
    // Fallback to English if language file fails to load
    if (lang !== 'en') {
      loadLanguage('en');
    }
  }
}

function applyTranslations() {
  // Handle option elements separately (they need textContent, not innerHTML)
  document.querySelectorAll("option[data-key]").forEach(el => {
    const key = el.getAttribute("data-key");
    if (translations[key]) {
      el.textContent = translations[key];
    }
  });
  
  // Handle all other elements with data-key
  document.querySelectorAll("[data-key]:not(option)").forEach(el => {
    const key = el.getAttribute("data-key");
    if (translations[key]) {
      // For elements that might contain HTML (like buttons with icons)
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SPAN') {
        // Check if element has icon children - preserve them
        const icons = el.querySelectorAll('i, svg');
        if (icons.length > 0) {
          // Store icon HTML
          const iconHTML = Array.from(icons).map(icon => icon.outerHTML).join('');
          el.innerHTML = iconHTML + ' ' + translations[key];
        } else {
          el.innerHTML = translations[key];
        }
      } else {
        el.innerHTML = translations[key];
      }
    }
  });
  
  // Handle placeholder attributes
  document.querySelectorAll("[data-placeholder-key]").forEach(el => {
    const key = el.getAttribute("data-placeholder-key");
    if (translations[key]) {
      el.placeholder = translations[key];
    }
  });
  
  // Handle title attributes
  document.querySelectorAll("[data-title-key]").forEach(el => {
    const key = el.getAttribute("data-title-key");
    if (translations[key]) {
      el.title = translations[key];
    }
  });
}

function applyDirection(lang) {
  if (lang === "ar") {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
  } else {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", "en");
  }
}

// Dropdown functionality
function initLanguageDropdown() {
  const dropdowns = document.querySelectorAll('.lang-dropdown');
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.lang-dropdown-toggle');
    const menu = dropdown.querySelector('.lang-dropdown-menu');
    
    if (toggle && menu) {
      // Toggle dropdown
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
      
      // Update current language display
      updateLanguageDisplay(dropdown);
    }
  });
}

function updateLanguageDisplay(dropdown) {
  const toggle = dropdown.querySelector('.lang-dropdown-toggle');
  const currentLangText = dropdown.querySelector('.lang-current');
  if (toggle && currentLangText) {
    currentLangText.textContent = currentLang.toUpperCase();
  }
}

function setLanguage(lang) {
  loadLanguage(lang);
  // Update all dropdowns
  document.querySelectorAll('.lang-dropdown').forEach(dropdown => {
    updateLanguageDisplay(dropdown);
    dropdown.classList.remove('active');
  });
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadLanguage(currentLang);
    initLanguageDropdown();
  });
} else {
  loadLanguage(currentLang);
  initLanguageDropdown();
}

// Initialize dropdowns after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLanguageDropdown();
  });
} else {
  initLanguageDropdown();
}

// Export for use in other scripts
window.i18n = {
  t: (key) => translations[key] || key,
  setLanguage: setLanguage,
  getCurrentLang: () => currentLang
};

