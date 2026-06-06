import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Send, FileText, X, Loader2, MessageSquare, BookOpen, Trash2, Clock } from 'lucide-react'
import './App.css'
function SetupWizard({ onComplete }) {
  const [status, setStatus] = useState(null)
  const [step, setStep] = useState('checking') // checking, needs_ollama, pulling, done
  const [pullLog, setPullLog] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/setup/status')
      const data = await res.json()
      setStatus(data)
      if (!data.ollama_installed) {
        setStep('needs_ollama')
      } else if (!data.model_ready) {
        setStep('needs_model')
      } else {
        setStep('done')
        onComplete()
      }
    } catch {
      setStep('backend_loading')
      setTimeout(checkStatus, 2000)
    }
  }

  const pullModel = async () => {
    setStep('pulling')
    const res = await fetch('http://localhost:8000/setup/pull_model', { method: 'POST' })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let prog = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const raw = line.replace('data: ', '').trim()
        try {
          const parsed = JSON.parse(raw)
          if (parsed.line) {
            setPullLog(parsed.line)
            // estimate progress from ollama output
            const match = parsed.line.match(/(\d+)%/)
            if (match) setProgress(parseInt(match[1]))
          }
          if (parsed.done) {
            setStep('done')
            onComplete()
          }
        } catch { }
      }
    }
  }

  if (step === 'checking' || step === 'backend_loading') return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="logo__mark"><div className="logo__dot" /></div>
          <span className="logo__name">Folio</span>
        </div>
        <Loader2 size={24} className="processing__spin" style={{margin: '24px auto'}} />
        <p className="setup-sub">Starting up…</p>
      </div>
    </div>
  )

  if (step === 'needs_ollama') return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="logo__mark"><div className="logo__dot" /></div>
          <span className="logo__name">Folio</span>
        </div>
        <h2 className="setup-title">One-time Setup</h2>
        <p className="setup-sub">Folio needs Ollama to run AI models locally on your machine.</p>
        <div className="setup-steps">
          <div className="setup-step">
            <span className="setup-step__num">1</span>
            <div>
              <p className="setup-step__title">Download Ollama</p>
              <p className="setup-step__desc">Visit ollama.com and install the app</p>
            </div>
            <a href="https://ollama.com/download" target="_blank" className="setup-btn setup-btn--primary">
              Download
            </a>
          </div>
          <div className="setup-step">
            <span className="setup-step__num">2</span>
            <div>
              <p className="setup-step__title">Come back here</p>
              <p className="setup-step__desc">Click continue once Ollama is installed</p>
            </div>
          </div>
        </div>
        <button className="setup-btn setup-btn--primary" style={{width:'100%', marginTop:'16px'}} onClick={checkStatus}>
          Continue →
        </button>
      </div>
    </div>
  )

  if (step === 'needs_model') return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="logo__mark"><div className="logo__dot" /></div>
          <span className="logo__name">Folio</span>
        </div>
        <h2 className="setup-title">Download AI Model</h2>
        <p className="setup-sub">
          Your system has <strong>{status?.ram_gb}GB RAM</strong>. 
          Folio will download <strong>{status?.recommended_model}</strong> (~{status?.ram_gb >= 14 ? '5' : '2'}GB).
        </p>
        <p className="setup-sub" style={{marginTop: '8px', opacity: 0.6}}>This only happens once.</p>
        <button className="setup-btn setup-btn--primary" style={{width:'100%', marginTop:'24px'}} onClick={pullModel}>
          Download Model
        </button>
      </div>
    </div>
  )

  if (step === 'pulling') return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="logo__mark"><div className="logo__dot" /></div>
          <span className="logo__name">Folio</span>
        </div>
        <h2 className="setup-title">Downloading Model…</h2>
        <div className="setup-progress">
          <div className="setup-progress__bar" style={{width: `${progress}%`}} />
        </div>
        <p className="setup-sub" style={{marginTop: '12px'}}>{progress}% — {pullLog || 'Starting download…'}</p>
        <p className="setup-sub" style={{opacity: 0.5, marginTop: '8px'}}>This may take a few minutes depending on your connection.</p>
      </div>
    </div>
  )

  return null
}
function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span/><span/><span/>
    </div>
  )
}

function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="msg-code">{part.slice(1, -1)}</code>
    return part
  })
}

function FormattedMessage({ content }) {
  const lines = content.split('\n')
  const elements = []
  let bulletBuffer = []
  let codeBuffer = []
  let tableBuffer = []
  let inCode = false
  let inTable = false
  let codeLang = ''

  const flushBullets = (key) => {
    if (bulletBuffer.length > 0) {
      elements.push(<ul key={`ul-${key}`} className="msg-list">{[...bulletBuffer]}</ul>)
      bulletBuffer = []
    }
  }

  const flushCode = (key) => {
    if (codeBuffer.length > 0) {
      elements.push(
        <div key={`code-${key}`} className="msg-code-block">
          {codeLang && <div className="msg-code-lang">{codeLang}</div>}
          <pre><code>{codeBuffer.join('\n')}</code></pre>
        </div>
      )
      codeBuffer = []
      codeLang = ''
    }
  }

  const flushTable = (key) => {
    if (tableBuffer.length > 0) {
      elements.push(
        <div key={`table-${key}`} className="msg-table-wrap">
          <table className="msg-table">
            <tbody>
              {tableBuffer.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? 'msg-table-header' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="msg-td">{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableBuffer = []
      inTable = false
    }
  }

  lines.forEach((line, i) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (!inCode) {
        flushBullets(i)
        flushTable(i)
        inCode = true
        codeLang = line.replace('```', '').trim()
      } else {
        inCode = false
        flushCode(i)
      }
      return
    }
    if (inCode) { codeBuffer.push(line); return }

    // Table rows
    if (line.startsWith('|')) {
      flushBullets(i)
      const cells = line.split('|').filter((_, ci) => ci > 0 && ci < line.split('|').length - 1)
      // Skip separator rows like |---|---|
      if (cells.every(c => c.trim().match(/^[-: ]+$/))) return
      inTable = true
      tableBuffer.push(cells)
      return
    } else if (inTable) {
      flushTable(i)
    }

    // Headings — handle # through ######
    if (line.match(/^#{1,6} /)) {
      flushBullets(i)
      const text = line.replace(/^#{1,6} /, '')
      const level = line.match(/^(#{1,6})/)[1].length
      const size = level <= 2 ? 'msg-heading--lg' : level <= 4 ? 'msg-heading--md' : 'msg-heading--sm'
      elements.push(<h3 key={i} className={`msg-heading ${size}`}>{renderInline(text)}</h3>)

    // Bullet points
    } else if (line.match(/^[-–*•] /)) {
      bulletBuffer.push(<li key={i} className="msg-bullet">{renderInline(line.replace(/^[-–*•] /, ''))}</li>)

    // Numbered lists
    } else if (line.match(/^\d+\. /)) {
      bulletBuffer.push(<li key={i} className="msg-bullet msg-bullet--numbered">{renderInline(line.replace(/^\d+\. /, ''))}</li>)

    // Empty line
    } else if (line.trim() === '') {
      flushBullets(i)
      elements.push(<br key={i} />)

    // Regular paragraph
    } else {
      flushBullets(i)
      elements.push(<p key={i} className="msg-para">{renderInline(line)}</p>)
    }
  })

  flushBullets('end')
  flushCode('end')
  flushTable('end')

  return <div className="formatted-message">{elements}</div>
}

function Message({ msg, isNew, isStreaming }) {
  return (
    <div className={`message message--${msg.role} ${isNew ? 'message--new' : ''}`}>
      {msg.role === 'assistant' && (
        <div className="message__avatar"><BookOpen size={13} /></div>
      )}
      <div className="message__bubble">
        {msg.role === 'assistant'
          ? <FormattedMessage content={msg.content} />
          : msg.content}
        {isStreaming && <span className="cursor-blink">▍</span>}
        {msg.source && !isStreaming && (
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
  const handle = (f) => { if (f && f.type === 'application/pdf') onUpload(f) }

  return (
    <div
      className={`upload ${dragging ? 'upload--drag' : ''} ${file ? 'upload--has-file' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => !file && inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />
      {file ? (
        <div className="upload__file">
          <div className="upload__file-icon"><FileText size={20} /></div>
          <div className="upload__file-info">
            <span className="upload__file-name">{file.name}</span>
            <span className="upload__file-size">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to chat</span>
          </div>
          <button className="upload__remove" onClick={e => { e.stopPropagation(); onUpload(null) }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="upload__empty">
          <div className="upload__icon-wrap"><Upload size={22} /></div>
          <p className="upload__label">Drop your PDF here</p>
          <p className="upload__sub">or click to browse</p>
        </div>
      )}
    </div>
  )
}

function ChatHistoryPanel({ sessions, activeFile, onSelect, onDelete }) {
  if (sessions.length === 0) return null
  return (
    <div className="history-panel">
      <p className="sidebar__label">Recent Chats</p>
      <div className="history-list">
        {sessions.map(s => (
          <div
            key={s.filename}
            className={`history-item ${activeFile === s.filename ? 'history-item--active' : ''}`}
            onClick={() => onSelect(s)}
          >
            <div className="history-item__icon"><FileText size={12} /></div>
            <div className="history-item__info">
              <span className="history-item__name">{s.filename.replace('.pdf', '')}</span>
              <span className="history-item__meta">
                <Clock size={9} /> {s.last_updated} · {s.message_count} msgs
              </span>
            </div>
            <button className="history-item__del" onClick={e => { e.stopPropagation(); onDelete(s.filename) }}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [setupDone, setSetupDone] = useState(false)
  const [file, setFile] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [newMsgId, setNewMsgId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [streamingId, setStreamingId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const bottomRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:8000/health')
        setBackendOnline(res.ok)
      } catch { setBackendOnline(false) }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/sessions')
      const data = await res.json()
      setSessions(data.sessions)
    } catch { }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSelectSession = useCallback(async (session) => {
    try {
      const res = await fetch(`http://localhost:8000/sessions/${encodeURIComponent(session.filename)}`)
      const data = await res.json()
      setActiveFile(session.filename)
      setFile({ name: session.filename, size: session.size || 0 })
      const restored = []
      for (const h of data.history) {
        restored.push({ id: Math.random(), role: 'user', content: h.user })
        restored.push({ id: Math.random(), role: 'assistant', content: h.assistant, source: session.filename })
      }
      setMessages(restored)
    } catch { }
  }, [])

  const handleDeleteSession = useCallback(async (filename) => {
    await fetch(`http://localhost:8000/sessions/${encodeURIComponent(filename)}`, { method: 'DELETE' })
    loadSessions()
    if (activeFile === filename) {
      setFile(null)
      setMessages([])
      setActiveFile(null)
    }
  }, [activeFile, loadSessions])

  const handleFileUpload = useCallback(async (f) => {
    setFile(f)
    setMessages([])
    setActiveFile(f ? f.name : null)
    if (f) {
      setProcessing(true)
      const formData = new FormData()
      formData.append('file', f)
      try {
        const res = await fetch('http://localhost:8000/upload', { method: 'POST', body: formData })
        const data = await res.json()
        setProcessing(false)
        const id = Date.now()
        setNewMsgId(id)
        if (data.history && data.history.length > 0) {
          const restored = []
          for (const h of data.history) {
            restored.push({ id: Math.random(), role: 'user', content: h.user })
            restored.push({ id: Math.random(), role: 'assistant', content: h.assistant, source: f.name })
          }
          setMessages(restored)
        } else {
          setMessages([{ id, role: 'assistant', content: `"${f.name}" loaded — ${data.status}` }])
        }
        loadSessions()
      } catch {
        setProcessing(false)
        setMessages([{ id: Date.now(), role: 'assistant', content: 'Error: Could not connect to backend.' }])
      }
    }
  }, [loadSessions])

  const send = useCallback(async () => {
    if (!input.trim() || loading || !file) return
    const currentInput = input.trim()
    const userMsg = { id: Date.now(), role: 'user', content: currentInput }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    textareaRef.current?.focus()

    const assistantId = Date.now() + 1
    setStreamingId(assistantId)
    setMessages(m => [...m, { id: assistantId, role: 'assistant', content: '', source: null }])

    try {
      const formData = new FormData()
      formData.append('message', currentInput)
      formData.append('model', 'auto')

      const res = await fetch('http://localhost:8000/chat', { method: 'POST', body: formData })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const raw = line.replace('data: ', '').trim()
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw)
            if (parsed.token) {
              setMessages(m => m.map(msg =>
                msg.id === assistantId ? { ...msg, content: msg.content + parsed.token } : msg
              ))
            }
            if (parsed.done) {
              const sourceInfo = `${parsed.source} · ${parsed.model}`
              setMessages(m => m.map(msg =>
                msg.id === assistantId ? { ...msg, source: sourceInfo } : msg
              ))
              loadSessions()
            }
          } catch { }
        }
      }
    } catch {
      setMessages(m => m.map(msg =>
        msg.id === assistantId ? { ...msg, content: 'Connection error. Is the backend running?' } : msg
      ))
    } finally {
      setLoading(false)
      setStreamingId(null)
      setNewMsgId(assistantId)
    }
  }, [input, loading, file, loadSessions])

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const isEmpty = messages.length === 0 && !processing
  if (!setupDone) return <SetupWizard onComplete={() => setSetupDone(true)} />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="logo">
            <div className="logo__mark"><div className="logo__dot" /></div>
            <span className="logo__name">Folio</span>
          </div>
          <p className="logo__tagline">PDF Intelligence</p>
        </div>

        <div className="sidebar__section">
          <p className="sidebar__label">Document</p>
          <PDFUpload onUpload={handleFileUpload} file={file} />
        </div>

        {file && (
          <div className="sidebar__section sidebar__section--stats">
            <p className="sidebar__label">Session</p>
            <div className="stats">
              <div className="stat">
                <span className="stat__val">{messages.filter(m => m.role === 'user').length}</span>
                <span className="stat__key">Questions</span>
              </div>
              <div className="stat">
                <span className="stat__val">{(file.size / 1024).toFixed(0)}k</span>
                <span className="stat__key">PDF size</span>
              </div>
            </div>
          </div>
        )}

        <ChatHistoryPanel
          sessions={sessions}
          activeFile={activeFile}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
        />

        <div className="sidebar__footer">
          <div className={`status-dot ${backendOnline ? 'status-dot--online' : 'status-dot--offline'}`} />
          <span>{backendOnline ? 'Backend online' : 'Backend offline'}</span>
        </div>
      </aside>

      <main className="main">
        <div className="chat">
          {isEmpty && (
            <div className="empty">
              <div className="empty__icon"><MessageSquare size={28} /></div>
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
              <Message key={msg.id} msg={msg} isNew={msg.id === newMsgId} isStreaming={msg.id === streamingId} />
            ))}
            {loading && streamingId === null && (
              <div className="message message--assistant">
                <div className="message__avatar"><BookOpen size={13} /></div>
                <div className="message__bubble"><TypingIndicator /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

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
              <button
                className={`send-btn ${input.trim() && file ? 'send-btn--active' : ''}`}
                onClick={send}
                disabled={!input.trim() || !file || loading}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for newline · responses sourced from document</p>
        </div>
      </main>
    </div>
  )
}