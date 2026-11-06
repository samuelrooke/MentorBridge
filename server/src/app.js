import cors from 'cors'
import express from 'express'
import adminRouter from './routes/admin.js'
import contactRouter from './routes/contact.js'
import meRouter from './routes/me.js'
import pilotRequestsRouter from './routes/pilotRequests.js'

const app = express()

// Only the platform client and the landing page may call the API from a browser.
// Each variable may hold several URLs separated by commas, because Vercel gives a page more than one address.
// Localhost is allowed outside production for local development.
export const parseOrigins = (...values) =>
  values
    .flatMap((value) => (value ?? '').split(','))
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean)
const allowedOrigins = parseOrigins(process.env.CLIENT_ORIGIN, process.env.LANDING_ORIGIN)
const isLocalhost = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

app.use(
  cors({
    origin(origin, callback) {
      const allowed =
        !origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost(origin))
      callback(null, allowed)
    },
  }),
)
app.use(express.json({ limit: '10kb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/me', meRouter)
app.use('/api/admin', adminRouter)
app.use('/api/pilot-requests', pilotRequestsRouter)
app.use('/api/contact', contactRouter)

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' })
  if (err.type === 'entity.too.large') return res.status(400).json({ error: 'Request body is too large.' })
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
