# AERIUM - Client Management System

## What This App Does
AERIUM is a secure web application for managing client information. It features:
- 🔐 Secure login with automatic logout
- 📋 Client listing and detailed views
- 🔄 Real-time database synchronization
- 📱 Responsive design

## Quick Start
1. Open `index.html` in a web browser
2. Login with your credentials
3. Navigate through clients using the sidebar

## Security Features
- **Auto-logout**: Users are logged out after 5 minutes of inactivity
- **Session protection**: All pages check authentication status
- **Secure database**: Connected to Supabase with proper authentication

## File Structure
AERIUM/
├── index.html # Main dashboard
├── login.html # Login page
├── AllClients.html # Client listing
├── ClientView.html # Individual client details
├── sidebar_template.html # Navigation menu
├── js/
│ ├── shared.js # Core utilities (START HERE)
│ ├── index.js # Dashboard logic
│ ├── login.js # Authentication
│ ├── allclients.js # Client management
│ └── clientview.js # Client details
├── css/
│ └── app.css # Styling
└── assets/
└── App_Icon.svg # App icon


## For Developers
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **No Build Process**: Direct HTML/CSS/JS