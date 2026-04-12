// ─── Dependencies ────────────────────────────────────────────────────────────
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express()

// Allow cross-origin requests from the React frontend
app.use(cors())

// Parse incoming JSON request bodies
app.use(express.json())

// ─── Health Check ────────────────────────────────────────────────────────────
// Simple endpoint to confirm the API is running
app.get('/', (req, res) => {
  res.json({ message: 'Ubuntu Health API running' })
})

// ─── Supabase Client ─────────────────────────────────────────────────────────
// Initialise Supabase using environment variables — never hardcode these values
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// ─── GET /clinics ─────────────────────────────────────────────────────────────
// Returns a list of clinics from the database
// Supports optional query parameters for filtering:
//   ?province=Gauteng
//   ?district=City of Tshwane
//   ?facility_type=Clinic
//   ?municipality=Tshwane
//   ?search=some name
// Filters are applied conditionally — only active if the parameter is provided
app.get('/clinics', async (req, res) => {
  try {
    const { province, district, municipality, facility_type, search } = req.query

    // Start with a base query selecting all clinic records
    let query = supabase.from('clinics').select('*')

    // Conditionally add filters based on query parameters provided
    if (province) query = query.eq('province', province)
    if (district) query = query.eq('district', district)
    if (facility_type) query = query.eq('facility_type', facility_type)
    if (municipality) query = query.eq('municipality', municipality)

    // Case-insensitive partial match on clinic name
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) throw error

    res.json({ clinics: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// ─── GET /clinics/:id ─────────────────────────────────────────────────────────
// Returns the full details of a single clinic by its UUID
// Validates the ID format before hitting the database to avoid Postgres
// throwing a type error on invalid UUIDs — returns 400 for invalid format
app.get('/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Validate that the ID matches UUID format before querying Supabase
    // Without this, an invalid string causes a Postgres type error (500)
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

    // Return 404 if no clinic found with that ID
    if (!data) return res.status(404).json({ error: 'Clinic not found' })

    res.json({ clinic: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic' })
  }
})

module.exports = app