let currentLang = localStorage.getItem('lang') || 'en';
let translations = {};

async function loadLanguage(lang) {
  try {
    // Determine the correct path based on current page location
    // This avoids trying absolute paths that fail on localhost
    const currentPath = window.location.pathname;
    let basePath = '../assets/i18n/';
    
    // Calculate relative path to assets/i18n based on current page depth
    // Root pages (index.html) -> ./assets/i18n/
    // One level deep (profile/profile.html) -> ../assets/i18n/
    // Two levels deep -> ../../assets/i18n/
    if (currentPath === '/' || currentPath.endsWith('/index.html') || currentPath.endsWith('/')) {
      // Root level
      basePath = './assets/i18n/';
    } else {
      // Count directory depth (excluding filename)
      const pathParts = currentPath.split('/').filter(p => p && !p.endsWith('.html'));
      const depth = pathParts.length;
      basePath = '../'.repeat(depth) + 'assets/i18n/';
    }
    
    // Try the calculated path first (most reliable)
    const primaryPath = `${basePath}${lang}.json`;
    
    let response = null;
    let successfulPath = null;
    
    // Try primary path first
    try {
      response = await fetch(primaryPath);
      if (response.ok) {
        successfulPath = primaryPath;
        console.log(`[i18n] ✅ Found language file at: ${successfulPath}`);
      }
    } catch (err) {
      // Primary path failed, try fallback
      console.log(`[i18n] Primary path failed: ${primaryPath}, trying fallback...`);
    }
    
    // Fallback: try one level up if primary failed
    if (!response || !response.ok) {
      const fallbackPath = `../assets/i18n/${lang}.json`;
      try {
        response = await fetch(fallbackPath);
        if (response.ok) {
          successfulPath = fallbackPath;
          console.log(`[i18n] ✅ Found language file at: ${successfulPath}`);
        }
      } catch (err) {
        // Fallback also failed
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`Failed to load language: ${lang} from ${primaryPath}`);
    }
    
    translations = await response.json();
    applyTranslations();
    applyDirection(lang);
    localStorage.setItem('lang', lang);
    currentLang = lang;
    
    // Update all language dropdowns to show current language
    updateAllLanguageDisplays();
    console.log(`[i18n] ✅ Language loaded successfully: ${lang} from ${successfulPath}`);
  } catch (error) {
    console.error('Error loading language:', error);
    // Fallback: Use empty translations object to prevent crashes
    translations = {};
    // Try to load English as fallback
    if (lang !== 'en') {
      console.log(`[i18n] Attempting fallback to English...`);
      loadLanguage('en');
    } else {
      // Even English failed, but we continue with empty translations
      console.warn('[i18n] ⚠️ Language files not found, continuing without translations');
      console.warn('[i18n] Expected location: ./assets/i18n/en.json or ../assets/i18n/en.json');
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

