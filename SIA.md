# SIA Project Roadmap & Workflow

Comprehensive documentation for the **Success Interest Assessment (SIA)** platform development lifecycle and operational architecture.

---

## 🚀 Project Core Workflow

The development lifecycle follows a structured path from psychological assessment design to AI-enhanced career recommendations.

### 1. Setup & Foundations

- **Environment**: Node.js backend with Firebase (Functions, Firestore, Hosting).
- **Configuration**: Environment variables (secrets) management for Gemini AI integration.
- **Static Research**: Compilation of industry-standard career data (High/Low Big Five traits and Holland RISEC codes).

### 2. Implementation Phase

- **Frontend Development**: Building responsive UI for Big Five and Holland personality tests.
- **Scoring Engine**: Implementation of `matching.js` to calculate compatibility using weighted averages (60% Holland, 40% Big Five).
- **AI Integration**: Developing `helpers.js` to interface with Google Gemini 1.5 Flash for personalized career narratives.

### 3. Execution & Deployment

- **Firestore Triggers**: Automated workflow where test completion triggers scoring and AI analysis.
- **Production Deployment**: Deployment via Firebase CLI and Railway for scalable backend hosting.

---

## ⚙️ Operational Logic

The system operates as a data-driven pipeline where psychological metrics are transformed into career insights.

### Component Interaction Flow:

1. **User Interaction**: User completes standardized tests on the frontend.
2. **Data Persistence**: Results are stored in the `tests_results` collection in Firestore.
3. **Trigger Event**: `functions/src/triggers.js` detects the new document.
4. **Matching Engine**: `matching.js` queries `careers.js` and performs a data-driven match.
5. **AI Synthesis**: `generateAnalysis` calls the Gemini API, providing the data-driven matches as context to ensure AI results are grounded in logic.
6. **Result Delivery**: The finalized analysis is saved to the user's profile and displayed via the frontend `profile.js`.

---

## 🏁 Post-Completion Protocol

Standardized procedures for validating, maintaining, and handing over the project.

### 🧪 Automated Testing & QA

- **Linter**: Consistent code quality enforced via `ESLint` using `.eslintrc.js` (standardizing LF line endings and ES6+ syntax).
- **Unit Testing**: Validation of the `matching.js` engine (e.g., `normalize` and `calculateMatchScore` functions).
- **Integration Tests**: Firebase Emulator Suite for local verification of Firestore triggers and function execution.

### 📝 Error Handling & Logging

- **Centralized Logging**: Using `firebase-functions/logger` for production-safe observability.
- **AI Resilience**: 30-second timeout handling and JSON parsing fallback logic for Gemini responses.
- **Validation**: Strict schema checks for test result inputs to prevent runtime errors during scoring.

### 📦 Data Archiving & Handover

- **Production Handover**: Secure transfer of Firebase project ownership and secret configuration.
- **Database Backups**: Periodic exports of Firestore data for integrity.
- **Documentation**: Inline JSDoc comments for all core functions (`normalize`, `calculateMatchScore`, `generateAnalysis`).

### 🛠️ Maintenance & Iteration

- **Career Updates**: Modify `functions/src/data/careers.js` to add new roles or update salary benchmarks.
- **Algorithm Tuning**: Adjustment of `WEIGHT_HOLLAND` and `WEIGHT_BIGFIVE` constants in `matching.js` based on user feedback.
- **Model Upgrades**: Transition to newer versions of `gemini-api` as they become available.

---

_Last Updated: 2025-12-18_
