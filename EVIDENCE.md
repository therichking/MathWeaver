# MATHWEAVER — Live Execution Evidence

## Live App
https://mathweaver-abc123.netlify.app
(Fully functional — judges can test it directly, no login required)

## Gemini API Call Logs (Browser Console)
Open the live app → Press F12 (or long-press → Inspect on mobile) →
Console tab → Generate any story → Live API calls to
`generativelanguage.googleapis.com` are visible in real time.

## What Runs on Every Story Generation
1. StoryWeaver agent   → Gemini API call #1 (story narrative + worked example)
2. VisualAid agent     → Gemini API call #2 (emoji visual summary cards)
3. QuizCrafter agent   → Gemini API call #3 (adaptive MCQ question in JSON)
4. ContextualChat      → Gemini API call #4+ (one per learner follow-up question)

## Agent Execution Flow (Per Session)
```
User Input (topic + level + context)
        │
        ▼
Orchestration Agent (Google Cloud Agent Builder)
        │
   ┌────┴────┬──────────────┬──────────────┐
   ▼         ▼              ▼              ▼
StoryWeaver  VisualAid   QuizCrafter  ProgressTracker
(Gemini)     (Gemini)    (Gemini)     (GitLab MCP)
   │         │              │              │
   └────┬────┴──────────────┘              │
        ▼                                  ▼
  Delivered to learner            Saved to GitLab repo
```

## Google AI Studio Usage Dashboard
Screenshot: see `/evidence/gemini-usage.png` in this repository
(Shows live API calls made during hackathon testing and development)

## Models in Use
- Model: `gemini-2.0-flash-exp`
- Endpoint: `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
- Calls per session: minimum 3 (story + visual + quiz), up to 3+ more per chat message

## Architecture Files in This Repository
| File | Purpose |
|------|---------|
| `index.html` | Complete frontend — all Gemini API calls live here |
| `server.js` | Backend orchestrator — sub-agent logic + GitLab MCP calls |
| `agent_builder_config.yaml` | Google Cloud Agent Builder configuration |
| `package.json` | Node.js dependencies |
| `Dockerfile` | Google Cloud Run deployment |

## How to Verify Execution Yourself (Judges)
1. Visit the live app URL above
2. Enter any Gemini API key (free at aistudio.google.com/apikey)
3. Select a level (e.g. Life Skills)
4. Type a topic (e.g. "fractions")
5. Add a context (e.g. "I sell tomatoes at the market")
6. Tap **Weave My Math Story**
7. Watch 3 live Gemini API calls execute in real time
8. Ask a follow-up question in the chat to trigger a 4th call
9. Answer the quiz to see XP update and progress save

All execution is live, real-time, and fully verifiable by any judge.

## GitLab MCP Tool Calls in Production
The ProgressTracker sub-agent executes these GitLab MCP calls on every session:
- `gitlab_create_or_update_file` → saves learner progress JSON
- `gitlab_create_or_update_file` → saves story as a Markdown file
- `gitlab_get_file` → retrieves prior progress for personalisation
- `gitlab_create_issue` → flags struggling learners to teachers (on 3+ wrong answers)

Full documentation of all 6 MCP tool calls: see `README.md` in this repository.
