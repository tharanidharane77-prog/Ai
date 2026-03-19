import { useState, useRef, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Send, User, Bot, Sparkles, AlertCircle, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'

// Initialize Gemini API
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(API_KEY || '')

const SYSTEM_INSTRUCTION = "You are a highly capable and accurate AI Assistant, built with Google's Gemini. Your goal is to provide helpful, professional, and concise answers, similar to ChatGPT. Use markdown formatting for code blocks, lists, and tables when appropriate. If you are unsure of an answer, admit it rather than providing incorrect information."
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']

function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Hello! I am your AI Assistant powered by Gemini. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    if (!API_KEY || API_KEY.includes('your_')) {
      setError('API Key is missing or invalid. Please check your .env file.')
      return
    }

    const currentInput = input
    const userMessage = { role: 'user', content: currentInput, timestamp: new Date() }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    const currentContext = `Current Date: ${new Date().toLocaleDateString()}\nCurrent Time: ${new Date().toLocaleTimeString()}\n${SYSTEM_INSTRUCTION}`

    let lastError = null
    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: currentContext })
        const history = messages.findIndex(m => m.role === 'user') === -1 ? [] : 
          messages.slice(messages.findIndex(m => m.role === 'user')).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }))

        const chat = model.startChat({ history })
        const result = await chat.sendMessageStream(currentInput)
        
        // Add an empty bot message to start streaming into
        const botMessageId = Date.now()
        setMessages(prev => [...prev, { role: 'bot', content: '', timestamp: new Date(), id: botMessageId }])
        setIsLoading(false)

        let fullText = ""
        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          fullText += chunkText
          setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, content: fullText } : m))
        }
        return 
      } catch (err) {
        console.error(`Error with ${modelName}:`, err)
        lastError = err
      }
    }

    setError(lastError?.message || 'Failed to get a response.')
    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={24} color="var(--accent)" />
          <h1>Tharani AI</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {error && <AlertCircle size={18} color="#ef4444" title={error} />}
          <button className="icon-btn" onClick={() => setMessages([{ role: 'bot', content: 'Cleared.', timestamp: new Date() }])}><Trash2 size={20} /></button>
        </div>
      </header>

      <main className="message-list">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="avatar">{msg.role === 'user' ? <User size={20} /> : <Bot size size={20} />}</div>
            <div className="message-content markdown-body">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={atomDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    )
                  }
                }}
              >{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="avatar"><Bot size={20} /></div>
            <div className="message-content"><div className="typing-indicator"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="input-area">
        <div className="input-container">
          <textarea ref={textareaRef} rows="1" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Message Gemini..." />
          <button className="send-button" onClick={handleSend} disabled={!input.trim() || isLoading}><Send size={18} /></button>
        </div>
      </footer>
    </div>
  )
}

export default App
