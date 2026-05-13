# 🌦️ SkySense — Real-Time Weather Application

A modern, responsive, and performance-optimized weather application built using **Vanilla JavaScript, HTML5, CSS3, and Node.js**.

SkySense provides real-time weather insights, air quality monitoring, hourly & daily forecasts, smart search autocomplete, offline caching, and a polished UI/UX experience.

---

# 🚀 Live Features

✅ Real-time weather data  
✅ Hourly & 5-day forecast  
✅ Air Quality Index (AQI) monitoring  
✅ Geolocation-based weather detection  
✅ Search autocomplete suggestions  
✅ Celsius / Fahrenheit toggle  
✅ Progressive Web App (PWA) support  
✅ Offline caching with Service Worker  
✅ In-memory TTL caching system  
✅ Rate-limited backend API proxy  
✅ Fully responsive premium UI  
✅ Modular ES6 architecture  
✅ Accessibility-focused design  

---

# 🛠️ Tech Stack

## Frontend
- HTML5
- CSS3
- Vanilla JavaScript (ES6 Modules)

## Backend
- Node.js
- Express.js

## APIs
- WeatherAPI.com

## Tooling
- ESLint
- Vitest
- Vercel
- Git & GitHub

---

# 📂 Project Structure

```bash
Weather_app/
│
├── api/                  # Serverless API proxy handlers
│   ├── search.js
│   └── weather.js
│
├── src/                  # Frontend modules
│   ├── animations.js
│   ├── api.js
│   ├── cache.js
│   ├── state.js
│   ├── ui.js
│   └── utils.js
│
├── test/                 # Unit tests
│   ├── api.test.js
│   ├── cache.test.js
│   ├── state.test.js
│   └── utils.test.js
│
├── server.js             # Express development server
├── sw.js                 # Service Worker
├── style.css             # Design token based styling
├── script.js             # App entry point
├── index.html
├── manifest.json
└── package.json

⚡ Performance Optimizations

SkySense is optimized for speed and responsiveness.

🔹 Smart Caching Strategy
Data Type	Cache Duration
Weather Data	10 Minutes
Forecast Data	30 Minutes
Search Suggestions	60 Minutes
🔹 Additional Optimizations
350ms debounced search input
AbortController for stale requests
Service Worker offline caching
Network-first API strategy
Cache-first app shell strategy
Lightweight modular architecture
🔒 Security Features
API key hidden using backend proxy
Strict CORS policy
Input sanitization
IP-based rate limiting
Environment variable protection
Secure API request handling
🎨 UI/UX Highlights
Premium dark glassmorphism-inspired interface
Smooth animations and transitions
Mobile-first responsive design
Accessible keyboard navigation
Semantic HTML5 structure
WCAG-inspired accessibility practices
📸 Screenshots
🏠 Home Screen

Add your screenshot here

🌍 Weather Dashboard

Add your screenshot here

📱 Mobile Responsive View

Add your screenshot here

🧪 Running Locally
1️⃣ Clone Repository
git clone https://github.com/kuldeepcodex/skysense-weather-app.git
2️⃣ Navigate Into Project
cd skysense-weather-app
3️⃣ Install Dependencies
npm install
4️⃣ Create Environment File

Create a .env file in the root folder:

WEATHER_API_KEY=your_api_key_here

Get your free API key from:

https://www.weatherapi.com/

5️⃣ Start Development Server
npm run dev

Server runs at:

http://localhost:3000
☁️ Deployment

This project is configured for deployment on:

Vercel
Netlify
Render

Recommended Platform:

👉 Vercel

🧠 Learning Outcomes

This project helped in understanding:

API integration
Backend proxy architecture
State management
Caching systems
Service Workers
PWA concepts
Modular JavaScript architecture
Performance optimization
Accessibility principles
Secure environment handling
📈 Future Improvements
Weather radar maps
Theme customization
Weather alerts system
User accounts & favorites
Shareable weather cards
Advanced analytics dashboard
Multi-language support
Voice-based search
👨‍💻 Author
Kuldeep Nagar

MCA Student | Full Stack & Software Development Enthusiast

GitHub: https://github.com/kuldeepcodex
LinkedIn: https://www.linkedin.com/in/kuldeepnagar2005/
⭐ Support

If you liked this project:

⭐ Star the repository
🍴 Fork the project
📢 Share it on LinkedIn

📄 License

This project is licensed under the MIT License.

🌩️ SkySense

"Real-time weather with a little atmosphere."