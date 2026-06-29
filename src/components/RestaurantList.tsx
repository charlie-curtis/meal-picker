import { EmptyStateIcon } from './Icons'

interface RestaurantListProps {
  entries: [string, string][]
  winner: string | null
  spinning: boolean
  spinIndex: number | null
  onRemoveRestaurant: (key: string) => void
}

export function RestaurantList({
  entries,
  winner,
  spinning,
  spinIndex,
  onRemoveRestaurant,
}: RestaurantListProps) {
  return (
    <div className="list-wrapper">
      {entries.length > 0 && (
        <div className="list-meta" aria-hidden="true">
          {entries.length} {entries.length === 1 ? 'place' : 'places'}
        </div>
      )}
      <ul className="restaurant-list" aria-label={`${entries.length} restaurants added`}>
        {entries.length === 0 ? (
          <li className="empty-state">
            <EmptyStateIcon />
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
                  onClick={() => onRemoveRestaurant(key)}
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
  )
}
