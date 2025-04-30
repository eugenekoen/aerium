// --- 1. Import Shared Functionality ---
import
{
    supabase,
    checkAuthAndRedirect,
    handleLogout, // Keep for potential direct use if needed
    setupInactivityDetection,
    stopInactivityDetection, // Keep for cleanup if needed
    loadSidebar,
    resetInactivityTimer
} from './shared.js';

// --- 2. DOM Element References ---
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
const pageTitleElement = document.querySelector('.client-view-top-section h2'); // More specific selector
const submitButton = clientForm?.querySelector('button[type="submit"]');
const cancelButton = clientForm?.querySelector('button[type="button"]');

// Notes Section DOM Elements
const notesSectionDiv = document.getElementById('notes-section');
const notesTableBody = document.getElementById('notes-table-body');
const newNoteTextarea = document.getElementById('new-note-content');
const saveNoteButton = document.getElementById('save-note-button');
const noteStatusSpan = document.getElementById('note-status');

// --- 3. Global Variables ---
let currentMode = 'edit'; // Default: 'edit' or 'add'
let currentClientId = null; // Stores the ID of the client being viewed/edited

// --- 4. Page Specific Functions ---

// Get Client ID and Mode from URL
function getUrlParams()
{
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    const mode = urlParams.get('mode');

    currentMode = mode === 'add' ? 'add' : 'edit';
    currentClientId = clientId ? parseInt(clientId) : null; // Store parsed ID or null

    if (currentMode === 'edit' && (currentClientId === null || isNaN(currentClientId)))
    {
        console.error("Invalid or missing Client ID in URL for Edit mode:", clientId);
        return false; // Indicate error
    }
    console.log(`Mode: ${currentMode}, Client ID: ${currentClientId}`);
    return true; // Indicate success
}

// Set Page Title
function setPageTitle(title)
{
    if (pageTitleElement)
    {
        pageTitleElement.textContent = title;
    }
}

// Fetch Client Data from Supabase (Only for Edit Mode)
async function fetchClientData(clientId)
{
    if (!clientId)
    {
        console.error("fetchClientData called without a valid Client ID.");
        setPageTitle("Error: Invalid Client ID");
        return null;
    }
    console.log(`Fetching data for client ID: ${clientId}`);
    setPageTitle(`Loading Client ${clientId}...`);

    try
    {
        const { data: client, error } = await supabase
            .from('Clients')
            .select('*') // Select all columns for simplicity, adjust if needed
            .eq('Id', clientId)
            .maybeSingle(); // Use maybeSingle to handle not found gracefully (returns null, not error)

        if (error)
        {
            console.error('Error fetching client data:', error);
            setPageTitle(`Error loading client ${clientId}`);
            alert(`Error fetching client data: ${error.message}`);
            return null;
        }

        if (!client)
        {
            setPageTitle(`Error: Client with ID ${clientId} not found.`);
            alert(`Client with ID ${clientId} could not be found.`);
            return null;
        }

        console.log("Client data fetched:", client);
        return client; // Return the fetched client data directly

    } catch (err)
    {
        console.error('An unexpected error occurred fetching client data:', err);
        setPageTitle(`Error loading client ${clientId}`);
        alert('An unexpected error occurred while loading client data. Check console.');
        return null;
    }
}

// Populate Form Fields
function populateForm(client)
{
    if (!client)
    {
        console.warn("populateForm called with null client data.");
        clientForm.reset(); // Clear form if no data
        return;
    }
    // setPageTitle(`Client Information - ${client.ClientName || 'Unnamed Client'} (ID: ${client.Id})`); - so only use this when Client Code is set
    setPageTitle(`Client Information - ${client.ClientName || 'Unnamed Client'}`);

    // Use helper function to safely set values
    const setValue = (element, value) => { if (element) element.value = value ?? ''; };

    setValue(clientNameInput, client.ClientName);
    setValue(contactNameInput, client.ContactName);
    setValue(emailAddressInput, client.EmailAddress);
    setValue(addressTextarea, client.Address);
    setValue(billingCodeInput, client.BillingCode);
    setValue(ckidNumberInput, client.CkIdNumber);
    setValue(vatNumberInput, client.VatNumber);
    setValue(payeNumberInput, client.PayeNumber);
    setValue(uifNumberInput, client.UifNumber);
    setValue(sdlNumberInput, client.SdlNumber);
    setValue(taxNumberInput, client.TaxNumber);
    setValue(wcaNumberInput, client.WcaNumber);
    setValue(telNumberInput, client.TelNumber);
    setValue(cellNumberInput, client.CellNumber);
    setValue(clientTypeSelect, client.ClientTypeId);
    setValue(yearEndSelect, client.YearEndId);
    setValue(clientStatusSelect, client.ClientStatusId);

    console.log("Form population complete.");
}

// Handle Form Submission (Add/Update)
async function handleFormSubmit(event)
{
    event.preventDefault();
    resetInactivityTimer();

    if (!submitButton) return;

    const confirmMessage = currentMode === 'add'
        ? "Are you sure you want to add this new client?"
        : `Are you sure you want to update the details for ${clientNameInput?.value?.trim() || 'this client'}?`;

    if (!confirm(confirmMessage))
    {
        console.log(`Client ${currentMode} cancelled by user.`);
        return;
    }

    console.log(`Attempting to ${currentMode} client...`);
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = currentMode === 'add' ? 'Saving...' : 'Updating...';
    submitButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    // Collect data (handle potential null values from selects/inputs)
    const clientDataPayload = {
        ClientName: clientNameInput?.value?.trim() || null,
        ContactName: contactNameInput?.value?.trim() || null,
        EmailAddress: emailAddressInput?.value?.trim() || null,
        Address: addressTextarea?.value?.trim() || null,
        BillingCode: billingCodeInput?.value?.trim() || null,
        ClientTypeId: parseInt(clientTypeSelect?.value) || null,
        CkIdNumber: ckidNumberInput?.value?.trim() || null,
        VatNumber: vatNumberInput?.value?.trim() || null,
        PayeNumber: payeNumberInput?.value?.trim() || null,
        UifNumber: uifNumberInput?.value?.trim() || null,
        SdlNumber: sdlNumberInput?.value?.trim() || null,
        TaxNumber: taxNumberInput?.value?.trim() || null,
        WcaNumber: wcaNumberInput?.value?.trim() || null,
        TelNumber: telNumberInput?.value?.trim() || null,
        CellNumber: cellNumberInput?.value?.trim() || null,
        YearEndId: parseInt(yearEndSelect?.value) || null,
        ClientStatusId: parseInt(clientStatusSelect?.value) || null,
    };

    // Basic validation
    if (!clientDataPayload.ClientName)
    { // Require at least a client name
        alert('Client Name is required.');
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        if (cancelButton) cancelButton.disabled = false;
        return;
    }

    let operationSuccessful = false;

    try
    {
        let data, error;

        if (currentMode === 'add')
        {
            ({ data, error } = await supabase
                .from('Clients')
                .insert([clientDataPayload])
                .select()
                .single());
        } else
        { // 'edit'
            if (!currentClientId) throw new Error("Client ID missing for update.");
            ({ data, error } = await supabase
                .from('Clients')
                .update(clientDataPayload)
                .eq('Id', currentClientId)
                .select()
                .single());
        }

        if (error)
        {
            console.error(`Error ${currentMode === 'add' ? 'adding' : 'updating'} client:`, error);
            alert(`Error: ${error.message}`);
        } else
        {
            console.log(`Client ${currentMode === 'add' ? 'added' : 'updated'} successfully:`, data);
            alert(`Client ${currentMode === 'add' ? 'added' : 'updated'} successfully!`);
            operationSuccessful = true;

            if (currentMode === 'add' && data?.Id)
            {
                // Redirect to edit view for the newly created client
                window.location.href = `ClientView.html?clientId=${data.Id}`;
                return; // Prevent button re-enable before redirect
            } else if (currentMode === 'edit' && data)
            {
                // Re-populate form title in case name changed
                setPageTitle(`Client Information - ${data.ClientName || 'Unnamed Client'} (ID: ${data.Id})`);
                // Optional: Maybe re-fetch and display notes if something relevant changed
                // await loadAndDisplayNotes();
            }
        }
    } catch (err)
    {
        console.error(`An unexpected error occurred during ${currentMode}:`, err);
        alert(`An unexpected error occurred. Please check console.`);
    } finally
    {
        // Re-enable buttons unless redirected
        if (!operationSuccessful || currentMode === 'edit')
        {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
            if (cancelButton) cancelButton.disabled = false;
        }
    }
}

// Cancel Button Logic
function handleCancelClick()
{
    resetInactivityTimer();
    if (confirm("Are you sure you want to cancel? Any unsaved changes will be lost."))
    {
        window.location.href = 'AllClients.html';
    }
}

// --- Notes Section Functions ---

// Fetch notes for the current client
async function fetchNotesForClient()
{
    if (!currentClientId)
    {
        console.error("Cannot fetch notes: Client ID is missing.");
        return { notes: [], userMap: new Map() }; // Return empty data
    }
    console.log(`[fetchNotesForClient] Fetching notes for client ID: ${currentClientId}`);
    if (notesTableBody) notesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading notes...</td></tr>';

    try
    {
        // Fetch notes
        const { data: notes, error: notesError } = await supabase
            .from('Notes')
            .select(`id, note_content, created_at, client_id, created_by`)
            .eq('client_id', currentClientId)
            .order('created_at', { ascending: false });

        if (notesError)
        {
            console.error('[fetchNotesForClient] Fetch ERROR:', notesError);
            throw notesError; // Rethrow to be caught below
        }
        if (!notes)
        {
            return { notes: [], userMap: new Map() }; // No notes found
        }


        // Get unique creator IDs
        const creatorIds = [...new Set(notes.map(note => note.created_by).filter(id => id))];
        const userNamesMap = new Map();

        // Fetch profiles if there are creators
        if (creatorIds.length > 0)
        {
            const { data: profiles, error: profileError } = await supabase
                .from('Profiles')
                .select('id, full_name')
                .in('id', creatorIds);

            if (profileError)
            {
                console.error('[fetchNotesForClient] Error fetching profiles:', profileError);
                // Continue without names, fallbacks will be used
            } else if (profiles)
            {
                profiles.forEach(profile =>
                {
                    userNamesMap.set(profile.id, profile.full_name?.trim() || `User (${profile.id.substring(0, 6)}...)`);
                });
            }
        }
        console.log('[fetchNotesForClient] Fetch SUCCESS. Notes:', notes.length, 'Profiles Mapped:', userNamesMap.size);
        return { notes, userMap: userNamesMap };

    } catch (err)
    {
        console.error('[fetchNotesForClient] Error processing notes:', err);
        if (notesTableBody) notesTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Error loading notes: ${err.message}</td></tr>`;
        return { notes: [], userMap: new Map() }; // Return empty on error
    }
}

// Display notes in the table
async function displayNotes(notes, userMap)
{
    if (!notesTableBody) return;
    notesTableBody.innerHTML = ''; // Clear previous content

    if (!notes || notes.length === 0)
    {
        notesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No notes found for this client.</td></tr>';
        return;
    }

    // Get current user ID for ownership check
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    notes.forEach(note =>
    {
        const row = document.createElement('tr');
        const noteContentSafe = note.note_content ? note.note_content.replace(/'/g, "\\'") : '';
        const notePreview = (note.note_content || '').substring(0, 30) + (note.note_content && note.note_content.length > 30 ? '...' : '');
        const notePreviewSafe = notePreview.replace(/'/g, "\\'");

        const createdAtDate = note.created_at ? new Date(note.created_at) : null;
        const formattedDate = createdAtDate
            ? createdAtDate.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            : 'N/A';

        let authorDisplay = 'Unknown User';
        if (note.created_by)
        {
            authorDisplay = userMap.get(note.created_by) || `User (${note.created_by.substring(0, 6)}...)`;
        }

        const isOwner = currentUserId && note.created_by === currentUserId;
        const deleteButtonHtml = isOwner
            ? `<button class="button" onclick="deleteNoteHandler(${note.id}, '${notePreviewSafe}')">Delete</button>` // Changed onclick function name
            : `<button class="button" disabled title="You can only delete your own notes">Delete</button>`;
        const editButtonHtml = `<button class="button" onclick="editNoteHandler(${note.id})" disabled title="Edit not implemented yet">Edit</button>`; // Changed onclick function name

        row.innerHTML = `
            <td class="tabledate">${formattedDate}</td>
            <td class="table-note" style="white-space: pre-wrap; word-break: break-word;">${note.note_content || ''}</td>
            <td class="table-user">${authorDisplay}</td>
            <td class="table-actions">
                ${editButtonHtml}
                ${deleteButtonHtml}
            </td>
        `;
        notesTableBody.appendChild(row);
    });
    console.log("[displayNotes] Finished rendering notes table.");
}

// Wrapper to load and display notes
async function loadAndDisplayNotes()
{
    if (currentMode === 'edit' && currentClientId)
    {
        const { notes, userMap } = await fetchNotesForClient();
        await displayNotes(notes, userMap);
    }
}


// Save New Note Handler
async function saveNewNoteHandler()
{ // Renamed function
    resetInactivityTimer();
    const noteContent = newNoteTextarea?.value?.trim();

    if (!noteContent)
    {
        alert("Please enter some content for the note.");
        return;
    }
    if (!currentClientId)
    {
        alert("Error: Cannot save note. Client context is missing.");
        return;
    }
    if (!saveNoteButton || !noteStatusSpan || !newNoteTextarea) return;

    saveNoteButton.disabled = true;
    noteStatusSpan.textContent = 'Saving...';
    noteStatusSpan.style.color = 'orange';

    try
    {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Could not get current user to save note.");

        const { error: insertError } = await supabase
            .from('Notes')
            .insert({ client_id: currentClientId, note_content: noteContent, created_by: user.id });

        if (insertError)
        {
            console.error('[saveNewNote] Insert ERROR:', insertError);
            alert(`Failed to save note: ${insertError.message}`);
            noteStatusSpan.textContent = 'Save failed.';
            noteStatusSpan.style.color = 'red';
        } else
        {
            noteStatusSpan.textContent = 'Note saved!';
            noteStatusSpan.style.color = 'green';
            newNoteTextarea.value = ''; // Clear textarea
            await loadAndDisplayNotes(); // Refresh notes list
            setTimeout(() => { if (noteStatusSpan) noteStatusSpan.textContent = ''; }, 3000);
        }
    } catch (err)
    {
        console.error('[saveNewNote] Unexpected error:', err);
        alert('An unexpected error occurred while saving the note.');
        noteStatusSpan.textContent = 'Error.';
        noteStatusSpan.style.color = 'red';
    } finally
    {
        saveNoteButton.disabled = false;
    }
}
// Attach directly if button exists
if (saveNoteButton)
{
    saveNoteButton.onclick = saveNewNoteHandler; // Use onclick or addEventListener
}


// Delete Note Handler
async function deleteNoteHandler(noteId, notePreview)
{ // Renamed function
    resetInactivityTimer();
    if (!currentClientId) return; // Should have client id if notes are visible

    const confirmMessage = `Are you sure you want to delete this note?\n\n"${notePreview}"`;
    if (confirm(confirmMessage))
    {
        const buttonSelector = `button[onclick^="deleteNoteHandler(${noteId},"]`;
        const deleteButton = notesTableBody?.querySelector(buttonSelector);
        if (deleteButton)
        {
            deleteButton.disabled = true;
            deleteButton.textContent = 'Deleting...';
        }

        try
        {
            const { error } = await supabase
                .from('Notes')
                .delete()
                .eq('id', noteId); // RLS policy should enforce ownership

            if (error)
            {
                console.error('Error deleting note:', error);
                alert(`Failed to delete note: ${error.message}`);
            } else
            {
                console.log(`Note ID: ${noteId} deleted successfully.`);
                alert(`Note deleted successfully.`);
                await loadAndDisplayNotes(); // Refresh notes list
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during note deletion:', err);
            alert('An unexpected error occurred during deletion.');
        } finally
        {
            // Re-enable button is tricky as the element might be gone after refresh
            // Generally okay as the list refreshes.
        }
    }
}
window.deleteNoteHandler = deleteNoteHandler; // Make globally accessible for onclick

// Edit Note Handler (Placeholder)
function editNoteHandler(noteId)
{ // Renamed function
    resetInactivityTimer();
    alert(`Editing note ID ${noteId} is not yet implemented.`);
}
window.editNoteHandler = editNoteHandler; // Make globally accessible for onclick


// --- 5. Initialization ---
async function initializePage()
{
    // 1. Load Sidebar
    await loadSidebar();

    // 2. Check Authentication
    const session = await checkAuthAndRedirect();
    if (!session) return; // Stop if redirected

    // 3. Get Mode & Client ID from URL
    if (!getUrlParams())
    {
        // Error handling if URL params are invalid for edit mode
        setPageTitle("Error: Invalid Client ID");
        if (clientForm) clientForm.style.display = 'none';
        if (notesSectionDiv) notesSectionDiv.style.display = 'none';
        return;
    }

    // 4. Setup based on mode
    if (currentMode === 'add')
    {
        setPageTitle("Add New Client");
        if (clientForm) clientForm.reset();
        if (submitButton) submitButton.textContent = 'Save New Client';
        if (clientForm) clientForm.style.display = ''; // Ensure form is visible
        if (notesSectionDiv) notesSectionDiv.style.display = 'none'; // Hide notes for new client
    } else
    { // 'edit' mode
        if (submitButton) submitButton.textContent = 'Update Client';
        const clientData = await fetchClientData(currentClientId);
        if (clientData)
        {
            populateForm(clientData);
            if (clientForm) clientForm.style.display = '';
            if (notesSectionDiv) notesSectionDiv.style.display = ''; // Show notes section
            await loadAndDisplayNotes(); // Load notes for this client
        } else
        {
            // fetchClientData handled errors and messages
            if (clientForm) clientForm.style.display = 'none';
            if (notesSectionDiv) notesSectionDiv.style.display = 'none';
            return; // Stop if client couldn't be loaded
        }
    }

    // 5. Attach Form Handlers
    if (clientForm) clientForm.addEventListener('submit', handleFormSubmit);
    if (cancelButton) cancelButton.addEventListener('click', handleCancelClick);


    // 6. Start Inactivity Detection
    setupInactivityDetection();
}

// --- 6. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);