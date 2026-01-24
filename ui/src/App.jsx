import { useState } from 'react'
import './App.css'

const API_URL = '' // Uses Vite proxy

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [screenshot, setScreenshot] = useState(null)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(null)

  const handleRender = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL (include https://)')
      return
    }

    setLoading(true)
    setError(null)
    setScreenshot(null)
    setMeta(null)

    try {
      console.log('Sending request to:', `${API_URL}/v1/render`)
      const response = await fetch(`${API_URL}/v1/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          render: {
            wait_until: 'load',
            timeout_ms: 30000
          },
          debug: { screenshot: true }
        })
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (data.success) {
        setScreenshot(data.content?.screenshot)
        setMeta(data.meta)
      } else {
        setError(data.errors?.[0]?.message || 'Render failed')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError(`Connection error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!screenshot) return
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${screenshot}`
    link.download = 'screenshot.png'
    link.click()
  }

  return (
    <div className="app">
      <header>
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          <h1>Web Screenshot Tool</h1>
        </div>
        <p className="tagline">Capture any webpage instantly</p>
      </header>

      <main>
        <div className="search-box">
          <input
            type="url"
            placeholder="Paste any website URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRender()}
          />
          <button onClick={handleRender} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Capturing...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                </svg>
                Capture Screenshot
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-container">
            <div className="loading-animation">
              <div className="pulse-ring"></div>
              <div className="pulse-dot"></div>
            </div>
            <p>Rendering webpage...</p>
            <span>This may take a few seconds</span>
          </div>
        )}

        {screenshot && !loading && (
          <div className="result">
            <div className="result-header">
              <h2>Screenshot Captured!</h2>
              <div className="result-actions">
                <button className="download-btn" onClick={handleDownload}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {meta && (
              <div className="meta-bar">
                <span className="meta-item success">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Success
                </span>
                <span className="meta-item">⏱️ {meta.load_time_ms}ms</span>
                <span className="meta-item">📄 {meta.page_title?.slice(0, 40) || 'No title'}</span>
              </div>
            )}

            <div className="screenshot-container">
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Screenshot"
              />
            </div>
          </div>
        )}

        {!screenshot && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </div>
            <h3>Capture Website Screenshots</h3>
            <p>Enter a URL above to capture a full-page screenshot of any website</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
