// File: js/appState.js
import { supabase, checkAuthAndRedirect } from './shared.js';

export const AppState = {
    user: null,
    session: null,
    
    // Initialize user data (call once)
    async initializeUser() {
        if (this.user) return this.user; // Already loaded
        
        this.session = await checkAuthAndRedirect();
        if (!this.session) return null;
        
        console.log(`Fetching profile for user ID: ${this.session.user.id}`);
        
        try {
            const { data: profile, error } = await supabase
                .from('Profiles')
                .select('full_name')
                .eq('id', this.session.user.id)
                .maybeSingle();
                
            if (error) {
                console.error('Error fetching user profile:', error);
                // Fallback to email
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
            
            console.log('User state loaded:', this.user);
            return this.user;
            
        } catch (err) {
            console.error('Unexpected error fetching user data:', err);
            return null;
        }
    },
    
    // Get user data (no database call)
    getUser() {
        return this.user;
    },
    
    // Clear on logout
    clearUser() {
        this.user = null;
        this.session = null;
    }
};