# HirePrep 🎯

An intelligent, full-stack AI-driven technical interview simulation platform. **HirePrep** empowers candidates to practice role-specific technical and behavioral interviews tailored dynamically to target roles, tech stacks, and experience levels. 

The application integrates real-time Speech-to-Text transcription, live video recording, dynamic audio wave visualization, adaptive follow-up drill-downs, and multidimensional rubric evaluations with actionable model feedback.

---

## 🚀 Live Demo

- **Live Application:** [https://hireprep-platform.vercel.app](https://hireprep-platform.vercel.app)

---

## 🌟 Key Features

* **Dynamic Skill & Topic Recommendation:** Automatically predicts relevant technical topics and libraries based on any target job role input.
* **Multimodal Candidate Experience:**
  * **Live Speech-to-Text:** Real-time speech transcription powered by the browser Web Speech API.
  * **Interactive Audio Visualizer:** Real-time frequency waveform rendering using `AudioContext` and HTML5 `<canvas>`.
  * **Webcam Feed & Video Playback:** In-browser response recording via the `MediaRecorder` API with immediate post-session review.
  * **AI Voice Synthesis:** Text-to-Speech (TTS) reading of interview questions.
* **Adaptive Drill-Down System:** Automatically evaluates response completeness and injects sharp follow-up questions when high-level concepts require deeper technical clarification.
* **4-Dimensional Rubric Scoring:** Comprehensive evaluation scoring across:
  * *Technical Accuracy* (1–10)
  * *Communication & Structure* (1–10)
  * *Confidence & Conciseness* (1–10)
  * *Edge Case Awareness* (1–10)
* **Actionable Feedback Engine:** Generates specific candidate strengths, prioritized areas for improvement, and benchmark suggested answers.
* **Authentication & Historical Analytics:** Secure JWT-based authentication enabling users to track their progress and review full past interview reports from MongoDB.
* **Modern UI & Theming:** Custom dark/light theme toggle, custom experience level stepper, and responsive design.

---

## 🛠️ Architecture & Tech Stack
```
┌─────────────────────────────────────────────────────────────┐
│                    React Client (Vite)                      │
│   Web Speech API  │  MediaRecorder  │  HTML5 Canvas Visual  │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────┐
│                  Node.js / Express Server                   │
│   JWT Auth  │  Defensive JSON Parser  │  Multi-Model Queue  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼─────────────┐   ┌─────────────▼──────────────┐
│     MongoDB Atlas / DB     │   │   Google Gemini API Engine │
│  Users & Interview History │   │ Structured Evaluation & Qs │
└────────────────────────────┘   └────────────────────────────┘
```

* **Frontend:** React 18, Vite, Axios, HTML5 Media APIs (`getUserMedia`, `MediaRecorder`, `AudioContext`, `SpeechRecognition`, `SpeechSynthesis`).
* **Backend:** Node.js, Express.js, JSON Web Tokens (JWT), Bcrypt.js, Mongoose.
* **Database:** MongoDB Atlas.
* **Intelligence Layer:** Google Generative AI SDK (`@google/generative-ai`) with resilient multi-model fallback handling (`gemini-2.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-pro-latest`).
* **Deployment:** Vercel (Frontend), Render (Backend).

---

## 📂 Project Structure

```ai-interview-platform/
├── backend/
│   ├── models/
│   │   ├── Interview.js      # Interview session, questions & rubric schema
│   │   └── User.js           # User credentials & profile schema
│   ├── .env.example          # Environment variable template
│   ├── package.json
│   └── server.js             # Express API, auth routes & AI generation pipelines
└── frontend/
    ├── src/
    │   ├── api.js            # Axios client instance configuration
    │   ├── App.jsx           # Main application state machine & UI views
    │   ├── AudioVisualizer.jsx # Canvas-based microphone waveform component
    │   ├── index.css         # Reset styles, theme variables & animations
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Local Development Setup

### 1. Clone the Repository
```git clone [https://github.com/vardhini-konijeti/ai-interview-platform.git](https://github.com/vardhini-konijeti/ai-interview-platform.git)
cd ai-interview-platform

### 2. Configure Backend

```cd backend
npm install

### 2. Configure Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/interview-db?retryWrites=true&w=majority
GEMINI_API_KEY=your_google_gemini_api_key_here
JWT_SECRET=your_jwt_secret_key_here
```

Start the backend server:

```bash
node server.js
```

### 3. Configure Frontend

Open a new terminal window:

```bash
cd frontend
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## 🔒 API Endpoints Reference

### Authentication

| **Method** | **Endpoint**         | **Description**                                  |
| ---------- | -------------------- | ------------------------------------------------ |
| `POST`     | `/api/auth/register` | Register a new user account with hashed password |
| `POST`     | `/api/auth/login`    | Authenticate user and issue JSON Web Token (JWT) |

### Interview Engine

| **Method** | **Endpoint**                    | **Description**                                                         |
| ---------- | ------------------------------- | ----------------------------------------------------------------------- |
| `POST`     | `/api/interview/suggest-skills` | Returns dynamically identified technical skills for a role              |
| `POST`     | `/api/interview/start`          | Creates interview session and generates structured questions            |
| `POST`     | `/api/interview/:id/evaluate`   | Evaluates answer, calculates 4-point rubric, and checks for drill-downs |
| `GET`      | `/api/interview/user/:userId`   | Retrieves past interview history and performance scores for a user      |

## 🛡️ Reliability & Prompt Engineering

- **Defensive JSON Extraction:** AI responses are processed through boundary parsing algorithms to strip extraneous markdown backticks and handle formatting drift.
- **In-Memory Caching:** Dynamic skill recommendations are cached in memory to minimize redundant API calls.
- **Failover Queue:** If the primary AI model experiences latency or rate limits, requests fail over through secondary models without terminating the interview session.

## 📄 License

This project is open-source and available under the [MIT License](https://www.google.com/search?q=LICENSE).
