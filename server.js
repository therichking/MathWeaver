/**
 * MATHWEAVER — Cloud Run Server
 * Orchestrates Gemini sub-agents and GitLab MCP calls
 * 
 * Google Cloud Rapid Agent Hackathon 2025
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_PROJECT = process.env.GITLAB_PROJECT_ID || 'mathweaver/progress';
const PORT = process.env.PORT || 8080;

// ── Gemini helper ─────────────────────────────────────────────────────────────
async function gemini(prompt, temperature = 0.85, maxTokens = 1200) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}gemini-1.5-flash

// ── GitLab MCP helpers ────────────────────────────────────────────────────────
const GL_BASE = 'https://gitlab.com/api/v4';
const glHeaders = {
  'PRIVATE-TOKEN': GITLAB_TOKEN,
  'Content-Type': 'application/json'
};

async function gitlabSaveProgress(userId, progress) {
  const encoded = Buffer.from(JSON.stringify(progress, null, 2)).toString('base64');
  const filePath = encodeURIComponent(`learners/${userId}/progress.json`);
  const url = `${GL_BASE}/projects/${encodeURIComponent(GITLAB_PROJECT)}/repository/files/${filePath}`;
  
  // Try PUT (update) first, fall back to POST (create)
  for (const method of ['PUT', 'POST']) {
    const res = await fetch(url, {
      method,
      headers: glHeaders,
      body: JSON.stringify({
        branch: 'main',
        content: encoded,
        encoding: 'base64',
        commit_message: `Update learner progress — ${userId}`
      })
    });
    if (res.ok) return await res.json();
    if (method === 'PUT' && res.status === 404) continue;
    const err = await res.json();
    throw new Error(err.message);
  }
}

async function gitlabSaveStory(userId, story, topic, level) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const content = `# Story: ${topic}\n**Level:** ${level}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n${story}`;
  const encoded = Buffer.from(content).toString('base64');
  const filePath = encodeURIComponent(`learners/${userId}/stories/${timestamp}.md`);
  const url = `${GL_BASE}/projects/${encodeURIComponent(GITLAB_PROJECT)}/repository/files/${filePath}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: glHeaders,
    body: JSON.stringify({
      branch: 'main',
      content: encoded,
      encoding: 'base64',
      commit_message: `New story: ${topic} — ${userId}`
    })
  });
  return res.ok ? await res.json() : null;
}

async function gitlabGetProgress(userId) {
  const filePath = encodeURIComponent(`learners/${userId}/progress.json`);
  const url = `${GL_BASE}/projects/${encodeURIComponent(GITLAB_PROJECT)}/repository/files/${filePath}?ref=main`;
  const res = await fetch(url, { headers: glHeaders });
  if (!res.ok) return null;
  const data = await res.json();
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

async function gitlabCreateIssue(userId, topic, detail) {
  const url = `${GL_BASE}/projects/${encodeURIComponent(GITLAB_PROJECT)}/issues`;
  const res = await fetch(url, {
    method: 'POST',
    headers: glHeaders,
    body: JSON.stringify({
      title: `Learner ${userId} struggling with: ${topic}`,
      description: detail,
      labels: 'needs-support'
    })
  });
  return res.ok ? await res.json() : null;
}

// ── Sub-Agent: StoryWeaver ────────────────────────────────────────────────────
async function storyWeaverAgent({ topic, context, level }) {
  const LEVEL_DESC = {
    foundation: 'a very young child aged 4–6, use very simple words and fun animals or toys',
    primary: 'a primary school student aged 8–12, use relatable everyday examples',
    secondary: 'a secondary school student aged 13–17, connect to real life clearly',
    advanced: 'a university student, use precise language with real-world connections',
    life: 'an adult learner, use practical situations like markets, cooking, sewing, or farming'
  };
  
  const contextLine = context && context !== 'skip'
    ? `The learner's everyday context is: "${context}". Weave this directly into the story.`
    : 'Use an everyday African marketplace or family home setting.';

  const prompt = `You are MATHWEAVER, an expert at teaching mathematics through immersive storytelling.
Your audience is ${LEVEL_DESC[level] || LEVEL_DESC.primary}.
Topic to teach: "${topic}"
${contextLine}

Write a SHORT, engaging math story (150–200 words) that:
1. Starts with a vivid scene from everyday life
2. Naturally introduces the math concept through character actions and dialogue
3. Shows the math being used to solve a real problem in the story
4. Ends with the math concept clearly stated in simple terms

Then after the story, add:
## The Maths Behind It
A 2–3 sentence plain explanation of the concept.

## Try It Yourself
One simple worked example with numbers shown step-by-step inside square brackets like:
[Example: 3 + 4 = 7]

Keep the total response under 350 words. Be warm, vivid, and encouraging.`;

  return await gemini(prompt);
}

// ── Sub-Agent: QuizCrafter ────────────────────────────────────────────────────
async function quizCrafterAgent({ topic, level, story }) {
  const prompt = `Create ONE multiple-choice quiz question about "${topic}" for a ${level} level learner.
${story ? `Context story: ${story.substring(0, 200)}` : ''}
Return ONLY valid JSON in this exact format:
{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"..."}
Where "correct" is the 0-based index of the right answer. Explanation: 1–2 sentences in everyday terms.
Return ONLY the JSON object, nothing else, no markdown.`;

  const raw = await gemini(prompt, 0.7, 500);
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ── Sub-Agent: VisualAid ──────────────────────────────────────────────────────
async function visualAidAgent({ topic, level }) {
  const prompt = `For the math topic "${topic}" at ${level} level, return ONLY a JSON array of 3–4 visual cards.
Each card: {"emoji":"...","label":"...","value":"..."}
Label max 4 words. Value shows a number or formula.
Example: [{"emoji":"🍕","label":"Whole pizza","value":"1"},{"emoji":"✂️","label":"Cut in half","value":"1/2"}]
Return ONLY the JSON array, nothing else.`;

  const raw = await gemini(prompt, 0.5, 300);
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return [];
  }
}

// ── Sub-Agent: ContextualChat ─────────────────────────────────────────────────
async function contextualChatAgent({ message, topic, level, context, storySnippet, history }) {
  const histText = (history || []).slice(-6)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const prompt = `You are MATHWEAVER's chat tutor. The learner is at ${level} level and learned about "${topic}".
Their everyday context: "${context || 'general'}".
Story snippet: ${(storySnippet || '').substring(0, 200)}
Answer the question in 2–4 sentences using a new mini-story or everyday analogy. Be warm and encouraging.

${histText}
Student: ${message}
Tutor:`;

  const reply = await gemini(prompt, 0.85, 400);
  return reply.replace(/^Tutor:\s*/i, '').trim();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Main orchestration endpoint
app.post('/orchestrate', async (req, res) => {
  try {
    const { topic, level, context, userId = 'anonymous' } = req.body;
    
    // Run StoryWeaver and get prior progress in parallel
    const [story, priorProgress] = await Promise.all([
      storyWeaverAgent({ topic, level, context }),
      gitlabGetProgress(userId).catch(() => null)
    ]);

    // Run VisualAid and QuizCrafter in parallel after story
    const [visuals, quiz] = await Promise.all([
      visualAidAgent({ topic, level }),
      quizCrafterAgent({ topic, level, story })
    ]);

    // Update progress
    const progress = {
      ...(priorProgress || {}),
      userId,
      level,
      lastTopic: topic,
      storiesWoven: ((priorProgress?.storiesWoven) || 0) + 1,
      xp: ((priorProgress?.xp) || 0) + 20,
      updatedAt: new Date().toISOString()
    };

    // Save to GitLab (fire and forget)
    Promise.all([
      gitlabSaveProgress(userId, progress),
      gitlabSaveStory(userId, story, topic, level)
    ]).catch(console.error);

    res.json({ story, visuals, quiz, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Quiz endpoint
app.post('/quiz', async (req, res) => {
  try {
    const { topic, level, story, userId = 'anonymous' } = req.body;
    const quiz = await quizCrafterAgent({ topic, level, story });
    res.json({ quiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quiz result logging
app.post('/quiz-result', async (req, res) => {
  try {
    const { userId = 'anonymous', topic, correct, wrongCount } = req.body;
    
    if (wrongCount >= 3) {
      await gitlabCreateIssue(userId, topic,
        `Learner ${userId} answered ${wrongCount} questions incorrectly on topic "${topic}". Consider teacher follow-up.`
      ).catch(console.error);
    }

    const progress = await gitlabGetProgress(userId).catch(() => ({}));
    const updated = {
      ...progress,
      questionsAnswered: ((progress?.questionsAnswered) || 0) + 1,
      correctAnswers: ((progress?.correctAnswers) || 0) + (correct ? 1 : 0),
      xp: ((progress?.xp) || 0) + (correct ? 10 : 0),
      updatedAt: new Date().toISOString()
    };
    await gitlabSaveProgress(userId, updated).catch(console.error);
    res.json({ ok: true, xp: updated.xp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, topic, level, context, storySnippet, history } = req.body;
    const reply = await contextualChatAgent({ message, topic, level, context, storySnippet, history });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Progress endpoint
app.get('/progress/:userId', async (req, res) => {
  try {
    const progress = await gitlabGetProgress(req.params.userId);
    res.json(progress || { storiesWoven: 0, xp: 0, questionsAnswered: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/_health', (_, res) => res.json({ status: 'ok', service: 'mathweaver' }));

// Serve index.html for all other routes
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`MATHWEAVER running on port ${PORT}`);
});
