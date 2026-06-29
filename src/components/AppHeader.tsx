import { LinkIcon } from './Icons'

interface AppHeaderProps {
  viewerCount: number
  copyLabel: string
  onCopyLink: () => void
}

export function AppHeader({ viewerCount, copyLabel, onCopyLink }: AppHeaderProps) {
  return (
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
        <button className="btn-share-icon" onClick={onCopyLink} aria-label="Copy room link">
          <LinkIcon />
          <span className="share-label">{copyLabel}</span>
        </button>
      </div>
    </div>
  )
}
