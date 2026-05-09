# Ubuntu Health  
**Community Clinic Appointment & Queue Management System**

[![codecov](https://codecov.io/gh/DeanFeldman/Ubuntu-Health/branch/main/graph/badge.svg)](https://codecov.io/gh/DeanFeldman/Ubuntu-Health)

## Overview  
Ubuntu Health is a web-based system designed to improve patient flow and reduce waiting times in public healthcare clinics. It enables patients to book appointments, join virtual queues, and track their status in real time, while giving clinic staff and administrators tools to manage operations efficiently.

The system integrates real South African clinic data and follows Agile development practices to ensure continuous improvement and scalability.

---

## Features  

### Patient  
- Sign in using Google OAuth  
- Browse and search clinics  
- View clinic details  
- Join virtual queues  
- Track queue position and status  
- Book and manage appointments  
- View upcoming appointments  
- Cancel and reschedule appointments  
- Receive booking confirmation notifications  

### Clinic Staff  
- View and manage clinic queues  
- Add/remove patients  
- Update patient status (Waiting, In Consultation, Complete)  
- View appointment time alongside queue entries  
- Book appointments on behalf of patients  
- Create new patient records during booking  
- View clinic appointments by selected date  
- Cancel and reschedule patient appointments  
- Manage staff availability  

### Admin  
- Manage clinics and system data  
- Configure clinic operating hours and services  
- Assign roles (Patient, Staff, Admin)  
- View analytics and reports  

---

## System Architecture  

### Frontend  
- React (Vite)  

### Backend  
- Node.js + Express  

### Database  
- PostgreSQL (Supabase)  

### CI/CD  
- GitHub Actions + Azure App Service  

---

## Project Structure  

```
Ubuntu-Health/
├── clinic-system/
│   ├── client/        # Frontend (React)
│   ├── server/        # Backend (Node.js/Express)
│   ├── data/          # Datasets (raw + processed)
│   ├── scripts/       # Data processing & seeding
│   └── docs/          # Documentation & UML diagrams
└── .github/workflows/ # CI/CD pipelines
```

---

## Authentication  

- Google OAuth (via Supabase)  
- Role-based access:
  - Patient  
  - Staff  
  - Admin  

---

## How to Run Locally  

### 1. Clone the repository  
```bash
git clone <repo-url>
cd Ubuntu-Health
```

### 2. Setup environment variables  

Create a `.env` file in `clinic-system/client`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Install dependencies  

**Frontend**
```bash
cd clinic-system/client
npm install
```

**Backend**
```bash
cd ../server
npm install
```

### 4. Run the application  

**Frontend**
```bash
npm run dev
```

**Backend**
```bash
npm run dev
```

---

## Packages Used

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.2.0 | Core UI library for building component-based interfaces |
| `react-dom` | ^18.2.0 | Renders React components to the browser DOM |
| `react-router-dom` | ^6.22.3 | Client-side routing and protected route navigation |
| `@supabase/supabase-js` | ^2.101.1 | Supabase client for Google OAuth, database access, and session management |

### Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.21 | Fast frontend build tool and local dev server |
| `@vitejs/plugin-react` | ^4.7.0 | Vite plugin enabling React JSX and fast refresh |
| `jest` | ^30.3.0 | JavaScript testing framework used for all backend and frontend unit tests |
| `jest-environment-jsdom` | ^30.3.0 | Simulates a browser DOM environment for Jest tests |
| `@testing-library/react` | ^16.3.2 | Utilities for testing React components in a user-centric way |
| `@testing-library/jest-dom` | ^6.9.1 | Custom Jest matchers for asserting on DOM elements |
| `@testing-library/user-event` | ^14.6.1 | Simulates realistic user interactions (clicks, typing) in tests |
| `@babel/preset-env` | ^7.29.2 | Transpiles modern JavaScript to compatible versions for testing |
| `@babel/preset-react` | ^7.28.5 | Transpiles JSX syntax so Jest can process React components |
| `babel-jest` | ^30.3.0 | Integrates Babel with Jest so test files are transpiled before running |
| `identity-obj-proxy` | ^3.0.0 | Mocks CSS module imports in Jest so style-dependent tests don't break |
| `jsdom` | ^29.0.2 | Full DOM implementation used as the browser simulation layer under Jest |

---

## Releases

### v1.0 — Initial Foundation

**Added:**
- Supabase Google authentication with session persistence
- Role-based routing and protected routes for Patient, Staff, and Admin users
- Home, Login, Patient, Staff, and Admin frontend pages
- Clinic API endpoints for listing and viewing clinics
- Patient clinic directory with search and filtering
- Azure deployment via GitHub Actions CI/CD pipeline

**Notes:**  
This release focuses on core setup and clinic-directory functionality. Booking, queue management, notifications, and analytics are not part of this release.

---

### v2.0 — Queue Logic Implementation

**Sprint Goal Achieved:**  
A functional virtual queue system enabling patients to join queues and track their position, and staff to manage patient flow through status updates.

**Frontend — 15 tasks completed:**
- Queue join confirmation flow
- Real-time queue position display
- Active queue view and status indicators
- Staff dashboard UI for queue management
- Notification UI and navigation improvements

**Backend — 12 tasks completed:**
- Queue join, retrieval, and filtering endpoints
- Patient status update endpoints
- Staff queue management APIs
- Notification trigger endpoints

**Core Logic — 11 tasks completed:**
- Prevent duplicate queue entries and enforce single active queue per patient
- Queue ordering and position recalculation
- Status lifecycle: Waiting → In Consultation → Complete
- Notification triggering based on queue position

**Testing — 11 tasks completed:**
- Queue join validation, status transition, queue consistency, and notification behaviour tests

**Total tasks completed: 49**

**Key Achievements:**
- Fully working virtual queue system
- Real-time queue position tracking
- Staff-controlled queue lifecycle management
- Strong validation and consistency rules
- Functional basic notification system
- Improved UI and navigation

---

### v3.0 — Appointment Logic Implementation

**Sprint Goal Achieved:**  
Ubuntu Health was extended from a basic clinic and queue system into a complete appointment lifecycle management system. This sprint covered appointment booking, staff availability, clinic configuration, slot generation, patient record creation, status tracking, rescheduling, cancellation, queue integration, and notification support.

**The system now enables:**
- Patients to book appointments and view upcoming bookings
- Staff to create and manage appointments on behalf of patients
- Admins to configure clinics, services, operating hours, and staff assignments
- The system to generate valid appointment slots from clinic hours and staff availability
- Appointments to move through a full lifecycle with clear statuses
- Appointments and queue entries to work together consistently

**Frontend — 18 tasks completed:**
- Shared booking interface for patients and staff
- Patient and staff appointment booking flows
- Date and slot selection interface
- Booking confirmation popup
- Upcoming appointments view for patients
- Clinic appointments view for staff by date
- Staff patient selection and patient creation during booking
- Appointment status display
- Appointment cancellation and rescheduling flows
- Staff appointment management controls
- Staff availability display and editing interface
- Improved queue wait time display and UI refinements

**Backend — 17 tasks completed:**
- Clinic configuration support (operating hours, default appointment duration)
- Staff availability storage and retrieval
- Appointment slot generation from clinic hours and staff availability
- Appointment booking endpoints for both patients and staff
- Patient record creation for unregistered patients
- Upcoming and date-filtered appointment retrieval
- Appointment status tracking, cancellation, and rescheduling logic
- Appointment confirmation email support
- Appointment and queue synchronisation support
- Automatic no-show update logic

**Core Logic — 16 tasks completed:**

*Appointment Slot Logic:*
- Generate slots from clinic operating hours using appointment duration
- Use staff availability to determine bookable times
- Prevent invalid, overlapping, or out-of-range slots
- Update available slots dynamically based on selected clinic and date

*Booking Rules:*
- Patients book using their own logged-in profile
- Staff book on behalf of selected or newly created patients
- Booking requires a valid clinic, date, patient, and time slot
- Booking shows a confirmation screen before submission
- Invalid inputs are rejected safely

*Appointment Lifecycle — supported statuses:*
- Confirmed → Waiting → Completed
- Cancelled
- No-show

*Queue Integration:*
- Same-day appointment patients are recognised when joining the queue
- Appointment time is displayed alongside patients in the staff queue view
- Queue behaviour and appointment status are kept consistent
- Staff receive better context when managing patient flow

**Automatic No-show Rule — 5 tasks completed:**  
An appointment is automatically marked as No-show only when:
- The status is still Confirmed or Waiting
- The appointment slot has a valid date and time
- The clinic operating hours are available for that day
- The clinic has already closed for that day
- Two additional hours have passed after clinic closing time

This prevents patients from being marked as no-shows too early while the clinic is still running.

**Notifications — 4 tasks completed:**
- Appointment confirmation email support
- Confirmation details shown after successful booking
- Improved communication after appointments are booked

**Testing — 12 tasks completed:**
- Clinic configuration and staff availability validation tests
- Appointment slot generation tests
- Patient and staff booking tests
- Patient record creation tests
- Appointment status update, cancellation, and rescheduling tests
- Queue wait time calculation tests
- Appointment and queue sync tests
- Automatic no-show timing rule tests

**Total tasks completed: 72**

**Key Achievements:**
- Full appointment booking flow for patients and staff
- Complete appointment lifecycle management (book, view, cancel, reschedule)
- Slot generation from real clinic hours and staff availability
- Appointment visibility in the staff queue view
- Automatic no-show detection with safe timing rules
- Appointment confirmation notifications
- Appointment and queue synchronisation

---

## Git Workflow  

- Use feature branches:
  - `feature/<name>`
  - `fix/<name>`
- No direct commits to `main`
- Use Pull Requests (PRs)
- CI checks must pass before merge  

---

## Testing  

- Jest used for backend and frontend testing
- Tests run automatically via CI/CD  
- Coverage tracked via Codecov

---

## Deployment  

Hosted on **Microsoft Azure App Service**

### Live URLs  
- **Frontend:**  
  https://ubuntu-health-geb6dbegejfmenc7.southafricanorth-01.azurewebsites.net/  

- **Backend:**  
  https://ubuntu-health-api-etdka2b3fucsckfs.southafricanorth-01.azurewebsites.net/  

---

## Data Source  

- South African clinic dataset (DHIS2)  
- Cleaned and standardised for application use  

---

## Team & Methodology  

- Agile Scrum methodology  
- Sprint-based development  
- GitHub Projects for tracking  
- Feature-branch workflow  

## Definition of Done  

A task is complete when:
- Code is implemented  
- PR is merged into `main`  
- All tests pass  
- Issue is closed