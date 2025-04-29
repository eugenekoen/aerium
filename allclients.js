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
        stopInactivityDetection(); // *** ADDED: Stop detection on error ***
        // Optionally redirect or show persistent error
        return;
    }

    if (!session)
    {
        console.log("No active session found. Redirecting to login.");
        stopInactivityDetection(); // *** ADDED: Stop detection before redirect ***
        window.location.href = 'login.html';
    } else
    {
        console.log("User is authenticated. Loading client data and starting inactivity timer...");
        // Initialize pagination controls after confirming authentication
        initializePaginationControls();
        loadClients(); // Load data with pagination
        setupInactivityDetection(); // *** ADDED: Start inactivity detection ***
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
        if (currentPage > 1)
        {
            currentPage--;
            loadClients();
        }
    });

    // Next page button
    nextPageBtn.addEventListener('click', () =>
    {
        currentPage++;
        loadClients();
    });

    // Page size select
    pageSizeSelect.addEventListener('change', () =>
    {
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

    try
    {
        // Get the total count for pagination calculation
        totalClients = await getClientCount();

        // Calculate offset based on current page and page size
        const offset = (currentPage - 1) * pageSize;

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
            .range(offset, offset + pageSize - 1);

        if (error)
        {
            console.error('Error fetching clients:', error);
            tableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
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
                }

                const row = document.createElement('tr');
                const clientTypeName = client.ClientTypes?.Name ?? 'N/A';
                const clientStatusName = client.ClientStatuses?.Name ?? 'N/A';
                const yearEndName = client.YearEnds?.Name ?? 'N/A';

                row.innerHTML = `
                    <td>${client.ClientName ?? ''}</td>
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
                        <button class="button" onclick="deleteClient(${client.Id}, '${client.ClientName}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else
        {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No clients found.</td></tr>';
        }

        // Update pagination controls
        updatePaginationControls();

    } catch (err)
    {
        console.error('An unexpected error occurred:', err);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">An unexpected error occurred. Check console.</td></tr>';
    }
}

// --- Update Pagination Controls Based on Current State ---
function updatePaginationControls()
{
    // Calculate total pages
    const totalPages = Math.ceil(totalClients / pageSize);

    // Update page info text
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    // Enable/disable previous button
    prevPageBtn.disabled = currentPage <= 1;

    // Enable/disable next button
    nextPageBtn.disabled = currentPage >= totalPages;
}

// --- Placeholder functions for Edit/Delete ---
function editClient(clientId)
{
    console.log(`[editClient] Function called with ID: ${clientId}`); // Log 1: Check if function is called with an ID
    console.log(`[editClient] Type of ID: ${typeof clientId}`);       // Log 2: Check the type (should be number)

    // Basic check if clientId is valid
    if (clientId === undefined || clientId === null || clientId === '')
    {
        console.error("[editClient] Invalid clientId received:", clientId);
        alert("Error: Could not get a valid Client ID to navigate.");
        return; // Stop execution if ID is bad
    }

    resetInactivityTimer();

    // Construct the URL for ClientView.html with the clientId as a query parameter
    const editUrl = `ClientView.html?clientId=${clientId}`;
    console.log(`[editClient] Constructed URL: ${editUrl}`); // Log 3: Check the final URL

    try
    {
        // Navigate to the Client View page
        window.location.href = editUrl;
        console.log("[editClient] Navigation attempted."); // Log 4: Confirm navigation call
    } catch (e)
    {
        console.error("[editClient] Error during navigation attempt:", e);
        alert("An error occurred while trying to navigate to the client view.");
    }

}

function deleteClient(clientId, clientName)
{
    resetInactivityTimer();

    if (confirm(`Are you sure you want to delete client: ${clientName}? This action cannot be undone.`))
    {
        alert(`Deleting client with ID: ${clientId}`);
        // Add your delete logic here (call Supabase delete)
        // Remember to reset the inactivity timer as this is user interaction

        // After successful deletion, you might want to reload the client list:
        // loadClients();
    } else
    {
        // User cancelled, still counts as activity
        resetInactivityTimer();
    }
}

// --- Logout Function ---
async function handleLogout()
{
    stopInactivityDetection(); // *** ADDED: Stop inactivity detection FIRST ***

    const { error } = await supabase.auth.signOut();
    if (error)
    {
        console.error('Error logging out:', error);
        alert(`Logout failed: ${error.message}`);
        // Optional: Decide if you should restart inactivity detection if logout fails
        // setupInactivityDetection(); // Maybe? Or just let the page potentially reload/error out.
    } else
    {
        console.log('User logged out successfully.');
        // Redirect happens AFTER cleanup and sign out attempt
        window.location.href = 'login.html';
    }
}

// --- Initial Load Trigger ---
document.addEventListener('DOMContentLoaded', checkAuthenticationAndLoadData);

// --- Optional: Cleanup on Page Unload ---
// This helps clear the timer if the user closes the tab/navigates away without logging out.
window.addEventListener('beforeunload', () =>
{
    clearTimeout(inactivityTimerId); // Just clear the timer, don't try removing listeners here.
});