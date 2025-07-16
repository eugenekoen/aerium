# FOR AI - AERIUM Project Guide

## Project Overview
- **Type**: Client Management Web App
- **Database**: Supabase (PostgreSQL)
- **Architecture**: Vanilla JavaScript + HTML/CSS
- **Authentication**: Supabase Auth with auto-logout

## Key Technical Details
- **Supabase URL**: https://rezjbpyicdasqlhldwok.supabase.co
- **Inactivity Timeout**: 5 minutes
- **Main Navigation**: Sidebar-based with AllClients.html as default

## Code Architecture
shared.js = Core utilities (auth, database, UI helpers)
├── Supabase client initialization
├── Authentication functions (checkAuthAndRedirect, handleLogout)
├── Inactivity management (5-min auto-logout)
└── UI helpers (loadSidebar)


## Key Functions to Know
- `checkAuthAndRedirect()` - Protects pages, redirects if not logged in
- `handleLogout()` - Secure logout with cleanup
- `setupInactivityDetection()` - Starts auto-logout timer
- `loadSidebar()` - Loads navigation menu

## Common Patterns
- **Page Protection**: Start protected pages with `checkAuthAndRedirect()`
- **Database Queries**: Use exported `supabase` instance
- **Error Handling**: Console logging + user alerts
- **UI Loading**: Async/await pattern with try/catch

## File Dependencies
- All JS files import from `shared.js`
- Supabase CDN loaded in HTML files
- `sidebar_template.html` loaded dynamically

## Security Features
- Auto-logout after inactivity
- Session validation on page load
- Secure logout with cleanup
- Error handling for auth failures



For each JavaScript file, add:
/**
 * AERIUM - [File Purpose]
 * 
 * This file handles: [main responsibility]
 * 
 * Key functions:
 * - functionName(): [what it does]
 * - anotherFunction(): [what it does]
 * 
 * Dependencies: [what it needs]
 * Used by: [what uses it]
 */