
<div align="center">

<img src="src-tauri/icons/icon.png" width="80" height="80" alt="Folio Icon" />

# Folio
### Local PDF Intelligence

**Chat with any PDF — fully offline, fully private, no subscriptions.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)]()
[![Made with Tauri](https://img.shields.io/badge/built%20with-Tauri-purple.svg)](https://tauri.app)
[![Powered by Ollama](https://img.shields.io/badge/powered%20by-Ollama-black.svg)](https://ollama.com)

</div>

---

## What is Folio?

Folio is a desktop application that lets you have a conversation with any PDF document using local AI models. Upload a textbook, research paper, or any document — then ask questions, request summaries, compare concepts, or get code examples, all without sending your data anywhere.

Everything runs on your machine. No cloud. No API keys. No subscriptions.

---

## Screenshots

| Startup | Main Screen |
|---|---|
| ![Startup](screenshots/StartUp.png) | ![Main](screenshots/main.png) |

| PDF Loaded | Flash (3b) Response |
|---|---|
| ![File Upload](screenshots/fileupload.png) | ![Flash Response](screenshots/flash3b.png) |

| Pro (8b) Detailed Answer | Pro (8b) with Code |
|---|---|
| ![Pro Response](screenshots/pro8B1.png) | ![Pro Code](screenshots/pro8B2.png) |

| Syntax Highlighted Code |
|---|
| ![Code Syntax](screenshots/code_syntax.png) |

---

## Features

- **100% Local & Offline** — All processing happens on your machine after one-time setup
- **Smart Model Routing** — Automatically uses the faster 3b model for simple questions and the more powerful 8b model for complex analysis
- **RAM-Aware** — Detects your system RAM and picks the best model automatically (8GB → 3b, 16GB+ → 8b)
- **Streaming Responses** — Answers appear word by word as they're generated
- **Rich Formatting** — Renders markdown, bullet points, headers, tables, and syntax-highlighted code blocks
- **Persistent Chat History** — Every conversation is saved per PDF and restored automatically when you re-upload the same document
- **First-Launch Setup Wizard** — Guides new users through installing Ollama and downloading the right model
- **Native Desktop App** — Built with Tauri for a lightweight, fast native experience on Windows and macOS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Tauri (Rust) |
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| PDF Extraction | PyMuPDF (fitz) |
| Vector Storage | ChromaDB |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Local LLM | Ollama (llama3.2:3b / llama3.1:8b) |

---

## Installation

### Prerequisites
- [Ollama](https://ollama.com/download) — for running local AI models
- The app's first-launch wizard will guide you through everything else

### Windows
1. Download `Folio_0.1.0_x64-setup.exe` from [Releases](../../releases)
2. Run the installer
3. Open Folio — the setup wizard handles the rest

### macOS
1. Download `Folio_0.1.0_x64.dmg` from [Releases](../../releases)
2. Open the `.dmg` and drag Folio to Applications
3. Open Folio — the setup wizard handles the rest

---

## Building from Source

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- [Rust](https://rustup.rs)
- [Python](https://python.org) 3.11+
- [Ollama](https://ollama.com/download)

### Steps

```bash
# Clone the repo
git clone https://github.com/Priyanshi-Sharma-279/FOLIO.git
cd FOLIO

# Install frontend dependencies
npm install

# Set up Python backend
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install fastapi uvicorn python-multipart pymupdf chromadb ollama sentence-transformers psutil pyinstaller

# Pull the AI models
ollama pull llama3.2:3b
ollama pull llama3.1:8b

# Build the backend executable
pyinstaller --onefile --name folio-backend \
  --hidden-import=chromadb.telemetry.product.posthog \
  --hidden-import=chromadb.api.rust \
  --hidden-import=chromadb.segment.impl.manager.local \
  --hidden-import=chromadb.segment.impl.vector.local_hnsw \
  --hidden-import=chromadb.segment.impl.metadata.sqlite \
  --hidden-import=chromadb.execution.executor.local \
  backend.py

# Copy binary to Tauri (Windows)
copy dist\folio-backend.exe ..\src-tauri\binaries\folio-backend-x86_64-pc-windows-msvc.exe

# Copy binary to Tauri (macOS)
cp dist/folio-backend ../src-tauri/binaries/folio-backend-aarch64-apple-darwin

# Build the desktop app
cd ..
npx tauri build
```

The installer will be at `src-tauri/target/release/bundle/`.

---

## How It Works

```
PDF Upload
    ↓
PyMuPDF extracts full text
    ↓
Text split into overlapping chunks (500 words, 50 word overlap)
    ↓
sentence-transformers converts chunks to vectors
    ↓
Vectors stored in ChromaDB (in-memory)
    ↓
User asks a question
    ↓
Question embedded → top 4 relevant chunks retrieved
    ↓
Chunks + question sent to Ollama (llama3.2:3b or llama3.1:8b)
    ↓
Answer streamed back token by token
    ↓
Conversation saved to JSON for future sessions
```

---

## Privacy

Folio is designed for sensitive documents. Your PDFs and conversations never leave your machine. There are no external API calls, no telemetry, and no cloud storage. After the one-time model download, Folio works completely offline.

---

## Contributors

| Contributor | Role |
|---|---|
| [Priyanshi Sharma](https://github.com/Priyanshi-Sharma-279) | Frontend Design & UI,macOS Build & Distribution | 
| [Kartik Dubey](https://github.com/kartikdubey17) | Backend, RAG Pipeline & Desktop Integration |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ — no data ever leaves your machine</sub>
</div>
EOF
