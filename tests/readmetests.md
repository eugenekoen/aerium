# AERIUM Testing Guide

## 🧪 Testing Strategy

### Phase 1: Manual Testing (Current)
Test each user flow manually with this checklist:

#### Authentication Tests
- [ ] **Login Success**: Valid credentials → redirect to AllClients.html
- [ ] **Login Failure**: Invalid credentials → show error message
- [ ] **Auto-logout**: Wait 5 minutes → should auto-logout
- [ ] **Session Check**: Navigate to protected page without login → redirect to login
- [ ] **Already Logged In**: Visit login page while logged in → redirect to AllClients

#### Database Connection Tests
- [ ] **Supabase Connection**: Check console for "Supabase client initialized globally"
- [ ] **Data Loading**: Client data loads without errors
- [ ] **Error Handling**: Test with internet disconnected

#### UI/Navigation Tests
- [ ] **Sidebar Loading**: Navigation menu appears on all pages
- [ ] **Logout Button**: Clicking logout successfully signs out
- [ ] **Active Page**: Current page highlighted in sidebar
- [ ] **Responsive Design**: Test on different screen sizes

### Phase 2: Automated Testing (Future)
Create these test files:

#### `tests/auth.test.js`
```javascript
// Test authentication functions
import { checkAuthAndRedirect, handleLogout } from '../js/shared.js';

// Test cases for login/logout flows
tests/database.test.js
javascript
Copy Code
// Test Supabase connection and queries
import { supabase } from '../js/shared.js';

// Test database operations
🐛 Common Issues to Test
Network failures: What happens when internet is down?
Invalid sessions: What if session expires?
Missing data: How does app handle empty database?
Browser compatibility: Test in Chrome, Firefox, Safari

## 🔧 **Immediate Code Improvements**

### **Add to each JavaScript file:**

```javascript
/**
 * AERIUM - [File Purpose]
 * 
 * Dependencies: shared.js
 * Database: Supabase
 * 
 * Key Functions:
 * - [list main functions]
 * 
 * Security: Uses checkAuthAndRedirect() for protection
 */



### index.html Testing
- [ ] **Page loads**: HTML displays correctly
- [ ] **CSS loads**: Styling appears
- [ ] **JS loads**: No console errors
- [ ] **Supabase CDN**: Library loads successfully
- [ ] **Sidebar loading**: Navigation appears
- [ ] **User message**: Welcome message updates
- [ ] **CSP works**: No security violations in console
- [ ] **Mobile responsive**: Works on phone/tablet
- [ ] **Favicon**: Icon shows in browser tab