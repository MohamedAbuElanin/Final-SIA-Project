# Final Book.md - الجانب التقني لمشروع SIA

## غطاء الكتاب

**عنوان الكتاب:** الجانب التقني لمنصة SIA: حكمة قديمة لمسارات مهنية حديثة  
**المؤلف:** [اسمك]  
**التاريخ:** 16 يناير 2026  
**الغرض:** كتاب مشروع التخرج، يشرح التقنيات المستخدمة في بناء الموقع مع أمثلة من الكود.  
**عدد الصفحات التقريبي في Word:** 20 صفحة (بناءً على تنسيق قياسي).

---

## فهرس المحتويات

1. **مقدمة**  
   1.1 نظرة عامة على المشروع  
   1.2 أهداف الكتاب  
   1.3 منهجية البحث  

2. **الفصل الأول: نظرة عامة على المشروع**  
   2.1 وصف المشروع  
   2.2 الميزات الرئيسية  
   2.3 هيكل المشروع العام  

3. **الفصل الثاني: اللغات البرمجية**  
   3.1 HTML  
   3.2 CSS  
   3.3 JavaScript  
   3.4 Node.js  

4. **الفصل الثالث: المكتبات والإطارات**  
   4.1 Firebase SDK  
   4.2 Google Generative AI  
   4.3 Express.js  
   4.4 مكتبات أخرى  

5. **الفصل الرابع: الأدوات والمنصات**  
   5.1 Firebase Platform  
   5.2 Node.js و npm  
   5.3 أدوات التطوير الأخرى  

6. **الفصل الخامس: قائمة كاملة للمكتبات والأدوات المستخدمة**  
   6.1 المكتبات في الجذر (package.json)  
   6.2 المكتبات في functions/ (package.json)  
   6.3 المكتبات في SIA-backend/ (package.json)  
   6.4 مكتبات الواجهة الأمامية (CDN وغيرها)  
   6.5 أدوات التطوير والمنصات  

7. **الفصل السادس: هيكل المشروع وأمثلة الكود**  
   7.1 الواجهة الأمامية  
   7.2 الخلفية  
   7.3 أمثلة عملية من الكود  

8. **خاتمة**  
   8.1 التحديات والحلول  
   8.2 التحسينات المستقبلية  
   8.3 الخلاصة  

9. **مراجع**

---

## 1. مقدمة

### 1.1 نظرة عامة على المشروع
منصة SIA هي تطبيق ويب يساعد المستخدمين على فهم سمات شخصيتهم من خلال اختبارات تفاعلية، ويقدم توصيات مخصصة للتعلم والمسارات المهنية. المشروع يجمع بين التقنيات الحديثة مثل الذكاء الاصطناعي والخدمات السحابية لتقديم تجربة مستخدم فريدة. بني المشروع باستخدام تقنيات الويب القياسية مع دعم خلفي قوي.

### 1.2 أهداف الكتاب
يهدف هذا الكتاب إلى شرح الجانب التقني للمشروع بشكل مفصل، مع التركيز على اللغات، المكتبات، والأدوات المستخدمة. سيتم استخدام أمثلة حقيقية من الكود لتوضيح النقاط، مما يجعله مناسبًا لكتاب مشروع التخرج. الكتاب مصمم ليكون حوالي 20 صفحة في برنامج Word عند التحويل.

### 1.3 منهجية البحث
تم جمع المعلومات من خلال تحليل ملفات المشروع (مثل package.json، firebase.json، وملفات الكود)، واستخدام أدوات التحليل لاستخراج الأمثلة. التركيز على الدقة والشمولية مع الحفاظ على الإيجاز.

---

## 2. الفصل الأول: نظرة عامة على المشروع

### 2.1 وصف المشروع
منصة SIA تعتمد على نموذج "حكمة قديمة لمسارات مهنية حديثة"، حيث يقوم المستخدم بإجراء اختبارات شخصية (مثل Big Five و Holland) للحصول على توصيات. المشروع يستخدم Firebase للاستضافة والمصادقة، وGoogle AI لتوليد المحتوى.

### 2.2 الميزات الرئيسية
- اختبارات تفاعلية.  
- لوحة تحكم شخصية.  
- توصيات مخصصة باستخدام AI.  
- إدارة المستخدمين والأمان.

### 2.3 هيكل المشروع العام
- **public/**: الواجهة الأمامية (HTML, CSS, JS).  
- **functions/**: الدوال السحابية.  
- **SIA-backend/**: خادم Express مستقل.  
- ملفات التكوين مثل firebase.json و package.json.

---

## 3. الفصل الثاني: اللغات البرمجية

### 3.1 HTML
HTML هو أساس بناء الصفحات الويبية. في مشروع SIA، يُستخدم HTML5 لإنشاء هيكل الصفحات، مع دعم اللغة العربية (dir="rtl").

**مثال من الكود (من public/index.html):**
```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIA – حكمة قديمة لمسارات مهنية حديثة</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="site-header">
      <nav class="site-nav">
        <a href="index.html" class="brand">
          <img src="./Images/Logo/SIA +Ra's Eye, yellow color.svg" alt="شعار SIA الذهبي" />
        </a>
      </nav>
    </header>
  </body>
</html>
```
هذا المثال يظهر استخدام العناصر الأساسية مثل <head> و <body>، مع روابط CSS وصور.

### 3.2 CSS
CSS يُستخدم للتصميم والتنسيق. في المشروع، يدعم التصميم المتجاوب.

**مثال من الكود (وصفي، من style.css):**
```css
.site-header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```
يُستخدم لجعل الواجهة جذابة ومتجاوبة.

### 3.3 JavaScript
JavaScript يدير التفاعل. في الواجهة الأمامية، يُستخدم للتنقل والتفاعل.

**مثال من الكود (من public/main.js):**
```javascript
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});
```
هذا الكود يضيف smooth scroll للروابط.

### 3.4 Node.js
Node.js يُستخدم في الخلفية لتشغيل الخادم.

**مثال من الكود (من functions/index.js):**
```javascript
const functions = require("firebase-functions");
const api = require("./src/api");
exports.api = functions.https.onRequest(api);
```
يظهر كيفية تصدير دالة Firebase.

---

## 4. الفصل الثالث: المكتبات والإطارات

### 4.1 Firebase SDK
Firebase يوفر خدمات مثل Authentication و Firestore.

**مثال من الكود (من public/firebaseInit.js):**
```javascript
import { initializeApp } from 'firebase/app';
const app = initializeApp(firebaseConfig);
```
يُستخدم لتهيئة Firebase.

### 4.2 Google Generative AI
لدمج AI في التوصيات.

**مثال من الكود (من SIA-backend/server.js):**
```javascript
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```
يُستخدم لتوليد محتوى.

### 4.3 Express.js
إطار للخادم.

**مثال من الكود (من SIA-backend/server.js):**
```javascript
const express = require('express');
const app = express();
app.use(cors());
```
يُستخدم لبناء APIs.

### 4.4 مكتبات أخرى
مثل Axios للطلبات، و Dotenv للمتغيرات.

---

## 5. الفصل الرابع: الأدوات والمنصات

### 5.1 Firebase Platform
منصة شاملة للاستضافة والخدمات.

### 5.2 Node.js و npm
لإدارة الحزم.

### 5.3 أدوات التطوير الأخرى
مثل VS Code و Git.

---

## 6. الفصل الخامس: قائمة كاملة للمكتبات والأدوات المستخدمة

### 6.1 المكتبات في الجذر (package.json)
- **@google/genai**: ^1.30.0 - مكتبة Google Generative AI لدمج الذكاء الاصطناعي.
- **dotenv**: ^17.2.3 - لتحميل متغيرات البيئة من ملف .env.
- **firebase**: ^12.6.0 - Firebase SDK للواجهة الأمامية.

### 6.2 المكتبات في functions/ (package.json)
- **firebase-admin**: ^13.6.0 - Firebase Admin SDK للوصول إلى خدمات Firebase من الخادم.
- **firebase-functions**: ^6.0.0 - لإنشاء دوال Firebase السحابية.
- **@google/generative-ai**: ^0.2.0 - مكتبة Google Generative AI للدوال السحابية.
- **axios**: ^1.6.0 - مكتبة لإرسال طلبات HTTP.
- **cors**: ^2.8.5 - middleware للتعامل مع CORS في Express.
- **dotenv**: ^16.3.0 - لتحميل متغيرات البيئة.
- **eslint**: ^8.15.0 - أداة للتحقق من جودة الكود.
- **eslint-config-google**: ^0.14.0 - تكوين ESLint من Google.
- **firebase-functions-test**: ^3.1.0 - أدوات اختبار لدوال Firebase.

### 6.3 المكتبات في SIA-backend/ (package.json)
- **@google/genai**: ^1.30.0 - مكتبة Google Generative AI.
- **body-parser**: ^1.20.2 - middleware لتحليل جسم الطلبات في Express.
- **cors**: ^2.8.5 - middleware للتعامل مع CORS.
- **dotenv**: ^17.2.3 - لتحميل متغيرات البيئة.
- **express**: ^4.18.2 - إطار عمل للخادم.
- **express-rate-limit**: ^7.1.5 - middleware للحد من معدل الطلبات.
- **firebase-admin**: ^12.0.0 - Firebase Admin SDK.

### 6.4 مكتبات الواجهة الأمامية (CDN وغيرها)
- **Font Awesome**: ^6.5.1 - مكتبة أيقونات مجانية (من cdnjs.cloudflare.com).
- **Google Fonts - Cairo**: خط Cairo من Google Fonts للنصوص العربية (أوزان 300, 400, 500, 600, 700, 800).
- **Bootstrap**: ^5.3.0 - إطار عمل CSS و JS للتصميم المتجاوب (في صفحات الملف الشخصي).

### 6.5 أدوات التطوير والمنصات
- **Firebase Platform**: منصة شاملة للاستضافة، المصادقة، قاعدة البيانات، والدوال السحابية.
- **Node.js**: ^24 - بيئة تشغيل JavaScript على الخادم.
- **npm**: مدير حزم Node.js.
- **VS Code**: محرر الكود الرئيسي.
- **Git**: نظام التحكم في الإصدارات.
- **Railway**: منصة نشر للخادم (SIA-backend).
- **ESLint**: أداة للتحقق من جودة الكود.
- **Firebase Emulator**: لاختبار الدوال محلياً.

---

## 7. الفصل السادس: هيكل المشروع وأمثلة الكود

### 7.1 الواجهة الأمامية
تتكون من HTML/CSS/JS.

### 7.2 الخلفية
دوال Firebase و Express server.

### 7.3 أمثلة عملية من الكود

#### مثال HTML:
في مشروع SIA، يُستخدم HTML5 لإنشاء هيكل الصفحات مع دعم اللغة العربية والتصميم المتجاوب. إليك مثال من `public/index.html`:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIA – حكمة قديمة لمسارات مهنية حديثة</title>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
    />
    <link rel="stylesheet" href="./style.css" />
    <link rel="stylesheet" href="./template.css" />
    <link rel="icon" type="image/x-icon" href="./Images/ICO/favicon.ico" />
  </head>
  <body>
    <!-- Navbar Start -->
    <header class="site-header">
      <nav class="site-nav" aria-label="Primary navigation">
        <input
          type="checkbox"
          id="navToggle"
          class="nav-toggle"
          aria-label="Toggle navigation menu"
        />

        <!-- Logo Section -->
        <a href="index.html" class="brand" aria-label="SIA homepage">
          <span class="brand__mark">
            <img
              src="./Images/Logo/SIA +Ra's Eye, yellow color.svg"
              alt="شعار SIA الذهبي"
            />
          </span>
        </a>

        <!-- Center Navigation Links -->
        <ul class="nav-links" id="navLinks">
          <li><a href="index.html" aria-current="page">الرئيسية</a></li>
          <li><a href="./About/About.html">عن SIA</a></li>
          <li><a href="./Test/Test.html">الاختبار</a></li>
          <li><a href="./profile/profile.html">الملف الشخصي</a></li>
          <li>
            <a href="./privacy-terms.html">الخصوصية والشروط</a>
          </li>
        </ul>

        <!-- Right Buttons Section -->
        <div class="nav-auth" id="navAuth">
          <a href="./sign in/signin.html" class="btn-nav btn-nav--signin">تسجيل الدخول</a>
          <a href="./sign up/signup.html" class="btn-nav btn-nav--signup">إنشاء حساب</a>
        </div>
      </nav>
    </header>
  </body>
</html>
```

هذا المثال يظهر استخدام العناصر الأساسية مثل `<head>`، `<body>`، الروابط لـ CSS والأيقونات، والتنقل مع دعم الوصولية.

#### مثال CSS:
CSS يُستخدم للتصميم والتنسيق مع متغيرات CSS للألوان والانتقالات. إليك مثال من `public/style.css`:

```css
/* Reset and Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-black: #000000;
  --color-gold: #d4af37;
  --color-gold-light: rgba(212, 175, 55, 0.1);
  --color-gold-medium: rgba(212, 175, 55, 0.3);
  --color-gold-dark: rgba(212, 175, 55, 0.8);
  --transition: all 0.3s ease;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background-color: var(--color-black);
  color: #ffffff;
  line-height: 1.6;
  overflow-x: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header and Navigation - Unified */
.site-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212, 175, 55, 0.35);
}

.site-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 1rem clamp(1.5rem, 5vw, 4rem);
}
```

يُستخدم لجعل الواجهة جذابة ومتجاوبة مع تأثيرات مثل الـ blur والانتقالات.

#### مثال JavaScript:
JavaScript يدير التفاعل في الواجهة الأمامية، مثل التنقل السلس والقوائم المحمولة. إليك مثال من `public/main.js`:

```javascript
// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Close mobile menu if open
            const navMenu = document.getElementById('navMenu');
            if (navMenu) {
                navMenu.classList.remove('active');
            }
        }
    });
});

// Mobile hamburger menu toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navAuth = document.getElementById('navAuth');

if (hamburger && navLinks && navAuth) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        navAuth.classList.toggle('active');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navLinks.contains(e.target) && !navAuth.contains(e.target)) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            navAuth.classList.remove('active');
        }
    });
    
    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            navAuth.classList.remove('active');
        });
    });
}
```

هذا الكود يضيف smooth scroll للروابط ويدير القائمة المحمولة.

#### مثال Node.js:
Node.js يُستخدم في الدوال السحابية لـ Firebase. إليك مثال من `functions/index.js`:

```javascript
const functions = require("firebase-functions");
const api = require("./src/api");

exports.api = functions.https.onRequest(api);

// Export Triggers
const {onUserTestUpdate, onManualAnalysisTrigger} = require("./src/triggers");
exports.onUserTestUpdate = onUserTestUpdate;
exports.onManualAnalysisTrigger = onManualAnalysisTrigger;
```

يظهر كيفية تصدير دالة Firebase.

#### Firebase SDK مثال:
Firebase SDK يوفر خدمات مثل Authentication و Firestore. إليك مثال من `public/firebaseInit.js`:

```javascript
(function() {
    'use strict';

    // Wait for Firebase SDK to load
    function waitForFirebase(callback, maxAttempts = 50) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof firebase !== 'undefined' && firebase.apps) {
                clearInterval(checkInterval);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('Firebase SDK failed to load after', maxAttempts, 'attempts');
            }
        }, 100);
    }

    // Initialize Firebase services
    function initFirebaseServices() {
        if (!window.firebase || !window.firebase.apps) {
            console.error('Firebase SDK not loaded. Ensure firebase-config.js is loaded first.');
            return;
        }

        // Services are already initialized in firebase-config.js
        // This module just provides a consistent API
        if (!window.firebaseInitialized) {
            window.firebaseInitialized = true;
            console.log('Firebase services initialized');
        }
    }

    // Public API
    window.firebaseInit = {
        getAuth: function() {
            return window.auth || firebase.auth();
        },
        // ... other methods
    };

    // Initialize on load
    waitForFirebase(initFirebaseServices);
})();
```

يُستخدم لتهيئة Firebase وتوفير واجهة موحدة.

#### Google Generative AI مثال:
لدمج AI في التوصيات. إليك مثال من `functions/gemini.js`:

```javascript
const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {logActivity} = require("./activityLog");

/**
 * Generates personalized recommendations using Gemini AI.
 */
exports.getGeminiRecommendations = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const {promptContext} = data;

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    throw new functions.https.HttpsError("internal", "AI service not configured.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});

  try {
    const prompt = `
       You are a helpful career and personality assistant.
       User Context: ${JSON.stringify(promptContext)}
       
       Please provide personalized advice, book recommendations, and a learning roadmap based on this profile.
       Keep it concise and actionable.
     `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    await logActivity(uid, "gemini_consultation", {valid: true});

    return {recommendation: text};
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw new functions.https.HttpsError("internal", "Failed to generate recommendations.");
  }
});
```

يُستخدم لتوليد محتوى مخصص باستخدام Gemini AI.

#### Express.js مثال:
إطار للخادم. إليك مثال من `SIA-backend/server.js`:

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// FIXED: Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
    logger.error('ERROR: GEMINI_API_KEY environment variable is not set!');
    logger.error('Please set it in your .env file or environment variables.');
    process.exit(1);
}

// FIXED: Initialize Gemini AI with proper error handling
let ai;
try {
    const { GoogleGenAI } = require("@google/genai");
    ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });
    logger.log('Gemini AI initialized successfully');
} catch (error) {
    logger.error('ERROR: Failed to initialize GoogleGenAI:', error.message);
    process.exit(1);
}

// UPDATED: Initialize Firebase Admin from environment variable
// ... (additional code for Firebase Admin)

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Routes
app.get('/', (req, res) => {
  res.send('SIA Backend Server is running!');
});

// ... (additional routes)

app.listen(PORT, () => {
  logger.log(`Server is running on port ${PORT}`);
});
```

يُستخدم لبناء APIs مع middleware للأمان والتحقق.

#### Axios: لإرسال طلبات HTTP. مثال:
على الرغم من أن Axios مدرج في dependencies، إليك مثال عام لاستخدامه (يمكن استبداله بـ fetch في المشروع):

```javascript
const axios = require('axios');

// إرسال بيانات إلى Firebase Functions
async function sendDataToBackend(data) {
  try {
    const response = await axios.post('https://your-firebase-function-url/api/endpoint', data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + userToken
      }
    });
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error sending data:', error);
  }
}
```

يُستخدم لإرسال طلبات HTTP إلى الخلفية.

#### مثال: إرسال بيانات من Front-End إلى Back-End عبر Firebase Functions مثال:
في المشروع، يُستخدم Firebase Callable Functions لإرسال البيانات. إليك مثال من كود افتراضي مشابه:

```javascript
// في الواجهة الأمامية (public/js/someFile.js)
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseInit'; // افتراضي

async function submitTestResults(testData) {
  const submitTest = httpsCallable(functions, 'submitTest');
  try {
    const result = await submitTest(testData);
    console.log('Test submitted successfully:', result.data);
  } catch (error) {
    console.error('Error submitting test:', error);
  }
}

// استدعاء الدالة
submitTestResults({ scores: { bigFive: {...}, holland: {...} } });
```

يُستخدم لإرسال نتائج الاختبارات إلى الخلفية للمعالجة والتخزين.

---

## 8. خاتمة

### 8.1 التحديات والحلول
تم حل مشكلات الأمان والأداء باستخدام Firebase.

### 8.2 التحسينات المستقبلية
إضافة دعم قواعد بيانات أكثر.

### 8.3 الخلاصة
المشروع يظهر استخدام تقنيات حديثة بفعالية.

---

## 9. مراجع
- Firebase Documentation  
- Google AI Docs  
- MDN Web Docs</content>
<parameter name="filePath">g:\Work Web\Final SIA Project\Final Book.md