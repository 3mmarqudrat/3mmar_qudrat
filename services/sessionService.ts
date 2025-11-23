
// Fix: Remove non-existent 'TestContext' from import.
import { UserAnswer, Section, Test, Folder, ReviewFilterState } from '../types';
import { storageService } from './storageService';

// This defines the structure of the state that gets saved.
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
    saveSessionState: async (state: SessionState, userKey: string) => {
        if (!userKey) return;
        try {
            await storageService.setItem(getSessionKey(userKey), state);
        } catch (error) {
            console.error("Failed to save session state:", error);
        }
    },

    loadSessionState: async (userKey: string): Promise<SessionState | null> => {
        if (!userKey) return null;
        try {
            return await storageService.getItem<SessionState>(getSessionKey(userKey));
        } catch (error) {
            console.error("Failed to load session state:", error);
            return null;
        }
    },

    clearTestState: async (userKey: string) => {
        if (!userKey) return;
        try {
            const session = await sessionService.loadSessionState(userKey);
            if (session) {
                delete session.currentTest;
                delete session.currentTestContext;
                delete session.userAnswers;
                delete session.elapsedTime;
                await sessionService.saveSessionState(session, userKey);
            }
        } catch (error) {
            console.error("Failed to clear test state:", error);
        }
    },

    clearFullSessionState: async (userKey: string) => {
        if (!userKey) return;
        try {
            await storageService.removeItem(getSessionKey(userKey));
        } catch (error) {
            console.error("Failed to clear session state:", error);
        }
    },
};
