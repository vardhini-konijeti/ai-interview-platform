const mongoose = require('mongoose');

const QASchema = new mongoose.Schema({
  question: { type: String, required: true },
  userAnswer: { type: String, default: "" },
  isFollowUp: { type: Boolean, default: false },
  parentQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  feedback: {
    overallScore: Number,
    metrics: {
      technicalAccuracy: Number,
      communicationStructure: Number,
      confidenceConciseness: Number,
      edgeCaseAwareness: Number
    },
    strengths: String,
    improvements: String,
    idealAnswer: String,
    needsFollowUp: Boolean,
    followUpQuestion: String
  }
});

const InterviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  jobRole: { type: String, required: true },
  techStack: { type: String, required: true },
  experienceYears: { type: Number, required: true },
  questions: [QASchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Interview', InterviewSchema);