// --- 1. Import Shared Functionality ---
import
{
    supabase,
    checkAuthAndRedirect,
    handleLogout, // Keep for direct use if needed
    setupInactivityDetection,
    stopInactivityDetection, // Keep for cleanup
    loadSidebar
} from './shared.js';

// --- 2. DOM Elements ---
const welcomeMessageElement = document.getElementById('user-welcome-message');

// --- 3. Page Specific Functions ---

// Fetch User Profile and Update Welcome Message
async function displayUserName(userId, userEmail)
{
    if (!welcomeMessageElement) return;

    welcomeMessageElement.textContent = 'Fetching user data...';

    try
    {
        console.log(`Fetching profile for user ID: ${userId}`);
        const { data: profile, error: profileError } = await supabase
            .from('Profiles') // Ensure 'Profiles' is your table name
            .select('full_name') // The column with the name
            .eq('id', userId) // Match the profile ID with the authenticated user's ID
            .maybeSingle(); // Handle null profile gracefully

        if (profileError)
        {
            console.error('Error fetching user profile:', profileError);
            welcomeMessageElement.textContent = `Welcome! (User: ${userEmail})`; // Fallback to email
        } else if (profile && profile.full_name)
        {
            console.log(`User profile found: ${profile.full_name}`);
            welcomeMessageElement.textContent = `Welcome, ${profile.full_name}!`; // Display name
        } else
        {
            console.warn("Profile data missing or full_name not set for user:", userId);
            welcomeMessageElement.textContent = `Welcome! (User: ${userEmail})`; // Fallback to email
        }
    } catch (err)
    {
        console.error('An unexpected error occurred fetching user data:', err);
        welcomeMessageElement.textContent = 'An error occurred displaying user info.';
    }
}

// --- 4. Initialization ---
async function initializePage()
{
    // 1. Load Sidebar
    await loadSidebar();

    // 2. Check Authentication
    const session = await checkAuthAndRedirect();
    if (!session) return; // Stop if redirected

    // 3. Auth successful, display user info & start inactivity
    console.log("User is authenticated on Home page. Fetching profile...");
    if (session.user)
    {
        await displayUserName(session.user.id, session.user.email); // Fetch and display the user's name
    } else
    {
        if (welcomeMessageElement) welcomeMessageElement.textContent = 'Welcome! (Could not identify user)';
    }
    setupInactivityDetection(); // Start inactivity detection
}

// --- 5. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);