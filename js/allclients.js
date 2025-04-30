// --- 1. Import Shared Functionality ---
import
    {
        supabase,
        checkAuthAndRedirect,
        handleLogout, // Keep if used directly (e.g., explicit logout button not in sidebar)
        setupInactivityDetection,
        stopInactivityDetection, // Keep if needed for specific cleanup
        loadSidebar,
        resetInactivityTimer // Import if needed for specific actions
    } from './shared.js';

// --- 2. Page Specific Variables & DOM References ---
const tableBody = document.getElementById('client-table-body');
let prevPageBtn, nextPageBtn, pageInfo, pageSizeSelect;

// Pagination State
let currentPage = 1;
let pageSize = 10; // Default page size
let totalClients = 0;

// --- 3. Page Specific Functions ---

// Navigate to Add Client View
function navigateToAddClient()
{
    console.log("[navigateToAddClient] Navigating to Client View in add mode.");
    resetInactivityTimer(); // Reset inactivity on user action
    window.location.href = 'ClientView.html?mode=add';
}
window.navigateToAddClient = navigateToAddClient; // Make accessible from HTML onclick

// Edit Client Function
function editClient(clientId)
{
    console.log(`[editClient] Function called with ID: ${clientId}, Type: ${typeof clientId}`);
    if (clientId === undefined || clientId === null || clientId === '')
    {
        console.error("[editClient] Invalid clientId received:", clientId);
        alert("Error: Could not get a valid Client ID to navigate.");
        return;
    }
    resetInactivityTimer(); // Reset inactivity on user action
    const editUrl = `ClientView.html?clientId=${clientId}`;
    console.log(`[editClient] Navigating to: ${editUrl}`);
    window.location.href = editUrl;
}
window.editClient = editClient; // Make accessible from HTML onclick

// Delete Client Function (with Supabase Call)
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
            deleteButtons.forEach(btn => { btn.disabled = true; btn.textContent = 'Deleting...'; }); // Disable button

            const { error } = await supabase
                .from('Clients')
                .delete()
                .eq('Id', clientId);

            if (error)
            {
                console.error('Error deleting client:', error);
                alert(`Failed to delete client "${safeClientName}": ${error.message}`);
                deleteButtons.forEach(btn => { btn.disabled = false; btn.textContent = 'Delete'; }); // Re-enable on error
            } else
            {
                console.log(`Client ID: ${clientId} (${safeClientName}) deleted successfully.`);
                alert(`Client "${safeClientName}" deleted successfully.`);
                // Reload the client list - loadClients() will handle count and pagination update
                await loadClients(); // Reload data which will trigger pagination update
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during deletion:', err);
            alert('An unexpected error occurred during deletion. Check console.');
            deleteButtons.forEach(btn => { btn.disabled = false; btn.textContent = 'Delete'; }); // Re-enable on error
        }
    } else
    {
        console.log('Client deletion cancelled by user.');
    }
}
window.deleteClient = deleteClient; // Make accessible from HTML onclick


// Function to Get Total Count of Clients
async function getClientCount()
{
    try
    {
        // Optimization: Use head: true to only get the count, not the data
        const { count, error } = await supabase
            .from('Clients')
            .select('*', { count: 'exact', head: true });

        if (error)
        {
            console.error('Error fetching client count:', error);
            return 0;
        }
        return count ?? 0;
    } catch (err)
    {
        console.error('Unexpected error getting client count:', err);
        return 0;
    }
}

// Function to Fetch and Display Clients with Pagination
async function loadClients()
{
    if (!tableBody) return; // Guard clause
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Loading clients...</td></tr>';

    // Disable pagination buttons while loading
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    try
    {
        // Get the total count *before* fetching the paginated data
        // Only fetch count if it's the first load or page size changes, otherwise use cached totalClients
        // (Could add more sophisticated caching if needed)
        totalClients = await getClientCount();

        // Calculate offset based on current page and page size
        const offset = (currentPage - 1) * pageSize;
        const maxRange = offset + pageSize - 1;

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
            .range(offset, maxRange);

        if (error)
        {
            console.error('Error fetching clients:', error);
            tableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
            updatePaginationControls(); // Update controls even on error to show correct state
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
                    return; // Skip this iteration
                }

                const row = document.createElement('tr');
                const clientTypeName = client.ClientTypes?.Name ?? 'N/A';
                const clientStatusName = client.ClientStatuses?.Name ?? 'N/A';
                const yearEndName = client.YearEnds?.Name ?? 'N/A';
                const clientNameSafe = client.ClientName ?? '';
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
        } else if (totalClients === 0)
        {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No clients found.</td></tr>';
        }
        else
        {
            // Handle case where current page might be empty (e.g., after deleting last item)
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No clients found on this page.</td></tr>`;
            // Optional: Auto-go to previous page if current page becomes empty and it's not page 1
            if (currentPage > 1)
            {
                console.log("Current page empty, attempting to go to previous page.");
                currentPage--;
                // No need to call loadClients again here, as updatePaginationControls will handle potential reload if page changes
            }
        }

        // Update pagination controls AFTER data is loaded and total count is known
        updatePaginationControls();

    } catch (err)
    {
        console.error('An unexpected error occurred loading clients:', err);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">An unexpected error occurred. Check console.</td></tr>';
        updatePaginationControls(); // Update controls even on error
    }
}

// Update Pagination Controls Based on Current State
function updatePaginationControls()
{
    // Ensure elements are found
    if (!pageInfo || !prevPageBtn || !nextPageBtn || !pageSizeSelect)
    {
        console.warn("Pagination control elements not all found.");
        return;
    }

    const totalPages = pageSize > 0 ? Math.ceil(totalClients / pageSize) : 1;

    // Handle edge case where page size makes total pages 0 (should be 1 min)
    const displayTotalPages = Math.max(totalPages, 1);

    // Correct current page if it's out of bounds (e.g., after deletion reduces total pages)
    let pageChanged = false;
    if (currentPage > displayTotalPages)
    {
        console.log(`Current page ${currentPage} is out of bounds (max ${displayTotalPages}). Resetting to page ${displayTotalPages}.`);
        currentPage = displayTotalPages;
        pageChanged = true;
    } else if (currentPage < 1)
    {
        currentPage = 1; // Should not happen, but safety check
        pageChanged = true;
    }

    pageInfo.textContent = `Page ${currentPage} of ${displayTotalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= displayTotalPages || totalClients === 0;
    pageSizeSelect.value = pageSize; // Ensure select reflects current page size


    // If the page number was corrected, reload the data for the new current page
    // IMPORTANT: Only reload if the page actually *changed* to avoid infinite loops
    // And only if we are not already on page 1 with 0 clients
    if (pageChanged && !(currentPage === 1 && totalClients === 0))
    {
        console.log("Reloading clients due to page correction.");
        // Use setTimeout to avoid potential race conditions or deep recursion if loadClients itself calls updatePaginationControls immediately
        setTimeout(loadClients, 0);
    }
}


// Initialize Pagination Controls Event Listeners
function initializePaginationControls()
{
    prevPageBtn = document.getElementById('prev-page');
    nextPageBtn = document.getElementById('next-page');
    pageInfo = document.getElementById('page-info');
    pageSizeSelect = document.getElementById('page-size');

    if (!prevPageBtn || !nextPageBtn || !pageInfo || !pageSizeSelect)
    {
        console.error("One or more pagination control elements are missing in the HTML.");
        return;
    }

    // Retrieve page size from local storage or use default
    pageSize = parseInt(localStorage.getItem('clientListPageSize') || '10');
    pageSizeSelect.value = pageSize; // Set dropdown to match


    prevPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer(); // Reset inactivity on interaction
        if (currentPage > 1)
        {
            currentPage--;
            loadClients();
        }
    });

    nextPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer(); // Reset inactivity on interaction
        const totalPages = Math.ceil(totalClients / pageSize);
        if (currentPage < totalPages)
        {
            currentPage++;
            loadClients();
        }
    });

    pageSizeSelect.addEventListener('change', () =>
    {
        resetInactivityTimer(); // Reset inactivity on interaction
        pageSize = parseInt(pageSizeSelect.value);
        localStorage.setItem('clientListPageSize', pageSize); // Store preference
        currentPage = 1; // Reset to first page when changing page size
        loadClients();
    });
}

// --- 4. Initialization ---
async function initializePage()
{
    // 1. Load the sidebar
    await loadSidebar();

    // 2. Check authentication
    const session = await checkAuthAndRedirect();
    if (!session) return; // Stop execution if redirected

    // 3. Auth successful, proceed with page setup
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Checking authentication... Done. Loading data...</td></tr>'; // Update status
    initializePaginationControls(); // Setup listeners for buttons/select
    await loadClients(); // Initial data load
    setupInactivityDetection(); // Start monitoring inactivity
}

// --- 5. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);

// Note: The global handleLogout is now imported from shared.js and attached by loadSidebar
// Note: Inactivity detection start/stop is handled by shared.js functions