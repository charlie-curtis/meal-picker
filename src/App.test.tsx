import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */
type FirebaseData = Record<string, any>
type Ref = { path: string }
type SnapshotCallback = (snap: { val: () => any }) => void

const firebaseMock = vi.hoisted(() => {
  let data: FirebaseData = {}
  let listeners = new Map<string, Set<SnapshotCallback>>()
  let keyCounter = 0

  function pathParts(path: string): string[] {
    return path.split('/').filter(Boolean)
  }

  function getAtPath(path: string): any {
    return pathParts(path).reduce((value: any, part) => value?.[part], data)
  }

  function setAtPath(path: string, value: any) {
    const parts = pathParts(path)
    let cursor: any = data
    parts.slice(0, -1).forEach(part => {
      cursor[part] ??= {}
      cursor = cursor[part]
    })
    cursor[parts.at(-1)!] = value
  }

  function removeAtPath(path: string) {
    const parts = pathParts(path)
    let cursor: any = data
    parts.slice(0, -1).forEach(part => {
      cursor = cursor?.[part]
    })
    if (cursor) delete cursor[parts.at(-1)!]
  }

  function snap(path: string) {
    return { val: () => structuredClone(getAtPath(path) ?? null) }
  }

  function notify(path: string) {
    const parts = pathParts(path)
    const affected = [path]
    for (let i = parts.length - 1; i > 0; i--) {
      affected.push(parts.slice(0, i).join('/'))
    }

    affected.forEach(affectedPath => {
      listeners.get(affectedPath)?.forEach(callback => callback(snap(affectedPath)))
    })
  }

  return {
    reset() {
      data = {}
      listeners = new Map()
      keyCounter = 0
    },
    ref: (_db: any, path: string): Ref => ({ path }),
    push(parentRef: Ref, value?: any) {
      const childRef = { path: `${parentRef.path}/mock-key-${++keyCounter}` }
      if (value !== undefined) {
        setAtPath(childRef.path, value)
        notify(childRef.path)
      }
      return childRef
    },
    remove(targetRef: Ref) {
      removeAtPath(targetRef.path)
      notify(targetRef.path)
      return Promise.resolve()
    },
    set(targetRef: Ref, value: any) {
      setAtPath(targetRef.path, value)
      notify(targetRef.path)
      return Promise.resolve()
    },
    onDisconnect() {
      return { remove: vi.fn() }
    },
    onValue(targetRef: Ref, callback: SnapshotCallback) {
      if (!listeners.has(targetRef.path)) listeners.set(targetRef.path, new Set())
      listeners.get(targetRef.path)!.add(callback)
      if (targetRef.path === '.info/connected') {
        callback({ val: () => true })
      } else {
        callback(snap(targetRef.path))
      }
      return () => listeners.get(targetRef.path)?.delete(callback)
    },
  }
})

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: firebaseMock.ref,
  push: firebaseMock.push,
  remove: firebaseMock.remove,
  set: firebaseMock.set,
  onValue: firebaseMock.onValue,
  onDisconnect: firebaseMock.onDisconnect,
}))

async function renderApp({ reducedMotion = false } = {}) {
  vi.resetModules()
  firebaseMock.reset()
  window.history.replaceState({}, '', '/')
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion }) as any
  const clipboardWriteText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText: clipboardWriteText },
    geolocation: navigator.geolocation,
  })

  const { default: App } = await import('./App')
  const user = userEvent.setup()
  render(<App />)
  return { clipboardWriteText, user }
}

function addPlace(name: string) {
  const input = screen.getByLabelText('Restaurant name')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    ;(global as any).fetch = undefined
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('creates a shareable room and shows the empty state', async () => {
    await renderApp()

    expect(screen.getByRole('heading', { name: 'Just Pick Food' })).toBeInTheDocument()
    expect(screen.getByText('Add places together. We pick one.')).toBeInTheDocument()
    expect(screen.getByText('No restaurants yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pick one' })).not.toBeInTheDocument()
    expect(window.location.search).toMatch(/^\?room=[a-z0-9]+$/)
  })

  it('adds restaurants from the input and enables picking', async () => {
    await renderApp()

    addPlace('Cava')

    expect(screen.getByText('1 place')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '1 restaurants added' })).getByText('Cava')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick one' })).toBeEnabled()
    expect(screen.getByLabelText('Restaurant name')).toHaveFocus()
  })

  it('adds restaurants with the Enter key', async () => {
    await renderApp()

    await userEvent.type(screen.getByLabelText('Restaurant name'), 'Chipotle{Enter}')

    expect(within(screen.getByRole('list', { name: '1 restaurants added' })).getByText('Chipotle')).toBeInTheDocument()
    expect(screen.getByText('1 place')).toBeInTheDocument()
  })

  it('prevents duplicate restaurants regardless of casing', async () => {
    await renderApp()

    addPlace('Cava')
    await userEvent.type(screen.getByLabelText('Restaurant name'), 'cava')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Already in list')
    expect(within(screen.getByRole('list', { name: '1 restaurants added' })).getAllByText(/^Cava$/)).toHaveLength(1)
  })

  it('removes a restaurant and clears the list when it is empty', async () => {
    await renderApp()

    addPlace('Cava')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Cava' }))

    expect(screen.getByText('No restaurants yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pick one' })).not.toBeInTheDocument()
  })

  it('picks a winner immediately for users who prefer reduced motion', async () => {
    await renderApp({ reducedMotion: true })
    vi.spyOn(Math, 'random').mockReturnValue(0.75)

    addPlace('Cava')
    addPlace('Chipotle')
    fireEvent.click(screen.getByRole('button', { name: 'Pick one' }))

    expect(screen.getByText("Let's go to Chipotle!")).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '2 restaurants added' })).getByText('Chipotle').closest('li')).toHaveClass('winner')
    expect(screen.getByRole('button', { name: 'Pick again' })).toBeEnabled()
  })

  it('shows spinning state, then lands on a winner with animation enabled', async () => {
    vi.useFakeTimers()
    await renderApp()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    addPlace('Cava')
    addPlace('Chipotle')
    fireEvent.click(screen.getByRole('button', { name: 'Pick one' }))

    expect(screen.getByRole('button', { name: 'Picking…' })).toBeDisabled()

    await act(async () => {
      vi.runAllTimers()
    })

    expect(screen.getByText("Let's go to Cava!")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick again' })).toBeEnabled()
  })

  it('copies the room link from the invite button', async () => {
    vi.useFakeTimers()
    await renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Copy room link' }))

    expect(screen.getByText('Copied!')).toBeInTheDocument()

    await act(async () => {
      vi.runAllTimers()
    })

    expect(screen.getByText('Invite')).toBeInTheDocument()
  })

  it('shows the viewer count when another person is in the room', async () => {
    await renderApp()
    const roomId = new URLSearchParams(window.location.search).get('room')

    act(() => {
      firebaseMock.set({ path: `rooms/${roomId}/presence/other-viewer` }, true)
    })

    expect(screen.getByLabelText('2 people in this room')).toHaveTextContent('2 here')
  })

  it('adds and disables restaurants from suggestions', async () => {
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Need ideas/ }))
    await userEvent.click(screen.getByRole('button', { name: "McDonald's" }))

    expect(screen.getByText('1 place')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "McDonald's" })).toBeDisabled()
  })

  it('searches nearby restaurants by address and lets a result be added', async () => {
    ;(global as any).fetch = vi.fn(async (url: string) => {
      if (url.includes('/geocode')) {
        return {
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [{ geometry: { location: { lat: 33.1, lng: -84.2 } } }],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({
          places: [
            { displayName: { text: 'Cava' } },
            { displayName: { text: 'Chipotle' } },
            { displayName: { text: 'Cava' } },
          ],
        }),
      }
    })
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Find restaurants nearby/ }))
    await userEvent.type(screen.getByLabelText('Address or zip code'), '30301')
    await userEvent.selectOptions(screen.getByRole('combobox'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('2 nearby')).toBeInTheDocument()
    expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/geocode?address=30301'))
    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://worker.example/nearby',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"radius":3218.68'),
      })
    )

    const nearbyResults = screen.getByText('2 nearby').closest('.nearby-results')!
    await userEvent.click(within(nearbyResults as HTMLElement).getByRole('button', { name: 'Cava' }))
    expect(screen.getByText('1 place')).toBeInTheDocument()
  })

  it('reports address search errors', async () => {
    ;(global as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    }))
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Find restaurants nearby/ }))
    await userEvent.type(screen.getByLabelText('Address or zip code'), 'nowhere')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Address not found — try a more specific address or zip code.'
    )
  })

  it('searches nearby restaurants from current location', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({ coords: { latitude: 40.7, longitude: -74 } } as GeolocationPosition)
        }),
      },
    })
    ;(global as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ places: [{ displayName: { text: 'Local Diner' } }] }),
    }))
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Find restaurants nearby/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }))

    expect(await screen.findByText('1 nearby')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Local Diner' })).toBeInTheDocument()
  })

  it('reports current-location errors', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({
          code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3
        })),
      },
    })
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Find restaurants nearby/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Location access denied — try entering an address instead'
    )
  })

  it('reports when geolocation is unavailable', async () => {
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example')
    await renderApp()

    await userEvent.click(screen.getByRole('button', { name: /Find restaurants nearby/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Geolocation not supported by your browser'
    )
  })
})
