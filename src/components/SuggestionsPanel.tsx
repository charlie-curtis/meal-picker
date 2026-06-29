import { Chevron } from './Icons'

const SUGGESTIONS: Record<string, string[]> = {
  'Burgers':    ["McDonald's", "Wendy's", "Burger King", "Shake Shack", "Chick-fil-A"],
  'Pizza':      ["Domino's", "Pizza Hut", "Papa John's", "Little Caesars"],
  'Mexican':    ["Chipotle", "Taco Bell", "Qdoba"],
  'Chicken':    ["Popeyes", "KFC", "Wingstop", "Raising Cane's"],
  'Asian':      ["Panda Express", "Cava", "Sweetgreen"],
  'Sandwiches': ["Subway", "Panera Bread", "Jimmy John's"],
}

interface SuggestionsPanelProps {
  open: boolean
  addedNames: Set<string>
  onToggle: () => void
  onAddRestaurant: (name: string, refocus: boolean) => void
}

export function SuggestionsPanel({
  open,
  addedNames,
  onToggle,
  onAddRestaurant,
}: SuggestionsPanelProps) {
  return (
    <div className="help-section">
      <button
        className="disclosure-toggle"
        aria-expanded={open}
        aria-controls="help-panel"
        onClick={onToggle}
      >
        <Chevron />
        Need ideas? Browse suggestions
      </button>
      <div id="help-panel" className={`collapse ${open ? 'open' : ''}`}>
        <div className="collapse-inner" {...(!open ? { inert: '' as unknown as boolean } : {})}>
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
                        onClick={() => onAddRestaurant(name, false)}
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
  )
}
