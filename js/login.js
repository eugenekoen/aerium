// --- 1. Import Shared Functionality ---
// Only import what's needed for the login page
import { supabase, checkLoginAndRedirect } from './shared.js';

// --- 2. DOM Elements ---
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessageDiv = document.getElementById('error-message');
const submitButton = loginForm?.querySelector('button[type="submit"]');

// --- 3. Event Listener for Form Submission ---
if (loginForm)
{
    loginForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault(); // Prevent default browser form submission

        const email = emailInput?.value?.trim();
        const password = passwordInput?.value; // Don't trim password
        if (errorMessageDiv) errorMessageDiv.textContent = ''; // Clear previous errors

        if (!email || !password)
        {
            if (errorMessageDiv) errorMessageDiv.textContent = 'Please enter both email and password.';
            return;
        }

        // Disable button during login attempt
        if (submitButton)
        {
            submitButton.disabled = true;
            submitButton.textContent = 'Logging in...';
        }

        try
        {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error)
            {
                console.error('Login error:', error);
                if (errorMessageDiv) errorMessageDiv.textContent = `Login failed: ${error.message}`;
            } else
            {
                // Login successful! Supabase handles session storage.
                console.log('Login successful:', data.session?.user?.email);
                window.location.href = 'index.html';
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during login:', err);
            if (errorMessageDiv) errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
        } finally
        {
            // Re-enable button if login failed
            if (submitButton && !window.location.href.endsWith('AllClients.html'))
            { // Check if not redirected
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            }
        }
    });
} else
{
    console.error("Login form not found in the DOM.");
}