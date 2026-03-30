# Article Summarizer — Local AI Pipeline

A fully local, privacy-first article summarization pipeline powered by **n8n**, **LM Studio**, and a **Go** backend. Summarize any text — from blog posts to research papers — using a local LLM, with automatic note-taking to Obsidian.

No cloud APIs. No data leaves your machine.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────┐
│  Go Web App      │────▶│  n8n Webhook  │────▶│  LM Studio    │
│  (localhost:8090)│     │  (Docker)     │     │  (Mistral 7B) │
└─────────────────┘     └──────┬───────┘     └───────────────┘
                               │
┌─────────────────┐            │
│ Chrome Extension │───────────┘            ┌───────────────┐
│ (Brave/Chrome)   │                   ────▶│  Obsidian     │
└─────────────────┘                         │  (Local REST) │
                                            └───────────────┘
```

## Features

- **Smart Chunking** — Automatically splits long texts into context-safe chunks (≤5000 chars) for models with limited context windows (e.g., 4096 tokens)
- **Map-Reduce Summarization** — Short texts get a direct summary; long texts are chunked, summarized individually, then synthesized into a cohesive final summary
- **Markdown Formatting** — A dedicated "Pretty" step formats summaries into clean, professional Markdown
- **Obsidian Integration** — Summaries are auto-saved to your Obsidian vault via the Local REST API plugin
- **Chrome/Brave Extension** — Select text on any page, right-click → summarize. Or paste text in the popup
- **100% Local** — Everything runs on your machine. No API keys, no cloud, no data leakage

## Components

| Component             | Tech                           | Purpose                                     |
| --------------------- | ------------------------------ | ------------------------------------------- |
| **Web App**           | Go + embedded HTML/CSS/JS      | Desktop UI for pasting and summarizing text |
| **Workflow Engine**   | n8n (Docker)                   | Orchestrates the summarization pipeline     |
| **LLM**               | LM Studio (Mistral 7B)         | Local AI inference                          |
| **Note Storage**      | Obsidian + Local REST API      | Saves formatted summaries as Markdown       |
| **Browser Extension** | Chrome Extension (Manifest v3) | Quick access from any webpage               |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) — for running n8n
- [Go 1.21+](https://go.dev/dl/) — for building the web app
- [LM Studio](https://lmstudio.ai/) — for local LLM inference
- [Obsidian](https://obsidian.md/) + [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) (optional)

## Quick Start

### 1. Start n8n

```bash
docker compose up -d
```

Open `http://localhost:5678` and set up your n8n account.

### 2. Import the Workflow

- In n8n, go to **Workflows → Import from File**
- Select `workflow.json` from this repo
- Update the Obsidian API key in the "Vault B" node (or remove that node if you don't use Obsidian)
- Click **Publish** to activate the workflow

### 3. Configure LM Studio

- Download and install [LM Studio](https://lmstudio.ai/)
- Download the `mistral-7b-instruct-v0.2` model (or any model you prefer)
- Start the local server on port `1234`

### 4. Build & Run the Web App

```bash
cd app
go build -o article-summarizer .
./article-summarizer
```

Open `http://localhost:8090` in your browser.

### 5. Install the Browser Extension (Optional)

- Open `brave://extensions` (or `chrome://extensions`)
- Enable **Developer mode**
- Click **Load unpacked** → select the `extension/` folder

## Configuration

Copy `.env.example` to `.env` and adjust:

```env
# n8n webhook endpoint (use /webhook-test/ for testing, /webhook/ for production)
N8N_ENDPOINT=http://localhost:5678/webhook/article-summary

# Go web app port
APP_PORT=8090

# Obsidian Local REST API (optional)
OBSIDIAN_API_KEY=your-api-key-here
OBSIDIAN_PORT=27123
```

> **Note:** The Go app currently uses hardcoded constants. Modify `app/main.go` to read from environment variables if needed.

## How It Works

### Short Text (≤ 5000 chars)

```
Text → Summary → Pretty Format → Obsidian
```

### Long Text (> 5000 chars)

```
Text → Split into chunks → Summarize each chunk
     → Combine summaries → Final meta-summary
     → Pretty Format → Obsidian
```

The chunking threshold (5000 chars) is tuned for Mistral 7B's 4096-token context window. Adjust `SAFE_CHARS` and `CHARS_PER_CHUNK` in the n8n Code node if you use a model with a larger context.

## Project Structure

```
.
├── app/                    # Go web application
│   ├── main.go             # Server, API handler, text sanitizer
│   └── static/             # Embedded frontend
│       ├── index.html
│       ├── style.css
│       └── script.js
├── extension/              # Chrome/Brave extension
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   └── background.js
├── workflow.json            # n8n workflow (import this)
├── docker-compose.yml       # n8n Docker setup
└── README.md
```

## Customization

### Using a Different Model

In the n8n workflow, find the HTTP Request nodes and change the `model` field:

```json
"model": "your-model-name"
```

Also adjust `SAFE_CHARS` in the "Separation Decision" Code node based on your model's context window.

### Changing the Summary Structure

Edit the prompt in the "Summary" HTTP Request node. The current structure:

```
## Title
## Main Idea
## Key Concepts
## Key Findings or Arguments
## Conclusion
```

### Disabling Obsidian

Simply remove or disable the "Vault B" node in the n8n workflow. Summaries will still be returned to the web app and extension.

## License

MIT — see [LICENSE](LICENSE)
