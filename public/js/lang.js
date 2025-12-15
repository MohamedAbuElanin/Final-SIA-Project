let currentLang = localStorage.getItem('lang') || 'en';
let translations = {};

// Cache the successful base path to avoid multiple 404s
let cachedBasePath = null;

async function loadLanguage(lang) {
  try {
    // If we have a cached successful path, use it immediately
    if (cachedBasePath) {
      const cachedPath = `${cachedBasePath}${lang}.json`;
      try {
        const response = await fetch(cachedPath);
        if (response.ok) {
          translations = await response.json();
          applyTranslations();
          applyDirection(lang);
          localStorage.setItem('lang', lang);
          currentLang = lang;
          updateAllLanguageDisplays();
          console.log(`[i18n] ✅ Language loaded from cached path: ${cachedPath}`);
          return;
        }
      } catch (err) {
        // Cached path failed, reset and try discovery
        cachedBasePath = null;
      }
    }
    
    // Determine the correct path based on script location (more reliable than page path)
    const scripts = document.querySelectorAll('script[src*="lang.js"]');
    let basePath = null;
    
    if (scripts.length > 0) {
      const scriptSrc = scripts[scripts.length - 1].getAttribute('src');
      const scriptUrl = new URL(scriptSrc, window.location.href);
      const scriptPath = scriptUrl.pathname;
      
      // Extract directory from script path
      // lang.js is in /js/lang.js, so assets is at /assets/
      // lang.js is in /profile/js/lang.js, so assets is at /profile/../assets/
      const scriptDir = scriptPath.substring(0, scriptPath.lastIndexOf('/'));
      
      if (scriptDir === '/js' || scriptDir.endsWith('/js')) {
        // Script is in /js or subdir/js/, assets is one level up
        basePath = '../assets/i18n/';
      } else {
        // Calculate relative path: count how many levels up to root
        const levels = scriptDir.split('/').filter(p => p && p !== 'js').length;
        basePath = '../'.repeat(levels) + 'assets/i18n/';
      }
    } else {
      // Fallback: calculate from current page path
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath.endsWith('/index.html') || currentPath.endsWith('/')) {
        basePath = './assets/i18n/';
      } else {
        const pathParts = currentPath.split('/').filter(p => p && !p.endsWith('.html'));
        const depth = pathParts.length;
        basePath = '../'.repeat(depth) + 'assets/i18n/';
      }
    }
    
    // Try the calculated path (only one attempt, no fallbacks to avoid 404s)
    const primaryPath = `${basePath}${lang}.json`;
    
    const response = await fetch(primaryPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load language file: ${response.status} ${response.statusText}`);
    }
    
    translations = await response.json();
    
    // Cache the successful base path
    cachedBasePath = basePath;
    
    applyTranslations();
    applyDirection(lang);
    localStorage.setItem('lang', lang);
    currentLang = lang;
    
    updateAllLanguageDisplays();
    console.log(`[i18n] ✅ Language loaded successfully: ${lang} from ${primaryPath}`);
  } catch (error) {
    console.error(`[i18n] ❌ Error loading language '${lang}':`, error.message);
    // Fallback: Use empty translations object to prevent crashes
    translations = {};
    // Try to load English as fallback only if not already English
    if (lang !== 'en') {
      console.log(`[i18n] Attempting fallback to English...`);
      await loadLanguage('en');
    } else {
      // Even English failed, but we continue with empty translations
      console.warn('[i18n] ⚠️ Language files not found, continuing without translations');
    }
  }
}

function updateAllLanguageDisplays() {
  document.querySelectorAll('.lang-current').forEach(el => {
    el.textContent = currentLang.toUpperCase();
  });
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
  // Update all language displays
  updateAllLanguageDisplays();
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

// Make setLanguage available globally for onclick handlers
window.setLanguage = setLanguage;

