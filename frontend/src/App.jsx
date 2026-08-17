import React, { useState, useEffect, useRef } from 'react';
import { API } from './api';
import AudioVisualizer from './AudioVisualizer';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'dark');
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
  };

  // Color Palette
  const colors = {
    bgGradient: isDark 
      ? 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 100%)' 
      : 'radial-gradient(ellipse at top, #e0e7ff 0%, #f1f5f9 100%)',
    textColor: isDark ? '#f8fafc' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    labelColor: isDark ? '#cbd5e1' : '#334155',
    cardBg: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    navBg: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.85)',
    inputBg: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
    inputText: isDark ? '#ffffff' : '#0f172a',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.6)' : '0 10px 25px rgba(0,0,0,0.06)',
    pillBg: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
    pillBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
    pillText: isDark ? '#94a3b8' : '#475569',
    videoContainerBg: isDark ? '#020617' : '#0f172a',
    gaugeBg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    stepperBtnBg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'
  };

  // View Stages: 'setup' | 'interview' | 'results' | 'history'
  const [stage, setStage] = useState('setup');

  // Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('interview_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [userHistory, setUserHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Setup Form State
  const [jobRole, setJobRole] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkills, setCustomSkills] = useState('');
  const [experienceYears, setExperienceYears] = useState(1);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [isFetchingSkills, setIsFetchingSkills] = useState(false);

  // Active Interview State
  const [interview, setInterview] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allFeedback, setAllFeedback] = useState([]);
  const [timer, setTimer] = useState(0);
  const [mediaStream, setMediaStream] = useState(null);

  // Media Recording
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [recordedVideos, setRecordedVideos] = useState([]);

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await API.post(endpoint, authForm);
      localStorage.setItem('interview_token', res.data.token);
      localStorage.setItem('interview_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setShowAuthModal(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Authentication failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('interview_token');
    localStorage.removeItem('interview_user');
    setUser(null);
    setStage('setup');
  };

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`/interview/user/${user.id}`);
      setUserHistory(res.data);
      setStage('history');
    } catch (err) {
      alert('Failed to load past sessions.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewPastReport = (session) => {
    if (!session.questions || session.questions.length === 0) {
      alert('No recorded evaluation details found for this session.');
      return;
    }

    const formattedFeedback = session.questions
      .filter(q => q.feedback)
      .map(q => ({
        question: q.question,
        userAnswer: q.userAnswer,
        isFollowUp: q.isFollowUp,
        overallScore: q.feedback.overallScore || q.feedback.score || 7,
        metrics: q.feedback.metrics || {
          technicalAccuracy: 7,
          communicationStructure: 7,
          confidenceConciseness: 7,
          edgeCaseAwareness: 6
        },
        strengths: q.feedback.strengths,
        improvements: q.feedback.improvements,
        idealAnswer: q.feedback.idealAnswer
      }));

    if (formattedFeedback.length === 0) {
      alert('This session was not submitted or evaluated.');
      return;
    }

    setInterview(session);
    setAllFeedback(formattedFeedback);
    setRecordedVideos([]);
    setStage('results');
  };

  // Dynamic Skill Suggestions
  useEffect(() => {
    const trimmedRole = jobRole.trim();
    if (trimmedRole.length < 2) {
      setSuggestedSkills([]);
      setIsFetchingSkills(false);
      return;
    }

    setIsFetchingSkills(true);
    const delayFn = setTimeout(async () => {
      try {
        const res = await API.post('/interview/suggest-skills', { jobRole: trimmedRole });
        setSuggestedSkills(res.data.skills || []);
      } catch (err) {
        console.warn('Skill suggestions unavailable:', err);
      } finally {
        setIsFetchingSkills(false);
      }
    }, 450);

    return () => clearTimeout(delayFn);
  }, [jobRole]);

  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  // Audio Synthesis & Recognition
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    let interval;
    if (stage === 'interview') {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e) => {
        const text = Array.from(e.results).map(r => r[0].transcript).join('');
        setTranscript(text);
      };
      recognition.onerror = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMediaStream(stream);
    } catch (e) {
      console.warn('Camera/Mic access denied:', e);
    }
  };

  const startMediaRecorder = () => {
    if (!mediaStream) return;
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          setRecordedVideos(prev => [...prev, URL.createObjectURL(blob)]);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('MediaRecorder failed to start:', err);
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    const combinedSkills = [...selectedSkills];
    if (customSkills.trim()) {
      combinedSkills.push(...customSkills.split(',').map(s => s.trim()).filter(Boolean));
    }
    if (combinedSkills.length === 0) {
      alert('Please select or add at least one topic.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/interview/start', {
        userId: user ? user.id : null,
        jobRole,
        techStack: combinedSkills.join(', '),
        experienceYears
      });
      setInterview(res.data);
      setAllFeedback([]);
      setRecordedVideos([]);
      setCurrentIndex(0);
      setTimer(0);
      setStage('interview');
      setTimeout(() => {
        startMedia();
        if (res.data.questions?.length > 0) speakText(res.data.questions[0].question);
      }, 500);
    } catch (err) {
      alert('Failed to initialize session. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopMediaRecorder();
      setIsRecording(false);
    } else {
      setTranscript('');
      if (recognitionRef.current) recognitionRef.current.start();
      startMediaRecorder();
      setIsRecording(true);
    }
  };

  const handleSubmit = async () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopMediaRecorder();
      setIsRecording(false);
    }
    setLoading(true);

    try {
      const currentQ = interview.questions[currentIndex];
      const res = await API.post(`/interview/${interview._id}/evaluate`, {
        questionId: currentQ._id,
        userAnswer: transcript || 'No answer provided.'
      });

      const { feedback, updatedQuestions } = res.data;
      setAllFeedback(prev => [...prev, { 
        question: currentQ.question, 
        userAnswer: transcript || 'No answer provided.',
        isFollowUp: currentQ.isFollowUp, 
        ...feedback 
      }]);

      if (updatedQuestions) {
        setInterview(prev => ({ ...prev, questions: updatedQuestions }));
      }

      const nextQuestions = updatedQuestions || interview.questions;
      if (currentIndex + 1 < nextQuestions.length) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setTranscript('');
        speakText(nextQuestions[nextIndex].question);
      } else {
        if (videoRef.current?.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        setStage('results');
      }
    } catch (err) {
      alert('Analysis failed. Please submit again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const getAverageMetrics = () => {
    if (!allFeedback.length) return { technical: 0, communication: 0, confidence: 0, edgeCases: 0, overall: 0 };
    let technical = 0, communication = 0, confidence = 0, edgeCases = 0, overall = 0;

    allFeedback.forEach(f => {
      overall += Number(f.overallScore || f.score || 7);
      if (f.metrics) {
        technical += Number(f.metrics.technicalAccuracy || 7);
        communication += Number(f.metrics.communicationStructure || 7);
        confidence += Number(f.metrics.confidenceConciseness || 7);
        edgeCases += Number(f.metrics.edgeCaseAwareness || 6);
      }
    });

    const len = allFeedback.length;
    return {
      overall: (overall / len).toFixed(1),
      technical: (technical / len).toFixed(1),
      communication: (communication / len).toFixed(1),
      confidence: (confidence / len).toFixed(1),
      edgeCases: (edgeCases / len).toFixed(1)
    };
  };

  const avg = getAverageMetrics();

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: colors.bgGradient, color: colors.textColor, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '40px 20px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Top Navbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', padding: '14px 22px', background: colors.navBg, borderRadius: '14px', border: `1px solid ${colors.cardBorder}`, backdropFilter: 'blur(10px)', boxShadow: isDark ? 'none' : '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div 
            onClick={() => setStage('setup')} 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 12px #6366f1' }}></div>
            <span style={{ fontWeight: '800', letterSpacing: '0.5px', fontSize: '18px', color: colors.textColor }}>InterviewPrep Pro</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* 1. Custom Smooth Theme Pill Button */}
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: `1px solid ${colors.cardBorder}`,
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                color: colors.textColor,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.05)'
              }}
            >
              <span>{isDark ? '🌙' : '☀️'}</span>
              <span>{isDark ? 'Dark' : 'Light'}</span>
            </button>

            {stage === 'interview' && (
              <span style={{ color: colors.subText, fontSize: '14px', marginRight: '4px' }}>⏱ {formatTimer(timer)}</span>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={fetchHistory}
                  style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid #6366f1', color: '#818cf8', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  My History
                </button>
                <div style={{ background: isDark ? '#334155' : '#e2e8f0', color: colors.textColor, padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>
                  👤 {user.name}
                </div>
                <button
                  onClick={handleLogout}
                  style={{ background: 'transparent', border: `1px solid ${colors.cardBorder}`, color: colors.subText, padding: '6px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>

        {/* AUTH MODAL */}
        {showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
            <div style={{ background: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', color: colors.textColor }}>
              <h2 style={{ fontSize: '22px', margin: '0 0 16px 0', color: colors.textColor }}>
                {authMode === 'login' ? 'Sign In' : 'Create an Account'}
              </h2>
              <form onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: colors.labelColor, marginBottom: '6px' }}>Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Hunter"
                      value={authForm.name}
                      onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '8px', color: colors.inputText, boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: colors.labelColor, marginBottom: '6px' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={authForm.email}
                    onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '8px', color: colors.inputText, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: colors.labelColor, marginBottom: '6px' }}>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '8px', color: colors.inputText, boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{ width: '100%', padding: '12px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: 'pointer', marginBottom: '12px' }}
                >
                  {authMode === 'login' ? 'Sign In' : 'Register'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    style={{ color: '#818cf8', cursor: 'pointer' }}
                  >
                    {authMode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
                  </span>
                  <span onClick={() => setShowAuthModal(false)} style={{ color: colors.subText, cursor: 'pointer' }}>Cancel</span>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 1. SETUP STAGE */}
        {stage === 'setup' && (
          <div style={{ background: colors.cardBg, backdropFilter: 'blur(16px)', border: `1px solid ${colors.cardBorder}`, borderRadius: '20px', padding: '36px', boxShadow: colors.boxShadow }}>
            <h2 style={{ fontSize: '26px', margin: '0 0 8px 0', fontWeight: '800', color: colors.textColor }}>Interview Simulator</h2>
            <p style={{ color: colors.subText, margin: '0 0 28px 0', fontSize: '15px' }}>Configure your custom technical interview session and receive structured feedback.</p>

            <form onSubmit={handleStart}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: colors.labelColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Job Role</label>
                  {isFetchingSkills && <div className="spinner"></div>}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Backend Engineer, React Specialist..."
                  value={jobRole}
                  onChange={e => setJobRole(e.target.value)}
                  style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.inputText, fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>

              {suggestedSkills.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#818cf8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recommended Skills for this Role
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {suggestedSkills.map((skill, idx) => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            border: isSelected ? '1px solid #818cf8' : `1px solid ${colors.pillBorder}`,
                            background: isSelected ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : colors.pillBg,
                            color: isSelected ? '#ffffff' : colors.pillText
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '} {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: colors.labelColor, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Additional / Custom Topics (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AWS Lambda, WebSockets (comma separated)"
                  value={customSkills}
                  onChange={e => setCustomSkills(e.target.value)}
                  style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.inputText, fontSize: '15px', boxSizing: 'border-box' }}
                />
              </div>

              {/* 2. Custom Experience Stepper & Level Badges */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: colors.labelColor, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Years of Experience
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Stepper Controls */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', padding: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setExperienceYears(prev => Math.max(0, prev - 1))}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        border: 'none',
                        background: colors.stepperBtnBg,
                        color: colors.textColor,
                        fontSize: '18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      −
                    </button>

                    <input
                      type="number"
                      min="0"
                      max="25"
                      value={experienceYears}
                      onChange={e => setExperienceYears(Math.max(0, Math.min(25, Number(e.target.value) || 0)))}
                      style={{
                        width: '50px',
                        textAlign: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: colors.textColor,
                        fontSize: '17px',
                        fontWeight: '700',
                        outline: 'none'
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setExperienceYears(prev => Math.min(25, prev + 1))}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        border: 'none',
                        background: colors.stepperBtnBg,
                        color: colors.textColor,
                        fontSize: '18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Level Tag Pill */}
                  <span style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                    color: '#6366f1',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}>
                    {experienceYears <= 1 ? '🌱 Entry-Level' : experienceYears <= 4 ? '🚀 Mid-Level' : '👑 Senior Engineer'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(79,70,229,0.35)' }}
              >
                {loading ? 'Preparing Assessment Questions...' : 'Enter Interview Chamber'}
              </button>
            </form>
          </div>
        )}

        {/* 2. ACTIVE INTERVIEW ROOM */}
        {stage === 'interview' && interview && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: colors.boxShadow }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', background: interview.questions[currentIndex]?.isFollowUp ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: interview.questions[currentIndex]?.isFollowUp ? '#fbbf24' : '#818cf8', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>
                      {interview.questions[currentIndex]?.isFollowUp ? '⚡ ADAPTIVE DRILL-DOWN' : `QUESTION ${currentIndex + 1} OF ${interview.questions.length}`}
                    </span>
                    <button 
                      onClick={() => speakText(interview.questions[currentIndex].question)}
                      style={{ background: 'transparent', border: `1px solid ${colors.cardBorder}`, color: colors.textColor, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🔊 Repeat
                    </button>
                  </div>
                  <h2 style={{ fontSize: '20px', lineHeight: '1.5', margin: 0, color: colors.textColor, fontWeight: '600' }}>
                    {interview.questions[currentIndex].question}
                  </h2>
                </div>

                <div style={{ marginTop: '24px', padding: '14px', background: colors.inputBg, borderRadius: '10px', border: `1px solid ${colors.cardBorder}` }}>
                  <span style={{ fontSize: '13px', color: colors.subText }}>💡 Tip: Address technical accuracy, architectural design, and edge cases clearly.</span>
                </div>
              </div>

              <div style={{ background: colors.videoContainerBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', overflow: 'hidden', height: '260px', position: 'relative' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRecording ? '#ef4444' : '#22c55e' }}></div> 
                  {isRecording ? '🔴 Recording Video' : 'Candidate Feed'}
                </div>
              </div>
            </div>

            <div style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: colors.boxShadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: colors.labelColor }}>Speech Transcription</span>
                <button
                  type="button"
                  onClick={toggleRecording}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isRecording ? '#ef4444' : '#10b981',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isRecording ? '0 0 16px rgba(239,68,68,0.4)' : '0 0 16px rgba(16,185,129,0.3)'
                  }}
                >
                  {isRecording ? '⏹ Stop Recording' : '🎙 Start Speaking'}
                </button>
              </div>

              <AudioVisualizer isRecording={isRecording} stream={mediaStream} />

              <textarea
                rows="4"
                placeholder="Speak into your microphone or type your answer directly here..."
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.inputText, fontSize: '15px', lineHeight: '1.6', boxSizing: 'border-box', marginBottom: '20px' }}
              />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
              >
                {loading ? 'Analyzing Your Response...' : currentIndex + 1 === interview.questions.length ? 'Finalize Interview & View Report' : 'Submit & Advance to Next Question ➔'}
              </button>
            </div>
          </div>
        )}

        {/* 3. PERFORMANCE REPORT */}
        {stage === 'results' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 4px 0', color: colors.textColor }}>Performance Evaluation</h2>
                <p style={{ color: colors.subText, margin: 0 }}>
                  {interview ? `${interview.jobRole} • ${interview.techStack}` : 'Assessment Breakdown'}
                </p>
              </div>
              {user && (
                <button
                  onClick={fetchHistory}
                  style={{ background: colors.inputBg, border: `1px solid ${colors.cardBorder}`, color: colors.textColor, padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  ← Back to History
                </button>
              )}
            </div>

            <div style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '28px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '32px', alignItems: 'center', boxShadow: colors.boxShadow }}>
              <div style={{ textAlign: 'center', borderRight: `1px solid ${colors.cardBorder}`, paddingRight: '20px' }}>
                <span style={{ fontSize: '13px', color: colors.subText, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overall Score</span>
                <div style={{ fontSize: '48px', fontWeight: '900', color: Number(avg.overall) >= 7 ? '#4ade80' : Number(avg.overall) >= 5 ? '#fbbf24' : '#f87171', margin: '6px 0' }}>
                  {avg.overall}
                </div>
                <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '12px', background: Number(avg.overall) >= 7 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: Number(avg.overall) >= 7 ? '#4ade80' : '#fbbf24', fontWeight: '700' }}>
                  {Number(avg.overall) >= 7.5 ? 'Strong Candidate' : Number(avg.overall) >= 5.5 ? 'Qualified with Improvements' : 'Needs Practice'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { label: 'Technical Accuracy', val: avg.technical },
                  { label: 'Communication & Structure', val: avg.communication },
                  { label: 'Confidence & Conciseness', val: avg.confidence },
                  { label: 'Edge Case Awareness', val: avg.edgeCases }
                ].map((metric, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: colors.labelColor, fontWeight: '600' }}>{metric.label}</span>
                      <strong style={{ color: '#818cf8' }}>{metric.val} / 10</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: colors.gaugeBg, borderRadius: '4px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${(Number(metric.val) / 10) * 100}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, #6366f1, #22c55e)', 
                          borderRadius: '4px',
                          transition: 'width 0.6s ease'
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {allFeedback.map((item, idx) => (
              <div key={idx} style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: colors.boxShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: item.isFollowUp ? '#fbbf24' : '#818cf8', fontWeight: '700' }}>
                    {item.isFollowUp ? `QUESTION ${idx + 1} (DRILL-DOWN)` : `QUESTION ${idx + 1}`}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '800', padding: '4px 12px', borderRadius: '6px', background: (item.overallScore || 7) >= 7 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: (item.overallScore || 7) >= 7 ? '#4ade80' : '#f87171' }}>
                    SCORE: {item.overallScore || item.score || 7} / 10
                  </span>
                </div>

                <h3 style={{ fontSize: '17px', margin: '0 0 14px 0', color: colors.textColor }}>{item.question}</h3>

                {item.userAnswer && (
                  <div style={{ background: colors.inputBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '14px', color: colors.textColor }}>
                    <strong style={{ color: colors.subText, display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Your Answer:</strong>
                    {item.userAnswer}
                  </div>
                )}

                {recordedVideos[idx] && (
                  <div style={{ margin: '14px 0', background: colors.videoContainerBg, padding: '12px', borderRadius: '12px', border: `1px solid ${colors.cardBorder}` }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>🎥 Your Response Playback:</span>
                    <video src={recordedVideos[idx]} controls style={{ width: '100%', maxWidth: '380px', borderRadius: '8px', maxHeight: '200px' }} />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', lineHeight: '1.6' }}>
                  <div style={{ background: isDark ? 'rgba(34,197,94,0.06)' : '#f0fdf4', borderLeft: '3px solid #22c55e', padding: '10px 14px', borderRadius: '4px' }}>
                    <strong style={{ color: '#16a34a' }}>Strengths:</strong> {item.strengths}
                  </div>
                  <div style={{ background: isDark ? 'rgba(245,158,11,0.06)' : '#fffbeb', borderLeft: '3px solid #f59e0b', padding: '10px 14px', borderRadius: '4px' }}>
                    <strong style={{ color: '#d97706' }}>Improvement:</strong> {item.improvements}
                  </div>
                  <div style={{ background: isDark ? 'rgba(99,102,241,0.06)' : '#eef2ff', borderLeft: '3px solid #6366f1', padding: '10px 14px', borderRadius: '4px' }}>
                    <strong style={{ color: '#4f46e5' }}>Suggested Answer:</strong> {item.idealAnswer}
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => setStage('setup')}
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}
            >
              Start a New Interview
            </button>
          </div>
        )}

        {/* 4. PAST SESSIONS / HISTORY STAGE */}
        {stage === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: colors.textColor }}>Past Session Records</h2>
              <button
                onClick={() => setStage('setup')}
                style={{ background: '#6366f1', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                + New Interview
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
            ) : userHistory.length === 0 ? (
              <div style={{ background: colors.cardBg, padding: '36px', borderRadius: '16px', textAlign: 'center', border: `1px solid ${colors.cardBorder}` }}>
                <p style={{ color: colors.subText }}>No previous interview records found under this account.</p>
              </div>
            ) : (
              userHistory.map((sess, i) => (
                <div 
                  key={i} 
                  style={{ 
                    background: colors.cardBg, 
                    border: `1px solid ${colors.cardBorder}`, 
                    borderRadius: '14px', 
                    padding: '22px', 
                    marginBottom: '16px',
                    boxShadow: colors.boxShadow
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: colors.textColor, fontWeight: '700' }}>{sess.jobRole}</h3>
                      <p style={{ fontSize: '13px', color: '#818cf8', margin: 0 }}>{sess.techStack}</p>
                    </div>
                    <span style={{ fontSize: '12px', color: colors.subText }}>
                      {new Date(sess.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${colors.cardBorder}` }}>
                    <span style={{ fontSize: '12px', background: colors.inputBg, padding: '5px 12px', borderRadius: '6px', color: colors.labelColor }}>
                      {sess.questions?.length || 0} Questions Attempted
                    </span>
                    
                    <button
                      onClick={() => handleViewPastReport(sess)}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                      }}
                    >
                      View Full Report ➔
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}