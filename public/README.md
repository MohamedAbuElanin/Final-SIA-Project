## SIA – Ancient Wisdom for Modern Careers

SIA (Ancient Wisdom for Modern Careers) is a web-based platform that helps individuals understand their personality traits and learn more effectively. After completing a guided assessment, users receive a tailored dashboard with insights and curated learning recommendations across courses, books, YouTube channels, and a personalized roadmap.

---

### Project Overview

The platform guides users through a personality analysis workflow and translates the results into actionable learning resources. By centralizing assessments and recommendations in a single interface, SIA empowers learners to plan their growth journeys with confidence.

---

### Features

- **Personality Assessment** – Deliver an interactive test to evaluate user traits and learning styles.
- **Dynamic Insights Dashboard** – Present analysis results with visual highlights and key takeaways.
- **Personalized Resources** – Recommend courses, books, channels, and roadmaps aligned with a user's profile.
- **User Accounts** – Allow visitors to sign up, log in, and revisit their personalized dashboard.
- **Admin Management** – Provide administrative tools for managing users, assessment outputs, and reports.
- **Privacy & Terms** – Communicate legal and data usage policies.
- **Responsive Experience** – Offer a consistent interface across desktop and mobile devices.
- **Error Handling** – Gracefully handle 404 and access-denied scenarios.

---

### Project Structure

- **Home** – Welcome page summarizing the platform, key benefits, and primary calls to action.
- **About** – Describe SIA’s mission, methodology, and team values.
- **Login** – Authenticate returning users to access their personalized dashboards.
- **Sign Up** – Register new users and collect initial profile information.
- **Profile** – Central hub for users showing assessment outcomes, recommended courses, books, channels, and their roadmap.
- **Test** – Hosts the personality assessment flow with instructions and dynamic questions.
- **Admin** – Restricted area for administrators to manage users, assessment results, and downloadable reports.
- **Privacy & Terms** – Outline privacy practices, terms of service, and consent information.
- **Error (404 / Access Denied)** – Custom pages to guide users when a route is missing or permissions are insufficient.

---

### Technologies Used

- **Frontend** – HTML, CSS, JavaScript
- **Future Enhancements** – Planned backend services (e.g., Node.js, Express, database integration) to support authentication, data persistence, and AI-driven recommendations.

---

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/MohamedAbuElanin/SIA.git

# Change into the project directory
cd SIA
```

Since this version is a static frontend, you can open `index.html` directly in your browser or use a local development server for a smoother experience:

```bash
# Example: using a lightweight Python HTTP server
python -m http.server 8000

# Then visit
# http://localhost:8000
```

---

### Usage Instructions

- **Explore the Home page** to understand the platform and begin the assessment journey.
- **Create an account** via the Sign Up page, then log in to access your personalized dashboard.
- **Complete the Test** to generate detailed personality insights and resource recommendations.
- **Review your Profile** for dynamic insights, curated learning resources, and your roadmap.
- **Return anytime** to revisit recommendations, adjust goals, or retake assessments as they evolve.
- **Administrators** can access the Admin portal (with proper credentials) to manage users, results, and reports.

---

### Contributors

- **Mohamed Osman** – Project Leader & AI Developer  
- **Wafa** – Front-End Developer  
- **Mahmoud** – Back-End Developer

---

### License

This project is licensed under the MIT License. – see the `LICENSE` file for details.

---

### Future Improvements

- Integrate AI-based recommendation engine for deeper personalization.
- Add backend APIs and database support for secure data storage.
- Implement robust authentication, authorization, and role management.
- Provide analytics dashboards for admins to monitor engagement trends.
- Expand multilingual support for broader accessibility.

# SIA