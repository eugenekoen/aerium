// clientview.js

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
const submitButton = clientForm.querySelector('button[type="submit"]');

// --- Notes Section DOM Elements ---
const notesSectionDiv = document.getElementById('notes-section');
const notesTableBody = document.getElementById('notes-table-body');
const newNoteTextarea = document.getElementById('new-note-content');
const saveNoteButton = document.getElementById('save-note-button');
const noteStatusSpan = document.getElementById('note-status');


// --- Global variables ---
let currentMode = 'edit'; // Default to edit
let currentClientId = null; // Stores the ID of the client being viewed

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
        // Return the fetched client data
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

        // --- Populate main form fields ---
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

        console.log("Form population complete (Edit Mode).");

    } else
    {
        // Add mode: Clear the form
        console.log("Clearing form for Add Mode.");
        pageTitle.textContent = "Add New Client";
        clientForm.reset();
        console.log("Form cleared (Add Mode).");
    }
}


// --- 6. Handle Form Submission (Handles Both Add and Update) ---
clientForm.addEventListener('submit', async (event) =>
{
    event.preventDefault();
    resetInactivityTimer();

    const clientId = currentClientId; // Use the globally stored ID for edit mode
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
    };

    let operationSuccessful = false;
    let resultingData = null;

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
            operationSuccessful = true;
            resultingData = data;

            if (currentMode === 'add' && data?.Id)
            {
                console.log(`Redirecting to edit view for new client ID: ${data.Id}`);
                // Set flag to prevent button re-enable before redirect
                window.location.href = `ClientView.html?clientId=${data.Id}`;
                return; // Exit early to allow redirect
            } else if (currentMode === 'edit' && data)
            {
                // Repopulate form title in case name changed
                pageTitle.textContent = `Client Information - ${data.ClientName || 'Unnamed Client'} (ID: ${data.Id})`;
            }
        }

    } catch (err)
    {
        console.error(`An unexpected error occurred during ${currentMode}:`, err);
        alert(`An unexpected error occurred during ${currentMode}. Please check console.`);
    } finally
    {
        // Re-enable button only if the operation failed OR it was an edit OR add finished without redirect (error)
        if (!operationSuccessful || currentMode === 'edit')
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

// --- 8. Notes Section Functions ---

// Function to fetch notes for a specific client
async function fetchNotesForClient(clientId)
{
    if (!clientId)
    {
        console.error("Cannot fetch notes: Client ID is missing.");
        notesTableBody.innerHTML = '<tr><td colspan="4" style="color: red; text-align: center;">Cannot load notes: Client ID not available.</td></tr>';
        return []; // Return empty array
    }
    console.log(`[fetchNotesForClient] Fetching notes for client ID: ${clientId} (Type: ${typeof clientId})`);
    notesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading notes...</td></tr>';

    try
    {
        // *** MODIFIED SELECT STATEMENT ***
        // Removed the problematic 'author: auth_users(email)' join
        const { data: notes, error } = await supabase
            .from('Notes')
            .select(`
                id,
                note_content,
                created_at,
                client_id,
                created_by
            `) // Fetch created_by UUID instead of joining
            .eq('client_id', clientId)
            .order('created_at', { ascending: false }); // Show newest first

        if (error)
        {
            // Keep existing error handling
            console.error('[fetchNotesForClient] Fetch ERROR:', error);
            // Display a more specific error message if possible
            let errorMsg = `Error loading notes: ${error.message}`;
            if (error.details) errorMsg += ` Details: ${error.details}`;
            if (error.hint) errorMsg += ` Hint: ${error.hint}`;
            notesTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">${errorMsg}</td></tr>`;
            return [];
        } else
        {
            console.log('[fetchNotesForClient] Fetch SUCCESS. Notes received:', JSON.stringify(notes));
            return notes;
        }

    } catch (err)
    {
        // Keep existing catch block
        console.error('[fetchNotesForClient] Unexpected error:', err);
        notesTableBody.innerHTML = '<tr><td colspan="4" style="color: red; text-align: center;">An unexpected error occurred loading notes.</td></tr>';
        return [];
    }
}

// Function to display fetched notes in the table
async function displayNotes(notes)
{
    console.log('[displayNotes] Received notes to display:', JSON.stringify(notes));
    notesTableBody.innerHTML = '';

    if (!notes || notes.length === 0)
    {
        console.log('[displayNotes] No notes array or empty array, displaying "No notes found".');
        notesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No notes found for this client.</td></tr>';
        return;
    }

    let currentUserId = null;
    try
    {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id;
    } catch (e)
    {
        console.error("Could not get current user to check note ownership:", e);
    }

    // *** OPTIONAL: Fetch user emails separately if needed (more complex) ***
    // If you absolutely need emails, you'd collect all unique 'created_by' IDs
    // and make another query to a 'profiles' table or similar.
    // For simplicity now, we'll just display the UUID.

    notes.forEach(note =>
    {
        const row = document.createElement('tr');
        const noteContentSafe = note.note_content ? note.note_content.replace(/'/g, "\\'") : '';
        const notePreview = (note.note_content || '').substring(0, 30) + (note.note_content && note.note_content.length > 30 ? '...' : '');
        const notePreviewSafe = notePreview.replace(/'/g, "\\'");

        const createdAtDate = note.created_at ? new Date(note.created_at) : null;
        const formattedDate = createdAtDate
            ? createdAtDate.toLocaleDateString('en-ZA', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
            })
            : 'N/A';

        // *** MODIFIED AUTHOR DISPLAY ***
        // Display the User ID (UUID) since we don't have the email directly
        let authorDisplay = 'Unknown User';
        if (note.created_by)
        {
            // Show first part of UUID for brevity, or the full ID
            authorDisplay = `User ID: ${note.created_by.substring(0, 8)}...`;
            // authorDisplay = note.created_by; // Uncomment to show full UUID
        }
        // You could enhance this later by fetching emails separately if required

        const isOwner = currentUserId && note.created_by === currentUserId;
        const deleteButtonHtml = isOwner
            ? `<button class="button" onclick="deleteNote(${note.id}, '${notePreviewSafe}')">Delete</button>`
            : `<button class="button" disabled title="You can only delete your own notes">Delete</button>`;
        const editButtonHtml = isOwner
            ? `<button class="button" onclick="editNote(${note.id})" disabled title="Edit not implemented yet">Edit</button>`
            : `<button class="button" disabled title="You can only edit your own notes">Edit</button>`;

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
}

// Function to Save a New Note
async function saveNewNote()
{
    resetInactivityTimer();
    const noteContent = newNoteTextarea.value.trim();

    if (!noteContent)
    {
        alert("Please enter some content for the note.");
        return;
    }

    if (!currentClientId)
    {
        alert("Error: Cannot save note. Client context is missing.");
        console.error("Attempted to save note without a valid currentClientId.");
        return;
    }

    // Disable button and show status
    saveNoteButton.disabled = true;
    noteStatusSpan.textContent = 'Saving...';
    noteStatusSpan.style.color = 'orange';

    try
    {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user)
        {
            throw new Error(userError?.message || "Could not get current user to save note.");
        }

        const newNote = {
            client_id: currentClientId,
            note_content: noteContent,
            created_by: user.id // RLS policy should ensure this matches logged-in user
        };

        console.log('[saveNewNote] Attempting to insert:', JSON.stringify(newNote));

        const { data: insertedNote, error: insertError } = await supabase
            .from('Notes')
            .insert(newNote)
            .select() // Optionally select the newly created note
            .single(); // Expecting a single row back

        if (insertError)
        {
            console.error('[saveNewNote] Insert ERROR:', insertError);
            alert(`Failed to save note: ${insertError.message}`);
            noteStatusSpan.textContent = 'Save failed.';
            noteStatusSpan.style.color = 'red';
        } else
        {
            console.log('[saveNewNote] Insert SUCCESS:', JSON.stringify(insertedNote));
            noteStatusSpan.textContent = 'Note saved!';
            noteStatusSpan.style.color = 'green';
            newNoteTextarea.value = ''; // Clear the textarea

            console.log(`[saveNewNote] Refreshing notes for client ID: ${currentClientId}`);
            const updatedNotes = await fetchNotesForClient(currentClientId);
            await displayNotes(updatedNotes); // await displayNotes as it's now async

            // Clear status message after a few seconds
            setTimeout(() =>
            {
                noteStatusSpan.textContent = '';
            }, 3000);
        }

    } catch (err)
    {
        console.error('[saveNewNote] Unexpected error:', err);
        alert('An unexpected error occurred while saving the note. Check console.');
        noteStatusSpan.textContent = 'Error.';
        noteStatusSpan.style.color = 'red';
    } finally
    {
        // Re-enable button
        saveNoteButton.disabled = false;
    }
}


// Function to Delete a Note
async function deleteNote(noteId, notePreview)
{
    resetInactivityTimer();
    console.log(`Attempting to delete note ID: ${noteId}`);

    const confirmMessage = `Are you sure you want to delete this note?\n\n"${notePreview}"`;

    if (confirm(confirmMessage))
    {
        // Find the specific delete button for this note to disable it
        const buttonSelector = `button[onclick^="deleteNote(${noteId},"]`;
        const deleteButton = notesTableBody.querySelector(buttonSelector);
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
                .eq('id', noteId);
            // RLS policy should enforce ownership check (auth.uid() = created_by)

            if (error)
            {
                console.error('Error deleting note:', error);
                alert(`Failed to delete note: ${error.message}`);
                if (deleteButton)
                { // Re-enable button on error
                    deleteButton.disabled = false;
                    deleteButton.textContent = 'Delete';
                }
            } else
            {
                console.log(`Note ID: ${noteId} deleted successfully.`);
                alert(`Note "${notePreview}" deleted successfully.`);
                // Refresh the notes list efficiently
                console.log(`[deleteNote] Refreshing notes for client ID: ${currentClientId} after deletion.`); // Added log
                const updatedNotes = await fetchNotesForClient(currentClientId);
                await displayNotes(updatedNotes); // await displayNotes as it's now async
            }
        } catch (err)
        {
            console.error('An unexpected error occurred during note deletion:', err);
            alert('An unexpected error occurred during deletion. Check console.');
            if (deleteButton)
            { // Re-enable button on error
                deleteButton.disabled = false;
                deleteButton.textContent = 'Delete';
            }
        }

    } else
    {
        console.log(`Deletion cancelled for note ID: ${noteId}`);
    }
}


// Placeholder for Edit Note Function
function editNote(noteId)
{
    resetInactivityTimer();
    console.log(`Edit Note button clicked for note ID: ${noteId} - Placeholder`);
    alert(`Editing note ID ${noteId} is not yet implemented.`);
    // Future implementation:
    // 1. Fetch the specific note's content.
    // 2. Populate the `newNoteTextarea` (or a modal).
    // 3. Change the "Save Note" button to "Update Note", storing `noteId`.
    // 4. Create an `updateNote(noteId)` async function to call supabase.update().
    // 5. Refresh list on success.
}


// --- 9. Authentication Check & Initial Load ---
async function checkAuthAndLoadClientView()
{
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session)
    {
        console.error("Error getting session or no session:", sessionError);
        pageTitle.textContent = "Authentication Error";
        alert("Could not verify user session. Redirecting to login.");
        stopInactivityDetection();
        window.location.href = 'login.html';
        return;
    }

    console.log("User is authenticated on ClientView.");
    setupInactivityDetection();

    currentMode = getModeFromUrl();
    console.log("Current Mode:", currentMode);

    // Clear potential leftover notes status
    if (noteStatusSpan) noteStatusSpan.textContent = '';

    if (currentMode === 'add')
    {
        pageTitle.textContent = "Add New Client";
        clientForm.reset();
        submitButton.textContent = 'Save New Client';
        clientForm.style.display = '';
        if (notesSectionDiv) notesSectionDiv.style.display = 'none'; // Hide notes section in add mode
        currentClientId = null; // Ensure no client ID is set

    } else
    { // 'edit' mode
        submitButton.textContent = 'Update Client';
        const clientIdFromUrl = getClientIdFromUrl();

        if (clientIdFromUrl)
        {
            const parsedClientId = parseInt(clientIdFromUrl); // Store client ID globally for notes
            if (isNaN(parsedClientId))
            {
                console.error("Invalid Client ID in URL:", clientIdFromUrl);
                pageTitle.textContent = "Error: Invalid Client ID";
                alert("The Client ID in the URL is invalid.");
                clientForm.style.display = 'none';
                if (notesSectionDiv) notesSectionDiv.style.display = 'none';
                currentClientId = null;
                return;
            }
            currentClientId = parsedClientId; // Assign valid ID

            const clientData = await fetchClientData(currentClientId); // Use stored ID
            if (clientData)
            {
                populateForm(clientData); // Populates the main client form
                clientForm.style.display = ''; // Ensure form is visible
                if (notesSectionDiv) notesSectionDiv.style.display = ''; // Show notes section in edit mode

                // Fetch and display notes AFTER client data is loaded
                const notes = await fetchNotesForClient(currentClientId);
                await displayNotes(notes); // await displayNotes as it's now async

            } else
            {
                // fetchClientData already handled alerts/errors and hid form
                console.log("Client data could not be fetched or found for edit.");
                if (notesSectionDiv) notesSectionDiv.style.display = 'none'; // Hide notes if client failed to load
                currentClientId = null; // Reset client ID
            }
        } else
        {
            pageTitle.textContent = "Client View - No Client Selected";
            alert("No client ID specified in the URL for editing.");
            clientForm.style.display = 'none';
            if (notesSectionDiv) notesSectionDiv.style.display = 'none';
            currentClientId = null; // Reset client ID
        }
    }
}


// --- Trigger Load on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', checkAuthAndLoadClientView);

// --- Optional: Cleanup on Page Unload ---
window.addEventListener('beforeunload', () =>
{
    stopInactivityDetection(); // More reliable than just clearing timer
});