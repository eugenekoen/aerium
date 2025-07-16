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

// Function to Fetch and Display Clients with Pagination (Optimized Version)
async function loadClients()
{
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Loading clients...</td></tr>';

    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    try
    {
        const offset = (currentPage - 1) * pageSize;
        const maxRange = offset + pageSize - 1;

        let { data: clients, error, count } = await supabase
            .from('Clients')
            .select(`
                Id, ClientCode, ClientName, ContactName, EmailAddress, TelNumber, CellNumber, BillingCode,
                ClientTypes ( Name ),
                ClientStatuses:ClientStatusId ( Name ),
                YearEnds:YearEndId ( Name )
            `, { count: 'exact' }) // Get the total count of all clients
            .order('ClientName', { ascending: true }) // Your original sorting is preserved
            .range(offset, maxRange); // Get only the clients for the current page

        if (error)
        {
            console.error('Error fetching clients:', error);
            tableBody.innerHTML = `<tr><td colspan="11" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
            updatePaginationControls();
            return;
        }

        totalClients = count ?? 0;


        tableBody.innerHTML = ''; // Clear loading message

        if (clients && clients.length > 0)
        {
            clients.forEach(client =>
            {
                if (client.Id === undefined || client.Id === null)
                {
                    console.warn(`[loadClients] Client found with missing ID:`, client);
                    return; // Skip rendering this row
                }

                const row = document.createElement('tr'); // Create the row element

                // Safely get data, providing fallbacks
                const clientTypeName = client.ClientTypes?.Name ?? 'N/A';
                const clientStatusName = client.ClientStatuses?.Name ?? 'N/A';
                const yearEndName = client.YearEnds?.Name ?? 'N/A';
                const clientNameSafe = client.ClientName ?? '';
                const escapedClientName = encodeURIComponent(clientNameSafe); // For data attribute

                // Client Code Cell
                const clientCodeCell = document.createElement('td');
                clientCodeCell.style.textAlign = 'center'; // Apply style directly
                clientCodeCell.textContent = client.ClientCode ?? '';
                row.appendChild(clientCodeCell);

                // Client Name Cell
                const clientNameCell = document.createElement('td');
                clientNameCell.textContent = clientNameSafe;
                row.appendChild(clientNameCell);

                // Contact Name Cell
                const contactNameCell = document.createElement('td');
                contactNameCell.textContent = client.ContactName ?? '';
                row.appendChild(contactNameCell);

                // Client Type Cell
                const clientTypeCell = document.createElement('td');
                clientTypeCell.textContent = clientTypeName;
                row.appendChild(clientTypeCell);

                // Email Address Cell
                const emailCell = document.createElement('td');
                emailCell.textContent = client.EmailAddress ?? '';
                row.appendChild(emailCell);

                // Tel Number Cell
                const telCell = document.createElement('td');
                telCell.textContent = client.TelNumber ?? '';
                row.appendChild(telCell);

                // Cell Number Cell
                const cellCell = document.createElement('td');
                cellCell.textContent = client.CellNumber ?? '';
                row.appendChild(cellCell);

                // Year End Cell
                const yearEndCell = document.createElement('td');
                yearEndCell.textContent = yearEndName;
                row.appendChild(yearEndCell);

                // Client Status Cell
                const statusCell = document.createElement('td');
                statusCell.textContent = clientStatusName;
                row.appendChild(statusCell);

                // Billing Code Cell
                const billingCodeCell = document.createElement('td');
                billingCodeCell.textContent = client.BillingCode ?? '';
                row.appendChild(billingCodeCell);

                // Actions Cell (Buttons are safe as their content/attributes are controlled)
                const actionsCell = document.createElement('td');
                const editButton = document.createElement('button');
                editButton.className = 'button edit-button';
                editButton.dataset.clientId = client.Id;
                editButton.textContent = 'Edit'; // Button text is safe
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'button delete-button';
                deleteButton.dataset.clientId = client.Id;
                deleteButton.dataset.clientName = escapedClientName; // Data attribute is safe
                deleteButton.textContent = 'Delete'; // Button text is safe
                actionsCell.appendChild(deleteButton);

                row.appendChild(actionsCell);

                tableBody.appendChild(row); // Append the securely built row
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
    pageSizeSelect.value = pageSize;

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