const express = require('express')
const cors = require('cors')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const app = express()

// Allow cross-origin requests from the React frontend running on a different port/domain
app.use(cors())

// Parse incoming JSON request bodies so we can read req.body in POST/PATCH routes
app.use(express.json())

// Read Supabase connection details from environment variables (stored in .env file)
// We support both SUPABASE_SERVICE_ROLE_KEY (full access) and SUPABASE_KEY (anon key)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

// If either variable is missing, crash early with a clear error rather than failing silently later
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY')
}

// Initialise the Supabase client — this is our single connection to the database
// All database queries go through this client
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
// Simple endpoint to confirm the API is running
// Used by Azure and CI/CD to verify the server is alive
app.get('/api', (req, res) => {
  res.json({ message: 'Ubuntu Health API running' })
})

// ─── CLINIC ENDPOINTS ────────────────────────────────────────────────────────

// GET /api/clinics
// Returns a list of clinics from the database
// Supports optional query filters: province, district, municipality, facility_type, search
// The frontend clinic directory page calls this endpoint to populate the list
app.get('/api/clinics', async (req, res) => {
  try {
    // Extract any filter parameters from the URL query string (e.g. ?province=Gauteng)
    const { province, district, municipality, facility_type, search } = req.query

    // Start with a base query that selects all columns from the clinics table
    let query = supabase.from('clinics').select('*')

    // Conditionally chain filters onto the query — only apply a filter if the parameter was provided
    if (province) query = query.eq('province', province)
    if (district) query = query.eq('district', district)
    if (facility_type) query = query.eq('facility_type', facility_type)
    if (municipality) query = query.eq('municipality', municipality)

    // ilike = case-insensitive LIKE search — wrapping in % means "contains this string anywhere"
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) throw error

    res.json({ clinics: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// GET /api/clinics/:id
// Returns a single clinic by its UUID
// The clinic detail page calls this endpoint when a patient clicks on a clinic
app.get('/api/clinics/:id', async (req, res) => {
  try {
    // Extract the clinic ID from the URL (e.g. /api/clinics/abc-123)
    const { id } = req.params

    // Validate that the ID is a properly formatted UUID before querying the database
    // This prevents SQL injection and avoids unnecessary database calls with invalid IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
    }

    // maybeSingle() returns null if no row is found instead of throwing an error
    // This lets us handle the "not found" case gracefully with a 404
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Clinic not found' })

    res.json({ clinic: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic' })
  }
})

// ─── QUEUE GET ENDPOINTS ─────────────────────────────────────────────────────

// GET /api/queue/:clinicId
// Returns all patients currently in the Waiting status at a specific clinic
// Used by the staff dashboard to display the live queue
// Results are ordered by position so staff see who is next
app.get('/api/queue/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params

    // Validate the clinic ID is a valid UUID before querying
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'Waiting')               // Only return patients currently waiting
      .order('position', { ascending: true }) // Order by position so queue is in correct sequence

    if (error) throw error

    res.json({ queue: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic queue' })
  }
})

// GET /api/queue/:clinicId/position/:patientId
// Returns just the queue position number for a specific patient at a specific clinic
// Used to display "You are number X in the queue" on the patient's screen
app.get('/api/queue/:clinicId/position/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    // Both IDs must be valid UUIDs — reject early if either is malformed
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('position')           // Only fetch the position column — we don't need the full row
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'Waiting')      // Only look for active (Waiting) entries
      .maybeSingle()                // Returns null instead of error if no entry found

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ position: data.position })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue position' })
  }
})

// GET /api/queue/:clinicId/entry/:patientId
// Returns the full queue entry row for a patient who is Waiting or Called
// Used to display all queue details on the patient's queue card
app.get('/api/queue/:clinicId/entry/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['Waiting', 'Called']) // Include both Waiting and Called statuses
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ entry: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue entry' })
  }
})

// GET /api/queue/:clinicId/status/:patientId
// Returns just the status, position, and joined_at time for a patient
// Lighter version of the entry endpoint — used for quick polling every 5 seconds
// to check if the patient's status has changed without fetching all fields
app.get('/api/queue/:clinicId/status/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('status, position, joined_at')                       // Only the 3 fields we need
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['Waiting', 'Called', 'In Consultation'])      // All active statuses
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ status: data.status, position: data.position, joined_at: data.joined_at })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue status' })
  }
})

// ─── ROLE REQUEST ENDPOINTS ───────────────────────────────────────────────────

// Import validation helpers from roleRequestValidation.js
// These are pure functions that check inputs without touching the database
const {
  hasRequiredRoleRequestFields,
  isValidUuid,
  isValidRequestedRole,
  isDifferentFromCurrentRole,
  doesUserExist,
  hasDuplicatePendingRoleRequest,
} = require('./roleRequestValidation')

// POST /api/role-requests
// Allows a patient or staff member to request a role elevation (e.g. Patient -> Staff)
// Validates the request before inserting into the role_requests table
app.post('/api/role-requests', async (req, res) => {
  try {
    const { user_id, requested_role } = req.body

    // Check that both required fields are present in the request body
    if (!hasRequiredRoleRequestFields(user_id, requested_role)) {
      return res.status(400).json({ error: 'user_id and requested_role are required' })
    }

    // Validate UUID format of the user_id
    if (!isValidUuid(user_id)) {
      return res.status(400).json({ error: 'Invalid user ID format' })
    }

    // Validate that the requested role is one of the allowed values (Staff or Admin)
    if (!isValidRequestedRole(requested_role)) {
      return res.status(400).json({ error: 'Invalid requested role' })
    }

    // Fetch the user from the database to verify they exist and get their current role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user_id)
      .maybeSingle()

    if (userError) throw userError

    // If no user was found, return 404
    if (!doesUserExist(user)) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Prevent a user from requesting the role they already have
    if (!isDifferentFromCurrentRole(user.role, requested_role)) {
      return res.status(400).json({ error: 'User already has this role' })
    }

    // Check if there is already a pending request for this exact role from this user
    // Prevents duplicate requests sitting in the queue at the same time
    const { data: existingRequest, error: existingError } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('requested_role', requested_role)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingError) throw existingError

    if (hasDuplicatePendingRoleRequest(existingRequest)) {
      return res.status(409).json({ error: 'A pending request for this role already exists' })
    }

    // All validations passed — insert the new role request with status 'pending'
    const { data, error } = await supabase
      .from('role_requests')
      .insert({ user_id, requested_role, status: 'pending' })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ request: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit role request' })
  }
})

// GET /api/role-requests
// Returns all role requests — only accessible by admins
// Admin must pass their admin_id as a query parameter so we can verify their role
// Optionally filter by status (pending, approved, rejected)
app.get('/api/role-requests', async (req, res) => {
  try {
    const { admin_id, status } = req.query

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    if (!uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' })
    }

    // Verify the requesting user is actually an Admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .maybeSingle()

    if (adminError) throw adminError
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' })

    // Role-based access control — only Admins can see role requests
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can access role requests' })
    }

    // Join with the users table to include the requester's name, email and current role
    let query = supabase
      .from('role_requests')
      .select(`id, user_id, requested_role, status, created_at, users (full_name, email, role)`)
      .order('created_at', { ascending: false })

    // Optionally filter by status if provided
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    res.json({ requests: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch role requests' })
  }
})

// PATCH /api/role-requests/:id/approve
// Admin approves a pending role request
// Updates both the role_requests table (status -> approved) and the users table (role -> new role)
// Includes a rollback mechanism: if the role_requests update fails after the user role is changed,
// the user role is reverted to prevent the system from being in an inconsistent state
app.patch('/api/role-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(id)) return res.status(400).json({ error: 'Invalid request ID format' })
    if (!admin_id) return res.status(400).json({ error: 'admin_id is required' })
    if (!uuidRegex.test(admin_id)) return res.status(400).json({ error: 'Invalid admin ID format' })

    // Verify the requesting user is actually an Admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users').select('id, role').eq('id', admin_id).maybeSingle()

    if (adminError) throw adminError
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' })
    if (adminUser.role !== 'Admin') return res.status(403).json({ error: 'Only admins can approve role requests' })

    // Fetch the role request including the user's current role (for rollback purposes)
    const { data: roleRequest, error: requestError } = await supabase
      .from('role_requests')
      .select('id, user_id, requested_role, status, users ( role )')
      .eq('id', id)
      .maybeSingle()

    if (requestError) throw requestError
    if (!roleRequest) return res.status(404).json({ error: 'Role request not found' })

    // Only pending requests can be approved — reject if already reviewed
    if (roleRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Role request has already been reviewed' })
    }

    const previousRole = roleRequest.users?.role

    if (!previousRole) return res.status(404).json({ error: 'Request user not found' })

    // Step 1: Update the user's role in the users table
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ role: roleRequest.requested_role })
      .eq('id', roleRequest.user_id)

    if (userUpdateError) throw userUpdateError

    // Step 2: Update the role request status to approved
    const { data: approvedRequest, error: requestUpdateError } = await supabase
      .from('role_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    // If step 2 failed, roll back step 1 to keep the database consistent
    if (requestUpdateError || !approvedRequest) {
      const { error: rollbackError } = await supabase
        .from('users')
        .update({ role: previousRole })
        .eq('id', roleRequest.user_id)

      if (rollbackError) {
        console.error('Failed to roll back user role after approval error:', rollbackError)
      }

      if (!approvedRequest) return res.status(409).json({ error: 'Role request is no longer pending' })

      throw requestUpdateError
    }

    res.json({ request: approvedRequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to approve role request' })
  }
})

// PATCH /api/role-requests/:id/reject
// Admin rejects a pending role request
// Simpler than approve — only updates the role_requests status, no user role change needed
app.patch('/api/role-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(id)) return res.status(400).json({ error: 'Invalid request ID format' })
    if (!admin_id) return res.status(400).json({ error: 'admin_id is required' })
    if (!uuidRegex.test(admin_id)) return res.status(400).json({ error: 'Invalid admin ID format' })

    // Verify the requesting user is an Admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users').select('id, role').eq('id', admin_id).maybeSingle()

    if (adminError) throw adminError
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' })
    if (adminUser.role !== 'Admin') return res.status(403).json({ error: 'Only admins can reject role requests' })

    // Update the role request status to rejected
    // The .eq('status', 'pending') ensures we only reject requests that are still pending
    const { data: rejectedRequest, error: requestUpdateError } = await supabase
      .from('role_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    if (requestUpdateError) throw requestUpdateError

    // If no row was updated, the request was no longer pending (already approved/rejected)
    if (!rejectedRequest) return res.status(409).json({ error: 'Role request is no longer pending' })

    res.json({ request: rejectedRequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to reject role request' })
  }
})

// ─── QUEUE WRITE ENDPOINTS ────────────────────────────────────────────────────

// Import validation helpers from queueValidation.js
// validateQueueJoin checks both confirmation and duplicate queue rules
// isValidStatusTransition enforces the correct status lifecycle
const { validateQueueJoin, isValidStatusTransition } = require('./queueValidation')

// POST /api/queue/:clinicId/join
// Allows a patient to join the virtual queue at a specific clinic
// Enforces 3 rules before inserting:
//   1. Both IDs must be valid UUIDs
//   2. The patient must have confirmed the join action
//   3. The patient must not already be in an active queue at any clinic
app.post('/api/queue/:clinicId/join', async (req, res) => {
  try {
    // clinicId comes from the URL, patient_id and confirmed come from the request body
    const { clinicId } = req.params
    const { patient_id, confirmed } = req.body

    // Validate both UUIDs before touching the database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patient_id)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    // Fetch all active (non-Complete) queue entries for this patient across ALL clinics
    // This is used by validateQueueJoin to check the single-active-queue rule
    const { data: activeQueues, error: activeError } = await supabase
      .from('queue_entries')
      .select('patient_id, status, clinic_id')
      .eq('patient_id', patient_id)
      .neq('status', 'Complete')

    if (activeError) throw activeError

    // Run validation — returns false if not confirmed OR if patient already in a queue
    if (!validateQueueJoin(patient_id, activeQueues, confirmed)) {
      if (!confirmed) {
        return res.status(400).json({ error: 'Queue join must be confirmed by the patient' })
      }
      return res.status(409).json({ error: 'Patient already has an active queue entry' })
    }

    // Calculate the next position by finding the highest current position in this clinic's queue
    // If the queue is empty, the patient starts at position 1
    const { data: queueData, error: queueError } = await supabase
      .from('queue_entries')
      .select('position')
      .eq('clinic_id', clinicId)
      .eq('status', 'Waiting')
      .order('position', { ascending: false })
      .limit(1)

    if (queueError) throw queueError

    const nextPosition = queueData.length > 0 ? queueData[0].position + 1 : 1

    // Insert the new queue entry with status Waiting and the calculated position
    const { data: newEntry, error: insertError } = await supabase
      .from('queue_entries')
      .insert({
        clinic_id: clinicId,
        patient_id: patient_id,
        position: nextPosition,
        status: 'Waiting',
        joined_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Return 201 Created with the full new queue entry
    res.status(201).json({ entry: newEntry })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to join queue' })
  }
})

// PATCH /api/queue/:clinicId/entry/:entryId/status
// Allows staff to update a patient's queue status
// Enforces the correct status lifecycle using isValidStatusTransition:
//   Waiting -> Called -> In Consultation -> Complete
// Also inserts a notification record whenever the status changes
app.patch('/api/queue/:clinicId/entry/:entryId/status', async (req, res) => {
  try {
    const { clinicId, entryId } = req.params
    const { status } = req.body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(entryId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    // Validate that the requested status is one of the 4 allowed values
    const validStatuses = ['Waiting', 'In Consultation', 'Complete', 'Called']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }

    // Fetch the current entry to check what status it is currently in
    // We need this to validate the transition is legal
    const { data: currentEntry, error: fetchError } = await supabase
      .from('queue_entries')
      .select('status')
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentEntry) return res.status(404).json({ error: 'Queue entry not found' })

    // Check if the transition is valid using the helper function
    // e.g. Waiting -> In Consultation is valid, but Complete -> Waiting is not
    if (!isValidStatusTransition(currentEntry.status, status)) {
      return res.status(409).json({ error: `Invalid status transition from ${currentEntry.status} to ${status}` })
    }

    // Build the update object — always includes the new status
    // Also set timestamps when the patient is called or consultation completes
    const updateData = { status }
    if (status === 'In Consultation') updateData.called_at = new Date().toISOString()
    if (status === 'Complete') updateData.completed_at = new Date().toISOString()

    const { data: updatedEntry, error: updateError } = await supabase
      .from('queue_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (updateError) throw updateError

    // Insert a notification record into the notifications table
    // This is an in-app notification — the message content depends on the new status
    // We don't throw if this fails — the status update already succeeded
    const notificationMessages = {
      'Called': 'You are being called — please make your way to the consultation room.',
      'In Consultation': 'Your consultation has started.',
      'Complete': 'Your visit is complete. Thank you for using Ubuntu Health.'
    }

    if (notificationMessages[status]) {
      await supabase
        .from('notifications')
        .insert({
          user_id: updatedEntry.patient_id,
          type: 'queue_alert',
          channel: 'push',
          message: notificationMessages[status],
          sent_at: new Date().toISOString(),
          delivered: false
        })
    }

    res.json({ entry: updatedEntry })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update queue status' })
  }
})

// DELETE /api/queue/:clinicId/entry/:entryId
// Allows staff to remove a patient from the queue entirely
// First checks the entry exists before attempting deletion
// Returns a success message on completion
app.delete('/api/queue/:clinicId/entry/:entryId', async (req, res) => {
  try {
    const { clinicId, entryId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(entryId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    // Check the entry exists before attempting to delete it
    // This gives us a clean 404 rather than silently deleting nothing
    const { data: existingEntry, error: fetchError } = await supabase
      .from('queue_entries')
      .select('id')
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existingEntry) return res.status(404).json({ error: 'Queue entry not found' })

    // Delete the queue entry from the database
    const { error: deleteError } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId)
      .eq('clinic_id', clinicId)

    if (deleteError) throw deleteError

    res.json({ message: 'Patient removed from queue successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to remove patient from queue' })
  }
})

// ─── FRONTEND SERVING ─────────────────────────────────────────────────────────

// Serve the built React frontend as static files from the public folder
// This allows a single Azure App Service to serve both the API and the frontend
const publicPath = path.join(__dirname, '..', 'public')
app.use(express.static(publicPath))

// Catch-all route — any URL that doesn't match an API route gets served index.html
// This is required for React Router to work correctly in production
// IMPORTANT: this must come LAST — after all API routes — otherwise it intercepts API calls
app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'))
})

module.exports = app