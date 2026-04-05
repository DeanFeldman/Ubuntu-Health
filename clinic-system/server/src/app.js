const express = require('express')
const cors = require('cors')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// Health check
app.get('/api', (req, res) => {
  res.json({ message: 'Ubuntu Health API running' })
})

// GET /api/clinics — filter by province, district, facility_type
app.get('/api/clinics', async (req, res) => {
  try {
    const { province, district, facility_type, search } = req.query

    let query = supabase.from('clinics').select('*')

    if (province) query = query.eq('province', province)
    if (district) query = query.eq('district', district)
    if (facility_type) query = query.eq('facility_type', facility_type)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) throw error

    res.json({ clinics: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// GET /api/clinics/:id — fetch single clinic detail
app.get('/api/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Clinic not found' })

    res.json({ clinic: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic' })
  }
})

// Serve React frontend
const publicPath = path.join(__dirname, 'public')
app.use(express.static(publicPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'))
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
