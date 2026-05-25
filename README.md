# MATHWEAVER 📖✨
### *Every number has a story. Every story has a lesson.*

> A Google Cloud Rapid Agent Hackathon 2025 submission.

**MATHWEAVER** is an AI-powered math tutoring agent that transforms any mathematical concept — from counting apples to university-level calculus — into immersive, contextual stories drawn from the learner's own everyday life. It meets learners where they are: young or old, schooled or unschooled, city or village.

---

## 🔗 Live Demo
**[mathweaver.app](https://mathweaver.app)** ← hosted URL for judges

## 📹 Demo Video
**[Watch on YouTube](https://youtu.be/mathweaver-demo)** (under 3 minutes)

## 💻 Repository
**[gitlab.com/your-team/mathweaver](https://gitlab.com/your-team/mathweaver)** (Apache 2.0)

---

## The Problem

Mathematical failure is one of the most widespread, yet solvable, crises in global education. From a child in Lagos who cannot count change, to an adult tailor who struggles with measurements, to a student who fails algebra because equations feel abstract — the root cause is the same: **math is taught without context, story, or human meaning.**

MATHWEAVER fixes this by answering one simple question: *What if every math lesson started with a story from your own life?*

---

## How It Works

### User Flow
1. Choose your **level** (Foundation · Primary · Secondary · Advanced · Life Skills)
2. Pick or type a **math topic**
3. (Optional) Add your **everyday context** — "I sell yams at the market", "I'm a tailor", "I play football"
4. Click **Weave My Math Story**
5. Receive: a story, a worked example, a quiz question, visual cards, and a chat tutor

### Agent Architecture

```
User Input (Topic + Context + Level)
          │
          ▼
┌─────────────────────────────────┐
│   Google Cloud Agent Builder    │
│   Orchestration Agent           │
│   (routes to sub-agents below)  │
└──────────┬──────────────────────┘
           │
    ┌──────┴──────┐──────────────┐──────────────┐──────────────┐
    ▼             ▼              ▼               ▼              ▼
StoryWeaver  QuizCrafter    VisualAid      ContextChat    ProgressTracker
(Gemini 2.0) (Gemini 2.0)  (Gemini 2.0)  (Gemini 2.0)   (GitLab MCP)
    │             │              │               │              │
    ▼             ▼              ▼               ▼              ▼
Narrative    MCQ + Answer   Visual cards    Conversational  Saves progress
+ Worked     + Explanation  JSON summary    follow-up       to GitLab repo
  Example                                  tutor
```

### Sub-Agents

| Agent | Role | Model |
|-------|------|-------|
| **StoryWeaver** | Generates contextual math narrative | Gemini 2.0 Flash |
| **QuizCrafter** | Creates adaptive MCQ questions | Gemini 2.0 Flash |
| **VisualAid** | Produces emoji-based visual summaries | Gemini 2.0 Flash |
| **ContextualChat** | Answers follow-up questions via story | Gemini 2.0 Flash |
| **ProgressTracker** | Logs XP, streaks, quiz scores | GitLab MCP |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Model | **Gemini 2.0 Flash** (via Google AI Studio API) |
| Agent Orchestration | **Google Cloud Agent Builder** |
| Partner MCP | **GitLab MCP Server** |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Hosting | Google Cloud Run |
| Storage | GitLab repository (via MCP) + `localStorage` |

---

## GitLab MCP Tool Calls

The ProgressTracker sub-agent uses GitLab MCP to persist learner progress, store story history, and enable teacher dashboards.

### Tool Calls Used

#### 1. Save Learner Progress
```json
{
  "tool": "gitlab_create_or_update_file",
  "params": {
    "project_id": "mathweaver/progress",
    "file_path": "learners/{user_id}/progress.json",
    "content": "{\"xp\": 120, \"level\": \"primary\", \"stories\": 4, \"quizzes\": 12, \"streak\": 3}",
    "commit_message": "Update learner progress — {user_id}",
    "branch": "main"
  }
}
```

#### 2. Store Story History
```json
{
  "tool": "gitlab_create_or_update_file",
  "params": {
    "project_id": "mathweaver/progress",
    "file_path": "learners/{user_id}/stories/{timestamp}.md",
    "content": "# Story: Fractions at the Market\n\n{story_text}\n\n---\nLevel: primary\nTopic: fractions\nContext: selling tomatoes",
    "commit_message": "New story saved: fractions — {user_id}",
    "branch": "main"
  }
}
```

#### 3. Log Quiz Results
```json
{
  "tool": "gitlab_create_or_update_file",
  "params": {
    "project_id": "mathweaver/progress",
    "file_path": "learners/{user_id}/quiz_log.json",
    "content": "{\"results\": [{\"topic\": \"fractions\", \"correct\": true, \"timestamp\": \"2025-07-14T10:23:00Z\"}]}",
    "commit_message": "Quiz result logged — {user_id}",
    "branch": "main"
  }
}
```

#### 4. Retrieve Learner History (for personalization)
```json
{
  "tool": "gitlab_get_file",
  "params": {
    "project_id": "mathweaver/progress",
    "file_path": "learners/{user_id}/progress.json",
    "ref": "main"
  }
}
```

#### 5. List Stories for Teacher Dashboard
```json
{
  "tool": "gitlab_list_directory",
  "params": {
    "project_id": "mathweaver/progress",
    "path": "learners/{user_id}/stories",
    "ref": "main"
  }
}
```

#### 6. Create Issue for Struggling Topics
```json
{
  "tool": "gitlab_create_issue",
  "params": {
    "project_id": "mathweaver/progress",
    "title": "Learner {user_id} struggling with: fractions",
    "description": "Answered 3/5 fraction questions incorrectly. Suggested follow-up: revisit with market context.",
    "labels": ["needs-support", "fractions"]
  }
}
```

---

## Setup Instructions

### Prerequisites
- Google AI Studio API Key (free at [aistudio.google.com](https://aistudio.google.com/apikey))
- A GitLab account (for MCP progress tracking)
- Node.js 18+ (for Cloud Run deployment) — OR just open `index.html` directly in a browser

### Local Development (Zero Build)
```bash
git clone https://gitlab.com/your-team/mathweaver
cd mathweaver
open index.html   # or: python3 -m http.server 8080
# Enter your Gemini API key in the app
```

### Google Cloud Run Deployment
```bash
gcloud run deploy mathweaver \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

### Agent Builder Setup
1. Go to [Google Cloud Console → Agent Builder](https://console.cloud.google.com/agent-builder)
2. Create a new **Conversational Agent**
3. Import `agent_builder_config.yaml` from this repo
4. Connect your Gemini endpoint and GitLab MCP server
5. Deploy and copy the agent URL into `config.js`

---

## License
Apache 2.0 — see [LICENSE](./LICENSE)

---

## Team
Built during the Google Cloud Rapid Agent Hackathon 2025.
