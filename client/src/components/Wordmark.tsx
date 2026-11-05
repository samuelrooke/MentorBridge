// The MentorBridge logo: the arch icon (public/icon.png) with the name, as on the landing page.
export default function Wordmark() {
  return (
    <span className="logo">
      <img src="/icon.png" alt="" width={512} height={512} />
      <span>
        Mentor<span className="text-accent">Bridge</span>
      </span>
    </span>
  )
}
