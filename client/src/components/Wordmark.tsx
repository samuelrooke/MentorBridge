// MENTOR + bar / bar + BRIDGE, the same wordmark as the landing page.
export default function Wordmark() {
  return (
    <span className="wordmark" aria-label="MentorBridge">
      <span className="wordmark-line" aria-hidden="true">
        Mentor<span className="wordmark-bar" />
      </span>
      <span className="wordmark-line" aria-hidden="true">
        <span className="wordmark-bar" />
        Bridge
      </span>
    </span>
  )
}
