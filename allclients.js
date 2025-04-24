// allclients.js

// --- 1. Initialize Supabase Client ---
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://rezjbpyicdasqlhldwok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlempicHlpY2Rhc3FsaGxkd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTUwNzUsImV4cCI6MjA1NjIzMTA3NX0.o9ZN3Q7-2ijrDrry5XP3SEqOS8PKqoHF-W-LGYmtswg';

// Basic check
if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
{
    alert("Supabase configuration is missing. Please check allclients.js");
    throw new Error("Supabase URL or Anon Key is missing.");
}

let supabase;
try
{
    // --- FIX IS HERE ---
    // 1. Access the createClient function from the GLOBAL supabase object (provided by CDN)
    const { createClient } = window.supabase; // Or often just 'supabase' works if window scope is implicit

    // 2. Use that function to initialize your LOCAL supabase variable
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // --- END OF FIX ---
    console.log('Supabase client initialized for AllClients page.');
} catch (error)
{
    console.error("Error initializing Supabase client:", error);
    alert("Could not initialize Supabase. Check console for details.");
    throw error;
}

// --- 2. Get Reference to the Table Body ---
const tableBody = document.getElementById('client-table-body');
if (!tableBody)
{
    console.error("Could not find element with ID 'client-table-body'");
    throw new Error("Table body element not found.");
}

// --- NEW: Function to check authentication ---
async function checkAuthenticationAndLoadData()
{
    // Show loading message immediately
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Checking authentication...</td></tr>';

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError)
    {
        console.error("Error getting session:", sessionError);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">Error checking authentication.</td></tr>';
        // Optionally redirect to login or show an error message
        // window.location.href = 'login.html';
        return;
    }

    if (!session)
    {
        // No active session, redirect to login page
        console.log("No active session found. Redirecting to login.");
        window.location.href = 'login.html';
    } else
    {
        // User is logged in, proceed to load client data
        console.log("User is authenticated. Loading client data...");
        loadClients(); // Call the original function to fetch data
    }
}


// --- 3. Function to Fetch and Display Clients (Keep this function as it was) ---
async function loadClients()
{
    // Clear auth message and show loading indicator
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Loading clients...</td></tr>';

    try
    {
        // Fetch data from 'Clients' and related tables
        let { data: Clients, error } = await supabase
            .from('Clients')
            .select(`
                Id,
                ClientName,
                ContactName,
                EmailAddress,
                TelNumber,
                CellNumber,
                BillingCode,
                ClientTypes ( Name ),
                ClientStatuses ( Name ),
                YearEnds ( Name )
            `)
            .order('ClientName', { ascending: true });

        // IMPORTANT: Now that the request is made by an authenticated user,
        // Supabase will apply the RLS policy: "Allow full access for authenticated users".
        // If this policy exists and is correct, the request should succeed.

        if (error)
        {
            console.error('Error fetching clients:', error);
            // Check the error message. If it mentions RLS violation or permission denied,
            // double-check your policies for 'Clients' AND the related tables
            // ('ClientTypes', 'ClientStatuses', 'YearEnds'). Authenticated users
            // need SELECT permission on ALL these tables for the query to work.
            tableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error loading clients: ${error.message}</td></tr>`;
            return;
        }

        // Clear loading message
        tableBody.innerHTML = '';

        if (clients && clients.length > 0)
        {
            clients.forEach(client =>
            {
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
                        <button onclick="editClient(${client.Id})">Edit</button>
                        <button onclick="deleteClient(${client.Id}, '${client.ClientName}')">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else
        {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No clients found.</td></tr>';
        }

    } catch (err)
    {
        console.error('An unexpected error occurred:', err);
        tableBody.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">An unexpected error occurred. Check console.</td></tr>';
    }
}

// --- 4. Placeholder functions for Edit/Delete (Keep as is) ---
function editClient(clientId) { /* ... */ }
function deleteClient(clientId, clientName) { /* ... */ }

// --- NEW: Function for Logout ---
async function handleLogout()
{
    const { error } = await supabase.auth.signOut();
    if (error)
    {
        console.error('Error logging out:', error);
        alert(`Logout failed: ${error.message}`);
    } else
    {
        console.log('User logged out successfully.');
        // Redirect to login page after logout
        window.location.href = 'login.html';
    }
}


// --- 5. Call the authentication check when the page loads ---
// Use DOMContentLoaded to ensure the HTML is fully parsed
// Replace the direct call to loadClients() with the auth check
document.addEventListener('DOMContentLoaded', checkAuthenticationAndLoadData);