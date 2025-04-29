// allclients.js

// --- 1. Initialize Supabase Client ---
const SUPABASE_URL = 'https://rezjbpyicdasqlhldwok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlempicHlpY2Rhc3FsaGxkd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTUwNzUsImV4cCI6MjA1NjIzMTA3NX0.o9ZN3Q7-2ijrDrry5XP3SEqOS8PKqoHF-W-LGYmtswg';

// --- Pagination State ---
let currentPage = 1;
let pageSize = 10;
let totalClients = 0;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
{
    alert("Supabase configuration is missing. Please check allclients.js");
    throw new Error("Supabase URL or Anon Key is missing.");
}

let supabase;
try
{
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized for AllClients page.');
} catch (error)
{
    console.error("Error initializing Supabase client:", error);
    alert("Could not initialize Supabase. Check console for details.");
    throw error;
}

// --- 2. Get Reference to the Table Body and Pagination Elements ---
const tableBody = document.getElementById('client-table-body');
// References to pagination controls
let prevPageBtn, nextPageBtn, pageInfo, pageSizeSelect;

// --- Inactivity Logout Variables & Functions ---
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
let inactivityTimerId;

// Simple debounce function
function debounce(func, wait)
{
    let timeout;
    return function executedFunction(...args)
    {
        const later = () =>
        {
            clearTimeout(timeout);
            func(...args); // Call the original function
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to call when timer expires
function logoutDueToInactivity()
{
    console.log("Logging out due to inactivity.");
    alert("You have been logged out due to inactivity.");
    handleLogout(); // Call the main logout function
}

// Function to reset the inactivity timer
function resetInactivityTimer()
{
    // console.log("Activity detected, resetting inactivity timer."); // Uncomment for debugging
    clearTimeout(inactivityTimerId); // Clear the previous timer
    inactivityTimerId = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT_MS); // Start a new timer
}

// Create a debounced version of the reset timer for high-frequency events
const debouncedResetTimer = debounce(resetInactivityTimer, 500); // Adjust 500ms as needed

// Function to add event listeners and start the first timer
function setupInactivityDetection()
{
    resetInactivityTimer(); // Start the timer initially

    // Add listeners for user activity
    window.addEventListener('mousemove', debouncedResetTimer);
    window.addEventListener('scroll', debouncedResetTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);

    console.log("Inactivity detection started.");
}

// Function to clear the timer and remove listeners
function stopInactivityDetection()
{
    clearTimeout(inactivityTimerId); // Clear the main timer

    // Remove event listeners to prevent memory leaks and stop checks
    window.removeEventListener('mousemove', debouncedResetTimer);
    window.removeEventListener('scroll', debouncedResetTimer);
    window.removeEventListener('mousedown', resetInactivityTimer);
    window.removeEventListener('keypress', resetInactivityTimer);
    window.removeEventListener('touchstart', resetInactivityTimer);

    console.log("Inactivity detection stopped.");
}

// --- Authentication Check ---
async function checkAuthenticationAndLoadData()
{
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Checking authentication...</td></tr>';

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError)
    {
        console.error("Error getting session:", sessionError);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">Error checking authentication.</td></tr>';
        stopInactivityDetection(); // Stop detection on error
        return;
    }

    if (!session)
    {
        console.log("No active session found. Redirecting to login.");
        stopInactivityDetection(); // Stop detection before redirect
        window.location.href = 'login.html';
    } else
    {
        console.log("User is authenticated. Loading client data and starting inactivity timer...");
        // Initialize pagination controls after confirming authentication
        initializePaginationControls();
        loadClients(); // Load data with pagination
        setupInactivityDetection(); // Start inactivity detection
    }
}

// --- Initialize Pagination Controls ---
function initializePaginationControls()
{
    prevPageBtn = document.getElementById('prev-page');
    nextPageBtn = document.getElementById('next-page');
    pageInfo = document.getElementById('page-info');
    pageSizeSelect = document.getElementById('page-size');

    // Previous page button
    prevPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer(); // Add timer reset on interaction
        if (currentPage > 1)
        {
            currentPage--;
            loadClients();
        }
    });

    // Next page button
    nextPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer(); // Add timer reset on interaction
        // Check if on last page before incrementing (using totalClients and pageSize)
        const totalPages = Math.ceil(totalClients / pageSize);
        if (currentPage < totalPages)
        {
            currentPage++;
            loadClients();
        }
    });

    // Page size select
    pageSizeSelect.addEventListener('change', () =>
    {
        resetInactivityTimer(); // Add timer reset on interaction
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1; // Reset to first page when changing page size
        loadClients();
    });
}

// --- Function to Get Total Count of Clients ---
async function getClientCount()
{
    try
    {
        const { count, error } = await supabase
            .from('Clients')
            .select('*', { count: 'exact', head: true });

        if (error)
        {
            console.error('Error fetching client count:', error);
            return 0;
        }
        // console.log("Total client count:", count); // Debug log
        return count;
    } catch (err)
    {
        console.error('Unexpected error getting client count:', err);
        return 0;
    }
}

// --- Function to Fetch and Display Clients with Pagination ---
async function loadClients()
{
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Loading clients...</td></tr>';

    // Disable pagination buttons while loading
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    try
    {
        // Get the total count *before* fetching the paginated data
        totalClients = await getClientCount();

        // Calculate offset based on current page and page size
        const offset = (currentPage - 1) * pageSize;
        const maxRange = offset + pageSize - 1;
        // console.log(`Loading page ${currentPage}, size ${pageSize}, range ${offset}-${maxRange}, total ${totalClients}`); // Debug log

        // Fetch the clients with pagination parameters
        let { data: clients, error } = await supabase
            .from('Clients')
            .select(`
                Id, ClientName, ContactName, EmailAddress, TelNumber, CellNumber, BillingCode,
                ClientTypes ( Name ),
                ClientStatuses:ClientStatusId ( Name ),
                YearEnds:YearEndId ( Name )
            `)
            .order('ClientName', { ascending: true })
            .range(offset, maxRange); // Use calculated max range

        if (error)
        {
            console.error('Error fetching clients:', error);
            tableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
            // Keep buttons disabled on error
            return;
        }

        tableBody.innerHTML = ''; // Clear loading message

        if (clients && clients.length > 0)
        {
            clients.forEach(client =>
            {
                if (client.Id === undefined || client.Id === null)
                {
                    console.warn(`[loadClients] Client found with missing ID:`, client);
                    // Optionally skip rendering this row or show placeholder
                    return; // Skip this iteration
                }

                const row = document.createElement('tr');
                // Use nullish coalescing (??) for safer defaults
                const clientTypeName = client.ClientTypes?.Name ?? 'N/A';
                const clientStatusName = client.ClientStatuses?.Name ?? 'N/A';
                const yearEndName = client.YearEnds?.Name ?? 'N/A';
                const clientNameSafe = client.ClientName ?? ''; // Ensure clientName is a string for delete confirm

                // Escape single quotes in clientName for the onclick attribute
                const escapedClientName = clientNameSafe.replace(/'/g, "\\'");

                row.innerHTML = `
                    <td>${clientNameSafe}</td>
                    <td>${client.ContactName ?? ''}</td>
                    <td>${clientTypeName}</td>
                    <td>${client.EmailAddress ?? ''}</td>
                    <td>${client.TelNumber ?? ''}</td>
                    <td>${client.CellNumber ?? ''}</td>
                    <td>${yearEndName}</td>
                    <td>${clientStatusName}</td>
                    <td>${client.BillingCode ?? ''}</td>
                    <td>
                        <button class="button" onclick="editClient(${client.Id})">Edit</button>
                        <button class="button" onclick="deleteClient(${client.Id}, '${escapedClientName}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else
        {
            // Handle case where current page might be empty after deletion or filter change
            if (currentPage > 1)
            {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No clients found on this page. <button class="button" onclick="currentPage=1; loadClients();">Go to First Page</button></td></tr>`; // Added button class
            } else
            {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No clients found.</td></tr>';
            }
        }

        // Update pagination controls AFTER data is loaded and total count is known
        updatePaginationControls();

    } catch (err)
    {
        console.error('An unexpected error occurred:', err);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">An unexpected error occurred. Check console.</td></tr>';
        // Keep buttons disabled on error
    }
}

// --- Update Pagination Controls Based on Current State ---
function updatePaginationControls()
{
    // Calculate total pages (ensure pageSize isn't zero)
    const totalPages = pageSize > 0 ? Math.ceil(totalClients / pageSize) : 1;

    // Correct current page if it's out of bounds (e.g., after deletion)
    // Do this *before* setting the text or disabling buttons based on current page
    if (currentPage > totalPages && totalPages > 0)
    {
        console.log(`Current page ${currentPage} is out of bounds (max ${totalPages}). Resetting to page ${totalPages}.`);
        currentPage = totalPages;
        // !!! Important: Reload data if page changes !!!
        loadClients();
        return; // Exit early as loadClients will call this again
    } else if (currentPage < 1)
    {
        currentPage = 1; // Should not happen with current logic, but safety check
    }


    // Update page info text
    if (pageInfo)
    { // Check if element exists
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    // Enable/disable previous button
    if (prevPageBtn)
    {
        prevPageBtn.disabled = currentPage <= 1;
    }

    // Enable/disable next button
    if (nextPageBtn)
    {
        nextPageBtn.disabled = currentPage >= totalPages || totalClients === 0;
    }
}

// --- Edit Client Function ---
function editClient(clientId)
{
    console.log(`[editClient] Function called with ID: ${clientId}`); // Log 1
    console.log(`[editClient] Type of ID: ${typeof clientId}`);       // Log 2

    if (clientId === undefined || clientId === null || clientId === '')
    {
        console.error("[editClient] Invalid clientId received:", clientId);
        alert("Error: Could not get a valid Client ID to navigate.");
        return;
    }

    resetInactivityTimer();

    const editUrl = `ClientView.html?clientId=${clientId}`;
    console.log(`[editClient] Constructed URL: ${editUrl}`); // Log 3

    try
    {
        window.location.href = editUrl;
        console.log("[editClient] Navigation attempted."); // Log 4
    } catch (e)
    {
        console.error("[editClient] Error during navigation attempt:", e);
        alert("An error occurred while trying to navigate to the client view.");
    }
}

// --- Delete Client Function (with Supabase Call) ---
async function deleteClient(clientId, clientName)
{
    resetInactivityTimer(); // User interaction, reset timer

    const safeClientName = clientName || `Client ID ${clientId}`;

    if (confirm(`Are you sure you want to delete client: ${safeClientName}? \n\nTHIS ACTION CANNOT BE UNDONE.`))
    {
        console.log(`Attempting to delete client with ID: ${clientId}`);

        const deleteButtons = document.querySelectorAll(`button[onclick^="deleteClient(${clientId},"]`);
        try
        {
            deleteButtons.forEach(btn => btn.disabled = true); // Disable button

            const { error } = await supabase
                .from('Clients')
                .delete()
                .eq('Id', clientId);

            if (error)
            {
                console.error('Error deleting client:', error);
                alert(`Failed to delete client "${safeClientName}": ${error.message}`);
                deleteButtons.forEach(btn => btn.disabled = false); // Re-enable on error
            } else
            {
                console.log(`Client ID: ${clientId} (${safeClientName}) deleted successfully.`);
                alert(`Client "${safeClientName}" deleted successfully.`);

                // --- Reload the client list ---
                // No need to explicitly decrement currentPage here anymore,
                // updatePaginationControls will handle being out of bounds after reload.
                totalClients--; // Decrement total count locally for pagination logic
                loadClients(); // Reload data which will trigger pagination update
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during deletion:', err);
            alert('An unexpected error occurred during deletion. Check console.');
            deleteButtons.forEach(btn => btn.disabled = false); // Re-enable on error
        }

    } else
    {
        console.log('Client deletion cancelled by user.');
    }
}

// --- Navigate to Add Client View ---
function navigateToAddClient()
{
    console.log("[navigateToAddClient] Navigating to Client View in add mode.");
    resetInactivityTimer();
    window.location.href = 'ClientView.html?mode=add';
}

// --- Logout Function ---
async function handleLogout()
{
    stopInactivityDetection();
    const { error } = await supabase.auth.signOut();
    if (error)
    {
        console.error('Error logging out:', error);
        alert(`Logout failed: ${error.message}`);
    } else
    {
        console.log('User logged out successfully.');
        window.location.href = 'login.html';
    }
}

// --- Initial Load Trigger ---
document.addEventListener('DOMContentLoaded', checkAuthenticationAndLoadData);

// --- Optional: Cleanup on Page Unload ---
window.addEventListener('beforeunload', () =>
{
    clearTimeout(inactivityTimerId); // Just clear the timer
});