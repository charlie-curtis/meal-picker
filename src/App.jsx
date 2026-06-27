import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, remove, set, onValue } from 'firebase/database'
import './App.css'

const firebaseConfig = {
  apiKey: "AIzaSyAf8FxYhAgYPB3H2mDvzZUpfSUMAEDI240",
  authDomain: "meal-picker-a1961.firebaseapp.com",
  databaseURL: "https://meal-picker-a1961-default-rtdb.firebaseio.com",
  projectId: "meal-picker-a1961",
  storageBucket: "meal-picker-a1961.firebasestorage.app",
  messagingSenderId: "292156708829",
  appId: "1:292156708829:web:ee3b9535fd0bcfb1d78834"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

let roomId = new URLSearchParams(window.location.search).get('room')
if (!roomId) {
  roomId = Math.random().toString(36).slice(2, 8)
  window.history.replaceState({}, '', `?room=${roomId}`)
}
const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`

const SUGGESTIONS = {
  'Burgers':    ["McDonald's", "Wendy's", "Burger King", "Shake Shack", "Chick-fil-A"],
  'Pizza':      ["Domino's", "Pizza Hut", "Papa John's", "Little Caesars"],
  'Mexican':    ["Chipotle", "Taco Bell", "Qdoba"],
  'Chicken':    ["Popeyes", "KFC", "Wingstop", "Raising Cane's"],
  'Asian':      ["Panda Express", "Cava", "Sweetgreen"],
  'Sandwiches': ["Subway", "Panera Bread", "Jimmy John's"],
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [restaurants, setRestaurants] = useState({})
  const [winner, setWinner] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [spinIndex, setSpinIndex] = useState(null)
  const [inputVal, setInputVal] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy link')
  const inputRef = useRef(null)
  const spinTimer = useRef(null)

  const restaurantsRef = ref(db, `rooms/${roomId}/restaurants`)
  const winnerRef = ref(db, `rooms/${roomId}/winner`)

  useEffect(() => {
    const unsub1 = onValue(restaurantsRef, snap => {
      setRestaurants(snap.val() || {})
    })
    const unsub2 = onValue(winnerRef, snap => {
      setWinner(snap.val())
    })
    return () => {
      unsub1()
      unsub2()
      if (spinTimer.current) clearTimeout(spinTimer.current)
    }
  }, [])

  const entries = Object.entries(restaurants)
  const addedNames = new Set(entries.map(([, n]) => n.toLowerCase()))

  function addRestaurant(name) {
    const n = (name ?? inputVal).trim()
    if (!n) return
    // Skip duplicates (case-insensitive)
    const exists = entries.some(([, existing]) => existing.toLowerCase() === n.toLowerCase())
    if (exists) {
      setInputVal('')
      inputRef.current?.focus()
      return
    }
    push(restaurantsRef, n)
    setInputVal('')
    inputRef.current?.focus()
  }

  function removeRestaurant(key) {
    remove(ref(db, `rooms/${roomId}/restaurants/${key}`))
    remove(winnerRef)
    setWinner(null)
  }

  function pickRandom() {
    if (!entries.length || spinning) return
    setWinner(null)

    const total = entries.length
    const winnerIndex = Math.floor(Math.random() * total)
    const winnerName = entries[winnerIndex][1]

    // Reduced motion: skip the cycle entirely and select instantly.
    if (prefersReducedMotion()) {
      setWinner(winnerName)
      set(winnerRef, winnerName)
      return
    }

    // Build a decelerating schedule that ramps from snappy to slow,
    // so the highlight visibly settles to a stop (no strobe).
    const delays = []
    let d = 70
    while (d < 600) {
      delays.push(d)
      d = Math.round(d * 1.12)
    }
    const ticks = delays.length
    // Step sequentially through rows, landing the final tick on the winner.
    const start = ((winnerIndex - (ticks - 1)) % total + total) % total

    setSpinning(true)
    let t = 0
    const step = () => {
      setSpinIndex((start + t) % total)
      t++
      if (t < ticks) {
        spinTimer.current = setTimeout(step, delays[t])
      } else {
        spinTimer.current = setTimeout(() => {
          setSpinning(false)
          setSpinIndex(null)
          setWinner(winnerName)
          set(winnerRef, winnerName)
        }, 550)
      }
    }
    step()
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy link'), 2000)
  }

  return (
    <main className="page">
      <div className="card">
        <div className="title-block">
          <h1>Meal Picker</h1>
          <p className="subtitle">Add your options and let fate decide.</p>
        </div>

        {/* Help disclosure */}
        <div className="help-section">
          <button
            className="disclosure-toggle"
            aria-expanded={helpOpen}
            aria-controls="help-panel"
            onClick={() => setHelpOpen(o => !o)}
          >
            <Chevron />
            Need help? Browse options
          </button>
          <div id="help-panel" className={`collapse ${helpOpen ? 'open' : ''}`}>
            <div className="collapse-inner" {...(!helpOpen ? { inert: '' } : {})}>
              <div className="help-tray">
                {Object.entries(SUGGESTIONS).map(([category, items]) => (
                  <div key={category} className="help-category">
                    <div className="help-category-label">{category}</div>
                    <div className="help-chips">
                      {items.map(name => {
                        const added = addedNames.has(name.toLowerCase())
                        return (
                          <button
                            key={name}
                            className={`help-chip${added ? ' added' : ''}`}
                            onClick={() => addRestaurant(name)}
                            disabled={added}
                          >
                            {name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input + list */}
        <div className="input-section">
          <div className="input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Restaurant name…"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRestaurant()}
            />
            <button
              className="btn-add"
              onClick={() => addRestaurant()}
              disabled={!inputVal.trim()}
            >
              Add
            </button>
          </div>

          <ul className="restaurant-list" aria-label={`${entries.length} restaurants added`}>
            {entries.length === 0 ? (
              <li className="empty-state">
                <svg className="empty-icon" width="36" height="36" viewBox="0 0 24 24"
                     fill="none" aria-hidden="true">
                  <path d="M7 3v8a2 2 0 0 1-2 2H4M5.5 3v6M4 3v6M17 3c-1.5 0-2.5 2-2.5 5s1 3 2.5 3 2.5 0 2.5-3-1-5-2.5-5ZM17 11v10"
                        stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="empty-title">No restaurants yet</span>
                <span className="empty-hint">Add one above, or pick from suggestions.</span>
              </li>
            ) : (
              entries.map(([key, name], i) => {
                const isHighlight = spinning && spinIndex === i
                const isWinner = !spinning && winner === name
                return (
                  <li key={key} className={isHighlight ? 'highlight' : isWinner ? 'winner' : ''}>
                    <span>{name}</span>
                    {isWinner && (
                      <span className="winner-badge" aria-hidden="true">★ Winner</span>
                    )}
                    <button
                      className="remove-btn"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeRestaurant(key)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        {/* Pick (primary) + result */}
        <div className="pick-row">
          <button className="btn-pick" onClick={pickRandom} disabled={spinning || !entries.length}>
            {spinning ? 'Picking…' : 'Pick one'}
          </button>
          <div className="result" role="status" aria-live="polite">
            {winner && !spinning ? `Let's go to ${winner}!` : ''}
          </div>
        </div>

        {/* Share disclosure (tertiary) */}
        <div className="share-section">
          <button
            className="disclosure-toggle"
            aria-expanded={shareOpen}
            aria-controls="share-box"
            onClick={() => setShareOpen(o => !o)}
          >
            <Chevron />
            Share this room
          </button>
          <div id="share-box" className={`collapse ${shareOpen ? 'open' : ''}`}>
            <div className="collapse-inner" {...(!shareOpen ? { inert: '' } : {})}>
              <div className="share-field">
                <span>{shareUrl}</span>
                <button className="btn-copy" onClick={copyLink}>{copyLabel}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
