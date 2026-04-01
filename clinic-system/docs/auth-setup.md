AUTHENTICATION SETUP – Google OAuth Authentication Setup

Overview:

Google OAuth authentication has been configured on the Google Cloud side for the Ubuntu Health system. This setup enables users to sign in using their Google accounts. The Google Cloud configuration has been completed, and credentials have been generated. Integration with Supabase and the frontend will be completed in later tasks.

Google Account:

A shared team Google account was created for this project to manage authentication and related services.

Account email: ubuntuhealthza@gmail.com

Note: credentials are stored securely and are not committed to the repository.

Google Cloud Project:

Project Name: ubuntu-health-auth

Project ID: ubuntu-health-auth

This project was created in Google Cloud Console and is used to manage OAuth authentication.

OAuth Consent Screen Configuration:

User Type: External

Publishing Status: Testing

App Name: Ubuntu Health

User Support Email: ubuntuhealthza@gmail.com

Developer Contact Email: ubuntuhealthza@gmail.com

Test Users:

• ubuntuhealthza@gmail.com

• 2434490@students.wits.ac.za

• 2693084@students.wits.ac.za

• 2698600@students.wits.ac.za

• 2799578@students.wits.ac.za

• 2803899@students.wits.ac.za

• 613ben.swartz@gmail.com

• dean.feldman05@gmail.com

• liorarosenberg2004@gmail.com

• nsundy0@gmail.com

• shaynaunterslak@gmail.com

The app is currently in testing mode, meaning only added test users can authenticate.

OAuth Credentials:

These credentials have been generated and are stored securely outside the repository.

Application Type: Web application

Client Name: ubuntu-health-web

Authorized JavaScript Origins:

• http://localhost:3000

Authorized Redirect URIs:

• http://localhost:3000/

Client ID: stored securely outside repository

Client Secret: stored securely outside repository

Current Status:

The following has been completed:

• Google Cloud project created

• OAuth consent screen configured

• Test users added

• OAuth client credentials generated

The following is still pending:

• Integration with Supabase authentication

• Configuration of production redirect URIs

• Frontend login implementation

• End-to-end testing

Notes:

• The support email and project ownership can be updated later if needed.

• The application is currently in testing mode and does not require verification.

• Redirect URIs may need to be updated depending on frontend implementation.



