const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const app = express()

// Allow cross-origin requests from the React frontend
app.use(cors())

// Parse incoming JSON request bodies
app.use(express.json())

// Simple health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Ubuntu Health API running' })
})

// Initialise Supabase using environment variables
//const supabase = createClient(
//  process.env.SUPABASE_URL,
//  process.env.SUPABASE_SERVICE_ROLE_KEY
//)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// GET /api/clinics — filter by province, district, facility_type, municipality, search
app.get('/api/clinics', async (req, res) => {
  try {
    const { province, district, municipality, facility_type, search } = req.query

    let query = supabase.from('clinics').select('*')

    if (province) query = query.eq('province', province)
    if (district) query = query.eq('district', district)
    if (facility_type) query = query.eq('facility_type', facility_type)
    if (municipality) query = query.eq('municipality', municipality)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) throw error

    res.json({ clinics: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// GET /api/clinics/:id — fetch single clinic with UUID validation
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

module.exports = app
