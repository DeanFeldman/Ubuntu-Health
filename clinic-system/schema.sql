-- ─── Ubuntu Health Database Schema ───────────────────────────────────────────
-- PostgreSQL schema for the Ubuntu Health clinic queue management system
-- Hosted on Supabase. Run this in the Supabase SQL Editor to set up all tables.
-- All tables use UUID primary keys for security and scalability.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── CORE TABLES (Sprint 1) ───────────────────────────────────────────────────

-- Clinics
-- Seeded from the South African National Health Facility Register (HFIR)
-- Contains real clinic data including GPS coordinates for proximity search
create table clinics (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  province text,
  district text,
  municipality text,
  facility_type text,
  services text[],        -- stored as array to match HFIR dataset structure
  latitude numeric,
  longitude numeric,
  operating_hours jsonb,  -- flexible JSON structure for hours per day of week
  created_at timestamp default now()
);

-- Users
-- Extends Supabase's built-in auth.users table via foreign key
-- Role defaults to Patient on first Google login
-- Role can be changed to Staff or Admin by an admin user
create table users (
  id uuid references auth.users(id) primary key,
  email text,
  full_name text,         -- stored as single field to match Google OAuth metadata
  phone text,
  role text default 'Patient' check (role in ('Patient', 'Staff', 'Admin')),
  clinic_id uuid references clinics(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Slots
-- Represents available appointment time slots per clinic
-- Generated from clinic operating hours and staff availability
-- Marked unavailable (is_available = false) once a patient books
create table slots (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  slot_datetime timestamp not null,
  is_available boolean default true,
  created_at timestamp default now()
);

-- Appointments
-- Records bookings made by patients for specific slots at clinics
-- Status transitions: Pending → Confirmed → Completed or Cancelled/No-show
create table appointments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references users(id),
  clinic_id uuid references clinics(id),
  slot_id uuid references slots(id),
  status text default 'Pending' check (
    status in ('Pending', 'Confirmed', 'Cancelled', 'Rescheduled', 'No-show')
  ),
  service text,
  created_at timestamp default now()
);

-- Queue Entries
-- Manages the walk-in virtual queue per clinic
-- Realtime is enabled on this table to support live position updates
-- Status transitions: Waiting → In Consultation → Complete
create table queue_entries (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  patient_id uuid references users(id),
  position integer,
  status text default 'Waiting' check (
    status in ('Waiting', 'In Consultation', 'Complete', 'Called')
  ),
  joined_at timestamp default now(),
  called_at timestamp,      -- set when staff calls the patient
  completed_at timestamp    -- set when consultation is marked complete
);


-- ─── FUTURE SPRINT TABLES ─────────────────────────────────────────────────────

-- Staff Availability
-- Records working hours per staff member per day of week
-- day_of_week: 0 = Sunday, 6 = Saturday
-- Used to generate available appointment slots
create table staff_availability (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references users(id),
  day_of_week integer check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_available boolean default true
);

-- Staff Exceptions
-- Stores specific dates when a staff member is unavailable (e.g. leave days)
-- Takes precedence over standard staff_availability hours
create table staff_exceptions (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references users(id),
  exception_date date not null,
  reason text
);

-- Notifications
-- Logs all notifications sent to users
-- Supports email, SMS (via Africa's Talking), and web push
create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id),
  type text check (type in ('reminder', 'queue_alert', 'general')),
  channel text check (channel in ('email', 'sms', 'push')),
  message text,
  sent_at timestamp default now(),
  delivered boolean default false
);

-- Wait Time Logs
-- Records actual wait times per queue entry for analytics reporting
-- Stores day of week and hour of day to support trend analysis
-- Used to generate average wait time reports and train the ML prediction model
create table wait_time_logs (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  queue_entry_id uuid references queue_entries(id),
  wait_minutes integer,
  day_of_week integer,
  hour_of_day integer,
  logged_at timestamp default now()
);

-- Visit Notes
-- Allows clinic staff to add a brief note to a completed appointment
-- Limited to 500 characters to keep records concise
create table visit_notes (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references appointments(id),
  staff_id uuid references users(id),
  note text check (char_length(note) <= 500),
  created_at timestamp default now()
);

-- Role Requests
-- Records requests made by users to change their role (e.g. Patient → Staff)
-- Admins can approve or reject requests via the admin dashboard
-- Status transitions: pending → approved or rejected
-- A user can only have one pending request per role at a time (enforced by unique index)
create table role_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  requested_role text not null check (requested_role in ('Patient', 'Staff', 'Admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);

-- Prevents duplicate pending requests for the same role per user
create unique index role_requests_one_pending_per_role
  on role_requests (user_id, requested_role)
  where status = 'pending';