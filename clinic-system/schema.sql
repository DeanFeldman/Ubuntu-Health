-- SPRINT 1 TABLES

-- Clinics (seeded from SA health facility data)
create table clinics (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  province text,
  district text,
  municipality text,
  facility_type text,
  services text[],
  latitude numeric,
  longitude numeric,
  operating_hours jsonb,
  created_at timestamp default now()
);

-- Users (extends Supabase auth.users)
create table users (
  id uuid references auth.users(id) primary key,
  full_name text,
  phone text,
  role text default 'Patient' check (role in ('Patient', 'Clinic Staff', 'Admin')),
  clinic_id uuid references clinics(id),
  created_at timestamp default now()
);

-- Slots (available appointment times per clinic)
create table slots (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  slot_datetime timestamp not null,
  is_available boolean default true,
  created_at timestamp default now()
);

-- Appointments
create table appointments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references users(id),
  clinic_id uuid references clinics(id),
  slot_id uuid references slots(id),
  status text default 'Pending' check (status in ('Pending','Confirmed','Cancelled','Rescheduled','No-show')),
  service text,
  created_at timestamp default now()
);

-- Queue entries (walk-ins)
create table queue_entries (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  patient_id uuid references users(id),
  position integer,
  status text default 'Waiting' check (status in ('Waiting','In Consultation','Complete','Called')),
  joined_at timestamp default now(),
  called_at timestamp,
  completed_at timestamp
);

-- SPRINT 2 TABLES

-- Staff availability
create table staff_availability (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references users(id),
  day_of_week integer check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_available boolean default true
);

-- Staff leave / exception dates
create table staff_exceptions (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references users(id),
  exception_date date not null,
  reason text
);

-- Notifications log
create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id),
  type text check (type in ('reminder','queue_alert','general')),
  channel text check (channel in ('email','sms','push')),
  message text,
  sent_at timestamp default now(),
  delivered boolean default false
);

-- SPRINT 3 TABLES

-- Wait time logs (for analytics)
create table wait_time_logs (
  id uuid default gen_random_uuid() primary key,
  clinic_id uuid references clinics(id),
  queue_entry_id uuid references queue_entries(id),
  wait_minutes integer,
  day_of_week integer,
  hour_of_day integer,
  logged_at timestamp default now()
);

-- Visit notes (staff adds after consultation)
create table visit_notes (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references appointments(id),
  staff_id uuid references users(id),
  note text check (char_length(note) <= 500),
  created_at timestamp default now()
);