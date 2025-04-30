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
let prevPageBtn, nextPageBtn, pageInfo, pageSizeSelect;

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
window.navigateToAddClient = navigateToAddClient;

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
    const editUrl = `ClientView.html?clientId=${clientId}`;
    console.log(`[editClient] Navigating to: ${editUrl}`);
    window.location.href = editUrl;
}
window.editClient = editClient;

// Delete Client Function
async function deleteClient(clientId, clientName)
{
    resetInactivityTimer();
    const safeClientName = clientName || `Client ID ${clientId}`;

    if (confirm(`Are you sure you want to delete client: ${safeClientName}? \n\nTHIS ACTION CANNOT BE UNDONE.`))
    {
        console.log(`Attempting to delete client with ID: ${clientId}`);
        const deleteButtons = document.querySelectorAll(`button[onclick^="deleteClient(${clientId},"]`);
        try
        {
            deleteButtons.forEach(btn => { btn.disabled = true; btn.textContent = 'Deleting...'; });

            const { error } = await supabase
                .from('Clients')
                .delete()
                .eq('Id', clientId);

            if (error)
            {
                console.error('Error deleting client:', error);
                alert(`Failed to delete client "${safeClientName}": ${error.message}`);
                deleteButtons.forEach(btn => { btn.disabled = false; btn.textContent = 'Delete'; });
            } else
            {
                console.log(`Client ID: ${clientId} (${safeClientName}) deleted successfully.`);
                alert(`Client "${safeClientName}" deleted successfully.`);
                await loadClients(); // Reload data
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during deletion:', err);
            alert('An unexpected error occurred during deletion. Check console.');
            deleteButtons.forEach(btn => { btn.disabled = false; btn.textContent = 'Delete'; });
        }
    } else
    {
        console.log('Client deletion cancelled by user.');
    }
}
window.deleteClient = deleteClient;


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
    // **** UPDATE COLSPAN to 11 ****
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Loading clients...</td></tr>';

    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    try
    {
        totalClients = await getClientCount();
        const offset = (currentPage - 1) * pageSize;
        const maxRange = offset + pageSize - 1;

        // **** ADD ClientCode to SELECT ****
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
            // **** UPDATE COLSPAN to 11 ****
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
                    return;
                }

                const row = document.createElement('tr');
                const clientTypeName = client.ClientTypes?.Name ?? 'N/A';
                const clientStatusName = client.ClientStatuses?.Name ?? 'N/A';
                const yearEndName = client.YearEnds?.Name ?? 'N/A';
                const clientNameSafe = client.ClientName ?? '';
                const escapedClientName = clientNameSafe.replace(/'/g, "\\'");

                // **** ADD ClientCode CELL ****
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
                        <button class="button" onclick="editClient(${client.Id})">Edit</button>
                        <button class="button" onclick="deleteClient(${client.Id}, '${escapedClientName}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else if (totalClients === 0)
        {
            // **** UPDATE COLSPAN to 11 ****
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No clients found.</td></tr>';
        } else
        {
            // **** UPDATE COLSPAN to 11 ****
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center;">No clients found on this page.</td></tr>`;
            if (currentPage > 1)
            {
                console.log("Current page empty, attempting to go to previous page.");
                currentPage--;
            }
        }
        updatePaginationControls();

    } catch (err)
    {
        console.error('An unexpected error occurred loading clients:', err);
        // **** UPDATE COLSPAN to 11 ****
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

    if (currentPage > displayTotalPages)
    {
        console.log(`Current page ${currentPage} is out of bounds (max ${displayTotalPages}). Resetting to page ${displayTotalPages}.`);
        currentPage = displayTotalPages;
        pageChanged = true;
    } else if (currentPage < 1)
    {
        currentPage = 1;
        pageChanged = true;
    }

    pageInfo.textContent = `Page ${currentPage} of ${displayTotalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= displayTotalPages || totalClients === 0;
    pageSizeSelect.value = pageSize;

    if (pageChanged && !(currentPage === 1 && totalClients === 0))
    {
        console.log("Reloading clients due to page correction.");
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
    pageSize = parseInt(localStorage.getItem('clientListPageSize') || '10');
    pageSizeSelect.value = pageSize;

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
        currentPage = 1;
        loadClients();
    });
}

// --- 4. Initialization ---
async function initializePage()
{
    await loadSidebar();
    const session = await checkAuthAndRedirect();
    if (!session) return;

    // **** UPDATE COLSPAN to 11 ****
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Checking authentication... Done. Loading data...</td></tr>';
    initializePaginationControls();
    await loadClients();
    setupInactivityDetection();
}

// --- 5. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);