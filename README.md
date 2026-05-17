# Ubuntu Health

Ubuntu Health is a web-based **Community Clinic Appointment and Queue Management System** built for the COMS3009A Software Design Project 2026.

The system helps patients book appointments, join virtual clinic queues, and track their waiting position, while giving clinic staff and admins tools to manage patient flow, clinic information, notifications, and analytics.

## Final Submission Links

| Item | Link |
|---|---|
| Public hosted application | https://ubuntu-health-geb6dbegejfmenc7.southafricanorth-01.azurewebsites.net |
| Screen recording demo | [ADD PUBLIC VIDEO LINK HERE] |
| GitHub repository | https://github.com/DeanFeldman/Ubuntu-Health |
| Final Word document | Submitted on Moodle |

> **Important:** Required secret values, credentials, and environment variable values are provided in the Word document submitted on Moodle. They are not committed to this repository.

## Project Overview

Public health clinics in South Africa are often overcrowded, and patients may wait for long periods without knowing their queue position or expected wait time. Ubuntu Health addresses this by providing:

- appointment booking and rescheduling,
- virtual queue joining,
- real-time queue position tracking,
- clinic and staff management,
- notifications and reminders,
- admin analytics and reporting,
- South African clinic/facility data integration.

## Main Features

### Patients

- Register and log in.
- Browse and search real clinic data.
- View clinic details and available slots.
- Book, reschedule, and cancel appointments.
- View future appointments and appointment history.
- Join a virtual clinic queue.
- Track queue position and estimated wait time.
- View predicted wait time separately from the live queue estimate.
- Receive email notifications for appointment changes.

### Clinic Staff

- Access staff dashboard based on role.
- View assigned clinic workflows.
- Manage booked and walk-in patients.
- Move patients through queue statuses.
- Mark appointments as completed or no-show.
- Manage patient flow using a cleaner sectioned dashboard.

### Admins

- Manage clinic details, services, and operating hours.
- Manage staff and role-related workflows.
- View analytics reports.
- View average wait-time reports.
- View no-show reports.
- Generate custom reports.
- Export report data where supported.

## SA Data Integration

The project includes the required South African data integration by using real South African health facility data for the clinic directory.

The dataset supports clinic records such as clinic names, locations, facility information, provinces, regions/districts, and filtering/search functionality.

The source choice and justification are documented in the submitted Word document and project artefacts.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Backend | Node.js + Express.js |
| Database / Backend Services | Supabase |
| Authentication / Roles | Role-based authentication flow |
| Testing | Jest / Supertest where applicable |
| CI/CD | GitHub Actions |
| Deployment | Public hosted deployment link provided above |

## Repository Structure

```text
Ubuntu-Health/
└── clinic-system/
    ├── client/      # React/Vite frontend
    └── server/      # Node/Express backend
```

## Running the Project Locally

### 1. Clone the repository

```bash
git clone https://github.com/DeanFeldman/Ubuntu-Health.git
cd Ubuntu-Health/clinic-system
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Create backend environment file

Create a `.env` file inside `clinic-system/server`.

```bash
touch .env
```

Add the required environment variables. The actual secret values are provided in the submitted Word document.

```env
SUPABASE_URL= 
SUPABASE_SERVICE_ROLE_KEY=
PORT=8080
```

Depending on the final configuration, some variable names may differ slightly. Use the submitted Word document as the source for the final secret values.

### 4. Start the backend

```bash
npm run dev
```

The backend should run on:

```text
http://localhost:3000
```

You can test the API health route with:

```text
http://localhost:3000/api
```

### 5. Install frontend dependencies

Open a new terminal:

```bash
cd Ubuntu-Health/clinic-system/client
npm install
```

### 6. Create frontend environment file

Create a `.env` file inside `clinic-system/client` if required by the final build.

```bash
touch .env
```

Example:

```env
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 7. Start the frontend

```bash
npm run dev
```

The frontend should run on:

```text
http://localhost:5173
```

## Running Tests

### Backend tests

```bash
cd clinic-system/server
npm test
```

### Frontend tests

```bash
cd clinic-system/client
npm test
```

## Deployment Notes

The final hosted application link is provided in the final submission links section and in the submitted Word document.

Secrets are not stored in GitHub. Deployment environment variables must be configured in the deployment provider using the values from the submitted document.

## Scrum and Project Management Evidence

The final submission includes evidence of Scrum methodology, including:

- product backlog,
- sprint backlogs,
- sprint burndown charts,
- daily stand-up summaries,
- sprint review evidence,
- sprint retrospective reports,
- GitHub issues and project board evidence,
- pull requests and commit history.

The repository and documentation are structured so that markers can navigate the project artefacts and verify the development process.

## Documentation and Artefacts

Additional project artefacts are included in the submitted documentation, including:

- project plan,
- architecture diagrams,
- design documents,
- test plan and results,
- screenshots or testing logs,
- release notes,
- final demo link,
- deployment link,
- environment and secret notes.

## Final Release

The final release is:

```text
v4.0.0 — Ubuntu Health Final Submission Release
```

This release represents the final viable product for submission.

## Security Note

Do not commit `.env` files, API keys, database keys, email passwords, or deployment secrets to the repository.

Secret values required to run the application are included only in the final document submitted on Moodle.

## Contributors

Ubuntu Health team members contributed through GitHub commits, issues, pull requests, Scrum artefacts, documentation, testing, and implementation work.

## Course

School of Computer Science and Applied Mathematics  
Software Design Project 2026  
University of the Witwatersrand
