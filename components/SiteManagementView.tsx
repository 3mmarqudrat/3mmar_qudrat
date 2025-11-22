
import React, { useState } from 'react';
import { AppSettings, settingsService } from '../services/settingsService';
import { ArrowRightIcon, SaveIcon } from './Icons';

interface SiteManagementViewProps {
    onBack: () => void;
    onUpdateSettings: (settings: AppSettings) => void;
}

const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onToggle: () => void; }> = ({ label, enabled, onToggle }) => (
    <div className="flex items-center justify-between p-4 bg-zinc-700 rounded-lg border border-zinc-600">
        <span className="font-semibold text-lg">{label}</span>
        <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${enabled ? 'text-green-400' : 'text-red-400'}`}>
                {enabled ? 'مفعل' : 'غير مفعل'}
            </span>
            <label htmlFor={`toggle-${label}`} className="flex items-center cursor-pointer">
                <div className="relative">
                    <input type="checkbox" id={`toggle-${label}`} className="sr-only" checked={enabled} onChange={onToggle} />
                    <div className={`block w-14 h-8 rounded-full transition-colors border-2 ${enabled ? 'bg-green-600 border-green-500' : 'bg-zinc-800 border-red-500'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${enabled ? 'translate-x-6' : ''}`}></div>
                </div>
            </label>
        </div>
    </div>
);


export const SiteManagementView: React.FC<SiteManagementViewProps> = ({ onBack, onUpdateSettings }) => {
    const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
    const [saved, setSaved] = useState(false);

    const handleToggle = (key: keyof AppSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
        setSaved(false);
    };

    const handleSaveChanges = () => {
        settingsService.saveSettings(settings);
        onUpdateSettings(settings); // Immediately update parent state
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    
    return (
        <div className="bg-bg min-h-screen">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-text mx-auto">إدارة الموقع</h1>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-8 max-w-2xl">
                <div className="bg-surface p-6 rounded-lg border border-border space-y-4">
                    <h2 className="text-2xl font-bold mb-4">تفعيل الأقسام (وضع التدريب فقط)</h2>
                     <p className="text-sm text-text-muted pb-2">
                        التحكم في ظهور الأقسام للمستخدمين العاديين في <strong>وضع التدريب</strong>. 
                        <br/>
                        ملاحظة: الأقسام متاحة دائماً في <strong>وضع المراجعة</strong>.
                     </p>
                    <ToggleSwitch 
                        label="القسم اللفظي" 
                        enabled={settings.isVerbalEnabled}
                        onToggle={() => handleToggle('isVerbalEnabled')}
                    />
                    <ToggleSwitch 
                        label="القسم الكمي" 
                        enabled={settings.isQuantitativeEnabled}
                        onToggle={() => handleToggle('isQuantitativeEnabled')}
                    />
                    <div className="pt-4 flex justify-end items-center gap-4">
                         {saved && <span className="text-sm text-green-400 animate-pulse">تم حفظ التغييرات بنجاح!</span>}
                         <button 
                            onClick={handleSaveChanges} 
                            className="flex items-center gap-2 px-6 py-2 bg-accent text-white font-bold rounded-md hover:opacity-90 transition-opacity"
                         >
                             <SaveIcon className="w-5 h-5" />
                            حفظ التغييرات
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};
