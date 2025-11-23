
export interface AppSettings {
    isQuantitativeEnabled: boolean;
    isVerbalEnabled: boolean;
    // New settings for Review Mode
    isReviewQuantitativeEnabled: boolean;
    isReviewVerbalEnabled: boolean;
}

const SETTINGS_KEY = 'qudratAppSettings';

const defaultSettings: AppSettings = {
    isQuantitativeEnabled: true,
    isVerbalEnabled: true,
    isReviewQuantitativeEnabled: true,
    isReviewVerbalEnabled: true,
};

export const settingsService = {
    getSettings: (): AppSettings => {
        try {
            const settings = localStorage.getItem(SETTINGS_KEY);
            if (settings) {
                // Merge saved settings with defaults to ensure all keys are present
                return { ...defaultSettings, ...JSON.parse(settings) };
            }
            return defaultSettings;
        } catch (e) {
            console.error("Failed to load settings from localStorage", e);
            return defaultSettings;
        }
    },

    saveSettings: (settings: AppSettings) => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save settings to localStorage", e);
        }
    },
};
