import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, remove, set, onValue, onDisconnect } from 'firebase/database'
import { getCurrentPosition, geocodeAddress, searchNearbyPlaces } from './services/locationService'
import { AppHeader } from './components/AppHeader'
import { NearbySearchPanel } from './components/NearbySearchPanel'
import { PickControls } from './components/PickControls'
import { PrivacyFooter } from './components/PrivacyFooter'
import { RestaurantForm } from './components/RestaurantForm'
import { RestaurantList } from './components/RestaurantList'
import { SuggestionsPanel } from './components/SuggestionsPanel'
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

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function friendlyError(e: unknown): string {
  if (e instanceof TypeError)
    return 'Search unavailable. Please try again later.'
  return (e as Error).message
}

export default function App() {
  const [restaurants, setRestaurants] = useState<Record<string, string>>({})
  const [winner, setWinner] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinIndex, setSpinIndex] = useState<number | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Invite')
  const [locationInput, setLocationInput] = useState('')
  const [radius, setRadius] = useState(5)
  const [nearbyResults, setNearbyResults] = useState<string[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [dupMsg, setDupMsg] = useState('')
  const [viewerCount, setViewerCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const val = snap.val() as Record<string, boolean> | null
      setViewerCount(val ? Object.keys(val).length : 0)
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

  const entries: [string, string][] = Object.entries(restaurants)
  const addedNames = new Set(entries.map(([, n]) => n.toLowerCase()))

  function addRestaurant(name?: string, refocus = true) {
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

  function removeRestaurant(key: string) {
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

    const delays: number[] = []
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

  async function findNearby() {
    if (!locationInput.trim()) return
    setLocationLoading(true)
    setLocationError('')
    setNearbyResults([])
    try {
      const { lat, lng } = await geocodeAddress(locationInput.trim())
      const names = await searchNearbyPlaces(lat, lng, radius)
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
      const names = await searchNearbyPlaces(lat, lng, radius)
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
