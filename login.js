// login.js

// --- 1. Initialize Supabase Client ---
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
// You still need the anon key for auth calls before the user is logged in.
const SUPABASE_URL = 'https://rezjbpyicdasqlhldwok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlempicHlpY2Rhc3FsaGxkd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTUwNzUsImV4cCI6MjA1NjIzMTA3NX0.o9ZN3Q7-2ijrDrry5XP3SEqOS8PKqoHF-W-LGYmtswg';

// Basic check
if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
{
    alert("Supabase configuration is missing. Please check login.js");
    throw new Error("Supabase URL or Anon Key is missing.");
}

let supabase;
try
{
    const { createClient } = window.supabase; // Or just 'supabase'
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized for Login page.');
} catch (error)
{
    console.error("Error initializing Supabase client:", error);
    alert("Could not initialize Supabase. Check console for details.");
    throw error;
}

// --- 2. Get DOM Elements ---
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessageDiv = document.getElementById('error-message');

// --- 3. Add Event Listener for Form Submission ---
loginForm.addEventListener('submit', async (event) =>
{
    event.preventDefault(); // Prevent default browser form submission

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    errorMessageDiv.textContent = ''; // Clear previous errors

    if (!email || !password)
    {
        errorMessageDiv.textContent = 'Please enter both email and password.';
        return;
    }

    try
    {
        // Attempt to sign in using Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error)
        {
            console.error('Login error:', error);
            errorMessageDiv.textContent = `Login failed: ${error.message}`;
            return;
        }

        // Login successful! data.session contains the session info.
        // Supabase automatically stores the session (usually in localStorage).
        console.log('Login successful:', data.session);

        // Redirect to the main application page (e.g., AllClients.html)
        window.location.href = 'AllClients.html'; // Redirect on success

    } catch (err)
    {
        console.error('An unexpected error occurred during login:', err);
        errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
    }
});

// --- Optional: Check if already logged in ---
// If a user navigates to login.html but already has a valid session,
// you might want to redirect them directly to the app.
async function checkExistingSession()
{
    const { data: { session } } = await supabase.auth.getSession();
    if (session)
    {
        console.log('User already logged in, redirecting to AllClients.html');
        window.location.href = 'AllClients.html';
    } else
    {
        console.log('No active session found, showing login page.');
    }
}

// Call the check when the script loads
document.addEventListener('DOMContentLoaded', checkExistingSession);