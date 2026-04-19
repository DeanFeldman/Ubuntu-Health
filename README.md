# Ubuntu Health  
**Community Clinic Appointment & Queue Management System**

## Overview  
Ubuntu Health is a web-based system designed to improve patient flow and reduce waiting times in public healthcare clinics. It enables patients to book appointments, join virtual queues, and track their status in real time, while giving clinic staff and administrators tools to manage operations efficiently.

The system integrates real South African clinic data and follows Agile development practices to ensure continuous improvement and scalability.

## Features  

### Patient  
- Sign in using Google OAuth  
- Browse and search clinics  
- View clinic details  
- Join virtual queues  
- Track queue position and status  
- Receive notifications and reminders  
- Book and manage appointments *(planned)*  

### Clinic Staff  
- View and manage clinic queues  
- Add/remove patients  
- Update patient status (Waiting, In Consultation, Complete)  
- Manage daily clinic operations  

### Admin  
- Manage clinics and system data  
- Assign roles (Patient, Staff, Admin)  
- View analytics and reports *(planned)*  

## System Architecture  

### Frontend  
- React (Vite)  

### Backend  
- Node.js + Express  

### Database  
- PostgreSQL (Supabase)  

### CI/CD  
- GitHub Actions + Azure App Service  

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

## Authentication  

- Google OAuth (via Supabase)  
- Role-based access:
  - Patient  
  - Staff  
  - Admin  

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

## Git Workflow  

- Use feature branches:
  - `feature/<name>`
  - `fix/<name>`
- No direct commits to `main`
- Use Pull Requests (PRs)
- CI checks must pass before merge  

## Testing  

- Jest used for backend testing  
- Tests run automatically via CI/CD  
- Focus on reliability and coverage  

## Deployment  

Hosted on **Microsoft Azure App Service**

### Live URLs  
- Frontend:  
  https://ubuntu-health-geb6dbegejfmenc7.southafricanorth-01.azurewebsites.net/  

- Backend:  
  https://ubuntu-health-api-etdka2b3fucsckfs.southafricanorth-01.azurewebsites.net/  

## Current Release  

### v1.0 — Initial Foundation  

**Includes:**
- Google authentication  
- Role-based routing  
- Clinic directory with search/filter  
- Basic frontend pages  
- CI/CD pipeline  

**Not yet included:**
- Full queue system  
- Appointment booking  
- Notifications  
- Analytics  

## Future Enhancements  

- Full queue management system  
- Appointment scheduling  
- Notification system (SMS/Email)  
- Wait time prediction  
- Analytics dashboards  

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

## Data Source  

- South African clinic dataset (DHIS2)  
- Cleaned and standardised for application use  