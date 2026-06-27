import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, remove, set, onValue, onDisconnect } from 'firebase/database'
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
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Invite')
  const [locationInput, setLocationInput] = useState('')
  const [radius, setRadius] = useState(5)
  const [nearbyResults, setNearbyResults] = useState([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [dupMsg, setDupMsg] = useState('')
  const [viewerCount, setViewerCount] = useState(0)
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

    // Presence: write on connect, auto-remove on disconnect (even on crash/close)
    const presenceRef = push(ref(db, `rooms/${roomId}/presence`))
    const connectedRef = ref(db, '.info/connected')
    const unsubConnected = onValue(connectedRef, snap => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).remove()
        set(presenceRef, true)
      }
    })
    const unsubPresence = onValue(ref(db, `rooms/${roomId}/presence`), snap => {
      setViewerCount(snap.val() ? Object.keys(snap.val()).length : 0)
    })

    return () => {
      unsub1()
      unsub2()
      unsubConnected()
      unsubPresence()
      remove(presenceRef)
      if (spinTimer.current) clearTimeout(spinTimer.current)
    }
  }, [])

  const entries = Object.entries(restaurants)
  const addedNames = new Set(entries.map(([, n]) => n.toLowerCase()))

  // refocus=true only when called from the manual input — chips pass false
  // so multi-adding from chips doesn't yank keyboard focus away
  function addRestaurant(name, refocus = true) {
    const n = (name ?? inputVal).trim()
    if (!n) return
    const exists = entries.some(([, existing]) => existing.toLowerCase() === n.toLowerCase())
    if (exists) {
      setDupMsg('Already in list')
      setTimeout(() => setDupMsg(''), 2000)
      if (refocus) { setInputVal(''); inputRef.current?.focus() }
      return
    }
    push(restaurantsRef, n)
    setInputVal('')
    if (refocus) inputRef.current?.focus()
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

    if (prefersReducedMotion()) {
      setWinner(winnerName)
      set(winnerRef, winnerName)
      return
    }

    const delays = []
    let d = 70
    while (d < 600) {
      delays.push(d)
      d = Math.round(d * 1.12)
    }
    const ticks = delays.length
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
    setTimeout(() => setCopyLabel('Invite'), 2000)
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
    if (!workerUrl) throw new Error('Search unavailable.')
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
    if (!res.ok) throw new Error(res.status === 429 ? 'Daily search limit reached — try again tomorrow.' : 'Search failed — try again.')
    const names = (data.places ?? [])
      .filter(p => p.displayName?.text)
      .map(p => p.displayName.text)
    return [...new Set(names)]
  }

  async function geocodeAddress(address) {
    const workerUrl = import.meta.env.VITE_WORKER_URL
    if (!workerUrl) throw new Error('Search unavailable.')
    const res = await fetch(`${workerUrl}/geocode?address=${encodeURIComponent(address)}`)
    const data = await res.json()
    if (data.status !== 'OK') throw new Error('Address not found — try a more specific address or zip code.')
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

        {/* Title + inline share — collaboration is the differentiator, surface it here */}
        <div className="title-bar">
          <div className="title-block">
            <h1>Just Pick Food</h1>
            <p className="subtitle">Add places together. We pick one.</p>
          </div>
          <div className="title-actions">
            {viewerCount > 1 && (
              <span
                className="viewer-count"
                aria-label={`${viewerCount} people in this room`}
              >
                <span className="viewer-dot" aria-hidden="true" />
                {`${viewerCount} here`}
              </span>
            )}
            <button className="btn-share-icon" onClick={copyLink} aria-label="Copy room link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="share-label">{copyLabel}</span>
            </button>
          </div>
        </div>

        {/* Core workflow: add → list → pick */}
        <div className="input-section">
          <div className="input-row">
            <label htmlFor="restaurant-input" className="sr-only">Restaurant name</label>
            <input
              id="restaurant-input"
              ref={inputRef}
              type="text"
              placeholder="Restaurant name…"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRestaurant()}
              disabled={spinning}
            />
            <button
              className="btn-add"
              onClick={() => addRestaurant()}
              disabled={!inputVal.trim() || spinning}
            >
              Add
            </button>
          </div>
          {dupMsg && <p className="dup-msg" role="alert">{dupMsg}</p>}

          <div className="list-wrapper">
            {entries.length > 0 && (
              <div className="list-meta" aria-hidden="true">
                {entries.length} {entries.length === 1 ? 'place' : 'places'}
              </div>
            )}
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
                  <span className="empty-hint">Add your first place to start the list.</span>
                </li>
              ) : (
                entries.map(([key, name], i) => {
                  const isHighlight = spinning && spinIndex === i
                  const isWinner = !spinning && winner === name
                  return (
                    <li key={key} className={isHighlight ? 'highlight' : isWinner ? 'winner' : ''}>
                      <span>{name}</span>
                      <button
                        className="remove-btn"
                        aria-label={`Remove ${name}`}
                        onClick={() => removeRestaurant(key)}
                        disabled={spinning}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>

        {(entries.length > 0 || spinning) && (
          <div className="pick-row">
            <button className="btn-pick" onClick={pickRandom} disabled={spinning}>
              {spinning ? 'Picking…' : winner ? 'Pick again' : 'Pick one'}
            </button>
            <div className="result" role="status" aria-live="polite">
              {winner && !spinning ? `Let's go to ${winner}!` : ''}
            </div>
          </div>
        )}

        {/* Discovery: static suggestions (secondary, below the fold) */}
        <div className="help-section">
          <button
            className="disclosure-toggle"
            aria-expanded={helpOpen}
            aria-controls="help-panel"
            onClick={() => setHelpOpen(o => !o)}
          >
            <Chevron />
            Need ideas? Browse suggestions
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
                            onClick={() => addRestaurant(name, false)}
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

        {/* Discovery: nearby restaurants (secondary, below the fold) */}
        <div className="nearby-section">
          <button
            className="disclosure-toggle"
            aria-expanded={nearbyOpen}
            aria-controls="nearby-panel"
            onClick={() => setNearbyOpen(o => !o)}
          >
            <Chevron />
            Find restaurants nearby
          </button>
          <div id="nearby-panel" className={`collapse ${nearbyOpen ? 'open' : ''}`}>
            <div className="collapse-inner" {...(!nearbyOpen ? { inert: '' } : {})}>
              <div className="nearby-tray">
                <div className="nearby-controls">
                  <label htmlFor="location-input" className="sr-only">Address or zip code</label>
                  <input
                    id="location-input"
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
                            onClick={() => addRestaurant(name, false)}
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

      </div>
    </main>
  )
}
