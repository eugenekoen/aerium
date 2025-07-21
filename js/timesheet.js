//File Name: js/timesheet.js

// --- Import Shared Functionality ---
import {
    supabase,
    checkAuthAndRedirect,
    setupInactivityDetection,
    loadSidebar,
    resetInactivityTimer
} from './shared.js';


// --- 2. DOM Element References ---
const currentDateElement = document.getElementById('current-date');
const prevDayButton = document.getElementById('prev-day');
const nextDayButton = document.getElementById('next-day');
const todayButton = document.getElementById('today-button');
const toggleCalendarButton = document.getElementById('calendar-toggle');
const dayTypeDisplay = document.getElementById('day-type-display');
const dayTypeSelect = document.getElementById('day-type-select');
const unlockDayButton = document.getElementById('unlock-day');
const lockDayButton = document.getElementById('lock-day');
const workHoursElement = document.getElementById('work-hours');
const leaveHoursElement = document.getElementById('leave-hours');
const totalHoursElement = document.getElementById('total-hours');
const timesheetTbody = document.getElementById('timesheet-tbody');
const addRowButton = document.getElementById('add-row-button');

// Calendar elements
const monthCalendar = document.getElementById('month-calendar');
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthYear = document.getElementById('calendar-month-year');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

// Modal elements
const calendarModal = document.getElementById('calendar-modal');
const calendarClose = document.getElementById('calendar-close');
const taskModal = document.getElementById('task-modal');
const taskModalClose = document.getElementById('task-modal-close');
const leaveModal = document.getElementById('leave-modal');
const leaveModalClose = document.getElementById('leave-modal-close');
const manageLeaveButton = document.getElementById('manage-leave');
const leaveTypeSelect = document.getElementById('leave-type');
const leaveHoursInput = document.getElementById('leave-hours');
const leaveSaveButton = document.getElementById('leave-save');
const leaveCancelButton = document.getElementById('leave-cancel');
const leaveClearButton = document.getElementById('leave-clear');
const messageContainer = document.getElementById('message-container');

// --- 3. Global Variables ---
let currentDate = new Date();
let currentDayType = 'work-day';
let isDayLocked = false;
let timesheetData = [];
let leaveData = { type: '', hours: 0 };
let calendarViewDate = new Date();
let activeClientSearch = null;
let selectedSuggestionIndex = -1;

// --- 4. Dummy Data ---
const dummyClients = [
    { id: 1, name: 'Acme Corporation', code: 'ACM001' },
    { id: 2, name: 'Global Solutions Ltd', code: 'GSL002' },
    { id: 3, name: 'Tech Innovations Inc', code: 'TII003' },
    { id: 4, name: 'Premier Services', code: 'PSV004' },
    { id: 5, name: 'Dynamic Systems', code: 'DYS005' },
    { id: 6, name: 'Excellence Partners', code: 'EPR006' },
    { id: 7, name: 'Future Enterprises', code: 'FEN007' }
];

const dummyTasks = [
    'AFS - 2025',
    'AFS - 2024',
    'Consulting - Tax Issue',
    'Provisional - 202502',
    'Provisional - 202501',
    'Management Accounts',
    'Payroll Processing',
    'VAT Return',
    'PAYE Reconciliation',
    'Year End Procedures',
    'AFS - Unassigned',
    'Provisional - Unassigned',
    'Consulting - Unassigned',
    'Admin - General',
    'Admin - Training'
];

// --- 5. Utility Functions ---
function formatDate(date) {
    return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTimeInput(input, value) {
    // Remove all non-digit characters
    let digits = value.replace(/\D/g, '');

    // Limit to 4 digits
    if (digits.length > 4) {
        digits = digits.slice(0, 4);
    }

    // Format based on length
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

function formatHoursInput(value) {
    // Remove all non-digit and non-decimal characters
    let cleaned = value.replace(/[^0-9.]/g, '');

    // Handle multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to XX.XX format
    if (cleaned.includes('.')) {
        const [whole, decimal] = cleaned.split('.');
        const limitedWhole = whole.slice(0, 2);
        const limitedDecimal = decimal.slice(0, 2);
        cleaned = limitedWhole + '.' + limitedDecimal;
    } else {
        cleaned = cleaned.slice(0, 2);
    }

    // Validate range (0.00 to 99.99)
    const numValue = parseFloat(cleaned);
    if (!isNaN(numValue) && numValue > 99.99) {
        return '99.99';
    }

    return cleaned;
}

function isValidTime(timeString) {
    if (!timeString || timeString.length === 0) return true; // Empty is valid

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
}

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

function calculateHours(startTime, endTime) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (start === null || end === null) return 0;

    let diff = end - start;
    if (diff < 0) diff += 24; // Handle overnight work

    return diff;
}

function generateRowId() {
    return 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;
    messageDiv.style.marginBottom = '10px';

    if (messageContainer) {
        messageContainer.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// --- 6. Storage Functions (Simulating Database) ---
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
    console.log('Timesheet data saved for', dateKey);
}

// function loadTimesheetData() {
//     const dateKey = getDateKey(currentDate);
//     const stored = localStorage.getItem(`timesheet_${dateKey}`);

//     if (stored) {
//         const data = JSON.parse(stored);
//         currentDayType = data.dayType || 'work-day';
//         isDayLocked = data.isLocked || false;
//         timesheetData = data.entries || [];
//         leaveData = data.leave || { type: '', hours: 0 };
//         console.log('Timesheet data loaded for', dateKey);
//     } else {
//         // Start with 7 blank rows
//         generateBlankRows();
//         console.log('Generated 7 blank rows for', dateKey);
//     }
// }

async function loadTimesheetData() {
    try {
        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error('No authenticated user found:', sessionError);
            generateBlankRows();
            return;
        }

        const userId = session.user.id;
        const dateKey = getDateKey(currentDate);

        console.log(`Loading timesheet data for user ${userId} on ${dateKey}`);

        console.log('Supabase query SQL equivalent:', `
SELECT 
    entry_id, te.client_id, date, time_start, time_end, hours, te.task_id, te.description, status, c.client_name, t.task_name
FROM timesheet_entries te
LEFT JOIN "Clients" c ON te.client_id = c."Id"
LEFT JOIN tasks t ON te.task_id = t.task_id
WHERE te.user_id = '${userId}' AND te.date = '${dateKey}'
ORDER BY te.time_start ASC NULLS LAST;
`);

        // Query timesheet entries for the current date and user
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
        Clients!timesheet_entries_client_id_fkey (
            client_name
        ),
        tasks!timesheet_entries_task_id_fkey (
            task_name
        )
    `)
    .eq('user_id', userId)
    .eq('date', dateKey)
    .order('time_start', { ascending: true, nullsFirst: false });

        if (error) {
            console.error('Error loading timesheet data:', error);
            generateBlankRows();
            return;
        }

        if (entries && entries.length > 0) {
            // Transform database entries to match your frontend format
            timesheetData = entries.map(entry => ({
                id: entry.entry_id,
                timeStart: entry.time_start ? formatTimeForInput(entry.time_start) : '',
                timeEnd: entry.time_end ? formatTimeForInput(entry.time_end) : '',
                client: entry.Clients?.client_name || '',
                clientId: entry.client_id,
                task: entry.tasks?.task_name || '',
                taskId: entry.task_id,
                categoryId: entry.category_id,
                description: entry.description || '',
                hours: entry.hours ? parseFloat(entry.hours).toFixed(2) : '',
                status: entry.status || 'open',
                isLocked: entry.status === 'locked' || entry.status === 'approved'
            }));

            // Set day type and lock status based on entries
            // You might want to store this separately or derive it from entries
            currentDayType = 'work-day'; // Default, adjust based on your logic
            isDayLocked = timesheetData.some(entry => entry.isLocked);

            console.log(`Loaded ${entries.length} timesheet entries for ${dateKey}`);
        } else {
            // No entries found, generate blank rows
            generateBlankRows();
            console.log(`No timesheet entries found for ${dateKey}, generated blank rows`);
        }

        // Update the UI
        renderTimesheet();

    } catch (err) {
        console.error('Unexpected error loading timesheet data:', err);
        generateBlankRows();
    }
}

// Helper function to format time from database (HH:MM:SS) to input format (HH:MM)
function formatTimeForInput(timeString) {
    if (!timeString) return '';
    // timeString might be in format "HH:MM:SS" or "HH:MM"
    return timeString.substring(0, 5); // Take first 5 characters (HH:MM)
}

// Helper function to get date in YYYY-MM-DD format for database queries
function getDateKey(date) {
    if (!date) return new Date().toISOString().split('T')[0];
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    return date; // Assume it's already in correct format
}

function generateBlankRows() {
    const dateKey = getDateKey(currentDate);
    const dayOfWeek = currentDate.getDay();

    // Set appropriate day type
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDayType = 'weekend';
    } else {
        currentDayType = 'work-day';
    }

    // Generate 7 blank rows
    timesheetData = [];
    for (let i = 0; i < 7; i++) {
        const entry = {
            id: generateRowId(),
            timeStart: '',
            timeEnd: '',
            client: '',
            task: '',
            description: '',
            hours: '',
            isLocked: false
        };
        timesheetData.push(entry);
    }

    // Reset leave data
    leaveData = { type: '', hours: 0 };

    isDayLocked = false;
}

// --- 7. UI Update Functions ---
function updateDateDisplay() {
    if (currentDateElement) {
        currentDateElement.textContent = formatDate(currentDate);
    }
}

function updateDayTypeDisplay() {
    if (dayTypeDisplay) {
        dayTypeDisplay.textContent = currentDayType.replace('-', ' ').toUpperCase();
        dayTypeDisplay.className = `day-type ${currentDayType}`;
    }

    if (dayTypeSelect) {
        dayTypeSelect.value = currentDayType;
    }
}

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

function updateHoursSummary() {
    let workHours = 0;
    let leaveHours = parseFloat(leaveData.hours) || 0;

    // Calculate work hours from timesheet entries
    timesheetData.forEach(entry => {
        if (entry.hours) {
            workHours += parseFloat(entry.hours) || 0;
        }
    });

    const totalHours = workHours + leaveHours;

    if (workHoursElement) {
        workHoursElement.textContent = `Work: ${workHours.toFixed(2)}h`;
    }

    if (leaveHoursElement) {
        leaveHoursElement.textContent = `Leave: ${leaveHours.toFixed(2)}h`;
    }

    if (totalHoursElement) {
        totalHoursElement.textContent = `Total: ${totalHours.toFixed(2)} / 7.5h`;
    }
}

function createTimeEntryRow(entry) {
    const row = document.createElement('tr');
    row.dataset.rowId = entry.id;

    const isLocked = isDayLocked || entry.isLocked || (currentDayType !== 'work-day' && currentDayType !== 'study-leave');

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
                       value="${entry.client_name || ''}" 
                       placeholder="Search client..." 
                       ${isLocked ? 'disabled' : ''}
                       data-field="client"
                       autocomplete="off">
                <div class="client-suggestions"></div>
            </div>
        </td>
        <td>
            <select class="task-select" ${isLocked ? 'disabled' : ''} data-field="task">
                <option value="">Select task...</option>
                ${dummyTasks.map(task => `<option value="${task}" ${entry.task === task ? 'selected' : ''}>${task}</option>`).join('')}
            </select>
            <button class="add-task-button" ${isLocked ? 'disabled' : ''} title="Add new task">+</button>
        </td>
        <td>
            <textarea class="description-input" 
                      placeholder="Work description..." 
                      ${isLocked ? 'disabled' : ''}
                      data-field="description">${entry.description || ''}</textarea>
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
            <button class="delete-row-button action-button" ${isLocked ? 'disabled' : ''} title="Delete entry">Delete</button>
        </td>
    `;

    return row;
}

function renderTimesheet() {
    if (!timesheetTbody) return;

    timesheetTbody.innerHTML = '';

    timesheetData.forEach(entry => {
        const row = createTimeEntryRow(entry);
        timesheetTbody.appendChild(row);
    });

    updateHoursSummary();
}

// --- 8. Calendar Functions ---
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

    // Get first day of the month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Generate calendar days
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();

        // Add classes for different states
        if (date.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }

        if (date.toDateString() === currentDate.toDateString()) {
            dayElement.classList.add('selected');
        }

        if (date.toDateString() === new Date().toDateString()) {
            dayElement.classList.add('today');
        }

        // Add click handler
        dayElement.addEventListener('click', () => {
            if (date.getMonth() !== month) return;

            saveTimesheetData();
            currentDate = new Date(date);
            loadTimesheetData();
            updateDateDisplay();
            updateDayTypeDisplay();
            updateDayControls();
            renderTimesheet();
            toggleCalendar(); // Close calendar after selection

            showMessage(`Switched to ${formatDate(currentDate)}`);
        });

        calendarGrid.appendChild(dayElement);
    }
}

function navigateMonth(direction) {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + direction);
    renderInlineCalendar();
}

// --- 9. Modal Functions ---
function openCalendarModal() {
    if (calendarModal) {
        calendarModal.style.display = 'block';
        // Add calendar modal rendering here if needed
    }
}

function closeCalendarModal() {
    if (calendarModal) {
        calendarModal.style.display = 'none';
    }
}

function openTaskModal() {
    if (taskModal) {
        taskModal.style.display = 'block';
    }
}

function closeTaskModal() {
    if (taskModal) {
        taskModal.style.display = 'none';
    }
}

// --- 10. Leave Management Functions ---
function openLeaveModal() {
    resetInactivityTimer();

    // Populate current leave data
    if (leaveTypeSelect) {
        leaveTypeSelect.value = leaveData.type || '';
    }
    if (leaveHoursInput) {
        leaveHoursInput.value = leaveData.hours ? leaveData.hours.toFixed(2) : '';
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

function handleLeaveSave() {
    resetInactivityTimer();

    const leaveType = leaveTypeSelect ? leaveTypeSelect.value : '';
    const leaveHours = leaveHoursInput ? parseFloat(leaveHoursInput.value) || 0 : 0;

    // Validate hours
    if (leaveType && (leaveHours <= 0 || leaveHours > 99.99)) {
        showMessage('Please enter valid leave hours (0.01 - 99.99)', 'error');
        return;
    }

    // Update leave data
    leaveData = {
        type: leaveType,
        hours: leaveType ? leaveHours : 0
    };

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

        updateHoursSummary();
        saveTimesheetData();
        closeLeaveModal();

        showMessage('Leave cleared successfully');
    }
}

function handleLeaveHoursInput(input, value) {
    const formatted = formatHoursInput(value);
    input.value = formatted;
}

// --- 11. Event Handlers ---
function handleDateNavigation(direction) {
    resetInactivityTimer();
    saveTimesheetData(); // Save current data before navigating

    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    currentDate = newDate;

    loadTimesheetData();
    updateDateDisplay();
    updateDayTypeDisplay();
    updateDayControls();
    renderTimesheet();

    showMessage(`Navigated to ${formatDate(currentDate)}`);
}

function goToToday() {
    resetInactivityTimer();
    saveTimesheetData();

    currentDate = new Date();
    loadTimesheetData();
    updateDateDisplay();
    updateDayTypeDisplay();
    updateDayControls();
    renderTimesheet();

    showMessage('Navigated to today');
}

function handleDayTypeChange() {
    resetInactivityTimer();
    const oldDayType = currentDayType;
    currentDayType = dayTypeSelect.value;

    // Auto-set leave if changing to a leave day type
    if (currentDayType === 'annual-leave' || currentDayType === 'study-leave') {
        if (leaveData.hours === 0) {
            leaveData = {
                type: currentDayType,
                hours: 7.5
            };
        }
    } else if (oldDayType === 'annual-leave' || oldDayType === 'study-leave') {
        // Clear leave if changing away from leave day
        if (leaveData.type === oldDayType) {
            leaveData = { type: '', hours: 0 };
        }
    }

    updateDayTypeDisplay();
    updateDayControls();
    updateHoursSummary();
    renderTimesheet(); // Re-render to apply locking rules
    saveTimesheetData();

    showMessage(`Day type changed to ${currentDayType.replace('-', ' ')}`);
}

function handleDayLock() {
    resetInactivityTimer();
    isDayLocked = !isDayLocked;
    updateDayControls();
    renderTimesheet();
    saveTimesheetData();

    showMessage(isDayLocked ? 'Day locked successfully' : 'Day unlocked successfully');
}

function handleAddRow() {
    resetInactivityTimer();
    const newEntry = {
        id: generateRowId(),
        timeStart: '',
        timeEnd: '',
        client: '',
        task: '',
        description: '',
        hours: '',
        isLocked: false
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
}

function handleDeleteRow(rowId) {
    resetInactivityTimer();
    timesheetData = timesheetData.filter(entry => entry.id !== rowId);
    renderTimesheet();
    saveTimesheetData();
    showMessage('Time entry deleted');
}

function handleCellChange(rowId, field, value) {
    resetInactivityTimer();
    const entry = timesheetData.find(e => e.id === rowId);
    if (!entry) return;

    entry[field] = value;

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

    updateHoursSummary();
    saveTimesheetData();
}

function handleTimeInput(input, value) {
    const formatted = formatTimeInput(input, value);
    input.value = formatted;

    // Update the data
    const rowId = input.closest('tr').dataset.rowId;
    const field = input.dataset.field;
    handleCellChange(rowId, field, formatted);
}

function handleHoursInput(input, value) {
    const formatted = formatHoursInput(value);
    input.value = formatted;

    // Update the data
    const rowId = input.closest('tr').dataset.rowId;
    const field = input.dataset.field;
    handleCellChange(rowId, field, formatted);
}

function handleClientSearch(input, query) {
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

    const filteredClients = dummyClients.filter(client =>
        client.name.toLowerCase().includes(query.toLowerCase()) ||
        client.code.toLowerCase().includes(query.toLowerCase())
    );

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

    // Store filtered clients for keyboard navigation
    activeClientSearch.filteredClients = filteredClients;
}

function selectClient(client) {
    if (!activeClientSearch) return;

    activeClientSearch.input.value = client.name;
    activeClientSearch.suggestions.style.display = 'none';

    // Trigger change event
    const rowId = activeClientSearch.input.closest('tr').dataset.rowId;
    handleCellChange(rowId, 'client', client.name);

    activeClientSearch = null;
    selectedSuggestionIndex = -1;
}

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

function updateSuggestionSelection() {
    if (!activeClientSearch) return;

    const suggestions = activeClientSearch.suggestions.querySelectorAll('.client-suggestion');
    suggestions.forEach((suggestion, index) => {
        suggestion.classList.toggle('selected', index === selectedSuggestionIndex);
    });
}

// --- 12. Event Listeners ---
function attachEventListeners() {
    // Date navigation
    if (prevDayButton) {
        prevDayButton.addEventListener('click', () => handleDateNavigation(-1));
    }
    if (nextDayButton) {
        nextDayButton.addEventListener('click', () => handleDateNavigation(1));
    }
    if (todayButton) {
        todayButton.addEventListener('click', goToToday);
    }

    // Calendar toggle
    if (toggleCalendarButton) {
        toggleCalendarButton.addEventListener('click', toggleCalendar);
    }
    if (prevMonthButton) {
        prevMonthButton.addEventListener('click', () => navigateMonth(-1));
    }
    if (nextMonthButton) {
        nextMonthButton.addEventListener('click', () => navigateMonth(1));
    }

    // Day type change
    if (dayTypeSelect) {
        dayTypeSelect.addEventListener('change', handleDayTypeChange);
    }

    // Day locking
    if (unlockDayButton) {
        unlockDayButton.addEventListener('click', handleDayLock);
    }
    if (lockDayButton) {
        lockDayButton.addEventListener('click', handleDayLock);
    }

    // Add row
    if (addRowButton) {
        addRowButton.addEventListener('click', handleAddRow);
    }

    // Leave management
    if (manageLeaveButton) {
        manageLeaveButton.addEventListener('click', openLeaveModal);
    }
    if (leaveModalClose) {
        leaveModalClose.addEventListener('click', closeLeaveModal);
    }
    if (leaveSaveButton) {
        leaveSaveButton.addEventListener('click', handleLeaveSave);
    }
    if (leaveCancelButton) {
        leaveCancelButton.addEventListener('click', closeLeaveModal);
    }
    if (leaveClearButton) {
        leaveClearButton.addEventListener('click', handleLeaveClear);
    }

    // Leave hours input formatting
    if (leaveHoursInput) {
        leaveHoursInput.addEventListener('input', (e) => {
            handleLeaveHoursInput(e.target, e.target.value);
        });
    }

    // Calendar modal
    if (calendarClose) {
        calendarClose.addEventListener('click', closeCalendarModal);
    }

    // Task modal
    if (taskModalClose) {
        taskModalClose.addEventListener('click', closeTaskModal);
    }

    // Event delegation for dynamic content
    if (timesheetTbody) {
        timesheetTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-row-button')) {
                const rowId = e.target.closest('tr').dataset.rowId;
                if (confirm('Are you sure you want to delete this time entry?')) {
                    handleDeleteRow(rowId);
                }
            }

            if (e.target.classList.contains('add-task-button')) {
                openTaskModal();
            }
        });

        // Handle input formatting and changes
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
            }
        });

        // Client search keyboard navigation
        timesheetTbody.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('client-input')) {
                handleClientKeyDown(e);
            }
        });

        timesheetTbody.addEventListener('blur', (e) => {
            if (e.target.classList.contains('client-input')) {
                // Hide suggestions after a delay to allow clicking
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
        if (e.target === calendarModal) {
            closeCalendarModal();
        }
        if (e.target === taskModal) {
            closeTaskModal();
        }
        if (e.target === leaveModal) {
            closeLeaveModal();
        }
    });

    // Handle tab navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            resetInactivityTimer();
        }
    });
}

// --- 13. Initialization ---
async function initializePage() {
    try {
        // 1. Load Sidebar
        await loadSidebar();

        // 2. Check Authentication
        const session = await checkAuthAndRedirect();
        if (!session) return;

        // 3. Load initial data
        loadTimesheetData();

        // 4. Update UI
        updateDateDisplay();
        updateDayTypeDisplay();
        updateDayControls();
        renderTimesheet();

        // 5. Attach event listeners
        attachEventListeners();

        // 6. Start inactivity detection
        setupInactivityDetection();

        showMessage('Timesheet loaded successfully');

    } catch (error) {
        console.error('Error initializing timesheet:', error);
        showMessage('Error loading timesheet', 'error');
    }
}

// --- 14. Auto-save functionality ---
setInterval(() => {
    if (timesheetData.length > 0) {
        saveTimesheetData();
    }
}, 30000); // Auto-save every 30 seconds

// --- 15. Event Listeners ---
document.addEventListener('DOMContentLoaded', initializePage);

// Save data before page unload
window.addEventListener('beforeunload', () => {
    saveTimesheetData();
});
