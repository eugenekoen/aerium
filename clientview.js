// --- 1. Initialize Supabase Client ---
const SUPABASE_URL = 'https://rezjbpyicdasqlhldwok.supabase.co'; // Same as other files
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlempicHlpY2Rhc3FsaGxkd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTUwNzUsImV4cCI6MjA1NjIzMTA3NX0.o9ZN3Q7-2ijrDrry5XP3SEqOS8PKqoHF-W-LGYmtswg'; // Same as other files

if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
{
    alert("Supabase configuration is missing. Please check clientview.js");
    throw new Error("Supabase URL or Anon Key is missing.");
}

let supabase;
try
{
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized for ClientView page.');
} catch (error)
{
    console.error("Error initializing Supabase client:", error);
    alert("Could not initialize Supabase. Check console for details.");
    throw error;
}

// --- 2. Get DOM Elements ---
const clientNameInput = document.getElementById('clientName');
const contactNameInput = document.getElementById('contactName');
const emailAddressInput = document.getElementById('emailAddress');
const addressTextarea = document.getElementById('address');
const billingCodeInput = document.getElementById('billingCode');
const clientTypeSelect = document.getElementById('clientType');
const ckidNumberInput = document.getElementById('ckidNumber');
const vatNumberInput = document.getElementById('vatNumber');
const payeNumberInput = document.getElementById('payeNumber');
const uifNumberInput = document.getElementById('uifNumber');
const sdlNumberInput = document.getElementById('sdlNumber');
const taxNumberInput = document.getElementById('taxNumber');
const wcaNumberInput = document.getElementById('wcaNumber');
const telNumberInput = document.getElementById('telNumber');
const cellNumberInput = document.getElementById('cellNumber');
const yearEndSelect = document.getElementById('yearEnd');
const clientStatusSelect = document.getElementById('clientStatusId');
const clientForm = document.getElementById('client-form');
const pageTitle = document.querySelector('.client-view-top-section h2');
// *** REMOVED servicesContainer reference ***
const notesTableBody = document.getElementById('notes-table-body'); // *** ADDED reference for notes table body ***
const submitButton = clientForm.querySelector('button[type="submit"]');

// --- Global variable to store current mode ('add' or 'edit') ---
let currentMode = 'edit'; // Default to edit

// --- Inactivity Logout Variables & Functions ---
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
let inactivityTimerId;

function debounce(func, wait)
{
    let timeout;
    return function executedFunction(...args)
    {
        const later = () =>
        {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function logoutDueToInactivity()
{
    console.log("Logging out due to inactivity from ClientView.");
    alert("You have been logged out due to inactivity.");
    handleLogout();
}

function resetInactivityTimer()
{
    // console.log("Activity detected, resetting inactivity timer (ClientView).");
    clearTimeout(inactivityTimerId);
    inactivityTimerId = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT_MS);
}

const debouncedResetTimer = debounce(resetInactivityTimer, 500);

function setupInactivityDetection()
{
    resetInactivityTimer();
    window.addEventListener('mousemove', debouncedResetTimer);
    window.addEventListener('scroll', debouncedResetTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    console.log("Inactivity detection started (ClientView).");
}

function stopInactivityDetection()
{
    clearTimeout(inactivityTimerId);
    window.removeEventListener('mousemove', debouncedResetTimer);
    window.removeEventListener('scroll', debouncedResetTimer);
    window.removeEventListener('mousedown', resetInactivityTimer);
    window.removeEventListener('keypress', resetInactivityTimer);
    window.removeEventListener('touchstart', resetInactivityTimer);
    console.log("Inactivity detection stopped (ClientView).");
}

// --- Logout Function ---
async function handleLogout()
{
    stopInactivityDetection(); // Stop first

    const { error } = await supabase.auth.signOut();
    if (error)
    {
        console.error('Error logging out from ClientView:', error);
        alert(`Logout failed: ${error.message}`);
    } else
    {
        console.log('User logged out successfully from ClientView.');
        window.location.href = 'login.html'; // Redirect to login
    }
}
// Make logout globally accessible for the nav bar link
window.handleLogout = handleLogout;


// --- 3. Get Client ID and Mode from URL ---
function getClientIdFromUrl()
{
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    console.log("[getClientIdFromUrl] Raw value from URL 'clientId' parameter:", clientId);
    return clientId;
}

function getModeFromUrl()
{
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    console.log("[getModeFromUrl] Raw value from URL 'mode' parameter:", mode);
    return mode === 'add' ? 'add' : 'edit';
}

// --- 4. Fetch Client Data from Supabase (Only for Edit Mode) ---
async function fetchClientData(clientId)
{
    if (!clientId)
    {
        console.error("No Client ID provided in URL for fetching.");
        pageTitle.textContent = "Error: No Client ID Specified for Edit";
        alert("Cannot load client data: No Client ID found in the URL for editing.");
        clientForm.style.display = 'none';
        return null;
    }

    console.log(`Fetching data for client ID: ${clientId}`);
    pageTitle.textContent = `Loading Client ${clientId}...`;

    try
    {
        // *** REMOVED 'Services' from the select string ***
        const selectColumns = `
            Id, ClientName, ContactName, EmailAddress, Address, BillingCode,
            ClientTypeId, CkIdNumber, VatNumber, PayeNumber, UifNumber, SdlNumber,
            TaxNumber, WcaNumber, TelNumber, CellNumber, YearEndId, ClientStatusId
        `;

        const { data: client, error } = await supabase
            .from('Clients')
            .select(selectColumns)
            .eq('Id', clientId)
            .single();

        if (error)
        {
            console.error('Error fetching client data:', error);
            if (error.code === 'PGRST116')
            {
                pageTitle.textContent = `Error: Client with ID ${clientId} not found.`;
                alert(`Error: Client with ID ${clientId} not found.`);
            } else
            {
                pageTitle.textContent = `Error loading client ${clientId}`;
                alert(`Error fetching client data: ${error.message} (Code: ${error.code}) Hint: ${error.hint || 'N/A'}`);
            }
            clientForm.style.display = 'none';
            return null;
        }

        if (!client)
        {
            pageTitle.textContent = `Error: Client with ID ${clientId} not found.`;
            alert(`Client with ID ${clientId} could not be found.`);
            clientForm.style.display = 'none';
            return null;
        }

        console.log("Client data fetched:", client);
        // Return the fetched client data (without Services)
        return { client };

    } catch (err)
    {
        console.error('An unexpected error occurred fetching client data:', err);
        pageTitle.textContent = `Error loading client ${clientId}`;
        alert('An unexpected error occurred while loading client data. Check console.');
        clientForm.style.display = 'none';
        return null;
    }
}


// --- 5. Populate Form Fields (Only for Edit Mode, or clear for Add Mode) ---
function populateForm(clientData)
{
    if (clientData && clientData.client)
    {
        const { client } = clientData;
        console.log("Populating form with data:", client);
        pageTitle.textContent = `Client Information - ${client.ClientName || 'Unnamed Client'} (ID: ${client.Id})`;

        // --- Populate main form fields (as before) ---
        clientNameInput.value = client.ClientName || '';
        contactNameInput.value = client.ContactName || '';
        emailAddressInput.value = client.EmailAddress || '';
        addressTextarea.value = client.Address || '';
        billingCodeInput.value = client.BillingCode || '';
        ckidNumberInput.value = client.CkIdNumber || '';
        vatNumberInput.value = client.VatNumber || '';
        payeNumberInput.value = client.PayeNumber || '';
        uifNumberInput.value = client.UifNumber || '';
        sdlNumberInput.value = client.SdlNumber || '';
        taxNumberInput.value = client.TaxNumber || '';
        wcaNumberInput.value = client.WcaNumber || '';
        telNumberInput.value = client.TelNumber || '';
        cellNumberInput.value = client.CellNumber || '';
        clientTypeSelect.value = client.ClientTypeId || '';
        yearEndSelect.value = client.YearEndId || '';
        clientStatusSelect.value = client.ClientStatusId || '';

        // *** REMOVED call to populateServiceCheckboxesFromString ***
        console.log("Form population complete (Edit Mode).");

    } else
    {
        // Add mode: Clear the form
        console.log("Clearing form for Add Mode.");
        pageTitle.textContent = "Add New Client";
        clientForm.reset();
        // *** REMOVED clearing of service checkboxes ***
        console.log("Form cleared (Add Mode).");
    }
}

// *** REMOVED populateServiceCheckboxesFromString function ***

// --- 6. Handle Form Submission (Handles Both Add and Update) ---
clientForm.addEventListener('submit', async (event) =>
{
    event.preventDefault();
    resetInactivityTimer();

    const clientId = getClientIdFromUrl();
    const confirmMessage = currentMode === 'add'
        ? "Are you sure you want to add this new client?"
        : `Are you sure you want to update the details for ${clientNameInput.value.trim() || 'this client'}?`;

    if (!confirm(confirmMessage))
    {
        console.log(`Client ${currentMode} cancelled by user.`);
        return;
    }

    console.log(`Attempting to ${currentMode} client...`);
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = currentMode === 'add' ? 'Saving...' : 'Updating...';
    submitButton.disabled = true;

    // *** REMOVED getCheckedServicesString function and its call ***

    // 1. Collect data from the form
    const clientDataPayload = {
        ClientName: clientNameInput.value.trim(),
        ContactName: contactNameInput.value.trim(),
        EmailAddress: emailAddressInput.value.trim(),
        Address: addressTextarea.value.trim(),
        BillingCode: billingCodeInput.value.trim(),
        ClientTypeId: parseInt(clientTypeSelect.value) || null,
        CkIdNumber: ckidNumberInput.value.trim(),
        VatNumber: vatNumberInput.value.trim(),
        PayeNumber: payeNumberInput.value.trim(),
        UifNumber: uifNumberInput.value.trim(),
        SdlNumber: sdlNumberInput.value.trim(),
        TaxNumber: taxNumberInput.value.trim(),
        WcaNumber: wcaNumberInput.value.trim(),
        TelNumber: telNumberInput.value.trim(),
        CellNumber: cellNumberInput.value.trim(),
        YearEndId: parseInt(yearEndSelect.value) || null,
        ClientStatusId: parseInt(clientStatusSelect.value) || null,
        // *** REMOVED 'Services' property from payload ***
    };

    try
    {
        let data, error;

        // 2. Perform Supabase Operation based on mode
        if (currentMode === 'add')
        {
            const { data: insertData, error: insertError } = await supabase
                .from('Clients')
                .insert([clientDataPayload])
                .select()
                .single();
            data = insertData;
            error = insertError;
        } else
        { // 'edit'
            if (!clientId)
            {
                console.error("Client ID is missing during update attempt in edit mode.");
                throw new Error("Client ID is missing for update operation.");
            }
            const { data: updateData, error: updateError } = await supabase
                .from('Clients')
                .update(clientDataPayload)
                .eq('Id', clientId)
                .select()
                .single();
            data = updateData;
            error = updateError;
        }

        // 3. Handle Result
        if (error)
        {
            console.error(`Error ${currentMode === 'add' ? 'adding' : 'updating'} client:`, error);
            alert(`Error ${currentMode === 'add' ? 'adding' : 'updating'} client: ${error.message} (Code: ${error.code}) Hint: ${error.hint || 'N/A'}`);
        } else
        {
            console.log(`Client ${currentMode === 'add' ? 'added' : 'updated'} successfully:`, data);
            alert(`Client ${currentMode === 'add' ? 'added' : 'updated'} successfully!`);

            if (currentMode === 'add' && data?.Id)
            {
                console.log(`Redirecting to edit view for new client ID: ${data.Id}`);
                window.location.href = `ClientView.html?clientId=${data.Id}`;
                return;
            } else if (currentMode === 'edit' && data)
            {
                // Repopulate form title in case name changed
                pageTitle.textContent = `Client Information - ${data.ClientName || 'Unnamed Client'} (ID: ${data.Id})`;
                // *** REMOVED re-population of checkboxes ***
            }
        }

    } catch (err)
    {
        console.error(`An unexpected error occurred during ${currentMode}:`, err);
        alert(`An unexpected error occurred during ${currentMode}. Please check console.`);
    } finally
    {
        // Re-enable button only if not redirecting after add
        if (!(currentMode === 'add' && data && !error))
        {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    }
});

// --- 7. Cancel Button Logic ---
const cancelButton = clientForm.querySelector('button[type="button"]');
if (cancelButton)
{
    cancelButton.addEventListener('click', () =>
    {
        resetInactivityTimer();
        if (confirm("Are you sure you want to cancel? Any unsaved changes will be lost."))
        {
            window.location.href = 'AllClients.html';
        }
    });
}

// --- *** NEW Notes Section Functions *** ---

// Function to display sample notes (replace with actual data fetching later)
function displaySampleNotes()
{
    if (!notesTableBody)
    {
        console.error("Notes table body not found!");
        return;
    }

    // Sample Data (array of objects)
    const sampleNotes = [
        { id: 1, date: '2024-07-25', content: 'Initial meeting held. Discussed tax requirements.', createdBy: 'John Doe' },
        { id: 2, date: '2024-07-28', content: 'Client provided previous year\'s financial statements.', createdBy: 'Jane Smith' },
        { id: 3, date: '2024-08-01', content: 'Followed up regarding missing PAYE information.', createdBy: 'John Doe' }
    ];

    notesTableBody.innerHTML = ''; // Clear loading message or previous notes

    if (sampleNotes.length === 0)
    {
        notesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No notes found for this client.</td></tr>';
        return;
    }

    sampleNotes.forEach(note =>
    {
        const row = document.createElement('tr');
        // Use sample ID for now in onclick handlers
        row.innerHTML = `
            <td>${note.date || 'N/A'}</td>
            <td>${note.content || ''}</td>
            <td>${note.createdBy || 'N/A'}</td>
            <td>
                <button class="button" onclick="editNote(${note.id})">Edit</button>
                <button class="button" onclick="deleteNote(${note.id}, '${(note.content || '').substring(0, 30).replace(/'/g, "\\'") + '...'}')">Delete</button>
            </td>
        `;
        notesTableBody.appendChild(row);
    });
}

// Placeholder function for adding a note
function addNote()
{
    resetInactivityTimer();
    console.log("Add Note button clicked - Placeholder");
    alert("Add Note functionality not yet implemented.");
    // Later: Open a modal or navigate to a new note form
}

// Placeholder function for editing a note
function editNote(noteId)
{
    resetInactivityTimer();
    console.log(`Edit Note button clicked for note ID: ${noteId} - Placeholder`);
    alert(`Edit Note functionality for ID ${noteId} not yet implemented.`);
    // Later: Open a modal with the note content or navigate to an edit form
}

// Placeholder function for deleting a note
function deleteNote(noteId, notePreview)
{
    resetInactivityTimer();
    console.log(`Delete Note button clicked for note ID: ${noteId} - Placeholder`);
    if (confirm(`Are you sure you want to delete this note?\n\n"${notePreview}"`))
    {
        alert(`Delete Note functionality for ID ${noteId} not yet implemented. \n(If implemented, note would be deleted)`);
        // Later: Call Supabase to delete the note and refresh the list
        // For now, we could remove the row from the sample display:
        // const rowToDelete = notesTableBody.querySelector(`button[onclick^="deleteNote(${noteId},"]`).closest('tr');
        // if (rowToDelete) rowToDelete.remove();
        // displaySampleNotes(); // Or just refresh the sample data display
    } else
    {
        console.log(`Deletion cancelled for note ID: ${noteId}`);
    }
}

// --- END NEW Notes Section Functions ---


// --- 8. Authentication Check & Initial Load (Modified for Mode Handling) ---
async function checkAuthAndLoadClientView()
{
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError)
    {
        console.error("Error getting session:", sessionError);
        pageTitle.textContent = "Error Checking Authentication";
        alert("Could not verify user session. Please try logging in again.");
        stopInactivityDetection();
        window.location.href = 'login.html';
        return;
    }

    if (!session)
    {
        console.log("No active session found on ClientView. Redirecting to login.");
        stopInactivityDetection();
        window.location.href = 'login.html';
        return;
    }

    console.log("User is authenticated on ClientView.");
    setupInactivityDetection();

    currentMode = getModeFromUrl();
    console.log("Current Mode:", currentMode);

    if (currentMode === 'add')
    {
        populateForm(null); // Clear the form
        submitButton.textContent = 'Save New Client';
        clientForm.style.display = '';
        document.querySelector('.client-view-bottom-section').style.display = ''; // Ensure bottom section is visible

    } else
    { // 'edit'
        submitButton.textContent = 'Update Client';
        const clientId = getClientIdFromUrl();
        if (clientId)
        {
            const clientData = await fetchClientData(clientId);
            if (clientData)
            {
                populateForm(clientData);
            } else
            {
                // Keep button text as 'Update Client' but form might be hidden by fetch error
                console.log("Client data could not be fetched or found for edit.");
                // Hide notes section if client load failed
                document.querySelector('.client-view-bottom-section').style.display = 'none';
            }
        } else
        {
            pageTitle.textContent = "Client View - No Client Selected for Edit";
            alert("No client ID specified in the URL for editing. Please select a client from the list.");
            clientForm.style.display = 'none';
            document.querySelector('.client-view-bottom-section').style.display = 'none';
        }
    }

    // --- Display notes regardless of mode (as long as the bottom section is visible) ---
    // Check if the bottom section is displayed before trying to load notes
    if (document.querySelector('.client-view-bottom-section').style.display !== 'none')
    {
        displaySampleNotes(); // *** ADDED call to display sample notes ***
    }
}

// --- Trigger Load on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', checkAuthAndLoadClientView);

// --- Optional: Cleanup on Page Unload ---
window.addEventListener('beforeunload', () =>
{
    clearTimeout(inactivityTimerId);
});