import { useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:3000'

function App() {
  const [activeTab, setActiveTab] = useState('render') // 'render' or 'search'

  // URL Render state
  const [url, setUrl] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [meta, setMeta] = useState(null)

  // Google Search state
  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [totalResults, setTotalResults] = useState('')

  // Shared state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRender = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

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
      const response = await fetch(`${API_URL}/v1/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          render: { wait_until: 'load', timeout_ms: 30000 },
          debug: { screenshot: true }
        })
      })

      const data = await response.json()

      if (data.success) {
        setScreenshot(data.content?.screenshot)
        setMeta(data.meta)
      } else {
        setError(data.errors?.[0]?.message || 'Render failed')
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setError('Please enter a search keyword')
      return
    }

    setLoading(true)
    setError(null)
    setSearchResults([])
    setTotalResults('')

    try {
      const response = await fetch(`${API_URL}/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          num_results: 10,
          country: 'in'
        })
      })

      const data = await response.json()

      if (data.success) {
        setSearchResults(data.results || [])
        setTotalResults(data.total_results || '')
      } else {
        setError(data.errors?.[0]?.message || 'Search failed')
      }
    } catch (err) {
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
          <h1>Web Unlock API</h1>
        </div>
        <p className="tagline">Render webpages & search Google with stealth</p>
      </header>

      <main>
        {/* Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'render' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('render')
              setError(null)
              setSearchResults([])
              setScreenshot(null)
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            URL Screenshot
          </button>
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('search')
              setError(null)
              setScreenshot(null)
              setSearchResults([])
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            Google Search
          </button>
        </div>

        {/* URL Render Tab */}
        {activeTab === 'render' && (
          <div className="tab-content">
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
                  <img src={`data:image/png;base64,${screenshot}`} alt="Screenshot" />
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
          </div>
        )}

        {/* Google Search Tab */}
        {activeTab === 'search' && (
          <div className="tab-content">
            <div className="search-box">
              <input
                type="text"
                placeholder="Enter search keyword (e.g., best restaurants delhi)..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    Search Google
                  </>
                )}
              </button>
            </div>

            {searchResults.length > 0 && !loading && (
              <div className="search-results">
                <div className="results-header">
                  <h2>Search Results</h2>
                  {totalResults && <span className="total-results">{totalResults}</span>}
                </div>

                <div className="results-list">
                  {searchResults.map((result, index) => (
                    <div key={index} className="search-result-item">
                      <div className="result-position">{result.position}</div>
                      <div className="result-content">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="result-title">
                          {result.title}
                        </a>
                        <div className="result-url">{result.url}</div>
                        {result.snippet && <p className="result-snippet">{result.snippet}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!searchResults.length && !loading && !error && (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                </div>
                <h3>Search Google with Stealth</h3>
                <p>Enter a keyword to search Google and get organic results</p>
                <p className="note">⚠️ Note: May trigger CAPTCHA on repeated use without proxies</p>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </div>
        )}

        {/* Loading Display */}
        {loading && (
          <div className="loading-container">
            <div className="loading-animation">
              <div className="pulse-ring"></div>
              <div className="pulse-dot"></div>
            </div>
            <p>{activeTab === 'search' ? 'Searching Google...' : 'Rendering webpage...'}</p>
            <span>This may take a few seconds</span>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
