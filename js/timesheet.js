// ===================================================================
// TIMESHEET APPLICATION
// Main timesheet functionality with client-task relationships
// ===================================================================

// --- IMPORTS ---
import {
    supabase,
    checkAuthAndRedirect,
    setupInactivityDetection,
    loadSidebar,
    debounce,
    resetInactivityTimer
} from './shared.js';

import { AppState } from './appState.js';

// ===================================================================
// DOM ELEMENT REFERENCES
// ===================================================================

// Date navigation elements
const currentDateElement = document.getElementById('current-date');
const prevDayButton = document.getElementById('prev-day');
const nextDayButton = document.getElementById('next-day');
const todayButton = document.getElementById('today-button');

// Calendar elements
const toggleCalendarButton = document.getElementById('calendar-toggle');
const monthCalendar = document.getElementById('month-calendar');
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthYear = document.getElementById('calendar-month-year');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

// Day control elements
const unlockDayButton = document.getElementById('unlock-day');
const lockDayButton = document.getElementById('lock-day');
const workHoursElement = document.getElementById('work-hours');
const leaveHoursElement = document.getElementById('leave-hours');

// Timesheet table elements
const timesheetTbody = document.getElementById('timesheet-tbody');
const addRowButton = document.getElementById('add-row-button');
const saveAllButton = document.getElementById('save-all');

// Modal elements
const calendarModal = document.getElementById('calendar-modal');
const calendarClose = document.getElementById('calendar-close');
const taskModal = document.getElementById('task-modal');
const taskModalClose = document.getElementById('task-modal-close');

// Leave management elements
const leaveModal = document.getElementById('leave-modal');
const leaveModalClose = document.getElementById('leave-modal-close');
const manageLeaveButton = document.getElementById('manage-leave');
const leaveTypeSelect = document.getElementById('leave-type');
const leaveHoursInput = document.getElementById('leave-hours');
const leaveHoursGroup = document.getElementById('leave-hours-group');
const leaveFullDay = document.getElementById('leave-full-day');
const leavePartialDay = document.getElementById('leave-partial-day');
const leaveSaveButton = document.getElementById('leave-save');
const leaveCancelButton = document.getElementById('leave-cancel');
const leaveClearButton = document.getElementById('leave-clear');

// Message container
const messageContainer = document.getElementById('message-container');

// ===================================================================
// GLOBAL VARIABLES
// ===================================================================

// Application state
let currentDate = new Date();
let currentDayType = 'work-day';
let isDayLocked = false;
let timesheetData = [];
let leaveData = { type: '', hours: 0 };
let calendarViewDate = new Date();

// Client search state
let activeClientSearch = null;
let selectedSuggestionIndex = -1;

// User profile data
let userShortName = '';
let currentUser = null;

// Save state tracking
let hasUnsavedChanges = false;
let autoSaveInterval = null;

// Training Contract Categories
const trainingContractCategories = [
    { code: 'N/A', description: 'Not Applicable' },
    { code: 'A', description: 'A - Strategy & Governance to create sustainable value' },
    { code: 'B', description: 'B - Stewardship of capitals, business processes and risk management' },
    { code: 'C', description: 'C - Decision-making to increase, decrease or transform capitals' },
    { code: 'D', description: 'D - Reporting on Value Creation' },
    { code: 'E', description: 'E - Compliance' },
    { code: 'F', description: 'F - Assurance & Related Services' },
    { code: 'NC', description: 'Non-Core' }
];

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Format date for display
 */
function formatDate(date) {
    return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Generate unique entry ID based on short name and date
 * Fills gaps in sequence first, then increments to next available number
 */
function generateEntryId() {
    const dateStr = getDateKey(currentDate).replace(/-/g, ''); // YYYYMMDD format
    const baseId = userShortName + dateStr;

    // Get all existing IDs for this date and extract numbers
    const existingIds = timesheetData
        .map(entry => entry.id)
        .filter(id => id && id.startsWith(baseId))
        .sort();

    console.log(`🔢 Generating ID for ${baseId}, existing IDs:`, existingIds);

    if (existingIds.length === 0) {
        const newId = `${baseId}001`;
        console.log(`🆕 First ID generated: ${newId}`);
        return newId;
    }

    // Extract numbers and sort them
    const usedNumbers = existingIds
        .map(id => parseInt(id.slice(-3)))
        .sort((a, b) => a - b);

    console.log(`🔢 Used numbers:`, usedNumbers);

    // Find first gap in sequence
    let nextNumber = 1;
    for (let i = 0; i < usedNumbers.length; i++) {
        if (usedNumbers[i] !== nextNumber) {
            // Found a gap
            break;
        }
        nextNumber++;
    }

    // If no gaps found, use next number after highest
    if (nextNumber <= usedNumbers[usedNumbers.length - 1]) {
        nextNumber = usedNumbers[usedNumbers.length - 1] + 1;
    }

    const paddedNumber = nextNumber.toString().padStart(3, '0');
    const newId = `${baseId}${paddedNumber}`;

    console.log(`🆕 New ID generated: ${newId} (gap fill: ${nextNumber <= usedNumbers[usedNumbers.length - 1]})`);
    return newId;
}

/**
 * Format time input as user types (HH:MM format)
 */
function formatTimeInput(input, value) {
    let digits = value.replace(/\D/g, '');

    if (digits.length > 4) {
        digits = digits.slice(0, 4);
    }

    let formatted = '';
    if (digits.length === 0) {
        formatted = '';
    } else if (digits.length <= 2) {
        formatted = digits;
    } else if (digits.length === 3) {
        formatted = digits.charAt(0) + ':' + digits.slice(1);
    } else if (digits.length === 4) {
        formatted = digits.slice(0, 2) + ':' + digits.slice(2);
    }

    return formatted;
}

/**
 * Format hours input (XX.XX format)
 */
function formatHoursInput(value) {
    let cleaned = value.replace(/[^0-9.]/g, '');

    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    if (cleaned.includes('.')) {
        const [whole, decimal] = cleaned.split('.');
        const limitedWhole = whole.slice(0, 2);
        const limitedDecimal = decimal.slice(0, 2);
        cleaned = limitedWhole + '.' + limitedDecimal;
    } else {
        cleaned = cleaned.slice(0, 2);
    }

    const numValue = parseFloat(cleaned);
    if (!isNaN(numValue) && numValue > 99.99) {
        return '99.99';
    }

    return cleaned;
}

/**
 * Validate time string format
 */
function isValidTime(timeString) {
    if (!timeString || timeString.length === 0) return true;
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
}

/**
 * Parse time string to decimal hours
 */
function parseTime(timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':');
    if (parts.length !== 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    return hours + (minutes / 60);
}

/**
 * Calculate hours between start and end times
 */
function calculateHours(startTime, endTime) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (start === null || end === null) return 0;

    let diff = end - start;
    if (diff < 0) diff += 24; // Handle overnight work

    return diff;
}

/**
 * Check if entry is blank (no meaningful data)
 */
function isBlankEntry(entry) {
    return !entry.timeStart && 
           !entry.timeEnd && 
           !entry.client && 
           !entry.task && 
           !entry.description && 
           !entry.hours;
}

/**
 * Get entry status for display
 */
function getEntryStatus(entry) {
    if (isBlankEntry(entry)) {
        return 'Empty';
    }

    if ((entry.timeStart && !isValidTime(entry.timeStart)) ||
        (entry.timeEnd && !isValidTime(entry.timeEnd)) ||
        (entry.hours && (isNaN(parseFloat(entry.hours)) || parseFloat(entry.hours) < 0))) {
        return 'Invalid';
    }

    return entry.isSaved ? 'Saved' : 'Unsaved';
}

/**
 * Get date in YYYY-MM-DD format for database queries
 */
function getDateKey(date) {
    if (!date) return new Date().toISOString().split('T')[0];
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    return date;
}

/**
 * Format time from database (HH:MM:SS) to input format (HH:MM)
 */
function formatTimeForInput(timeString) {
    if (!timeString) return '';
    return timeString.substring(0, 5);
}

/**
 * Show success/error messages to user
 */
function showMessage(message, type = 'success') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;
    messageDiv.style.marginBottom = '10px';

    if (messageContainer) {
        messageContainer.appendChild(messageDiv);
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

/**
 * Mark changes as unsaved
 */
function markUnsavedChanges() {
    hasUnsavedChanges = true;
    console.log('🔄 Marked changes as unsaved');
}

/**
 * Mark changes as saved
 */
function markChangesSaved() {
    hasUnsavedChanges = false;
    console.log('✅ Marked changes as saved');
}

// ===================================================================
// CLIENT AND TASK MANAGEMENT
// ===================================================================

/**
 * Load tasks for a specific client from database
 */
async function loadTasksForClient(clientId) {
    if (!clientId) {
        console.log('🔍 No client ID provided for task loading');
        return [];
    }

    console.log(`🔍 Loading tasks for client ID: ${clientId}`);

    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('task_id, task_name, client_id')
            .eq('client_id', clientId)
            .order('task_name');

        if (error) {
            console.error('❌ Error loading tasks for client:', error);
            console.error('❌ Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return [];
        }

        console.log(`✅ Loaded ${tasks?.length || 0} tasks for client ${clientId}:`, tasks);
        return tasks || [];

    } catch (err) {
        console.error('❌ Unexpected error loading tasks for client:', err);
        return [];
    }
}

/**
 * Generate task options HTML for dropdown
 */
async function generateTaskOptions(clientId, selectedTask = '') {
    console.log(`🔧 Generating task options for client ${clientId}, selected: ${selectedTask}`);

    if (!clientId) {
        console.log('⚠️ No client ID provided for task options');
        return '<option value="">Select client first...</option>';
    }

    const tasks = await loadTasksForClient(clientId);

    if (!tasks || tasks.length === 0) {
        console.log('⚠️ No tasks found for client');
        return '<option value="">No tasks available</option>';
    }

    const options = tasks.map(task => {
        const isSelected = selectedTask === task.task_name ? 'selected' : '';
        return `<option value="${task.task_name}" data-task-id="${task.task_id}" ${isSelected}>${task.task_name}</option>`;
    }).join('');

    console.log(`✅ Generated ${tasks.length} task options`);
    return '<option value="">Select task...</option>' + options;
}

/**
 * Update task dropdown when client changes
 */
async function updateTaskDropdownForRow(rowId, clientId) {
    console.log(`🔄 Updating task dropdown for row ${rowId}, client ${clientId}`);

    const taskSelect = document.querySelector(`tr[data-row-id="${rowId}"] .task-select`);
    if (!taskSelect) {
        console.error(`❌ Task select not found for row ${rowId}`);
        return;
    }

    taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
    taskSelect.disabled = true;

    try {
        if (!clientId) {
            console.log('⚠️ No client ID, showing default option');
            taskSelect.innerHTML = '<option value="">Select client first...</option>';
            return;
        }

        const tasks = await loadTasksForClient(clientId);

        if (!tasks || tasks.length === 0) {
            console.log('⚠️ No tasks available for client');
            taskSelect.innerHTML = '<option value="">No tasks available</option>';
        } else {
            const options = tasks.map(task => 
                `<option value="${task.task_name}" data-task-id="${task.task_id}">${task.task_name}</option>`
            ).join('');

            taskSelect.innerHTML = `
                <option value="">Select task...</option>
                ${options}
            `;

            console.log(`✅ Updated task dropdown with ${tasks.length} tasks`);
        }
    } catch (error) {
        console.error('❌ Error updating task dropdown:', error);
        taskSelect.innerHTML = '<option value="">Error loading tasks</option>';
    } finally {
        taskSelect.disabled = false;
    }
}

// ===================================================================
// DATABASE OPERATIONS
// ===================================================================

/**
 * Save a single timesheet entry to database
 */
async function saveEntryToDatabase(entry) {
    if (isBlankEntry(entry)) {
        console.log(`⏭️ Skipping blank entry ${entry.id}`);
        return { success: true, skipped: true };
    }


    const user = AppState.getUser();
    console.log(`💾 User ${user} to database:`, entry);
    console.log(`💾 Saving entry ${entry.id} to database:`, entry);

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            throw new Error('No authenticated user found');
        }

        const dateKey = getDateKey(currentDate);

        // Prepare entry data for database
        const entryData = {
            entry_id: entry.id,
            user_id: user.id,
            date: dateKey,
            time_start: entry.timeStart || null,
            time_end: entry.timeEnd || null,
            client_id: entry.clientId || null,
            task_id: entry.taskId || null,
            description: entry.description || null,
            hours: entry.hours ? parseFloat(entry.hours) : null,
            tc_category: entry.tcCategory || 'N/A',
            status: 'open'
        };

        console.log(`📤 Prepared entry data for database:`, entryData);

        // Use upsert to handle both insert and update
        const { data, error } = await supabase
            .from('timesheet_entries')
            .upsert(entryData, { 
                onConflict: 'entry_id',
                ignoreDuplicates: false 
            })
            .select();

        if (error) {
            console.error(`❌ Database error saving entry ${entry.id}:`, error);
            return { 
                success: false, 
                error: error.message,
                entry: entry
            };
        }

        console.log(`✅ Successfully saved entry ${entry.id} to database:`, data);
        return { success: true, data };

    } catch (err) {
        console.error(`❌ Unexpected error saving entry ${entry.id}:`, err);
        return { 
            success: false, 
            error: err.message,
            entry: entry
        };
    }
}

/**
 * Delete a timesheet entry from database
 */
async function deleteEntryFromDatabase(entryId) {
    console.log(`🗑️ Deleting entry ${entryId} from database`);

    try {
        const { error } = await supabase
            .from('timesheet_entries')
            .delete()
            .eq('entry_id', entryId);

        if (error) {
            console.error(`❌ Database error deleting entry ${entryId}:`, error);
            return { success: false, error: error.message };
        }

        console.log(`✅ Successfully deleted entry ${entryId} from database`);
        return { success: true };

    } catch (err) {
        console.error(`❌ Unexpected error deleting entry ${entryId}:`, err);
        return { success: false, error: err.message };
    }
}

/**
 * Save all unsaved entries to database
 */
async function saveAllEntriesToDatabase() {
    console.log('💾 Starting batch save to database...');

    const unsavedEntries = timesheetData.filter(entry => !entry.isSaved && !isBlankEntry(entry));
    const results = {
        successful: [],
        failed: [],
        skipped: 0
    };

    if (unsavedEntries.length === 0) {
        console.log('ℹ️ No unsaved entries to save');
        return { success: true, results };
    }

    console.log(`🔄 Saving ${unsavedEntries.length} unsaved entries...`);

    for (const entry of unsavedEntries) {
        const result = await saveEntryToDatabase(entry);

        if (result.success) {
            if (result.skipped) {
                results.skipped++;
            } else {
                entry.isSaved = true;
                results.successful.push(entry.id);
            }
        } else {
            results.failed.push({
                id: entry.id,
                error: result.error
            });
        }
    }

    console.log('📊 Batch save results:', results);

    if (results.failed.length === 0) {
        markChangesSaved();
        renderTimesheet();
        return { success: true, results };
    } else {
        return { success: false, results };
    }
}

/**
 * Auto-save function called periodically
 */
async function performAutoSave() {
    if (!hasUnsavedChanges) {
        console.log('⏭️ Auto-save: No unsaved changes');
        return;
    }

    console.log('🔄 Performing auto-save...');

    try {
        const result = await saveAllEntriesToDatabase();

        if (result.success) {
            const count = result.results.successful.length;
            if (count > 0) {
                showMessage(`Auto-saved ${count} entries`, 'success');
            }
        } else {
            const failedCount = result.results.failed.length;
            showMessage(`Auto-save failed for ${failedCount} entries`, 'error');
            console.error('❌ Auto-save failures:', result.results.failed);
        }
    } catch (error) {
        console.error('❌ Auto-save error:', error);
        showMessage('Auto-save failed', 'error');
    }
}

/**
 * Check for unsaved changes before navigation
 */
async function checkUnsavedChangesBeforeNavigation() {
    if (!hasUnsavedChanges) {
        return true; // No unsaved changes, safe to navigate
    }

    console.log('⚠️ Checking unsaved changes before navigation...');

    try {
        const result = await saveAllEntriesToDatabase();

        if (result.success) {
            console.log('✅ Successfully saved changes before navigation');
            return true;
        } else {
            // Show modal asking if user wants to continue without saving
            const message = `Failed to save ${result.results.failed.length} entries. Are you sure you want to continue? Unsaved changes will be lost.`;
            return confirm(message);
        }
    } catch (error) {
        console.error('❌ Error saving before navigation:', error);
        const message = 'Failed to save changes. Are you sure you want to continue? Unsaved changes will be lost.';
        return confirm(message);
    }
}

// ===================================================================
// DATA STORAGE AND LOADING
// ===================================================================

/**
 * Save timesheet data to local storage (backup)
 */
function saveTimesheetData() {
    const dateKey = getDateKey(currentDate);
    const data = {
        date: dateKey,
        dayType: currentDayType,
        isLocked: isDayLocked,
        entries: timesheetData,
        leave: leaveData
    };

    localStorage.setItem(`timesheet_${dateKey}`, JSON.stringify(data));
    console.log('💽 Timesheet data saved to localStorage for', dateKey);
}

/**
 * Load timesheet data from database
 */
async function loadTimesheetData() {
    console.log('📥 Loading timesheet data from database...');

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error('❌ No authenticated user found:', sessionError);
            generateBlankRows();
            return;
        }

        const userId = session.user.id;
        const dateKey = getDateKey(currentDate);

        console.log(`🔍 Loading timesheet data for user ${userId} on ${dateKey}`);

        const { data: entries, error } = await supabase
            .from('timesheet_entries')
            .select(`
                entry_id,
                client_id,
                date,
                time_start,
                time_end,
                hours,
                task_id,
                description,
                status,
                tc_category,
                Clients!timesheet_entries_client_id_fkey (
                    client_name
                ),
                tasks!timesheet_entries_task_id_fkey (
                    task_name
                )
            `)
            .eq('user_id', userId)
            .eq('date', dateKey)
            .order('entry_id');

        if (error) {
            console.error('❌ Error loading timesheet data:', error);
            generateBlankRows();
            return;
        }

        console.log(`📊 Raw database query result (${entries?.length || 0} entries):`, entries);

        // Convert database entries to internal format
        if (entries && entries.length > 0) {
            timesheetData = entries.map(entry => {
                const mappedEntry = {
                    id: entry.entry_id,
                    timeStart: entry.time_start ? formatTimeForInput(entry.time_start) : '',
                    timeEnd: entry.time_end ? formatTimeForInput(entry.time_end) : '',
                    client: entry.Clients?.client_name || '',
                    clientId: entry.client_id,
                    task: entry.tasks?.task_name || '',
                    taskId: entry.task_id,
                    description: entry.description || '',
                    hours: entry.hours ? parseFloat(entry.hours).toFixed(2) : '',
                    tcCategory: entry.tc_category || 'N/A',
                    status: entry.status || 'open',
                    isLocked: entry.status === 'locked' || entry.status === 'approved',
                    isSaved: true
                };
                console.log(`🔄 Mapped entry ${entry.entry_id}:`, mappedEntry);
                return mappedEntry;
            });

            currentDayType = 'work-day';
            isDayLocked = timesheetData.some(entry => entry.isLocked);

            console.log(`✅ Loaded ${entries.length} timesheet entries for ${dateKey}`);
        } else {
            timesheetData = [];
            console.log(`ℹ️ No timesheet entries found for ${dateKey}`);
        }

        // Always ensure we have minimum entries (fills gaps or creates new ones)
        generateBlankRows();
        renderTimesheet();
        markChangesSaved(); // Fresh load means no unsaved changes

    } catch (err) {
        console.error('❌ Unexpected error loading timesheet data:', err);
        generateBlankRows();
    }
}

/**
 * Generate blank rows for new days or fill gaps
 * Always ensures minimum 7 entries per day
 */
function generateBlankRows() {
    console.log('🔧 Generating blank rows...');

    const dayOfWeek = currentDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDayType = 'weekend';
    } else {
        currentDayType = 'work-day';
    }

    // If we have existing entries, fill gaps to ensure we have at least 7 total
    const targetCount = Math.max(7, timesheetData.length);

    while (timesheetData.length < targetCount) {
        const entry = {
            id: generateEntryId(),
            timeStart: '',
            timeEnd: '',
            client: '',
            clientId: null,
            task: '',
            taskId: null,
            description: '',
            hours: '',
            tcCategory: 'N/A',
            isLocked: false,
            isSaved: true // Blank entries are considered "saved"
        };
        timesheetData.push(entry);
        console.log(`➕ Added blank entry: ${entry.id}`);
    }

    // Sort entries by ID to maintain order
    timesheetData.sort((a, b) => a.id.localeCompare(b.id));

    leaveData = leaveData || { type: '', hours: 0 };
    isDayLocked = isDayLocked || false;

    console.log(`✅ Generated ${timesheetData.length} total entries`);
}

// ===================================================================
// UI RENDERING FUNCTIONS
// ===================================================================

/**
 * Update date display
 */
function updateDateDisplay() {
    if (currentDateElement) {
        currentDateElement.textContent = formatDate(currentDate);
    }
}

/**
 * Update day control buttons
 */
function updateDayControls() {
    const isNonWorkDay = currentDayType !== 'work-day';
    const shouldBeLockedByDefault = isNonWorkDay && !isDayLocked;

    if (unlockDayButton && lockDayButton) {
        if (shouldBeLockedByDefault) {
            unlockDayButton.style.display = 'inline-block';
            lockDayButton.style.display = 'none';
        } else {
            unlockDayButton.style.display = isDayLocked ? 'inline-block' : 'none';
            lockDayButton.style.display = isDayLocked ? 'none' : 'inline-block';
        }
    }
}

/**
 * Update hours summary display
 */
function updateHoursSummary() {
    let workHours = 0;
    let leaveHours = parseFloat(leaveData.hours) || 0;

    timesheetData.forEach(entry => {
        if (entry.hours) {
            workHours += parseFloat(entry.hours) || 0;
        }
    });

    if (workHoursElement) {
        workHoursElement.textContent = `Work: ${workHours.toFixed(2)}h`;
    }

    if (leaveHoursElement) {
        leaveHoursElement.textContent = `Leave: ${leaveHours.toFixed(2)}h`;
    }
}

/**
 * Create a single timesheet row
 */
function createTimeEntryRow(entry) {
    console.log('🔧 Creating timesheet row for entry:', entry);

    const row = document.createElement('tr');
    row.dataset.rowId = entry.id;

    const isLocked = isDayLocked || entry.isLocked || (currentDayType !== 'work-day' && currentDayType !== 'study-leave');
    const status = getEntryStatus(entry);

    if (isLocked) {
        row.classList.add('locked-row');
    }

    row.innerHTML = `
        <td>
            <input type="text" class="time-input" 
                   value="${entry.timeStart || ''}" 
                   placeholder="08:00" 
                   ${isLocked ? 'disabled' : ''}
                   data-field="timeStart"
                   maxlength="5">
        </td>
        <td>
            <input type="text" class="time-input" 
                   value="${entry.timeEnd || ''}" 
                   placeholder="17:00" 
                   ${isLocked ? 'disabled' : ''}
                   data-field="timeEnd"
                   maxlength="5">
        </td>
        <td>
            <div class="client-search-container">
                <input type="text" class="client-input" 
                       value="${entry.client || ''}" 
                       placeholder="Search client..." 
                       ${isLocked ? 'disabled' : ''}
                       data-field="client"
                       data-client-id="${entry.clientId || ''}"
                       autocomplete="off">
                <div class="client-suggestions"></div>
            </div>
        </td>
        <td>
            <select class="task-select" ${isLocked ? 'disabled' : ''} data-field="task" data-client-id="${entry.clientId || ''}">
                <option value="">Select client first...</option>
            </select>
            <button class="add-task-button" ${isLocked ? 'disabled' : ''} title="Add new task">+</button>
        </td>
        <td>
            <textarea class="description-input" 
                      placeholder="Work description..." 
                      ${isLocked ? 'disabled' : ''}
                      data-field="description" style="height: 17px;">${entry.description || ''}</textarea>
        </td>
        <td>
            <select class="tc-select" ${isLocked ? 'disabled' : ''} data-field="tcCategory" 
                    data-selected-code="${entry.tcCategory || 'N/A'}" 
                    title="Training Contract Category">
                ${trainingContractCategories.map(cat =>
                    `<option value="${cat.code}" ${entry.tcCategory === cat.code ? 'selected' : ''}>${cat.code}</option>`
                ).join('')}
            </select>
        </td>
        <td>
            <input type="text" class="hours-input" 
                   value="${entry.hours || ''}" 
                   placeholder="0.00" 
                   ${isLocked ? 'disabled' : ''}
                   data-field="hours"
                   maxlength="5">
        </td>
        <td>
            <span class="status-indicator status-${status.toLowerCase()}">${status}</span>
        </td>
        <td>
            <button class="save-row-button action-button" ${isLocked ? 'disabled' : ''} title="Save entry">Save</button>
            <button class="delete-row-button action-button" ${isLocked ? 'disabled' : ''} title="Delete entry">Delete</button>
        </td>
    `;

    // Load tasks if client is already selected
    if (entry.clientId) {
        console.log(`🔄 Loading tasks for existing client ${entry.clientId} in row ${entry.id}`);
        updateTaskDropdownForRow(entry.id, entry.clientId).then(() => {
            const taskSelect = row.querySelector('.task-select');
            if (taskSelect && entry.task) {
                taskSelect.value = entry.task;
                console.log(`✅ Set task value to: ${entry.task}`);
            }
        });
    }

    return row;
}

/**
 * Render the complete timesheet table
 */
function renderTimesheet() {
    console.log('🎨 Rendering timesheet table...');

    if (!timesheetTbody) return;

    timesheetTbody.innerHTML = '';

    timesheetData.forEach(entry => {
        const row = createTimeEntryRow(entry);
        timesheetTbody.appendChild(row);
    });

    updateHoursSummary();
    console.log('✅ Timesheet table rendered');
}

// ===================================================================
// CLIENT SEARCH FUNCTIONALITY
// ===================================================================

/**
 * Handle client search as user types
 */
async function handleClientSearch(input, query) {
    const container = input.parentElement;
    const suggestions = container.querySelector('.client-suggestions');

    activeClientSearch = {
        input: input,
        suggestions: suggestions,
        container: container
    };

    if (!query.trim()) {
        suggestions.style.display = 'none';
        selectedSuggestionIndex = -1;
        return;
    }

    // Use debounced search
    debounce(performClientSearch, 300)(input, query);
}

/**
 * Perform the actual client search in database
 */
async function performClientSearch(input, query) {
    if (!activeClientSearch) return;

    console.log(`🔍 Searching clients for query: "${query}"`);

    try {
        const { data: clients, error } = await supabase
            .from('Clients')
            .select('Id, client_name, ClientCode')
            .or(`client_name.ilike.%${query}%,ClientCode.ilike.%${query}%`)
            .limit(100);

        if (error) {
            console.error('❌ Error searching clients:', error);
            return;
        }

        console.log(`✅ Found ${clients?.length || 0} clients for query "${query}"`);

        const filteredClients = (clients || []).map(client => ({
            id: client.Id,
            name: client.client_name,
            code: client.ClientCode
        }));

        const suggestions = activeClientSearch.suggestions;
        suggestions.innerHTML = '';

        filteredClients.forEach((client, index) => {
            const suggestion = document.createElement('div');
            suggestion.className = 'client-suggestion';
            suggestion.textContent = `${client.name} (${client.code})`;
            suggestion.dataset.index = index;
            suggestion.addEventListener('click', () => selectClient(client));
            suggestions.appendChild(suggestion);
        });

        suggestions.style.display = filteredClients.length > 0 ? 'block' : 'none';
        selectedSuggestionIndex = -1;

        activeClientSearch.filteredClients = filteredClients;

    } catch (err) {
        console.error('❌ Unexpected error searching clients:', err);
    }
}

/**
 * Select a client from search results
 */
function selectClient(client) {
    if (!activeClientSearch) return;

    console.log(`✅ Selected client: ${client.name} (ID: ${client.id})`);

    activeClientSearch.input.value = client.name;
    activeClientSearch.input.dataset.clientId = client.id;
    activeClientSearch.suggestions.style.display = 'none';

    const rowId = activeClientSearch.input.closest('tr').dataset.rowId;
    const entry = timesheetData.find(e => e.id === rowId);
    if (entry) {
        entry.client = client.name;
        entry.clientId = client.id;
        entry.task = ''; // Clear task when client changes
        entry.taskId = null;
        entry.isSaved = false;
        markUnsavedChanges();

        // Update task dropdown
        updateTaskDropdownForRow(rowId, client.id);
    }

    activeClientSearch = null;
    selectedSuggestionIndex = -1;

    updateHoursSummary();
    saveTimesheetData();
}

/**
 * Handle keyboard navigation in client search
 */
function handleClientKeyDown(e) {
    if (!activeClientSearch || !activeClientSearch.filteredClients) return;

    const suggestions = activeClientSearch.suggestions;
    const filteredClients = activeClientSearch.filteredClients;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, filteredClients.length - 1);
            updateSuggestionSelection();
            break;

        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSuggestionSelection();
            break;

        case 'Enter':
            e.preventDefault();
            if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < filteredClients.length) {
                selectClient(filteredClients[selectedSuggestionIndex]);
            } else if (filteredClients.length === 1) {
                selectClient(filteredClients[0]);
            }
            break;

        case 'Escape':
            suggestions.style.display = 'none';
            activeClientSearch = null;
            selectedSuggestionIndex = -1;
            break;
    }
}

/**
 * Update visual selection in suggestions
 */
function updateSuggestionSelection() {
    if (!activeClientSearch) return;

    const suggestions = activeClientSearch.suggestions.querySelectorAll('.client-suggestion');
    suggestions.forEach((suggestion, index) => {
        suggestion.classList.toggle('selected', index === selectedSuggestionIndex);
    });
}

// ===================================================================
// EVENT HANDLERS
// ===================================================================

/**
 * Handle changes to timesheet cell values
 */
function handleCellChange(rowId, field, value) {
    resetInactivityTimer();
    const entry = timesheetData.find(e => e.id === rowId);
    if (!entry) return;

    const oldValue = entry[field];
    entry[field] = value;

    // Only mark as unsaved if this is a meaningful change
    if (oldValue !== value && !isBlankEntry(entry)) {
        entry.isSaved = false;
        markUnsavedChanges();
    }

    console.log(`🔄 Cell change: ${rowId}.${field} = "${value}" (was "${oldValue}")`);

    // Handle client change - update task dropdown
    if (field === 'client') {
        entry.task = '';
        entry.taskId = null;
        if (entry.clientId) {
            updateTaskDropdownForRow(rowId, entry.clientId);
        }
    }

    // Handle task selection - get task ID
    if (field === 'task' && value) {
        const taskSelect = document.querySelector(`tr[data-row-id="${rowId}"] .task-select`);
        const selectedOption = taskSelect?.querySelector(`option[value="${value}"]`);
        if (selectedOption) {
            entry.taskId = selectedOption.dataset.taskId;
            console.log(`🔗 Set task ID: ${entry.taskId} for task: ${value}`);
        }
    }

    // Calculate hours if both times are filled
    if (field === 'timeStart' || field === 'timeEnd') {
        if (entry.timeStart && entry.timeEnd) {
            const calculatedHours = calculateHours(entry.timeStart, entry.timeEnd);
            entry.hours = calculatedHours.toFixed(2);
            const hoursInput = document.querySelector(`tr[data-row-id="${rowId}"] .hours-input`);
            if (hoursInput) {
                hoursInput.value = entry.hours;
                hoursInput.classList.add('calculated');
            }
        }
    }

    // Clear calculated hours if manual hours are entered
    if (field === 'hours' && value) {
        const hoursInput = document.querySelector(`tr[data-row-id="${rowId}"] .hours-input`);
        if (hoursInput) {
            hoursInput.classList.remove('calculated');
        }
    }

    // Handle TC Category changes
    if (field === 'tcCategory') {
        const selectedCategory = trainingContractCategories.find(cat => cat.code === value);
        if (selectedCategory && value !== 'N/A') {
            showMessage(`TC Category set to: ${selectedCategory.code}`, 'success');
        }
        updateTCDisplay(document.querySelector(`tr[data-row-id="${rowId}"] .tc-select`));
    }

    // Update status indicator
    const statusElement = document.querySelector(`tr[data-row-id="${rowId}"] .status-indicator`);
    if (statusElement) {
        const status = getEntryStatus(entry);
        statusElement.textContent = status;
        statusElement.className = `status-indicator status-${status.toLowerCase()}`;
    }

    updateHoursSummary();
    saveTimesheetData();
}

/**
 * Handle time input formatting
 */
function handleTimeInput(input, value) {
    const formatted = formatTimeInput(input, value);
    input.value = formatted;

    const rowId = input.closest('tr').dataset.rowId;
    const field = input.dataset.field;
    handleCellChange(rowId, field, formatted);
}

/**
 * Handle hours input formatting
 */
function handleHoursInput(input, value) {
    const formatted = formatHoursInput(value);
    input.value = formatted;

    const rowId = input.closest('tr').dataset.rowId;
    const field = input.dataset.field;
    handleCellChange(rowId, field, formatted);
}

/**
 * Add new timesheet row
 */
function handleAddRow() {
    resetInactivityTimer();
    console.log('➕ Adding new timesheet row');

    const newEntry = {
        id: generateEntryId(),
        timeStart: '',
        timeEnd: '',
        client: '',
        clientId: null,
        task: '',
        taskId: null,
        description: '',
        hours: '',
        tcCategory: 'N/A',
        isLocked: false,
        isSaved: true // New blank entries are considered saved
    };

    timesheetData.push(newEntry);
    renderTimesheet();
    saveTimesheetData();

    // Focus on the first input of the new row
    const newRow = timesheetTbody.querySelector(`tr[data-row-id="${newEntry.id}"]`);
    if (newRow) {
        const firstInput = newRow.querySelector('.time-input');
        if (firstInput) firstInput.focus();
    }

    showMessage('New time entry added');
    console.log(`✅ Added new entry: ${newEntry.id}`);
}

/**
 * Save all timesheet entries
 */
async function handleSaveAll() {
    resetInactivityTimer();
    console.log('💾 Save All button clicked');

    try {
        const result = await saveAllEntriesToDatabase();

        if (result.success) {
            const successCount = result.results.successful.length;
            const skippedCount = result.results.skipped;

            if (successCount > 0) {
                showMessage(`Successfully saved ${successCount} entries`);
            } else if (skippedCount > 0) {
                showMessage('All entries are already saved');
            } else {
                showMessage('No entries to save');
            }
        } else {
            const failedCount = result.results.failed.length;
            const successCount = result.results.successful.length;

            if (successCount > 0) {
                showMessage(`Saved ${successCount} entries, ${failedCount} failed`, 'error');
            } else {
                showMessage(`Failed to save ${failedCount} entries`, 'error');
            }

            console.error('❌ Save failures:', result.results.failed);
        }
    } catch (error) {
        console.error('❌ Save All error:', error);
        showMessage('Failed to save entries', 'error');
    }
}

/**
 * Save single timesheet row
 */
async function handleSaveRow(rowId) {
    resetInactivityTimer();
    console.log(`💾 Save Row button clicked for ${rowId}`);

    const entry = timesheetData.find(e => e.id === rowId);
    if (!entry) {
        showMessage('Entry not found', 'error');
        return;
    }

    const status = getEntryStatus(entry);
    if (status === 'Invalid') {
        showMessage('Cannot save invalid entry. Please check your data.', 'error');
        return;
    }

    if (isBlankEntry(entry)) {
        showMessage('Cannot save blank entry', 'error');
        return;
    }

    try {
        const result = await saveEntryToDatabase(entry);

        if (result.success) {
            entry.isSaved = true;
            renderTimesheet();
            showMessage('Entry saved successfully');

            // Check if all entries are now saved
            const hasUnsaved = timesheetData.some(e => !e.isSaved && !isBlankEntry(e));
            if (!hasUnsaved) {
                markChangesSaved();
            }
        } else {
            showMessage(`Failed to save entry: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('❌ Save Row error:', error);
        showMessage('Failed to save entry', 'error');
    }
}

/**
 * Delete timesheet row
 */
async function handleDeleteRow(rowId) {
    resetInactivityTimer();
    console.log(`🗑️ Delete Row button clicked for ${rowId}`);

    const entry = timesheetData.find(e => e.id === rowId);
    if (!entry) {
        showMessage('Entry not found', 'error');
        return;
    }

    // If entry was saved to database, delete it there too
    if (entry.isSaved && !isBlankEntry(entry)) {
        try {
            const result = await deleteEntryFromDatabase(rowId);
            if (!result.success) {
                showMessage(`Failed to delete from database: ${result.error}`, 'error');
                return;
            }
        } catch (error) {
            console.error('❌ Delete Row database error:', error);
            showMessage('Failed to delete from database', 'error');
            return;
        }
    }

    // Remove from local array
    timesheetData = timesheetData.filter(entry => entry.id !== rowId);
    renderTimesheet();
    saveTimesheetData();
    showMessage('Time entry deleted');
    console.log(`✅ Deleted entry: ${rowId}`);
}

/**
 * Navigate between dates
 */
async function handleDateNavigation(direction) {
    resetInactivityTimer();
    console.log(`📅 Navigating ${direction > 0 ? 'forward' : 'backward'} one day`);

    // Check for unsaved changes before navigation
    const canNavigate = await checkUnsavedChangesBeforeNavigation();
    if (!canNavigate) {
        console.log('❌ Navigation cancelled due to unsaved changes');
        return;
    }

    saveTimesheetData();

    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    currentDate = newDate;

    await loadTimesheetData();
    updateDateDisplay();
    updateDayControls();

    showMessage(`Navigated to ${formatDate(currentDate)}`);
}

/**
 * Go to today's date
 */
async function goToToday() {
    resetInactivityTimer();
    console.log('📅 Navigating to today');

    // Check for unsaved changes before navigation
    const canNavigate = await checkUnsavedChangesBeforeNavigation();
    if (!canNavigate) {
        console.log('❌ Navigation to today cancelled due to unsaved changes');
        return;
    }

    saveTimesheetData();

    currentDate = new Date();
    await loadTimesheetData();
    updateDateDisplay();
    updateDayControls();

    showMessage('Navigated to today');
}

/**
 * Toggle day lock status
 */
function handleDayLock() {
    resetInactivityTimer();
    isDayLocked = !isDayLocked;
    updateDayControls();
    renderTimesheet();
    saveTimesheetData();
    markUnsavedChanges();

    showMessage(isDayLocked ? 'Day locked successfully' : 'Day unlocked successfully');
}

/**
 * Update TC category display
 */
function updateTCDisplay(selectElement) {
    const selectedValue = selectElement.value || 'N/A';
    selectElement.setAttribute('data-selected-code', selectedValue);

    const selectedCategory = trainingContractCategories.find(cat => cat.code === selectedValue);
    if (selectedCategory) {
        selectElement.title = selectedCategory.description;
    }
}

// ===================================================================
// CALENDAR FUNCTIONS
// ===================================================================

function toggleCalendar() {
    if (monthCalendar) {
        const isVisible = monthCalendar.classList.contains('show');
        monthCalendar.classList.toggle('show');

        if (!isVisible) {
            calendarViewDate = new Date(currentDate);
            renderInlineCalendar();
        }
    }
}

function renderInlineCalendar() {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    if (calendarMonthYear) {
        calendarMonthYear.textContent = calendarViewDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    }

    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';

    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    // Generate calendar days
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();

        if (date.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }

        if (date.toDateString() === currentDate.toDateString()) {
            dayElement.classList.add('selected');
        }

        if (date.toDateString() === new Date().toDateString()) {
            dayElement.classList.add('today');
        }

        dayElement.addEventListener('click', async () => {
            if (date.getMonth() !== month) return;

            // Check for unsaved changes before navigation
            const canNavigate = await checkUnsavedChangesBeforeNavigation();
            if (!canNavigate) {
                return;
            }

            saveTimesheetData();
            currentDate = new Date(date);
            await loadTimesheetData();
            updateDateDisplay();
            updateDayControls();
            toggleCalendar();

            showMessage(`Switched to ${formatDate(currentDate)}`);
        });

        calendarGrid.appendChild(dayElement);
    }
}

function navigateMonth(direction) {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + direction);
    renderInlineCalendar();
}

// ===================================================================
// LEAVE MANAGEMENT
// ===================================================================

function openLeaveModal() {
    resetInactivityTimer();

    if (leaveTypeSelect) {
        leaveTypeSelect.value = leaveData.type || '';
    }

    if (leaveData.hours === 7.5 || leaveData.hours === 0) {
        leaveFullDay.checked = true;
        leaveHoursGroup.style.display = 'none';
    } else {
        leavePartialDay.checked = true;
        leaveHoursGroup.style.display = 'block';
        if (leaveHoursInput) {
            leaveHoursInput.value = leaveData.hours ? leaveData.hours.toFixed(2) : '';
        }
    }

    if (leaveModal) {
        leaveModal.style.display = 'block';
    }
}

function closeLeaveModal() {
    if (leaveModal) {
        leaveModal.style.display = 'none';
    }
}

function handleLeaveDurationChange() {
    if (leavePartialDay.checked) {
        leaveHoursGroup.style.display = 'block';
    } else {
        leaveHoursGroup.style.display = 'none';
    }
}

function handleLeaveSave() {
    resetInactivityTimer();

    const leaveType = leaveTypeSelect ? leaveTypeSelect.value : '';
    let leaveHours = 0;

    if (leaveType) {
        if (leaveFullDay.checked) {
            leaveHours = 7.5;
        } else {
            leaveHours = leaveHoursInput ? parseFloat(leaveHoursInput.value) || 0 : 0;
            if (leaveHours <= 0 || leaveHours > 99.99) {
                showMessage('Please enter valid leave hours (0.01 - 99.99)', 'error');
                return;
            }
        }
    }

    leaveData = {
        type: leaveType,
        hours: leaveType ? leaveHours : 0
    };

    markUnsavedChanges();
    updateHoursSummary();
    saveTimesheetData();
    closeLeaveModal();

    if (leaveType) {
        showMessage(`${leaveType.replace('-', ' ')} leave saved: ${leaveHours.toFixed(2)} hours`);
    } else {
        showMessage('Leave cleared');
    }
}

function handleLeaveClear() {
    resetInactivityTimer();

    if (confirm('Are you sure you want to clear all leave for this day?')) {
        leaveData = { type: '', hours: 0 };

        if (leaveTypeSelect) leaveTypeSelect.value = '';
        if (leaveHoursInput) leaveHoursInput.value = '';
        leaveFullDay.checked = true;
        leaveHoursGroup.style.display = 'none';

        markUnsavedChanges();
        updateHoursSummary();
        saveTimesheetData();
        closeLeaveModal();

        showMessage('Leave cleared successfully');
    }
}

// ===================================================================
// EVENT LISTENER SETUP
// ===================================================================

function attachEventListeners() {
    console.log('🔧 Attaching event listeners...');

    // Date navigation
    if (prevDayButton) prevDayButton.addEventListener('click', () => handleDateNavigation(-1));
    if (nextDayButton) nextDayButton.addEventListener('click', () => handleDateNavigation(1));
    if (todayButton) todayButton.addEventListener('click', goToToday);

    // Calendar
    if (toggleCalendarButton) toggleCalendarButton.addEventListener('click', toggleCalendar);
    if (prevMonthButton) prevMonthButton.addEventListener('click', () => navigateMonth(-1));
    if (nextMonthButton) nextMonthButton.addEventListener('click', () => navigateMonth(1));

    // Day controls
    if (unlockDayButton) unlockDayButton.addEventListener('click', handleDayLock);
    if (lockDayButton) lockDayButton.addEventListener('click', handleDayLock);

    // Timesheet actions
    if (addRowButton) addRowButton.addEventListener('click', handleAddRow);
    if (saveAllButton) saveAllButton.addEventListener('click', handleSaveAll);

    // Leave management
    if (manageLeaveButton) manageLeaveButton.addEventListener('click', openLeaveModal);
    if (leaveModalClose) leaveModalClose.addEventListener('click', closeLeaveModal);
    if (leaveSaveButton) leaveSaveButton.addEventListener('click', handleLeaveSave);
    if (leaveCancelButton) leaveCancelButton.addEventListener('click', closeLeaveModal);
    if (leaveClearButton) leaveClearButton.addEventListener('click', handleLeaveClear);
    if (leaveFullDay) leaveFullDay.addEventListener('change', handleLeaveDurationChange);
    if (leavePartialDay) leavePartialDay.addEventListener('change', handleLeaveDurationChange);

    // Leave hours formatting
    if (leaveHoursInput) {
        leaveHoursInput.addEventListener('input', (e) => {
            const formatted = formatHoursInput(e.target.value);
            e.target.value = formatted;
        });
    }

    // Modal close buttons
    if (calendarClose) calendarClose.addEventListener('click', () => { calendarModal.style.display = 'none'; });
    if (taskModalClose) taskModalClose.addEventListener('click', () => { taskModal.style.display = 'none'; });

    // Timesheet table event delegation
    if (timesheetTbody) {
        timesheetTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-row-button')) {
                const rowId = e.target.closest('tr').dataset.rowId;
                if (confirm('Are you sure you want to delete this time entry?')) {
                    handleDeleteRow(rowId);
                }
            }

            if (e.target.classList.contains('save-row-button')) {
                const rowId = e.target.closest('tr').dataset.rowId;
                handleSaveRow(rowId);
            }

            if (e.target.classList.contains('add-task-button')) {
                if (taskModal) taskModal.style.display = 'block';
            }
        });

        timesheetTbody.addEventListener('input', (e) => {
            if (e.target.classList.contains('time-input')) {
                handleTimeInput(e.target, e.target.value);
            } else if (e.target.classList.contains('hours-input')) {
                handleHoursInput(e.target, e.target.value);
            } else if (e.target.classList.contains('client-input')) {
                handleClientSearch(e.target, e.target.value);
            } else {
                const rowId = e.target.closest('tr').dataset.rowId;
                const field = e.target.dataset.field;
                const value = e.target.value;

                if (rowId && field) {
                    handleCellChange(rowId, field, value);
                }
            }
        });

        timesheetTbody.addEventListener('change', (e) => {
            const rowId = e.target.closest('tr').dataset.rowId;
            const field = e.target.dataset.field;
            const value = e.target.value;

            if (rowId && field) {
                handleCellChange(rowId, field, value);

                if (field === 'tcCategory') {
                    updateTCDisplay(e.target);
                }
            }
        });

        timesheetTbody.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('client-input')) {
                handleClientKeyDown(e);
            }
        });

        timesheetTbody.addEventListener('blur', (e) => {
            if (e.target.classList.contains('client-input')) {
                setTimeout(() => {
                    if (activeClientSearch && activeClientSearch.suggestions) {
                        activeClientSearch.suggestions.style.display = 'none';
                    }
                    activeClientSearch = null;
                    selectedSuggestionIndex = -1;
                }, 200);
            }
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === calendarModal && calendarModal) calendarModal.style.display = 'none';
        if (e.target === taskModal && taskModal) taskModal.style.display = 'none';
        if (e.target === leaveModal && leaveModal) leaveModal.style.display = 'none';
    });

    // Reset inactivity timer on tab navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            resetInactivityTimer();
        }
    });

    console.log('✅ Event listeners attached');
}

// ===================================================================
// INITIALIZATION
// ===================================================================

async function initializePage() {
    try {
        console.log('🚀 Initializing timesheet application...');

        // 1. Load sidebar
        await loadSidebar();

        // 2. Check authentication and load user data
        const session = await checkAuthAndRedirect();
        if (!session) return;

        // 3. Initialize user data and get short name
        currentUser = await AppState.initializeUser();
        if (!currentUser || !currentUser.short_name) {
            showMessage('Error loading user profile. Using default short name.', 'error');
            userShortName = 'USR'; // Fallback
        } else {
            userShortName = currentUser.short_name;
            console.log(`✅ User short name loaded: ${userShortName}`);
        }

        // 4. Load timesheet data
        await loadTimesheetData();

        // 5. Update UI
        updateDateDisplay();
        updateDayControls();

        // 6. Attach event listeners
        attachEventListeners();

        // 7. Start inactivity detection
        setupInactivityDetection();

        // 8. Start auto-save interval
        autoSaveInterval = setInterval(performAutoSave, 30000); // 30 seconds
        console.log('🔄 Auto-save interval started (30 seconds)');

        console.log('✅ Timesheet application initialized successfully');
        showMessage('Timesheet loaded successfully');

    } catch (error) {
        console.error('❌ Error initializing timesheet:', error);
        showMessage('Error loading timesheet', 'error');
    }
}

// ===================================================================
// AUTO-SAVE AND CLEANUP
// ===================================================================

// Save data before page unload
window.addEventListener('beforeunload', (e) => {
    console.log('🔄 Page unloading, performing final save...');

    if (hasUnsavedChanges) {
        // Try to save, but don't block unload
        performAutoSave().catch(err => {
            console.error('❌ Final save failed:', err);
        });

        // Show warning to user
        const confirmationMessage = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }

    saveTimesheetData();

    // Cleanup auto-save interval
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);
