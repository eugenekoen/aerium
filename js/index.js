//File Name: index.js

// --- 1. Import Shared Functionality ---
import { AppState } from './appState.js';
import
{
    supabase,
    checkAuthAndRedirect,
    handleLogout, // Keep for direct use if needed
    setupInactivityDetection,
    stopInactivityDetection, // Keep for cleanup
    loadSidebar
} from './shared.js';


// --- 2. Page Specific Functions ---

function updateWelcomeMessage() {
    const welcomeMessageElement = document.getElementById('user-welcome-message');
    const user = AppState.getUser(); // No database call!
    
    if (welcomeMessageElement && user) {
        welcomeMessageElement.textContent = `Welcome, ${user.full_name}!`;
    }
}

// --- 3. Initialization ---
async function initializePage()
{
    // 1. Load Sidebar
    await loadSidebar();

    // 2. Check Authentication
    const user = await AppState.initializeUser();
    if (!user) return; // Redirected to login

    // 3. Auth successful, display user info & start inactivity
    updateWelcomeMessage();
    setupInactivityDetection(); // Start inactivity detection
}

// --- 4. Event Listeners ---

//When content loads, call InitializePage
document.addEventListener('DOMContentLoaded', initializePage);