const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const Interview = require('./models/Interview');
const User = require('./models/User');

// 1. Initialize Express App
const app = express();

// 2. Middleware Configuration
app.use(cors());
app.use(express.json());

// 3. Initialize Gemini AI & JWT Secret
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'ai_interview_secret_key_2026';

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected successfully!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Robust extractor for JSON objects or arrays from AI output
function parseGeminiJson(rawText) {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
      return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
    } else if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    throw e;
  }
}

// Resilient AI generation helper that loops through backup models
const CANDIDATE_MODELS = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-pro-latest'];

async function generateWithFallback(prompt) {
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      return parseGeminiJson(rawText);
    } catch (err) {
      console.warn(`Model ${modelName} unavailable, trying next... Error:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All AI models were unavailable.");
}

// In-memory cache for role skills
const skillCache = new Map();

// --- AUTHENTICATION ROUTES ---

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INTERVIEW ROUTES ---

// Route 1: Dynamic Skill Generation
app.post('/api/interview/suggest-skills', async (req, res) => {
  try {
    const { jobRole } = req.body;
    if (!jobRole || jobRole.trim().length < 2) {
      return res.json({ skills: [] });
    }

    const normalizedRole = jobRole.trim().toLowerCase();

    if (skillCache.has(normalizedRole)) {
      return res.json({ skills: skillCache.get(normalizedRole) });
    }

    const prompt = `Return a JSON array of 8 to 10 key technical skills, libraries, and core topics essential for the job role: "${jobRole}".
    Strictly format as a JSON array of strings: ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"]`;

    let skills = [];
    try {
      const result = await generateWithFallback(prompt);
      if (Array.isArray(result)) {
        skills = result;
      } else if (result.skills && Array.isArray(result.skills)) {
        skills = result.skills;
      }
    } catch (err) {
      console.warn("Falling back to standard skills taxonomy.");
      skills = [
        `${jobRole} Fundamentals`,
        'System Architecture',
        'Data Structures & Algorithms',
        'REST APIs & Microservices',
        'Database Optimization',
        'Testing & Debugging',
        'CI/CD & Git',
        'Performance Tuning'
      ];
    }

    skillCache.set(normalizedRole, skills);
    res.json({ skills });
  } catch (error) {
    console.error('Error suggesting skills:', error);
    res.status(500).json({ skills: [] });
  }
});

// Route 2: Generate Questions & Start Session
app.post('/api/interview/start', async (req, res) => {
  const { jobRole, techStack, experienceYears, userId } = req.body;

  try {
    const prompt = `Generate exactly 3 interview questions for a candidate applying for the role of ${jobRole} with ${experienceYears} years of experience specializing in ${techStack}.
    Return strictly a JSON array of objects with the key "question".
    Example format: [{"question": "Can you explain the difference between processes and threads?"}]`;

    let parsedQuestions;
    try {
      parsedQuestions = await generateWithFallback(prompt);
    } catch (aiErr) {
      console.warn("AI generation failed; applying role-based fallback questions.");
      parsedQuestions = [
        { question: `Describe your hands-on experience working with ${techStack} and how you architect projects for a ${jobRole} role.` },
        { question: `What are some of the most challenging technical bottlenecks or edge cases you resolved using ${techStack}?` },
        { question: `How do you ensure code maintainability, security, and high performance in your systems?` }
      ];
    }

    const interview = new Interview({
      userId: userId || null,
      jobRole,
      techStack,
      experienceYears,
      questions: parsedQuestions
    });

    await interview.save();
    res.status(201).json(interview);
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route 3: Evaluate User Answer with Rubric & Follow-ups
app.post('/api/interview/:id/evaluate', async (req, res) => {
  try {
    const { questionId, userAnswer } = req.body;
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    const questionItem = interview.questions.id(questionId);
    if (!questionItem) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const cleanedAnswer = (userAnswer || '').trim() || 'No answer provided.';
    questionItem.userAnswer = cleanedAnswer;

    let evaluation;

    try {
      const prompt = `Evaluate the candidate's interview answer based on these 4 rubric metrics (score each 1 to 10):
      1. technicalAccuracy (1-10)
      2. communicationStructure (1-10)
      3. confidenceConciseness (1-10)
      4. edgeCaseAwareness (1-10)

      Target Role: ${interview.jobRole}
      Target Tech Stack: ${interview.techStack}
      Question: ${questionItem.question}
      Candidate Answer: ${cleanedAnswer}

      Also evaluate: If the candidate's answer is incomplete, vague, or mentions a high-level concept without detail, set "needsFollowUp" to true and write a 1-sentence sharp "followUpQuestion". If the answer is complete or already a follow-up, set "needsFollowUp" to false and "followUpQuestion" to "".

      Return strictly a JSON object with this exact structure:
      {
        "overallScore": 8,
        "metrics": {
          "technicalAccuracy": 8,
          "communicationStructure": 7,
          "confidenceConciseness": 8,
          "edgeCaseAwareness": 6
        },
        "strengths": "Clear explanation of fundamental principles.",
        "improvements": "Discuss trade-offs and performance implications.",
        "idealAnswer": "A concise, complete 2-sentence optimal answer.",
        "needsFollowUp": false,
        "followUpQuestion": ""
      }`;

      evaluation = await generateWithFallback(prompt);
    } catch (aiErr) {
      console.warn('Evaluation fallback triggered:', aiErr.message);
      const isBlank = cleanedAnswer === 'No answer provided.';
      evaluation = {
        overallScore: isBlank ? 2 : 7,
        metrics: {
          technicalAccuracy: isBlank ? 2 : 7,
          communicationStructure: isBlank ? 2 : 7,
          confidenceConciseness: isBlank ? 2 : 7,
          edgeCaseAwareness: isBlank ? 2 : 6
        },
        strengths: isBlank ? 'Attempt recorded.' : 'Provided a direct foundational answer.',
        improvements: 'Provide concrete real-world examples and edge case handling.',
        idealAnswer: 'Structure the response with definition, architectural implementation, and performance trade-offs.',
        needsFollowUp: false,
        followUpQuestion: ""
      };
    }

    questionItem.feedback = evaluation;

    if (evaluation.needsFollowUp && evaluation.followUpQuestion && !questionItem.isFollowUp) {
      interview.questions.splice(interview.questions.indexOf(questionItem) + 1, 0, {
        question: `[Follow-up Drill-down] ${evaluation.followUpQuestion}`,
        userAnswer: '',
        isFollowUp: true,
        parentQuestionId: questionItem._id
      });
    }

    await interview.save();
    res.json({ feedback: evaluation, updatedQuestions: interview.questions });
  } catch (error) {
    console.error('Error evaluating answer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route 4: User Session History
app.get('/api/interview/user/:userId', async (req, res) => {
  try {
    const history = await Interview.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));