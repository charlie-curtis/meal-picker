import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, remove, set, onValue, onDisconnect } from 'firebase/database'
import { AppHeader } from './components/AppHeader.jsx'
import { NearbySearchPanel } from './components/NearbySearchPanel.jsx'
import { PickControls } from './components/PickControls.jsx'
import { PrivacyFooter } from './components/PrivacyFooter.jsx'
import { RestaurantForm } from './components/RestaurantForm.jsx'
import { RestaurantList } from './components/RestaurantList.jsx'
import { SuggestionsPanel } from './components/SuggestionsPanel.jsx'
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
  roomId = Math.random().toString(36).slice(2, 11)
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

function friendlyError(e) {
  if (e instanceof TypeError)
    return 'Search unavailable — please try again later.'
  return e.message
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
    if (spinning) return
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
      setLocationError(friendlyError(e))
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
      setLocationError(friendlyError(e))
    } finally {
      setLocationLoading(false)
    }
  }

  return (
    <main className="page">
      <div className="page-content">
        <div className="card">
          <AppHeader
            viewerCount={viewerCount}
            copyLabel={copyLabel}
            onCopyLink={copyLink}
          />

          <div className="input-section">
            <RestaurantForm
              inputRef={inputRef}
              inputVal={inputVal}
              dupMsg={dupMsg}
              spinning={spinning}
              onInputChange={setInputVal}
              onAddRestaurant={addRestaurant}
            />
            <RestaurantList
              entries={entries}
              winner={winner}
              spinning={spinning}
              spinIndex={spinIndex}
              onRemoveRestaurant={removeRestaurant}
            />
          </div>

          <PickControls
            show={entries.length > 0 || spinning}
            winner={winner}
            spinning={spinning}
            onPickRandom={pickRandom}
          />

          <SuggestionsPanel
            open={helpOpen}
            suggestions={SUGGESTIONS}
            addedNames={addedNames}
            onToggle={() => setHelpOpen(o => !o)}
            onAddRestaurant={addRestaurant}
          />

          <NearbySearchPanel
            open={nearbyOpen}
            locationInput={locationInput}
            radius={radius}
            nearbyResults={nearbyResults}
            locationLoading={locationLoading}
            locationError={locationError}
            addedNames={addedNames}
            onToggle={() => setNearbyOpen(o => !o)}
            onLocationInputChange={setLocationInput}
            onRadiusChange={setRadius}
            onFindNearby={findNearby}
            onUseMyLocation={useMyLocation}
            onAddRestaurant={addRestaurant}
          />
        </div>
        <PrivacyFooter />
      </div>
    </main>
  )
}
