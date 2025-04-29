// --- START OF FILE clientview.js ---

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
// Form fields
const clientNameInput = document.getElementById('clientName');
const contactNameInput = document.getElementById('contactName');
const emailAddressInput = document.getElementById('emailAddress');
const addressTextarea = document.getElementById('address');
const billingCodeInput = document.getElementById('billingCode');
const clientTypeSelect = document.getElementById('clientType');
const ckidNumberInput = document.getElementById('ckidNumber'); // HTML ID can stay camelCase
const vatNumberInput = document.getElementById('vatNumber');   // HTML ID can stay camelCase
const payeNumberInput = document.getElementById('payeNumber');  // HTML ID can stay camelCase
const uifNumberInput = document.getElementById('uifNumber');   // HTML ID can stay camelCase
const sdlNumberInput = document.getElementById('sdlNumber');   // HTML ID can stay camelCase
const taxNumberInput = document.getElementById('taxNumber');
const wcaNumberInput = document.getElementById('wcaNumber');   // HTML ID can stay camelCase
const telNumberInput = document.getElementById('telNumber');
const cellNumberInput = document.getElementById('cellNumber');
const yearEndSelect = document.getElementById('yearEnd');
const clientStatusSelect = document.getElementById('clientStatusId');
const clientForm = document.getElementById('client-form');
const pageTitle = document.querySelector('.client-view-top-section h2');

// Services Checkboxes (will be handled based on the 'Services' varchar column for now)
const servicesContainer = document.querySelector('.client-view-bottom-section table'); // Container for checkboxes

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


// --- 3. Get Client ID from URL ---
function getClientIdFromUrl()
{
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    // *** This log is crucial ***
    console.log("[getClientIdFromUrl] Raw value from URL 'clientId' parameter:", clientId);
    return clientId;
}

// --- 4. Fetch Client Data from Supabase ---
async function fetchClientData(clientId)
{
    if (!clientId)
    {
        console.error("No Client ID provided in URL.");
        pageTitle.textContent = "Error: No Client ID Specified";
        alert("Cannot load client data: No Client ID found in the URL.");
        clientForm.style.display = 'none';
        return null;
    }

    console.log(`Fetching data for client ID: ${clientId}`);
    pageTitle.textContent = `Loading Client ${clientId}...`;

    try
    {
        // *** DEFINITIVELY Corrected Select statement: NO comments inside the string ***
        const selectColumns = `
            Id, ClientName, ContactName, EmailAddress, Address, BillingCode,
            ClientTypeId, CkIdNumber, VatNumber, PayeNumber, UifNumber, SdlNumber,
            TaxNumber, WcaNumber, TelNumber, CellNumber, YearEndId, ClientStatusId,
            Services
        `;
        // Comments belong OUTSIDE the string like this one

        const { data: client, error } = await supabase
            .from('Clients')
            .select(selectColumns) // Pass the clean string here
            .eq('Id', clientId)
            .single();

        if (error)
        {
            console.error('Error fetching client data:', error);
            if (error.code === 'PGRST116')
            { // Code for " volto result contains 0 rows"
                pageTitle.textContent = `Error: Client with ID ${clientId} not found.`;
                alert(`Error: Client with ID ${clientId} not found.`);
            } else
            {
                pageTitle.textContent = `Error loading client ${clientId}`;
                // Provide more specific error from Supabase
                alert(`Error fetching client data: ${error.message} (Code: ${error.code}) Hint: ${error.hint || 'N/A'}`);
            }
            clientForm.style.display = 'none';
            return null;
        }

        if (!client)
        { // Should be caught by PGRST116, but good safety check
            pageTitle.textContent = `Error: Client with ID ${clientId} not found.`;
            alert(`Client with ID ${clientId} could not be found.`);
            clientForm.style.display = 'none';
            return null;
        }

        console.log("Client data fetched:", client);
        // Return the fetched client data (including the Services string)
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


// --- 5. Populate Form Fields ---
function populateForm(clientData)
{
    if (!clientData || !clientData.client)
    {
        console.error("Cannot populate form, client data is missing.");
        return;
    }

    const { client } = clientData;

    console.log("Populating form with data:", client);
    pageTitle.textContent = `Client Information - ${client.ClientName || 'Unnamed Client'} (ID: ${client.Id})`;

    // *** CORRECTED property access to match DB column names / LATEST error hint ***
    clientNameInput.value = client.ClientName || '';
    contactNameInput.value = client.ContactName || '';
    emailAddressInput.value = client.EmailAddress || '';
    addressTextarea.value = client.Address || '';
    billingCodeInput.value = client.BillingCode || '';
    ckidNumberInput.value = client.CkIdNumber || ''; // Use DB name CkIdNumber
    vatNumberInput.value = client.VatNumber || '';   // Use DB name
    payeNumberInput.value = client.PayeNumber || '';  // Use DB name
    uifNumberInput.value = client.UifNumber || '';   // Use DB name
    sdlNumberInput.value = client.SdlNumber || '';   // Use DB name
    taxNumberInput.value = client.TaxNumber || '';
    wcaNumberInput.value = client.WcaNumber || '';   // Use DB name
    telNumberInput.value = client.TelNumber || '';
    cellNumberInput.value = client.CellNumber || '';

    clientTypeSelect.value = client.ClientTypeId || '';
    yearEndSelect.value = client.YearEndId || '';
    clientStatusSelect.value = client.ClientStatusId || '';

    // --- Populate Services Checkboxes based on the varchar 'Services' column ---
    populateServiceCheckboxesFromString(client.Services);

    console.log("Form population complete.");
}

// --- Helper function to Populate Services Checkboxes from String ---
// This assumes the 'Services' column stores service IDs separated by a comma (e.g., "1,5,11")
// Adjust the separator if needed.
function populateServiceCheckboxesFromString(servicesString)
{
    const serviceCheckboxes = servicesContainer.querySelectorAll('.service-checkbox');
    serviceCheckboxes.forEach(checkbox => checkbox.checked = false); // Uncheck all first

    if (!servicesString)
    {
        console.log("No services string found for this client.");
        return; // No services to check
    }

    const selectedServiceIds = servicesString.split(',') // Adjust separator if needed (e.g., ';', ' ')
        .map(idStr => idStr.trim()) // Trim whitespace
        .filter(idStr => idStr !== ''); // Remove empty strings

    console.log("Populating services checkboxes with IDs from string:", selectedServiceIds);

    selectedServiceIds.forEach(serviceIdStr =>
    {
        // Find the checkbox. Assuming ID is "service-{ID}" like "service-5"
        const checkbox = document.getElementById(`service-${serviceIdStr}`);
        if (checkbox)
        {
            checkbox.checked = true;
            console.log(`Checkbox for service ID ${serviceIdStr} checked.`);
        } else
        {
            console.warn(`Checkbox with ID 'service-${serviceIdStr}' not found in HTML.`);
        }
    });
}


// --- 6. Handle Form Submission (Update Logic) ---
clientForm.addEventListener('submit', async (event) =>
{
    event.preventDefault(); // Prevent default browser submission
    resetInactivityTimer(); // User is active

    // --- ADDED CONFIRMATION STEP ---
    // Get client name for the confirmation message (optional but nice)
    const currentClientName = clientNameInput.value.trim() || 'this client';
    if (!confirm(`Are you sure you want to update the details for ${currentClientName}?`))
    {
        console.log("Client update cancelled by user.");
        return; // Stop the function if user clicks Cancel
    }
    // --- END OF CONFIRMATION STEP ---


    // --- Proceed with update if confirmed ---
    const clientId = getClientIdFromUrl();
    if (!clientId)
    {
        alert("Cannot update: Client ID is missing.");
        return;
    }

    console.log(`Updating client ID: ${clientId}`);
    const submitButton = clientForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Updating...';
    submitButton.disabled = true;

    // --- Helper function to get checked service IDs as a string ---
    function getCheckedServicesString()
    {
        const checkedBoxes = servicesContainer.querySelectorAll('.service-checkbox:checked');
        const serviceIds = Array.from(checkedBoxes).map(cb =>
        {
            // Extract ID from checkbox id="service-X"
            return cb.id.split('-')[1];
        });
        return serviceIds.join(','); // Join with comma (adjust separator if needed)
    }

    // 1. Collect data from the form
    const updatedData = {
        ClientName: clientNameInput.value.trim(),
        ContactName: contactNameInput.value.trim(),
        EmailAddress: emailAddressInput.value.trim(),
        Address: addressTextarea.value.trim(),
        BillingCode: billingCodeInput.value.trim(),
        ClientTypeId: parseInt(clientTypeSelect.value) || null,
        CkIdNumber: ckidNumberInput.value.trim(),     // Use DB name CkIdNumber
        VatNumber: vatNumberInput.value.trim(),      // Use DB name
        PayeNumber: payeNumberInput.value.trim(),     // Use DB name
        UifNumber: uifNumberInput.value.trim(),      // Use DB name
        SdlNumber: sdlNumberInput.value.trim(),      // Use DB name
        TaxNumber: taxNumberInput.value.trim(),
        WcaNumber: wcaNumberInput.value.trim(),      // Use DB name
        TelNumber: telNumberInput.value.trim(),
        CellNumber: cellNumberInput.value.trim(),
        YearEndId: parseInt(yearEndSelect.value) || null,
        ClientStatusId: parseInt(clientStatusSelect.value) || null,
        Services: getCheckedServicesString() // Get updated services string
    };

    try
    {
        // 2. Send the update request to Supabase
        const { data, error } = await supabase
            .from('Clients')
            .update(updatedData)
            .eq('Id', clientId)
            .select()
            .single();

        if (error)
        {
            console.error('Error updating client:', error);
            // Provide more specific error from Supabase
            alert(`Error updating client: ${error.message} (Code: ${error.code}) Hint: ${error.hint || 'N/A'}`);
        } else
        {
            console.log('Client updated successfully:', data);
            alert('Client details updated successfully!');
            pageTitle.textContent = `Client Information - ${data.ClientName || 'Unnamed Client'} (ID: ${data.Id})`;
            // Re-populate checkboxes in case DB modified the string (unlikely but good practice)
            populateServiceCheckboxesFromString(data.Services);
        }

    } catch (err)
    {
        console.error('An unexpected error occurred during update:', err);
        alert('An unexpected error occurred while updating. Please check console.');
    } finally
    {
        // Re-enable the button and restore text regardless of success/failure
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    }
});

// --- 7. Cancel Button Logic ---
const cancelButton = clientForm.querySelector('button[type="button"]');
if (cancelButton)
{
    cancelButton.addEventListener('click', () =>
    {
        resetInactivityTimer(); // User interaction
        // Ask for confirmation if changes were made (more advanced)
        // For now, just navigate back to the clients list
        if (confirm("Are you sure you want to cancel? Any unsaved changes will be lost."))
        {
            window.location.href = 'AllClients.html'; // Go back to the list view
        }
    });
}


// --- 8. Authentication Check & Initial Load ---
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
    } else
    {
        console.log("User is authenticated on ClientView. Loading client data...");
        setupInactivityDetection(); // Start inactivity timer

        const clientId = getClientIdFromUrl();
        if (clientId)
        {
            const clientData = await fetchClientData(clientId);
            if (clientData)
            {
                populateForm(clientData);
                // Service checkboxes are now populated within populateForm
            } else
            {
                // Error/Not Found message already shown in fetchClientData
                console.log("Client data could not be fetched or found.");
            }
        } else
        {
            pageTitle.textContent = "Client View - No Client Selected";
            // Corrected typo cumbersome->in below
            alert("No client ID specified in the URL. Please select a client from the list.");
            clientForm.style.display = 'none';
            document.querySelector('.client-view-bottom-section').style.display = 'none'; // Hide services too
        }
    }
}

// --- Trigger Load on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', checkAuthAndLoadClientView);

// --- Optional: Cleanup on Page Unload ---
window.addEventListener('beforeunload', () =>
{
    clearTimeout(inactivityTimerId);
});

// --- END OF FILE clientview.js ---