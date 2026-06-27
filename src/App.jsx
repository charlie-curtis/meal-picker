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
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [radius, setRadius] = useState(5)
  const [nearbyResults, setNearbyResults] = useState([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
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

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by your browser'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('Location access denied — try entering an address instead'))
      )
    })
  }

  async function searchNearbyPlaces(lat, lng) {
    const workerUrl = import.meta.env.VITE_WORKER_URL
    if (!workerUrl) throw new Error('Add VITE_WORKER_URL to .env.local')
    const radiusMeters = radius * 1609.34
    const res = await fetch(`${workerUrl}/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusMeters,
          }
        }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? 'Nearby search failed')
    const names = (data.places ?? [])
      .filter(p => p.displayName?.text)
      .map(p => p.displayName.text)
    return [...new Set(names)]
  }

  async function geocodeAddress(address) {
    const workerUrl = import.meta.env.VITE_WORKER_URL
    if (!workerUrl) throw new Error('Add VITE_WORKER_URL to .env.local')
    const res = await fetch(`${workerUrl}/geocode?address=${encodeURIComponent(address)}`)
    const data = await res.json()
    if (data.status !== 'OK') throw new Error('Address not found — try a more specific address or zip code')
    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  }

  async function findNearby() {
    if (!locationInput.trim()) return
    setLocationLoading(true)
    setLocationError('')
    setNearbyResults([])
    try {
      const { lat, lng } = await geocodeAddress(locationInput.trim())
      const names = await searchNearbyPlaces(lat, lng)
      if (names.length === 0) setLocationError('No restaurants found — try a larger radius.')
      else setNearbyResults(names)
    } catch (e) {
      setLocationError(e.message)
    } finally {
      setLocationLoading(false)
    }
  }

  async function useMyLocation() {
    setLocationLoading(true)
    setLocationError('')
    setNearbyResults([])
    setLocationInput('')
    try {
      const { lat, lng } = await getCurrentPosition()
      const names = await searchNearbyPlaces(lat, lng)
      if (names.length === 0) setLocationError('No restaurants found — try a larger radius.')
      else setNearbyResults(names)
    } catch (e) {
      setLocationError(e.message)
    } finally {
      setLocationLoading(false)
    }
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

        {/* Nearby restaurants */}
        <div className="nearby-section">
          <button
            className="disclosure-toggle"
            aria-expanded={nearbyOpen}
            aria-controls="nearby-panel"
            onClick={() => setNearbyOpen(o => !o)}
          >
            <Chevron />
            Find nearby restaurants
          </button>
          <div id="nearby-panel" className={`collapse ${nearbyOpen ? 'open' : ''}`}>
            <div className="collapse-inner" {...(!nearbyOpen ? { inert: '' } : {})}>
              <div className="nearby-tray">
                <div className="nearby-controls">
                  <input
                    type="text"
                    placeholder="Address or zip code…"
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && findNearby()}
                  />
                  <button
                    className="btn-locate"
                    onClick={useMyLocation}
                    aria-label="Use my current location"
                    disabled={locationLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div className="nearby-options-row">
                  <label className="radius-label">
                    Within
                    <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
                      <option value={0.5}>0.5 mi</option>
                      <option value={1}>1 mi</option>
                      <option value={2}>2 mi</option>
                      <option value={5}>5 mi</option>
                      <option value={10}>10 mi</option>
                    </select>
                  </label>
                  <button
                    className="btn-search"
                    onClick={findNearby}
                    disabled={locationLoading || !locationInput.trim()}
                  >
                    {locationLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {locationError && (
                  <p className="nearby-error" role="alert">{locationError}</p>
                )}
                {nearbyResults.length > 0 && (
                  <div className="nearby-results">
                    <div className="help-category-label">{nearbyResults.length} nearby</div>
                    <div className="help-chips">
                      {nearbyResults.map(name => {
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
                )}
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
