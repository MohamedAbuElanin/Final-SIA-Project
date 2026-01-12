/**
 * Static Career Database for Matching Engine
 * Defines careers with their required Holland Codes and Big Five Personality Traits.
 * Updated to include specific Tech roles and Dual-Currency Salaries per System Architect requirements.
 */

const careers = [
  // --- Technology Careers (Required) ---
  {
    id: "frontend-developer",
    title: "Front-End Developer",
    category: "Technology",
    holland: ["A", "I", "R"], // Artistic (UI), Investigative (Logic), Realistic (Code)
    bigFive: {
      O: "high", // Creativity/New Frameworks
      C: "high", // Detail-oriented
      N: "low", // Deadline stress
    },
    salary: {
      egypt: "15,000 - 35,000 EGP",
      usa: "$80,000 - $140,000",
    },
    education: "Bachelor's or Bootcamp",
    description: "Build the visual and interactive elements of websites and web applications " +
      "that users see and interact with.",
    skills: ["JavaScript/React", "CSS/Tailwind", "UI/UX Principles"],
    details: {
      roadmap: [
        {step: "Basics", description: "Master HTML, CSS, and modern JavaScript (ES6+)."},
        {step: "Frameworks", description: "Learn a popular framework like React, Vue, or Angular."},
        {step: "Tools", description: "Understand Git, Package Managers (npm), and Build Tools."},
      ],
    },
  },
  {
    id: "backend-developer",
    title: "Back-End Developer",
    category: "Technology",
    holland: ["I", "R", "C"], // Investigative, Realistic, Conventional
    bigFive: {
      C: "high", // Logic/Structure
      I: "high", // Deep focus
      O: "mid",
    },
    salary: {
      egypt: "20,000 - 45,000 EGP",
      usa: "$95,000 - $160,000",
    },
    education: "Bachelor's Degree",
    description: "Develop the server-side logic, databases, and APIs that power web applications.",
    skills: ["Node.js/Python", "Databases (SQL/NoSQL)", "API Design"],
    details: {
      roadmap: [
        {step: "Server Logic", description: "Learn a backend language (Node.js, Python, Go)."},
        {step: "Databases", description: "Master SQL (PostgreSQL) and NoSQL (MongoDB)."},
        {step: "Architecture", description: "Understand REST APIs, Microservices, and Auth."},
      ],
    },
  },
  {
    id: "fullstack-developer",
    title: "Full-Stack Developer",
    category: "Technology",
    holland: ["I", "A", "R"],
    bigFive: {
      O: "high", // Adaptability
      C: "high",
    },
    salary: {
      egypt: "25,000 - 55,000 EGP",
      usa: "$110,000 - $180,000",
    },
    education: "Bachelor's or Equivalent",
    description: "Handle both front-end and back-end responsibilities, understanding the " +
      "entire web development lifecycle.",
    skills: ["MERN Stack", "System Architecture", "DevOps Basics"],
    details: {
      roadmap: [
        {step: "Foundation", description: "Gain proficiency in both frontend and backend technologies."},
        {step: "Integration", description: "Learn to connect UIs with APIs and Databases effectively."},
        {step: "Deployment", description: "Master CI/CD, Cloud providers (AWS/Firebase), and Docker."},
      ],
    },
  },
  {
    id: "ai-engineer",
    title: "AI Engineer",
    category: "Technology",
    holland: ["I", "R", "C"],
    bigFive: {
      O: "high", // Innovation
      I: "high", // Complex problem solving
      C: "high",
    },
    salary: {
      egypt: "30,000 - 65,000 EGP",
      usa: "$120,000 - $200,000",
    },
    education: "Master's or Specialized Cert",
    description: "Build and deploy artificial intelligence models and systems, including " +
      "machine learning and deep learning applications.",
    skills: ["Python/PyTorch", "Data Structures", "Neural Networks"],
    details: {
      roadmap: [
        {step: "Math & Stats", description: "Solidify Linear Algebra, Calculus, and Probability."},
        {step: "ML Basics", description: "Learn Scikit-Learn, Supervised/Unsupervised learning."},
        {
          step: "Deep Learning",
          description: "Master TensorFlow or PyTorch and specialized architectures (Transformers).",
        },
      ],
    },
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    category: "Technology",
    holland: ["I", "C", "R"],
    bigFive: {
      O: "high",
      C: "high",
    },
    salary: {
      egypt: "25,000 - 50,000 EGP",
      usa: "$115,000 - $180,000",
    },
    education: "Master's Degree",
    description: "Analyze complex data sets to discover patterns, trends, and actionable " +
      "insights for business decisions.",
    skills: ["Statistics", "Data Visualization", "Big Data Tools"],
    details: {
      roadmap: [
        {step: "Data Analysis", description: "Learn Pandas, NumPy, and SQL for data manipulation."},
        {step: "Visualization", description: "Master Tableau, PowerBI, or Matplotlib."},
        {step: "Modeling", description: "Apply statistical models to predictive analytics."},
      ],
    },
  },
  {
    id: "cyber-security-specialist",
    title: "Cyber Security Specialist",
    category: "Technology",
    holland: ["R", "I", "C"],
    bigFive: {
      C: "high", // Vigilance
      N: "low", // High pressure
      R: "high", // Hands-on
    },
    salary: {
      egypt: "25,000 - 55,000 EGP",
      usa: "$100,000 - $170,000",
    },
    education: "Bachelor's + Certs (CISSP)",
    description: "Protect systems, networks, and programs from digital attacks, ensuring " +
      "data confidentiality and integrity.",
    skills: ["Network Security", "Ethical Hacking", "Risk Assessment"],
    details: {
      roadmap: [
        {step: "Networking", description: "Deep understanding of TCP/IP, OSI Model, and protocols."},
        {
          step: "Security Basics",
          description: "Learn about firewalls, encryption, and common vulnerabilities (OWASP).",
        },
        {step: "Advanced", description: "Penetration testing, incident response, and compliance."},
      ],
    },
  },

  // --- Other Key Careers (Retained for Variety) ---
  {
    id: "digital-marketer",
    title: "Digital Marketer",
    category: "Business",
    holland: ["E", "A", "C"],
    bigFive: {
      E: "high",
      O: "high",
    },
    salary: {
      egypt: "12,000 - 30,000 EGP",
      usa: "$60,000 - $110,000",
    },
    education: "Bachelor's Degree",
    description: "Promote products or brands using digital channels like social media, search engines, and email.",
    skills: ["SEO/SEM", "Content Strategy", "Analytics"],
  },
  {
    id: "project-manager",
    title: "Technical Project Manager",
    category: "Business/Tech",
    holland: ["E", "S", "C"],
    bigFive: {
      E: "high",
      C: "high",
      N: "low",
    },
    salary: {
      egypt: "25,000 - 60,000 EGP",
      usa: "$90,000 - $150,000",
    },
    education: "Bachelor's + PMP",
    description: "Plan, execute, and close projects, ensuring they are completed on time and within budget.",
    skills: ["Agile/Scrum", "Leadership", "Resource Planning"],
  },
];

// Helper to get all careers
const getAllCareers = () => careers;

// Helper to get career by ID
const getCareerById = (id) => careers.find((c) => c.id === id);

module.exports = {
  careers,
  getAllCareers,
  getCareerById,
};
