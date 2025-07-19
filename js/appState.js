// File: js/appState.js
import { supabase, checkAuthAndRedirect } from './shared.js';

export const AppState = {
    user: null,
    session: null,
    
    // Load from localStorage on initialization
    _loadFromStorage() {
        try {
            const storedUser = localStorage.getItem('appState_user');
            const storedSession = localStorage.getItem('appState_session');
            
            if (storedUser) this.user = JSON.parse(storedUser);
            if (storedSession) this.session = JSON.parse(storedSession);
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this._clearStorage();
        }
    },
    
    // Save to localStorage
    _saveToStorage() {
        try {
            if (this.user) {
                localStorage.setItem('appState_user', JSON.stringify(this.user));
            }
            if (this.session) {
                localStorage.setItem('appState_session', JSON.stringify(this.session));
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },
    
    // Clear localStorage
    _clearStorage() {
        localStorage.removeItem('appState_user');
        localStorage.removeItem('appState_session');
    },
    
    // Initialize user data (call once per page load)
    async initializeUser() {
        // First, try to load from storage
        this._loadFromStorage();
        
        if (this.user && this.session) {
            console.log('User loaded from storage:', this.user);
            return this.user; // Return cached data
        }
        
        // If not in storage, fetch from Supabase
        this.session = await checkAuthAndRedirect();
        if (!this.session) {
            this._clearStorage();
            return null;
        }
        
        console.log(`Fetching profile for user ID: ${this.session.user.id}`);
        
        try {
            const { data: profile, error } = await supabase
                .from('Profiles')
                .select('full_name')
                .eq('id', this.session.user.id)
                .maybeSingle();
                
            if (error) {
                console.error('Error fetching user profile:', error);
                this.user = {
                    id: this.session.user.id,
                    email: this.session.user.email,
                    full_name: this.session.user.email
                };
            } else {
                this.user = {
                    id: this.session.user.id,
                    email: this.session.user.email,
                    full_name: profile?.full_name || this.session.user.email
                };
            }
            
            // Save to storage after successful fetch
            this._saveToStorage();
            
            console.log('User state loaded and cached:', this.user);
            return this.user;
            
        } catch (err) {
            console.error('Unexpected error fetching user data:', err);
            this._clearStorage();
            return null;
        }
    },
    
    // Get user data (no database call)
    getUser() {
        if (!this.user) {
            this._loadFromStorage();
        }
        return this.user;
    },
    
    // Clear on logout
    clearUser() {
        this.user = null;
        this.session = null;
        this._clearStorage();
    }
};