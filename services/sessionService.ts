// Fix: Remove non-existent 'TestContext' from import.
import { UserAnswer, Section, Test, TestAttempt, Folder, ReviewFilterState } from '../types';

// This defines the structure of the state that gets saved to localStorage.
// It's a subset of the main AppState to avoid saving transient UI states like modal visibility.
export interface SessionState {
  pageHistory?: string[];
  userMode?: 'training' | 'review' | null;
  selectedSection?: Section | null;
  // Test-specific state
  currentTest?: Test | null;
  currentTestContext?: { bankKey?: string; categoryKey?: string };
  userAnswers?: UserAnswer[];
  elapsedTime?: number;
  // UI persistence state
  openBankKeys?: string[]; // Stored as array because Set doesn't stringify to JSON
  selectedTestId?: string | null;
  reviewFilters?: ReviewFilterState;
}

const getSessionKey = (userKey: string) => `qudratSession_${userKey}`;

export const sessionService = {
    saveSessionState: (state: SessionState, userKey: string) => {
        if (!userKey) return;
        try {
            localStorage.setItem(getSessionKey(userKey), JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save session state:", error);
        }
    },

    loadSessionState: (userKey: string): SessionState | null => {
        if (!userKey) return null;
        try {
            const savedStateJSON = localStorage.getItem(getSessionKey(userKey));
            if (savedStateJSON) {
                const loadedState = JSON.parse(savedStateJSON);
                return loadedState;
            }
            return null;
        } catch (error) {
            console.error("Failed to load session state:", error);
            return null;
        }
    },

    clearTestState: (userKey: string) => {
        if (!userKey) return;
        try {
            const session = sessionService.loadSessionState(userKey);
            if (session) {
                delete session.currentTest;
                delete session.currentTestContext;
                delete session.userAnswers;
                delete session.elapsedTime;
                sessionService.saveSessionState(session, userKey);
            }
        } catch (error) {
            console.error("Failed to clear test state:", error);
        }
    },

    clearFullSessionState: (userKey: string) => {
        if (!userKey) return;
        try {
            localStorage.removeItem(getSessionKey(userKey));
        } catch (error) {
            console.error("Failed to clear session state:", error);
        }
    },
};