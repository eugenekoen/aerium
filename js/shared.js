// --- 1. Supabase Initialization (Singleton Pattern) ---
const SUPABASE_URL = 'https://rezjbpyicdasqlhldwok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlempicHlpY2Rhc3FsaGxkd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTUwNzUsImV4cCI6MjA1NjIzMTA3NX0.o9ZN3Q7-2ijrDrry5XP3SEqOS8PKqoHF-W-LGYmtswg';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
{
    alert("Supabase configuration is missing. Please check js/shared.js");
    throw new Error("Supabase URL or Anon Key is missing.");
}

let supabaseInstance;
try
{
    // Ensure Supabase library is loaded (usually via CDN in HTML)
    if (!window.supabase)
    {
        throw new Error("Supabase client library not found. Ensure it's loaded in your HTML.");
    }
    const { createClient } = window.supabase;
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized globally.');
} catch (error)
{
    console.error("Error initializing Supabase client:", error);
    alert(`Could not initialize Supabase: ${error.message}. Check console for details.`);
    throw error; // Re-throw to stop script execution if critical
}

// Export the initialized client
export const supabase = supabaseInstance;

// --- 2. Authentication Functions ---

/**
 * Checks if a user session exists. If not, redirects to the specified login page.
 * If a session exists, returns the session object.
 * Should be called at the beginning of protected pages.
 * @param {string} loginPageURL - The URL to redirect to if not authenticated. Defaults to 'login.html'.
 * @returns {Promise<object|null>} The user session object or null if redirected or error occurred.
 */
export async function checkAuthAndRedirect(loginPageURL = 'login.html')
{
    try
    {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error)
        {
            console.error("Error getting session:", error);
            alert("Error checking authentication status. Please try refreshing.");
            window.location.href = loginPageURL;
            return null;
        }

        if (!session)
        {
            console.log("No active session found. Redirecting to login.");
            window.location.href = loginPageURL;
            return null;
        }

        console.log("User is authenticated.");
        return session; // Return session if authenticated
    } catch (err)
    {
        console.error("Unexpected error during authentication check:", err);
        alert("An unexpected error occurred during authentication check. Redirecting to login.");
        window.location.href = loginPageURL;
        return null;
    }
}

/**
 * Checks if a user session exists on pages like the login page.
 * If a session *does* exist, redirects to the specified main application page.
 * Should be called at the beginning of the login page.
 * @param {string} appPageURL - The URL to redirect to if already authenticated. Defaults to 'AllClients.html'.
 */
export async function checkLoginAndRedirect(appPageURL = 'AllClients.html')
{
    try
    {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Ignore getSession errors on the login page, as the user might not be logged in anyway.
        if (error)
        {
            console.warn("Ignoring error getting session on login page:", error);
        }

        if (session)
        {
            console.log('User already logged in, redirecting to application.');
            window.location.href = appPageURL;
        } else
        {
            console.log('No active session found, showing login page.');
        }
    } catch (err)
    {
        console.error("Unexpected error during login check:", err);
        // Don't redirect on unexpected errors here, just log it.
    }
}

/**
 * Handles user logout: stops inactivity detection, signs out from Supabase,
 * and redirects to the login page.
 * @param {string} loginPageURL - The URL to redirect to after logout. Defaults to 'login.html'.
 */
export async function handleLogout(loginPageURL = 'login.html')
{
    console.log("Attempting to logout...");
    stopInactivityDetection(); // Stop timer first

    try
    {
        const { error } = await supabase.auth.signOut();
        if (error)
        {
            console.error('Error signing out from Supabase:', error);
            alert(`Logout failed: ${error.message}`);
            // Optionally restart inactivity detection if logout fails? Or just leave it stopped.
        } else
        {
            console.log('User signed out successfully from Supabase.');
            // Clear any app-specific local storage if necessary
            // localStorage.removeItem('someAppSetting');
            window.location.href = loginPageURL;
        }
    } catch (err)
    {
        console.error('An unexpected error occurred during logout:', err);
        alert('An unexpected error occurred during logout. Please try again.');
    }
}

// --- 3. Inactivity Logout Logic ---
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 10 minutes
let inactivityTimerId = null; // Initialize to null

// Simple debounce function
function debounce(func, wait)
{
    let timeout;
    return function executedFunction(...args)
    {
        const later = () =>
        {
            clearTimeout(timeout);
            func.apply(this, args); // Use apply to preserve context if needed
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to call when timer expires
function logoutDueToInactivity()
{
    // Check if timer ID still exists; avoids potential race conditions if stopInactivityDetection was called just before timeout fired
    if (inactivityTimerId !== null)
    {
        console.log("Logging out due to inactivity.");
        // Check if alert exists before calling it (good practice)
        if (typeof alert === 'function')
        {
            alert("You have been logged out due to inactivity.");
        }
        handleLogout(); // Call the shared logout function
        inactivityTimerId = null; // Clear the ID after triggering logout
    } else
    {
        console.log("Inactivity timeout triggered, but timer was already cleared. Ignoring.");
    }
}

// Function to reset the inactivity timer
export function resetInactivityTimer()
{
    if (inactivityTimerId !== null)
    {
        clearTimeout(inactivityTimerId); // Clear the previous timer if it exists
    }
    inactivityTimerId = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT_MS); // Start a new timer
}

// Create a debounced version of the reset timer for high-frequency events
const debouncedResetTimer = debounce(resetInactivityTimer, 500); // Adjust 500ms as needed

/**
 * Sets up event listeners to detect user activity and reset the inactivity timer.
 */
export function setupInactivityDetection()
{
    // Ensure detection isn't already running (optional, but good practice)
    if (inactivityTimerId !== null)
    {
        console.warn("Inactivity detection seems to be already running. Stopping first.");
        stopInactivityDetection();
    }
    console.log("Starting inactivity detection...");
    resetInactivityTimer(); // Start the timer initially

    // Add listeners for user activity
    window.addEventListener('mousemove', debouncedResetTimer, { passive: true }); // Use passive where possible
    window.addEventListener('scroll', debouncedResetTimer, { passive: true });
    window.addEventListener('mousedown', resetInactivityTimer); // Cannot be passive
    window.addEventListener('keypress', resetInactivityTimer); // Cannot be passive
    window.addEventListener('touchstart', resetInactivityTimer, { passive: true });

    // Add listener for form inputs/changes (using capture phase)
    document.body.addEventListener('input', resetInactivityTimer, true);
    document.body.addEventListener('change', resetInactivityTimer, true);

    console.log("Inactivity detection started.");
}

/**
 * Clears the inactivity timer and removes event listeners.
 */
export function stopInactivityDetection()
{
    if (inactivityTimerId !== null)
    {
        console.log("Stopping inactivity detection...");
        clearTimeout(inactivityTimerId); // Clear the main timer
        inactivityTimerId = null; // Reset the ID

        // Remove event listeners
        window.removeEventListener('mousemove', debouncedResetTimer);
        window.removeEventListener('scroll', debouncedResetTimer);
        window.removeEventListener('mousedown', resetInactivityTimer);
        window.removeEventListener('keypress', resetInactivityTimer);
        window.removeEventListener('touchstart', resetInactivityTimer);
        document.body.removeEventListener('input', resetInactivityTimer, true);
        document.body.removeEventListener('change', resetInactivityTimer, true);

        console.log("Inactivity detection stopped.");
    } else
    {
        console.log("Inactivity detection was not running.");
    }
}

// --- 4. UI Helper Functions ---

/**
 * Fetches the sidebar HTML from a separate file and injects it into a placeholder element.
 * Also attaches the logout handler and highlights the active navigation link.
 * @param {string} placeholderId - The ID of the div where the sidebar should be loaded. Defaults to 'sidebar-placeholder'.
 * @param {string} sidebarUrl - The path to the sidebar HTML file. Defaults to '_sidebar.html'.
 */
export async function loadSidebar(placeholderId = 'sidebar-placeholder', sidebarUrl = 'sidebar_template.html')
{
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder)
    {
        console.error(`Sidebar placeholder element with ID #${placeholderId} not found.`);
        return;
    }

    try
    {
        const response = await fetch(sidebarUrl);
        if (!response.ok)
        {
            throw new Error(`Failed to fetch sidebar (${sidebarUrl}): ${response.status} ${response.statusText}`);
        }
        const sidebarHtml = await response.text();
        // Replace placeholder content, not the placeholder itself
        placeholder.innerHTML = sidebarHtml;

        // Attach the logout handler to the dynamically loaded logout link using its ID
        const logoutLink = placeholder.querySelector('#logout-link'); // Use ID selector

        if (logoutLink)
        {
            logoutLink.onclick = (event) =>
            {
                event.preventDefault(); // Prevent default link behavior (#)
                handleLogout();       // Call the shared logout function
            };
            console.log("Logout handler attached successfully to #logout-link.");
        } else
        {
            // This warning indicates a mismatch between shared.js and _sidebar.html
            console.warn("Could not find logout link (#logout-link) in loaded sidebar to attach handler.");
        }

        // Make current page link active
        // Get the filename part of the current URL (e.g., "AllClients.html")
        const currentPage = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
        const navLinks = placeholder.querySelectorAll('.sidenav a'); // Select all links within the loaded sidenav

        navLinks.forEach(link =>
        {
            const linkHref = link.getAttribute('href');
            // Check if the link has an href, it's not just "#", and it matches the current page filename
            if (linkHref && linkHref !== '#' && linkHref === currentPage)
            {
                link.classList.add('active'); // Add an 'active' class (style in CSS)
                console.log(`Activated sidebar link for: ${currentPage}`);
            } else
            {
                link.classList.remove('active'); // Ensure others are not active
            }
        });

    } catch (error)
    {
        console.error("Error loading sidebar:", error);
        // Display error within the placeholder for visibility
        placeholder.innerHTML = `<div class="sidenav-error" style="padding: 20px; color: #ffcccc; font-family: sans-serif;">Error loading navigation: ${error.message}</div>`;
    }
}

// --- 5. Global Cleanup on Page Unload ---
// This helps ensure the timer is stopped if the user navigates away or closes the tab/browser.
window.addEventListener('beforeunload', () =>
{
    console.log("beforeunload event triggered. Stopping inactivity detection.");
    stopInactivityDetection(); // Ensure timer/listeners are cleaned up
});