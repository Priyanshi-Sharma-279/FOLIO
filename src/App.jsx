import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Send, FileText, X, ChevronDown, Zap, Brain, Loader2, MessageSquare, BookOpen } from 'lucide-react'
import './App.css'

const MOCK_RESPONSES = [
  "Based on the document, the main concept here involves a multi-layered approach where each component feeds into the next sequentially.",
  "The text explicitly states this in section 3, where it outlines the core methodology with three distinct phases.",
  "That's a great question. The document covers this in detail — the key insight is that the retrieval step must happen before synthesis.",
  "According to the PDF, the accuracy metrics show a 93–97% correctness rate for retrieval-based queries.",
  "The author argues that the cascading approach outperforms single-pass methods by a significant margin in complex documents.",
]

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span/><span/><span/>
    </div>
  )
}

function Message({ msg, isNew }) {
  return (
    <div className={`message message--${msg.role} ${isNew ? 'message--new' : ''}`}>
      {msg.role === 'assistant' && (
        <div className="message__avatar">
          <BookOpen size={13} />
        </div>
      )}
      <div className="message__bubble">
        {msg.content}
        {msg.source && (
          <div className="message__source">
            <FileText size={11} />
            <span>{msg.source}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PDFUpload({ onUpload, file }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handle = (f) => {
    if (f && f.type === 'application/pdf') onUpload(f)
  }

  return (
    <div
      className={`upload ${dragging ? 'upload--drag' : ''} ${file ? 'upload--has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => !file && inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{display:'none'}}
        onChange={e => handle(e.target.files[0])} />

      {file ? (
        <div className="upload__file">
          <div className="upload__file-icon"><FileText size={20}/></div>
          <div className="upload__file-info">
            <span className="upload__file-name">{file.name}</span>
            <span className="upload__file-size">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to chat</span>
          </div>
          <button className="upload__remove" onClick={e => { e.stopPropagation(); onUpload(null) }}>
            <X size={14}/>
          </button>
        </div>
      ) : (
        <div className="upload__empty">
          <div className="upload__icon-wrap">
            <Upload size={22} />
          </div>
          <p className="upload__label">Drop your PDF here</p>
          <p className="upload__sub">or click to browse</p>
        </div>
      )}
    </div>
  )
}

function ModelBadge({ model, onChange }) {
  return (
    <button className={`model-badge model-badge--${model}`} onClick={onChange}>
      {model === 'flash' ? <><Zap size={12}/> Flash</> : <><Brain size={12}/> Pro</>}
      <ChevronDown size={11} />
    </button>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('flash')
  const [newMsgId, setNewMsgId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const bottomRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleFileUpload = useCallback((f) => {
    setFile(f)
    setMessages([])
    if (f) {
      setProcessing(true)
      setTimeout(() => {
        setProcessing(false)
        const id = Date.now()
        setNewMsgId(id)
        setMessages([{
          id,
          role: 'assistant',
          content: `I've loaded "${f.name}". Ask me anything — I'll search through the full document to answer you.`,
        }])
      }, 1800)
    }
  }, [])

  const send = useCallback(() => {
    if (!input.trim() || loading || !file) return
    const userMsg = { id: Date.now(), role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    textareaRef.current?.focus()

    const delay = model === 'flash' ? 900 : 1800
    setTimeout(() => {
      const reply = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
      const id = Date.now()
      setNewMsgId(id)
      setMessages(m => [...m, {
        id,
        role: 'assistant',
        content: reply,
        source: `Page ${Math.floor(Math.random() * 40) + 1} · ${model === 'flash' ? 'Flash' : 'Pro'} model`,
      }])
      setLoading(false)
    }, delay)
  }, [input, loading, file, model])

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isEmpty = messages.length === 0 && !processing

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="logo">
            <div className="logo__mark">
              <div className="logo__dot"/>
            </div>
            <span className="logo__name">Folio</span>
          </div>
          <p className="logo__tagline">PDF Intelligence</p>
        </div>

        <div className="sidebar__section">
          <p className="sidebar__label">Document</p>
          <PDFUpload onUpload={handleFileUpload} file={file} />
        </div>

        {file && (
          <div className="sidebar__section">
            <p className="sidebar__label">Model</p>
            <div className="model-selector">
              <button
                className={`model-btn ${model === 'flash' ? 'model-btn--active' : ''}`}
                onClick={() => setModel('flash')}
              >
                <Zap size={14}/>
                <div>
                  <span>Flash</span>
                  <small>Fast · Simple Q&A</small>
                </div>
              </button>
              <button
                className={`model-btn ${model === 'pro' ? 'model-btn--active' : ''}`}
                onClick={() => setModel('pro')}
              >
                <Brain size={14}/>
                <div>
                  <span>Pro</span>
                  <small>Deep · Cross-chapter</small>
                </div>
              </button>
            </div>
          </div>
        )}

        {file && (
          <div className="sidebar__section sidebar__section--stats">
            <p className="sidebar__label">Session</p>
            <div className="stats">
              <div className="stat">
                <span className="stat__val">{messages.filter(m=>m.role==='user').length}</span>
                <span className="stat__key">Questions</span>
              </div>
              <div className="stat">
                <span className="stat__val">{(file.size/1024).toFixed(0)}k</span>
                <span className="stat__key">PDF size</span>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar__footer">
          <div className="status-dot status-dot--online"/>
          <span>Backend offline · mock mode</span>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="chat">
          {isEmpty && (
            <div className="empty">
              <div className="empty__icon">
                <MessageSquare size={28} />
              </div>
              <h2 className="empty__title">Upload a PDF to begin</h2>
              <p className="empty__sub">Drop any textbook, paper, or document on the left and start asking questions.</p>
              <div className="empty__hints">
                {['Summarise chapter 3', 'What is the main argument?', 'Compare section 2 and 4'].map(h => (
                  <button key={h} className="hint" onClick={() => file && setInput(h)}>{h}</button>
                ))}
              </div>
            </div>
          )}

          {processing && (
            <div className="processing">
              <Loader2 size={18} className="processing__spin" />
              <span>Parsing document and building index…</span>
            </div>
          )}

          <div className="messages">
            {messages.map(msg => (
              <Message key={msg.id} msg={msg} isNew={msg.id === newMsgId} />
            ))}
            {loading && (
              <div className="message message--assistant">
                <div className="message__avatar"><BookOpen size={13}/></div>
                <div className="message__bubble"><TypingIndicator /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="input-area">
          <div className={`input-wrap ${!file ? 'input-wrap--disabled' : ''}`}>
            <textarea
              ref={textareaRef}
              className="input-field"
              placeholder={file ? 'Ask anything about the document…' : 'Upload a PDF first'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              disabled={!file || loading}
            />
            <div className="input-actions">
              <ModelBadge model={model} onChange={() => setModel(m => m === 'flash' ? 'pro' : 'flash')} />
              <button
                className={`send-btn ${input.trim() && file ? 'send-btn--active' : ''}`}
                onClick={send}
                disabled={!input.trim() || !file || loading}
              >
                <Send size={15}/>
              </button>
            </div>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for newline · responses sourced from document</p>
        </div>
      </main>
    </div>
  )
}
