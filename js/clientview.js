// File Name: js/clientview.js

// --- 1. Import Shared Functionality ---
import
{
    supabase,
    checkAuthAndRedirect,
    setupInactivityDetection,
    loadSidebar,
    resetInactivityTimer
} from './shared.js';

// --- 2. Global Variables ---
let currentMode = 'edit';
let currentClientId = null;
let clientNotes = [];
let unsavedChanges = new Set(); // Track which fields have unsaved changes
let autosaveInterval = null;
let searchTimeout = null;
let originalFormData = {}; // Store original form data for comparison

// Track whether inactive tasks are showing
let showingInactive = false;

// --- 3. DOM Element References ---
// Client Details Section DOM Elements
const clientForm = document.getElementById('client-form');
const saveStatus = document.getElementById('save-status');
const clientHeaderName = document.getElementById('client-header-name');
const clientHeaderSubtitle = document.getElementById('client-header-subtitle');
const clientStatusBadge = document.getElementById('client-status-badge');

// Search Elements
const clientSearchInput = document.getElementById('client-search-input');
const searchResultsDropdown = document.getElementById('search-results-dropdown');

// Tab Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');

// Notes Elements
const newNoteTextarea = document.getElementById('new-note-content');
const saveNoteButton = document.getElementById('save-note-button');
const noteStatusSpan = document.getElementById('note-status');
const notesContainer = document.getElementById('notes-container');

// Modal Elements
const editNoteModal = document.getElementById('edit-note-modal');
const editNoteTextarea = document.getElementById('edit-note-textarea');
const editingNoteIdInput = document.getElementById('editing-note-id');
const saveEditedNoteButton = document.getElementById('save-edited-note-button');
const editNoteStatusSpan = document.getElementById('edit-note-status');

// Additional Contacts Elements
const addContactBtn = document.getElementById('add-contact-btn');
const addContactModal = document.getElementById('add-contact-modal');
const contactsTableBody = document.getElementById('contacts-table-body');

// Loading
const loadingOverlay = document.getElementById('loading-overlay');

// --- 4. Utility Functions ---
function showLoading()
{
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading()
{
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function updateSaveStatus(status, message)
{
    if (!saveStatus) return;

    saveStatus.className = `save-status ${status}`;
    saveStatus.style.display = 'flex';

    const icon = saveStatus.querySelector('.save-icon');
    const text = saveStatus.querySelector('.save-text');

    if (icon && text)
    {
        switch (status)
        {
            case 'saving':
                icon.className = 'fas fa-spinner fa-spin save-icon';
                text.textContent = message || 'Saving changes...';
                break;
            case 'saved':
                icon.className = 'fas fa-check save-icon';
                text.textContent = message || 'All changes saved';
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-triangle save-icon';
                text.textContent = message || 'Error saving changes';
                break;
            default:
                saveStatus.style.display = 'none';
        }
    }

    if (status === 'saved')
    {
        setTimeout(() =>
        {
            if (unsavedChanges.size === 0)
            {
                saveStatus.style.display = 'none';
            }
        }, 3000);
    }
}

// --- 5. Tab Management ---
function initializeTabs()
{
    tabButtons.forEach(button =>
    {
        button.addEventListener('click', () =>
        {
            const tabId = button.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId)
{
    // Update buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeButton) activeButton.classList.add('active');

    // Update panes
    tabPanes.forEach(pane => pane.classList.remove('active'));
    const activePane = document.getElementById(`${tabId}-tab`);
    if (activePane) activePane.classList.add('active');

    // Load tab-specific content
    loadTabContent(tabId);
}

async function loadTabContent(tabId)
{
    switch (tabId)
    {
        case 'notes':
            if (currentMode === 'edit' && currentClientId)
            {
                await loadAndDisplayNotes();
            }
            break;
        case 'tasks':
            if (currentMode === 'edit' && currentClientId)
            {
                loadTasks();
            }
            break;
        case 'details':
            // Already loaded
            break;
        // Add other tab loading logic here
    }
}

// --- 6. Client Search Functionality ---
function initializeClientSearch()
{
    if (!clientSearchInput) return;

    clientSearchInput.addEventListener('input', handleSearchInput);
    clientSearchInput.addEventListener('focus', handleSearchFocus);
    document.addEventListener('click', handleSearchClickOutside);
}

function handleSearchInput(event)
{
    const query = event.target.value.trim();

    // Clear previous timeout
    if (searchTimeout)
    {
        clearTimeout(searchTimeout);
    }

    // Hide dropdown if query is too short
    if (query.length < 2)
    {
        hideSearchResults();
        return;
    }

    // Debounce search
    searchTimeout = setTimeout(() =>
    {
        performClientSearch(query);
    }, 300);
}

function handleSearchFocus()
{
    const query = clientSearchInput.value.trim();
    if (query.length >= 2)
    {
        performClientSearch(query);
    }
}

function handleSearchClickOutside(event)
{
    if (!event.target.closest('.search-input-container'))
    {
        hideSearchResults();
    }
}

async function performClientSearch(query)
{
    try
    {
        const { data: clients, error } = await supabase
            .from('Clients')
            .select('Id, client_name, ClientCode, EmailAddress')
            .or(`client_name.ilike.%${query}%,ClientCode.ilike.%${query}%,EmailAddress.ilike.%${query}%`)
            .limit(10);

        if (error)
        {
            console.error('Search error:', error);
            return;
        }

        displaySearchResults(clients || []);
    } catch (err)
    {
        console.error('Search error:', err);
    }
}

function displaySearchResults(clients)
{
    if (!searchResultsDropdown) return;

    searchResultsDropdown.innerHTML = '';

    if (clients.length === 0)
    {
        searchResultsDropdown.innerHTML = '<div class="search-result-item">No clients found</div>';
    } else
    {
        clients.forEach(client =>
        {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-name">${client.client_name}</div>
                <div class="search-result-details">
                    ${client.ClientCode ? `Code: ${client.ClientCode}` : ''}
                    ${client.EmailAddress ? ` • ${client.EmailAddress}` : ''}
                </div>
            `;

            item.addEventListener('click', () =>
            {
                navigateToClient(client.Id);
            });

            searchResultsDropdown.appendChild(item);
        });
    }

    searchResultsDropdown.style.display = 'block';
}

function hideSearchResults()
{
    if (searchResultsDropdown)
    {
        searchResultsDropdown.style.display = 'none';
    }
}

function navigateToClient(clientId)
{
    if (clientId !== currentClientId)
    {
        if (unsavedChanges.size > 0)
        {
            if (confirm('You have unsaved changes. Do you want to leave without saving?'))
            {
                window.location.href = `ClientView.html?clientId=${clientId}`;
            }
        } else
        {
            window.location.href = `ClientView.html?clientId=${clientId}`;
        }
    }
    hideSearchResults();
    clientSearchInput.value = '';
}

// --- 7. Autosave Functionality ---
function initializeAutosave()
{
    // Track form field changes
    const formElements = clientForm.querySelectorAll('input, select, textarea');

    formElements.forEach(element =>
    {
        // Store original values
        originalFormData[element.name] = element.value;

        // Add change listeners
        element.addEventListener('input', () => handleFieldChange(element));
        element.addEventListener('change', () => handleFieldChange(element));
    });

    // Start autosave interval (every 30 seconds)
    autosaveInterval = setInterval(performAutosave, 30000);
}

function handleFieldChange(element)
{
    const fieldName = element.name;
    const currentValue = element.value;
    const originalValue = originalFormData[fieldName] || '';

    const formGroup = element.closest('.form-group');

    if (currentValue !== originalValue)
    {
        // Mark as unsaved
        unsavedChanges.add(fieldName);
        if (formGroup) formGroup.classList.add('unsaved');
    } else
    {
        // Mark as saved
        unsavedChanges.delete(fieldName);
        if (formGroup) formGroup.classList.remove('unsaved');
    }

    // Update save status
    if (unsavedChanges.size > 0)
    {
        updateSaveStatus('', `${unsavedChanges.size} unsaved change${unsavedChanges.size > 1 ? 's' : ''}`);
    } else
    {
        updateSaveStatus('saved');
    }
}

async function performAutosave()
{
    if (unsavedChanges.size === 0 || !currentClientId) return;

    updateSaveStatus('saving');

    try
    {
        const formData = new FormData(clientForm);
        const clientData = {};

        // Only include changed fields
        for (const fieldName of unsavedChanges)
        {
            const value = formData.get(fieldName);
            clientData[fieldName] = value ? value.trim() : null;

            // Handle numeric fields
            if (['ClientTypeId', 'YearEndId', 'ClientStatusId'].includes(fieldName))
            {
                clientData[fieldName] = value ? parseInt(value) : null;
            }
        }

        const { error } = await supabase
            .from('Clients')
            .update(clientData)
            .eq('Id', currentClientId);

        if (error)
        {
            throw error;
        }

        // Update original data and clear unsaved changes
        unsavedChanges.forEach(fieldName =>
        {
            originalFormData[fieldName] = formData.get(fieldName) || '';
            const element = clientForm.querySelector(`[name="${fieldName}"]`);
            if (element)
            {
                const formGroup = element.closest('.form-group');
                if (formGroup) formGroup.classList.remove('unsaved');
            }
        });

        unsavedChanges.clear();
        updateSaveStatus('saved');

    } catch (error)
    {
        console.error('Autosave error:', error);
        updateSaveStatus('error', 'Failed to save changes');
    }
}

// --- 8. Client Data Management ---
function getUrlParams()
{
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    const mode = urlParams.get('mode');

    currentMode = mode === 'add' ? 'add' : 'edit';
    currentClientId = clientId ? parseInt(clientId) : null;

    if (currentMode === 'edit' && (currentClientId === null || isNaN(currentClientId)))
    {
        console.error("Invalid or missing Client ID in URL for Edit mode:", clientId);
        return false;
    }

    return true;
}

async function fetchClientData(clientId)
{
    if (!clientId) return null;

    showLoading();

    try
    {
        const { data: client, error } = await supabase
            .from('Clients')
            .select(`
                Id, client_name, ContactName, EmailAddress, Address, BillingCode, ClientCode,
                ClientTypeId, CkIdNumber, VatNumber, PayeNumber, UifNumber, SdlNumber,
                TaxNumber, WcaNumber, TelNumber, CellNumber, YearEndId, ClientStatusId
            `)
            .eq('Id', clientId)
            .maybeSingle();

        if (error) throw error;
        if (!client) throw new Error(`Client with ID ${clientId} not found`);

        return client;
    } catch (error)
    {
        console.error('Error fetching client data:', error);
        updateClientHeader('Error', `Failed to load client: ${error.message}`);
        return null;
    } finally
    {
        hideLoading();
    }
}

function populateForm(client)
{
    if (!client) return;

    // Update header
    updateClientHeader(client.client_name + " (" + client.ClientCode + ")");

    // Populate form fields
    Object.keys(client).forEach(key =>
    {
        const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
        if (element)
        {
            element.value = client[key] || '';
            originalFormData[element.name] = element.value;
        }
    });

    // Clear any unsaved indicators
    unsavedChanges.clear();
    document.querySelectorAll('.form-group.unsaved').forEach(group =>
    {
        group.classList.remove('unsaved');
    });
}

function updateClientHeader(name, subtitle = '')
{
    if (clientHeaderName) clientHeaderName.textContent = name;
    if (clientHeaderSubtitle) clientHeaderSubtitle.textContent = subtitle;

    // Update page title
    document.title = `${name} - Client View`;
}

// --- 9. Manual Save Handler ---
async function handleFormSubmit(event)
{
    event.preventDefault();
    resetInactivityTimer();

    if (!currentClientId) return;

    updateSaveStatus('saving');

    try
    {
        const formData = new FormData(clientForm);
        const clientData = {};

        // Build complete client data object
        for (const [key, value] of formData.entries())
        {
            clientData[key] = value ? value.trim() : null;

            // Handle numeric fields
            if (['ClientTypeId', 'YearEndId', 'ClientStatusId'].includes(key))
            {
                clientData[key] = value ? parseInt(value) : null;
            }
        }

        const { data, error } = await supabase
            .from('Clients')
            .update(clientData)
            .eq('Id', currentClientId)
            .select()
            .single();

        if (error) throw error;

        // Update original data and clear unsaved changes
        Object.keys(clientData).forEach(key =>
        {
            originalFormData[key] = clientData[key] || '';
        });

        unsavedChanges.clear();
        document.querySelectorAll('.form-group.unsaved').forEach(group =>
        {
            group.classList.remove('unsaved');
        });

        updateSaveStatus('saved');

        // Update header with new data
        if (data)
        {
            updateClientHeader(data.client_name, data.ClientCode ? `Code: ${data.ClientCode}` : '');
        }

    } catch (error)
    {
        console.error('Save error:', error);
        updateSaveStatus('error', `Save failed: ${error.message}`);
    }
}

// --- 10. Notes Functionality ---
async function loadAndDisplayNotes()
{
    if (!currentClientId) return;

    try
    {
        const { data: notes, error } = await supabase
            .from('Notes')
            .select(`id, note_content, created_at, client_id, created_by`)
            .eq('client_id', currentClientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        clientNotes = notes || [];

        // Get user names for note creators
        const creatorIds = [...new Set(notes?.map(note => note.created_by).filter(id => id))];
        const userNamesMap = new Map();

        if (creatorIds.length > 0)
        {
            const { data: profiles } = await supabase
                .from('Profiles')
                .select('id, full_name')
                .in('id', creatorIds);

            if (profiles)
            {
                profiles.forEach(profile =>
                {
                    userNamesMap.set(profile.id, profile.full_name?.trim() || `User (${profile.id.substring(0, 6)}...)`);
                });
            }
        }

        displayNotes(notes || [], userNamesMap);

    } catch (error)
    {
        console.error('Error loading notes:', error);
        if (notesContainer)
        {
            notesContainer.innerHTML = `<div class="empty-state text-danger">Error loading notes: ${error.message}</div>`;
        }
    }
}

function displayNotes(notes, userMap)
{
    if (!notesContainer) return;

    if (notes.length === 0)
    {
        notesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-sticky-note"></i>
                </div>
                <h3>No notes yet</h3>
                <p>Add notes to keep track of important information about this client.</p>
            </div>
        `;
        return;
    }

    notesContainer.innerHTML = '';

    notes.forEach(note =>
    {
        const noteElement = createNoteElement(note, userMap);
        notesContainer.appendChild(noteElement);
    });
}

function createNoteElement(note, userMap)
{
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note-item';

    const createdAt = note.created_at ? new Date(note.created_at) : null;
    const dateString = createdAt ? createdAt.toLocaleDateString('en-ZA', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
    }) : 'N/A';

    const authorName = note.created_by ?
        (userMap.get(note.created_by) || `User (${note.created_by.substring(0, 6)}...)`) :
        'Unknown User';

    // --- Start of programmatic element creation ---
    const noteHeader = document.createElement('div');
    noteHeader.className = 'note-header';

    const noteMeta = document.createElement('div');
    noteMeta.className = 'note-meta';
    noteMeta.innerHTML = `<i class="fas fa-user"></i> ${authorName} • <i class="fas fa-calendar"></i> ${dateString}`; // Icons are safe static HTML

    const noteActions = document.createElement('div');
    noteActions.className = 'note-actions-buttons';

    const editButton = document.createElement('button');
    editButton.className = 'btn btn-small btn-edit';
    editButton.innerHTML = `<i class="fas fa-edit"></i> Edit`;
    editButton.addEventListener('click', () => openEditNoteModal(note.id));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-small btn-delete';
    deleteButton.innerHTML = `<i class="fas fa-trash"></i> Delete`;
    const preview = (note.note_content || '').substring(0, 30).replace(/'/g, "\\'");
    deleteButton.addEventListener('click', () => deleteNote(note.id, preview));

    noteActions.append(editButton, deleteButton);
    noteHeader.append(noteMeta, noteActions);

    const noteContent = document.createElement('div');
    noteContent.className = 'note-content';
    noteContent.textContent = note.note_content || ''; // <-- The critical fix: using .textContent

    noteDiv.append(noteHeader, noteContent);
    // --- End of programmatic element creation ---

    return noteDiv;
}


async function saveNewNote()
{
    const content = newNoteTextarea?.value?.trim();
    if (!content || !currentClientId) return;

    if (saveNoteButton) saveNoteButton.disabled = true;
    if (noteStatusSpan)
    {
        noteStatusSpan.textContent = 'Saving...';
        noteStatusSpan.className = 'text-warning';
    }

    try
    {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const { error } = await supabase.from('Notes').insert({
            client_id: currentClientId,
            note_content: content,
            created_by: user.id
        });

        if (error) throw error;

        if (newNoteTextarea) newNoteTextarea.value = '';
        if (noteStatusSpan)
        {
            noteStatusSpan.textContent = 'Note saved!';
            noteStatusSpan.className = 'text-success';
        }

        await loadAndDisplayNotes();

        setTimeout(() =>
        {
            if (noteStatusSpan) noteStatusSpan.textContent = '';
        }, 3000);

    } catch (error)
    {
        console.error('Save note error:', error);
        if (noteStatusSpan)
        {
            noteStatusSpan.textContent = `Error: ${error.message}`;
            noteStatusSpan.className = 'text-danger';
        }
    } finally
    {
        if (saveNoteButton) saveNoteButton.disabled = false;
    }
}

// --- 11. Tasks Functionality ---
function toggleInactiveTasks()
{
    const inactiveTasks = document.querySelectorAll('.inactive-task');
    const toggleBtn = document.getElementById('toggleInactiveBtn');

    showingInactive = !showingInactive;

    if (showingInactive)
    {
        // Show inactive tasks
        inactiveTasks.forEach(task =>
        {
            task.classList.remove('hidden');
        });
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Inactive';
        toggleBtn.classList.add('active');
    } else
    {
        // Hide inactive tasks
        inactiveTasks.forEach(task =>
        {
            task.classList.add('hidden');
        });
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Show Inactive';
        toggleBtn.classList.remove('active');
    }
}

function loadTasks()
{
    console.log('Loading tasks for client:', currentClientId);
    // Implementation would load tasks from Supabase here
    // For now, this is handled by the static HTML
}

function addNewTask()
{
    console.log('Opening new task form');
    // Implementation for adding new task
    alert('Add Task functionality will be implemented with your Supabase integration.');
}

function refreshTasks()
{
    console.log('Refreshing tasks');
    loadTasks();
    // You can add a visual refresh indicator here
    const refreshBtn = event.target;
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

    setTimeout(() =>
    {
        refreshBtn.innerHTML = originalText;
    }, 1000);
}

function billTask(taskId)
{
    console.log('Billing task:', taskId);
    // Implementation for billing a task
    alert('Bill Task functionality will be implemented with your billing system.');
}

function viewTask(taskId)
{
    console.log('Viewing task:', taskId);

    // Sample task data - replace with actual data loading from Supabase
    const taskData = {
        taskName: 'Annual Financial Statements',
        category: 'AFS',
        period: '2024',
        status: 'Active',
        description: 'Preparation of annual financial statements for the year ending February 2024'
    };

    // Populate modal
    document.getElementById('modalTaskName').value = taskData.taskName;
    document.getElementById('modalTaskCategory').value = taskData.category;
    document.getElementById('modalTaskPeriod').value = taskData.period;
    document.getElementById('modalTaskStatus').value = taskData.status;
    document.getElementById('modalTaskDescription').value = taskData.description;
    document.getElementById('taskModalTitle').textContent = 'Task: ' + taskData.taskName;

    // Show modal
    document.getElementById('taskModal').style.display = 'block';
}

function deleteTask(taskId)
{
    if (confirm('Are you sure you want to delete this task? This action cannot be undone.'))
    {
        console.log('Deleting task:', taskId);
        // Implementation for deleting a task
        alert('Delete Task functionality will be implemented with your Supabase integration.');
    }
}

function closeTaskModal()
{
    document.getElementById('taskModal').style.display = 'none';
}

function billCurrentTask()
{
    console.log('Billing current task from modal');
    // Implementation for billing from task detail view
    alert('Billing functionality will be integrated with your billing system.');
}

function linkUnassignedTimes()
{
    console.log('Opening link times dialog');
    // Implementation for linking unassigned times
    alert('Link Times functionality will be implemented with your timesheet system.');
}

function refreshTimeLedger()
{
    console.log('Refreshing time ledger');
    // Implementation for refreshing time ledger
    const refreshBtn = event.target;
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

    setTimeout(() =>
    {
        refreshBtn.innerHTML = originalText;
    }, 1000);
}

function unlinkTime(timeId)
{
    if (confirm('Are you sure you want to unlink this time entry?'))
    {
        console.log('Unlinking time:', timeId);
        // Implementation for unlinking time
        alert('Unlink Time functionality will be implemented with your timesheet system.');
    }
}

// --- 12. Additional Contacts (Placeholder) ---
function initializeAdditionalContacts()
{
    if (addContactBtn)
    {
        addContactBtn.addEventListener('click', () =>
        {
            // This would open the add contact modal
            // For now, just show an alert
            alert('Additional contacts functionality will be implemented soon.');
        });
    }
}

// --- 13. Modal Management ---
function initializeModals()
{
    // Close modals when clicking outside or on close button
    const modals = document.querySelectorAll('.modal');

    modals.forEach(modal =>
    {
        // Close on outside click
        modal.addEventListener('click', (e) =>
        {
            if (e.target === modal)
            {
                modal.style.display = 'none';
            }
        });

        // Close on close button click
        const closeBtn = modal.querySelector('.modal-close-button');
        if (closeBtn)
        {
            closeBtn.addEventListener('click', () =>
            {
                modal.style.display = 'none';
            });
        }

        // Close on cancel button click
        const cancelBtn = modal.querySelector('.cancel-button');
        if (cancelBtn)
        {
            cancelBtn.addEventListener('click', () =>
            {
                modal.style.display = 'none';
            });
        }
    });

    // Save edited note
    if (saveEditedNoteButton)
    {
        saveEditedNoteButton.addEventListener('click', saveEditedNote);
    }

    // Make sure the task modal closes when clicking outside
    window.addEventListener('click', function (event)
    {
        const taskModal = document.getElementById('taskModal');
        if (event.target === taskModal)
        {
            closeTaskModal();
        }
    });
}

async function saveEditedNote()
{
    const noteId = parseInt(editingNoteIdInput?.value);
    const content = editNoteTextarea?.value?.trim();

    if (!noteId || !content) return;

    if (saveEditedNoteButton) saveEditedNoteButton.disabled = true;
    if (editNoteStatusSpan)
    {
        editNoteStatusSpan.textContent = 'Saving...';
        editNoteStatusSpan.className = 'text-warning';
    }

    try
    {
        const { error } = await supabase
            .from('Notes')
            .update({ note_content: content })
            .eq('id', noteId);

        if (error) throw error;

        if (editNoteStatusSpan)
        {
            editNoteStatusSpan.textContent = 'Saved!';
            editNoteStatusSpan.className = 'text-success';
        }

        setTimeout(() =>
        {
            if (editNoteModal) editNoteModal.style.display = 'none';
            loadAndDisplayNotes();
        }, 1000);

    } catch (error)
    {
        console.error('Edit note error:', error);
        if (editNoteStatusSpan)
        {
            editNoteStatusSpan.textContent = `Error: ${error.message}`;
            editNoteStatusSpan.className = 'text-danger';
        }
    } finally
    {
        if (saveEditedNoteButton) saveEditedNoteButton.disabled = false;
    }
}

// --- 14. Header Save Button ---
function initializeHeaderSaveButton()
{
    const headerSaveBtn = document.getElementById('header-save-btn');
    if (headerSaveBtn)
    {
        headerSaveBtn.addEventListener('click', handleFormSubmit);
    }
}

// --- 15. Initialization ---
async function initializePage()
{
    try
    {
        // Load sidebar
        await loadSidebar();

        // Check authentication
        const session = await checkAuthAndRedirect();
        if (!session) return;

        // Get URL parameters
        if (!getUrlParams()) return;

        // Initialize UI components
        initializeTabs();
        initializeClientSearch();
        initializeModals();
        initializeHeaderSaveButton();
        initializeTaskEventListeners();

        // Setup form handling
        if (clientForm)
        {
            clientForm.addEventListener('submit', handleFormSubmit);
        }

        // Setup notes functionality
        if (saveNoteButton)
        {
            saveNoteButton.addEventListener('click', saveNewNote);
        }

        // Load client data for edit mode
        if (currentMode === 'edit' && currentClientId)
        {
            const clientData = await fetchClientData(currentClientId);
            if (clientData)
            {
                populateForm(clientData);
                initializeAutosave();
            }
        } else
        {
            updateClientHeader('Add New Client', 'Enter client information below');
        }

        // Start inactivity detection
        setupInactivityDetection();

    } catch (error)
    {
        console.error('Initialization error:', error);
        updateClientHeader('Error', 'Failed to initialize page');
    }
}

// --- 16. Global Function Assignments (for onclick handlers) ---
// Make functions global for onclick handlers
window.openEditNoteModal = function (noteId)
{
    const note = clientNotes.find(n => n.id === noteId);
    if (!note) return;

    if (editNoteTextarea) editNoteTextarea.value = note.note_content || '';
    if (editingNoteIdInput) editingNoteIdInput.value = noteId;
    if (editNoteStatusSpan) editNoteStatusSpan.textContent = '';
    if (editNoteModal) editNoteModal.style.display = 'block';
};

window.deleteNote = async function (noteId, preview)
{
    if (!confirm(`Are you sure you want to delete this note?\n\n"${preview}..."`)) return;

    try
    {
        const { error } = await supabase.from('Notes').delete().eq('id', noteId);
        if (error) throw error;

        await loadAndDisplayNotes();
    } catch (error)
    {
        console.error('Delete error:', error);
        alert(`Failed to delete note: ${error.message}`);
    }
};

// Task functions
window.toggleInactiveTasks = toggleInactiveTasks;
window.addNewTask = addNewTask;
window.refreshTasks = refreshTasks;
window.billTask = billTask;
window.viewTask = viewTask;
window.deleteTask = deleteTask;
window.closeTaskModal = closeTaskModal;
window.billCurrentTask = billCurrentTask;
window.linkUnassignedTimes = linkUnassignedTimes;
window.refreshTimeLedger = refreshTimeLedger;
window.unlinkTime = unlinkTime;

// --- 17. Cleanup ---
window.addEventListener('beforeunload', () =>
{
    if (autosaveInterval)
    {
        clearInterval(autosaveInterval);
    }
    if (searchTimeout)
    {
        clearTimeout(searchTimeout);
    }
});

// --- 18. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);

// Add this function to handle task-related event listeners
function initializeTaskEventListeners()
{
    // Add New Task button
    const addTaskBtn = document.querySelector('button[onclick="addNewTask()"]');
    if (addTaskBtn)
    {
        addTaskBtn.removeAttribute('onclick');
        addTaskBtn.addEventListener('click', addNewTask);
    }

    // Refresh Tasks button  
    const refreshBtn = document.querySelector('button[onclick="refreshTasks()"]');
    if (refreshBtn)
    {
        refreshBtn.removeAttribute('onclick');
        refreshBtn.addEventListener('click', refreshTasks);
    }

    // Toggle Inactive button
    const toggleBtn = document.getElementById('toggleInactiveBtn');
    if (toggleBtn)
    {
        toggleBtn.removeAttribute('onclick');
        toggleBtn.addEventListener('click', toggleInactiveTasks);
    }

    // Task action buttons (bill, view, delete)
    document.addEventListener('click', function (e)
    {
        if (e.target.matches('.btn-bill'))
        {
            const taskId = e.target.closest('tr').dataset.taskId || 'task1';
            billTask(taskId);
        }

        if (e.target.matches('.btn-view'))
        {
            const taskId = e.target.closest('tr').dataset.taskId || 'task1';
            viewTask(taskId);
        }

        if (e.target.matches('.btn-delete'))
        {
            const taskId = e.target.closest('tr').dataset.taskId || 'task1';
            deleteTask(taskId);
        }
    });

    // Modal close button
    const modalCloseBtn = document.querySelector('#taskModal .modal-close-button');
    if (modalCloseBtn)
    {
        modalCloseBtn.removeAttribute('onclick');
        modalCloseBtn.addEventListener('click', closeTaskModal);
    }

    // Bill current task button
    const billCurrentBtn = document.querySelector('button[onclick="billCurrentTask()"]');
    if (billCurrentBtn)
    {
        billCurrentBtn.removeAttribute('onclick');
        billCurrentBtn.addEventListener('click', billCurrentTask);
    }

    // Link unassigned times button
    const linkTimesBtn = document.querySelector('button[onclick="linkUnassignedTimes()"]');
    if (linkTimesBtn)
    {
        linkTimesBtn.removeAttribute('onclick');
        linkTimesBtn.addEventListener('click', linkUnassignedTimes);
    }

    // Refresh time ledger button
    const refreshLedgerBtn = document.querySelector('button[onclick="refreshTimeLedger()"]');
    if (refreshLedgerBtn)
    {
        refreshLedgerBtn.removeAttribute('onclick');
        refreshLedgerBtn.addEventListener('click', refreshTimeLedger);
    }

    // Unlink time buttons
    document.addEventListener('click', function (e)
    {
        if (e.target.matches('.btn-action.btn-delete') && e.target.textContent.includes('Unlink'))
        {
            const timeId = e.target.dataset.timeId || 'time1';
            unlinkTime(timeId);
        }
    });
}