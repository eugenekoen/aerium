// js/allclients.js

// --- 1. Import Shared Functionality ---
import
{
    supabase,
    checkAuthAndRedirect,
    // handleLogout, // Handled by sidebar
    setupInactivityDetection,
    // stopInactivityDetection, // Handled by shared.js unload
    loadSidebar,
    resetInactivityTimer
} from './shared.js';

// --- 2. Page Specific Variables & DOM References ---
const tableBody = document.getElementById('client-table-body');
let prevPageBtn, nextPageBtn, pageInfo, pageSizeSelect, addClientBtn; // Added addClientBtn

// Pagination State
let currentPage = 1;
let pageSize = 10;
let totalClients = 0;

// --- 3. Page Specific Functions ---

// Navigate to Add Client View
function navigateToAddClient()
{
    console.log("[navigateToAddClient] Navigating to Client View in add mode.");
    resetInactivityTimer();
    window.location.href = 'ClientView.html?mode=add';
}
// *** REMOVED window.navigateToAddClient = navigateToAddClient; ***

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
    resetInactivityTimer();
    // Convert clientId to number just in case it came from dataset as string
    const id = parseInt(clientId);
    if (isNaN(id))
    {
        console.error("[editClient] Parsed clientId is NaN:", clientId);
        alert("Error: Invalid Client ID format.");
        return;
    }
    const editUrl = `ClientView.html?clientId=${id}`;
    console.log(`[editClient] Navigating to: ${editUrl}`);
    window.location.href = editUrl;
}
// *** REMOVED window.editClient = editClient; ***

// Delete Client Function
async function deleteClient(clientId, clientName)
{
    resetInactivityTimer();
    // Convert clientId to number just in case it came from dataset as string
    const id = parseInt(clientId);
    if (isNaN(id))
    {
        console.error("[deleteClient] Parsed clientId is NaN:", clientId);
        alert("Error: Invalid Client ID format for deletion.");
        return;
    }
    // Use the provided name, fallback if it's somehow missing/undefined
    const safeClientName = clientName || `Client ID ${id}`;

    if (confirm(`Are you sure you want to delete client: ${safeClientName}? \n\nTHIS ACTION CANNOT BE UNDONE.`))
    {
        console.log(`Attempting to delete client with ID: ${id}`);
        // Find button using data attributes now
        const deleteButton = tableBody.querySelector(`button.delete-button[data-client-id="${id}"]`);
        try
        {
            if (deleteButton)
            {
                deleteButton.disabled = true;
                deleteButton.textContent = 'Deleting...';
            } else
            {
                console.warn("Could not find the specific delete button to disable.")
            }

            const { error } = await supabase
                .from('Clients')
                .delete()
                .eq('Id', id); // Use the parsed ID

            if (error)
            {
                console.error('Error deleting client:', error);
                alert(`Failed to delete client "${safeClientName}": ${error.message}`);
                if (deleteButton)
                {
                    deleteButton.disabled = false;
                    deleteButton.textContent = 'Delete';
                }
            } else
            {
                console.log(`Client ID: ${id} (${safeClientName}) deleted successfully.`);
                alert(`Client "${safeClientName}" deleted successfully.`);
                await loadClients(); // Reload data
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during deletion:', err);
            alert('An unexpected error occurred during deletion. Check console.');
            if (deleteButton)
            {
                deleteButton.disabled = false;
                deleteButton.textContent = 'Delete';
            }
        }
    } else
    {
        console.log('Client deletion cancelled by user.');
    }
}
// *** REMOVED window.deleteClient = deleteClient; ***


// Function to Get Total Count of Clients
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
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Loading clients...</td></tr>';

    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    try
    {
        totalClients = await getClientCount();
        const offset = (currentPage - 1) * pageSize;
        const maxRange = offset + pageSize - 1;

        // Fetch data (refined select columns)
        let { data: clients, error } = await supabase
            .from('Clients')
            .select(`
                Id, ClientCode, ClientName, ContactName, EmailAddress, TelNumber, CellNumber, BillingCode,
                ClientTypes ( Name ),
                ClientStatuses:ClientStatusId ( Name ),
                YearEnds:YearEndId ( Name )
            `)
            .order('ClientName', { ascending: true })
            .range(offset, maxRange);

        if (error)
        {
            console.error('Error fetching clients:', error);
            tableBody.innerHTML = `<tr><td colspan="11" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
            updatePaginationControls();
            return;
        }

        tableBody.innerHTML = '';

        if (clients && clients.length > 0)
        {
            clients.forEach(client =>
            {
                if (client.Id === undefined || client.Id === null)
                {
                    console.warn(`[loadClients] Client found with missing ID:`, client);
                    return; // Skip rendering this row
                }

                const row = document.createElement('tr');
                const clientTypeName = client.ClientTypes?.Name ?? '';
                const clientStatusName = client.ClientStatuses?.Name ?? '';
                const yearEndName = client.YearEnds?.Name ?? '';
                const clientNameSafe = client.ClientName ?? '';
                // Escape name for use in data-attribute (though less critical than for JS string in onclick)
                // Using encodeURIComponent is safer for data attributes if names can have quotes/special chars
                const escapedClientName = encodeURIComponent(clientNameSafe);

                // *** MODIFIED: Removed onclick, added data-* attributes and classes ***
                row.innerHTML = `
                    <td style="text-align: center">${client.ClientCode ?? ''}</td>
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
                        <button class="button edit-button" data-client-id="${client.Id}">Edit</button>
                        <button class="button delete-button" data-client-id="${client.Id}" data-client-name="${escapedClientName}">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else if (totalClients === 0)
        {
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No clients found.</td></tr>';
        } else
        {
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center;">No clients found on this page.</td></tr>`;
            if (currentPage > 1)
            {
                console.log("Current page empty, attempting to go to previous page.");
                currentPage--;
                // Consider reloading if page becomes empty after deletion on last page
                setTimeout(loadClients, 0); // Reload to show previous page
            }
        }
        updatePaginationControls();

    } catch (err)
    {
        console.error('An unexpected error occurred loading clients:', err);
        tableBody.innerHTML = '<tr><td colspan="11" style="color: red; text-align: center;">An unexpected error occurred. Check console.</td></tr>';
        updatePaginationControls();
    }
}

// Update Pagination Controls Based on Current State
function updatePaginationControls()
{
    if (!pageInfo || !prevPageBtn || !nextPageBtn || !pageSizeSelect)
    {
        console.warn("Pagination control elements not all found.");
        return;
    }
    const totalPages = pageSize > 0 ? Math.ceil(totalClients / pageSize) : 1;
    const displayTotalPages = Math.max(totalPages, 1);
    let pageChanged = false;

    // Prevent current page from exceeding total pages
    if (currentPage > displayTotalPages)
    {
        currentPage = displayTotalPages;
        pageChanged = true;
    }
    // Prevent current page from being less than 1
    if (currentPage < 1)
    {
        currentPage = 1;
        // No need to set pageChanged=true here, as initial load handles page 1.
    }


    pageInfo.textContent = `Page ${currentPage} of ${displayTotalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= displayTotalPages || totalClients === 0;
    pageSizeSelect.value = pageSize; // Ensure dropdown matches state

    // If page was corrected *and* it wasn't just reset to 1 for an empty table
    if (pageChanged && !(currentPage === 1 && totalClients === 0))
    {
        console.log("Reloading clients due to page correction.");
        // Use setTimeout to avoid potential infinite loops if calculation is wrong
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
    // Load pageSize from localStorage or default
    pageSize = parseInt(localStorage.getItem('clientListPageSize') || '10');
    pageSizeSelect.value = pageSize; // Set dropdown initial value

    prevPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer();
        if (currentPage > 1)
        {
            currentPage--;
            loadClients();
        }
    });
    nextPageBtn.addEventListener('click', () =>
    {
        resetInactivityTimer();
        // Recalculate totalPages here in case totalClients changed
        const totalPages = Math.ceil(totalClients / pageSize);
        if (currentPage < totalPages)
        {
            currentPage++;
            loadClients();
        }
    });
    pageSizeSelect.addEventListener('change', () =>
    {
        resetInactivityTimer();
        pageSize = parseInt(pageSizeSelect.value);
        localStorage.setItem('clientListPageSize', pageSize);
        currentPage = 1; // Reset to page 1 when size changes
        loadClients();
    });
}

// *** NEW FUNCTION: Setup Listeners for Add/Edit/Delete Actions ***
function setupActionListeners()
{
    // Listener for static "Add Client" button
    addClientBtn = document.getElementById('add-client-button');
    if (addClientBtn)
    {
        addClientBtn.addEventListener('click', navigateToAddClient);
    } else
    {
        console.error("Add Client button not found.");
    }

    // Listener for dynamic Edit/Delete buttons (Event Delegation)
    if (tableBody)
    {
        tableBody.addEventListener('click', (event) =>
        {
            const target = event.target; // The element that was actually clicked

            // Check if the clicked element is an Edit button
            if (target.classList.contains('edit-button'))
            {
                resetInactivityTimer(); // Reset on action
                const clientId = target.dataset.clientId; // Get ID from data attribute
                if (clientId)
                {
                    editClient(clientId);
                } else
                {
                    console.error("Edit button clicked, but client ID not found in data attribute.");
                }
            }
            // Check if the clicked element is a Delete button
            else if (target.classList.contains('delete-button'))
            {
                resetInactivityTimer(); // Reset on action
                const clientId = target.dataset.clientId;
                // Decode the name from data attribute
                const encodedClientName = target.dataset.clientName;
                const clientName = encodedClientName ? decodeURIComponent(encodedClientName) : null;

                if (clientId)
                {
                    deleteClient(clientId, clientName); // Pass name too
                } else
                {
                    console.error("Delete button clicked, but client ID not found in data attribute.");
                }
            }
        });
    } else
    {
        console.error("Client table body not found for event delegation.");
    }
}

// --- 4. Initialization ---
async function initializePage()
{
    await loadSidebar();
    const session = await checkAuthAndRedirect();
    if (!session) return;

    if (tableBody) tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Checking authentication... Done. Loading data...</td></tr>';

    initializePaginationControls();
    setupActionListeners(); // *** ADDED CALL to setup listeners ***
    await loadClients(); // Load initial client data
    setupInactivityDetection();
}

// --- 5. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);