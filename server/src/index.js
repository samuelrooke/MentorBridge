import cors from 'cors'
import express from 'express'
import adminRouter from './routes/admin.js'
import meRouter from './routes/me.js'

const app = express()
const port = process.env.PORT ?? 4000

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/me', meRouter)
app.use('/api/admin', adminRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
