import { Chevron, LocationIcon } from './Icons'

interface NearbySearchPanelProps {
  open: boolean
  locationInput: string
  radius: number
  nearbyResults: string[]
  locationLoading: boolean
  locationError: string
  addedNames: Set<string>
  onToggle: () => void
  onLocationInputChange: (value: string) => void
  onRadiusChange: (value: number) => void
  onFindNearby: () => void
  onUseMyLocation: () => void
  onAddRestaurant: (name: string, refocus: boolean) => void
}

export function NearbySearchPanel({
  open,
  locationInput,
  radius,
  nearbyResults,
  locationLoading,
  locationError,
  addedNames,
  onToggle,
  onLocationInputChange,
  onRadiusChange,
  onFindNearby,
  onUseMyLocation,
  onAddRestaurant,
}: NearbySearchPanelProps) {
  return (
    <div className="nearby-section">
      <button
        className="disclosure-toggle"
        aria-expanded={open}
        aria-controls="nearby-panel"
        onClick={onToggle}
      >
        <Chevron />
        Find restaurants nearby
      </button>
      <div id="nearby-panel" className={`collapse ${open ? 'open' : ''}`}>
        <div className="collapse-inner" {...(!open ? { inert: '' as unknown as boolean } : {})}>
          <div className="nearby-tray">
            <div className="nearby-controls">
              <label htmlFor="location-input" className="sr-only">Address or zip code</label>
              <input
                id="location-input"
                type="text"
                placeholder="Address or zip code…"
                value={locationInput}
                onChange={e => onLocationInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onFindNearby()}
              />
              <button
                className="btn-locate"
                onClick={onUseMyLocation}
                aria-label="Use my current location"
                disabled={locationLoading}
              >
                <LocationIcon />
              </button>
            </div>
            <div className="nearby-options-row">
              <label className="radius-label">
                Within
                <select value={radius} onChange={e => onRadiusChange(Number(e.target.value))}>
                  <option value={0.5}>0.5 mi</option>
                  <option value={1}>1 mi</option>
                  <option value={2}>2 mi</option>
                  <option value={5}>5 mi</option>
                  <option value={10}>10 mi</option>
                </select>
              </label>
              <button
                className="btn-search"
                onClick={onFindNearby}
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
                        onClick={() => onAddRestaurant(name, false)}
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
  )
}
