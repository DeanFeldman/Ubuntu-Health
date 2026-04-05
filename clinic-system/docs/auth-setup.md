# AUTHENTICATION SETUP – Google OAuth

## Overview

Google OAuth authentication has been configured for the Ubuntu Health system, enabling users to securely sign in using their Google accounts.

The setup includes:
- Google Cloud OAuth configuration  
- Integration with Supabase authentication  
- Frontend login flow  

Initial testing confirms that the authentication flow is functional. Full end-to-end validation will be completed once database integration is finalised.


## Google Account

A dedicated project Google account is used to manage authentication services.

**Note:**
- The initial Google Cloud project was restricted due to a service policy issue.  
- A new account and project were created to resolve this and ensure a stable configuration.  

All credentials are now stored securely and are not committed to the repository.


## Google Cloud Project

A Google Cloud project is used to manage OAuth authentication.

- OAuth 2.0 credentials were created for a web application  
- Authorized origins and redirect URIs were configured for local development  
- The project is currently in testing mode  


## OAuth Consent Screen

- User Type: External  
- Publishing Status: Testing  
- App Name: Ubuntu Health  

The application is currently restricted to approved test users.


## Test Users

Authentication is limited to approved test users while the application remains in testing mode.


## OAuth Credentials

OAuth credentials were generated in Google Cloud and configured in Supabase.

- Application Type: Web application  
- Credentials (Client ID and Secret) are stored securely outside the repository  

### Authorized JavaScript Origins
- http://localhost:3000  

### Authorized Redirect URIs
- http://localhost:3000/auth/callback  


## Supabase Integration

Google authentication has been integrated with Supabase:

- Google provider enabled in Supabase Authentication  
- OAuth Client ID and Secret configured  
- Redirect URLs configured correctly  
- Authentication flow connected to the frontend  


## Environment Configuration

Environment variables are used for frontend configuration.

**Important:**
- `.env` files are **NOT** committed to the repository  
- A `.env.example` file is provided as a template  

Each developer must create their own `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
