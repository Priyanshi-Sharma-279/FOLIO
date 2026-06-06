from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import fitz  # PyMuPDF
import chromadb
from chromadb.utils import embedding_functions
import ollama
import json
import psutil
from pathlib import Path
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global state ---
chroma_client = chromadb.Client()
collection = None
current_filename = None
chat_history = []

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)

# --- RAM-based model routing ---
TOTAL_RAM_GB = psutil.virtual_memory().total / (1024 ** 3)
FLASH_MODEL = "llama3.2:3b"
PRO_MODEL = "llama3.1:8b" if TOTAL_RAM_GB >= 14 else "llama3.2:3b"
print(f"System RAM: {TOTAL_RAM_GB:.1f}GB — Pro model set to: {PRO_MODEL}")

COMPLEX_KEYWORDS = [
    "compare", "contrast", "analyse", "analyze", "explain", "summarise",
    "summarize", "difference", "relationship", "why", "how does", "evaluate",
    "discuss", "elaborate", "describe in detail", "what are the implications"
]

# --- History persistence ---
HISTORY_DIR = Path("chat_histories")
HISTORY_DIR.mkdir(exist_ok=True)

def get_history_path(filename: str) -> Path:
    safe = filename.replace(" ", "_").replace("/", "_").replace("\\", "_")
    return HISTORY_DIR / f"{safe}.json"

def load_history(filename: str) -> list:
    path = get_history_path(filename)
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return []

def save_history(filename: str, history: list):
    path = get_history_path(filename)
    with open(path, "w") as f:
        json.dump(history, f, indent=2)

# --- Model routing ---
def route_model(question: str) -> str:
    q = question.lower()
    if any(kw in q for kw in COMPLEX_KEYWORDS) or len(question.split()) > 12:
        return PRO_MODEL
    return FLASH_MODEL

# --- Format detection ---
def detect_format(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ["difference", "compare", "contrast", "vs"]):
        return "comparison"
    if any(k in q for k in ["list", "what are", "types", "examples", "features"]):
        return "bullets"
    if any(k in q for k in ["explain", "how does", "why", "describe"]):
        return "explanation"
    return "default"

# --- Prompt builder ---
def build_prompt(question: str, context: str, history: list) -> str:
    fmt = detect_format(question)

    if fmt == "comparison":
        format_instruction = """Structure your response with clear markdown headers:
## [First Concept]
- key point
- key point

## [Second Concept]
- key point
- key point

## Key Differences
- difference 1
- difference 2

Do NOT write 'key points:' as literal text. Write actual points directly."""

    elif fmt == "bullets":
        format_instruction = """Structure your response as:
A brief one-line intro, then bullet points:
- Point 1
- Point 2
- Point 3"""

    elif fmt == "explanation":
        format_instruction = """Structure your response as:
**Overview:** one sentence summary
Then explain in clear paragraphs. Use bullet points for any steps or lists."""

    else:
        format_instruction = "Answer clearly and concisely. Use bullet points if listing multiple things."

    history_text = ""
    if history:
        history_text = "\n\nPrevious conversation:\n"
        for h in history[-4:]:
            history_text += f"User: {h['user']}\nAssistant: {h['assistant']}\n"

    return f"""You are an expert teaching assistant. Answer questions in detail based strictly on the document context provided.
- Always give thorough, complete answers. Never truncate or summarise too briefly.
- Use the formatting structure specified below for every response.
- If the answer is not in the context, say "I couldn't find that in the document."

{format_instruction}
{history_text}

Document context:
{context}

Question: {question}

Provide a detailed, well-structured answer:"""

# --- PDF processing ---
def extract_chunks(pdf_bytes: bytes, chunk_size: int = 500, overlap: int = 50) -> list:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    words = full_text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

# --- Routes ---

@app.get("/health")
async def health():
    return {"status": "online"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global collection, current_filename, chat_history

    pdf_bytes = await file.read()
    current_filename = file.filename
    chat_history = load_history(file.filename)

    try:
        chroma_client.delete_collection("pdf_chunks")
    except:
        pass

    collection = chroma_client.create_collection(
        name="pdf_chunks",
        embedding_function=embed_fn
    )

    chunks = extract_chunks(pdf_bytes)
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    collection.add(documents=chunks, ids=ids)

    print(f"Indexed {len(chunks)} chunks from '{file.filename}'")
    return {
        "status": f"Indexed {len(chunks)} chunks successfully!",
        "filename": file.filename,
        "history": chat_history
    }

@app.post("/chat")
async def chat_endpoint(message: str = Form(...), model: str = Form(...)):
    global collection, chat_history

    if collection is None:
        async def err():
            yield f"data: {json.dumps({'token': 'No document loaded. Please upload a PDF first.'})}\n\n"
            yield f"data: {json.dumps({'done': True, 'model': 'System', 'source': 'System'})}\n\n"
        return StreamingResponse(err(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    chosen_model = route_model(message)
    model_label = "Flash (3b)" if chosen_model == FLASH_MODEL else "Pro (8b)"

    results = collection.query(query_texts=[message], n_results=4)
    context = "\n\n".join(results["documents"][0])
    prompt = build_prompt(message, context, chat_history)

    async def stream():
        full_response = ""
        yield f"data: {json.dumps({'model': model_label, 'source': current_filename})}\n\n"

        response = ollama.chat(
            model=chosen_model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )

        for chunk in response:
            token = chunk["message"]["content"]
            full_response += token
            yield f"data: {json.dumps({'token': token})}\n\n"

        chat_history.append({"user": message, "assistant": full_response})
        save_history(current_filename, chat_history)

        yield f"data: {json.dumps({'done': True, 'model': model_label, 'source': current_filename})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@app.get("/sessions")
async def get_sessions():
    sessions = []
    for path in HISTORY_DIR.glob("*.json"):
        try:
            with open(path, "r") as f:
                data = json.load(f)
            if not data:
                continue
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            days_ago = (datetime.now() - mtime).days
            if days_ago == 0:
                label = "Today"
            elif days_ago == 1:
                label = "Yesterday"
            else:
                label = f"{days_ago}d ago"

            original_name = path.stem.replace("_", " ")
            if not original_name.endswith(".pdf"):
                original_name += ".pdf"

            sessions.append({
                "filename": original_name,
                "stem": path.stem,
                "message_count": len(data) * 2,
                "last_updated": label,
                "mtime": path.stat().st_mtime
            })
        except:
            pass
    sessions.sort(key=lambda x: x["mtime"], reverse=True)
    return {"sessions": sessions}

@app.get("/sessions/{filename}")
async def get_session(filename: str):
    path = get_history_path(filename)
    if not path.exists():
        return {"history": []}
    with open(path, "r") as f:
        return {"history": json.load(f)}

@app.delete("/sessions/{filename}")
async def delete_session(filename: str):
    path = get_history_path(filename)
    if path.exists():
        path.unlink()
    return {"status": "deleted"}

@app.post("/clear_history")
async def clear_history():
    global chat_history
    chat_history = []
    if current_filename:
        save_history(current_filename, [])
    return {"status": "cleared"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)