const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// GET /clinics — filter by province, district, facility_type
app.get('/clinics', async (req, res) => {
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

// GET /clinics/:id — fetch single clinic detail
app.get('/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

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