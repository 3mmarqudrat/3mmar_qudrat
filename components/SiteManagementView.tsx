
import React, { useState, useRef } from 'react';
import { AppSettings, settingsService } from '../services/settingsService';
import { ArrowRightIcon, SaveIcon, UploadCloudIcon, FileTextIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { useAppData } from '../hooks/useAppData';

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
    
    // Hooks for data export/import
    // Note: We use null for userId here because export/import handles ALL data regardless of current user
    const { exportAllData, importAllData } = useAppData(null, true, false); 
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleExport = () => {
        const success = exportAllData();
        if (success) {
            alert("تم بدء تحميل ملف النسخة الاحتياطية. يرجى الاحتفاظ به في مكان آمن.");
        } else {
            alert("حدث خطأ أثناء تصدير البيانات.");
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (confirm("تحذير: استيراد البيانات سيستبدل جميع البيانات الحالية في هذا المتصفح ببيانات الملف. هل أنت متأكد؟")) {
            try {
                await importAllData(file);
                setImportStatus('success');
                alert("تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة.");
                window.location.reload();
            } catch (err) {
                setImportStatus('error');
                alert("فشل استيراد البيانات. تأكد من أن الملف صالح.");
            }
        }
        // Reset input
        e.target.value = '';
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
            <main className="container mx-auto p-4 md:p-8 max-w-3xl">
                <div className="bg-surface p-6 rounded-lg border border-border space-y-8">
                    
                    {/* Data Management Section */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold border-b border-zinc-700 pb-2 text-primary flex items-center gap-2">
                             <UploadCloudIcon className="w-6 h-6" />
                             إدارة البيانات والنسخ الاحتياطي
                        </h2>
                        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-sm text-blue-200">
                             <strong>ملاحظة هامة:</strong> البيانات تحفظ حالياً على هذا الجهاز. لنقل بياناتك إلى جهاز آخر، استخدم زر "تصدير البيانات" لحفظ ملف نسخة احتياطية، ثم استخدم زر "استيراد البيانات" في الجهاز الجديد لرفع ذلك الملف.
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col items-center text-center gap-3">
                                <h3 className="font-bold text-lg">تصدير البيانات</h3>
                                <p className="text-xs text-text-muted">حمل ملف يحتوي على جميع حساباتك واختباراتك.</p>
                                <button onClick={handleExport} className="w-full py-2 bg-zinc-600 hover:bg-zinc-500 rounded font-bold transition-colors flex items-center justify-center gap-2">
                                    <FileTextIcon className="w-4 h-4" />
                                    حفظ نسخة احتياطية
                                </button>
                            </div>

                            <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col items-center text-center gap-3">
                                <h3 className="font-bold text-lg">استيراد البيانات</h3>
                                <p className="text-xs text-text-muted">استعد بياناتك من ملف نسخة احتياطية سابق.</p>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept=".json" 
                                    className="hidden" 
                                />
                                <button onClick={handleImportClick} className="w-full py-2 bg-accent hover:opacity-90 rounded font-bold transition-colors flex items-center justify-center gap-2 text-white">
                                    <UploadCloudIcon className="w-4 h-4" />
                                    رفع ملف نسخة احتياطية
                                </button>
                                {importStatus === 'success' && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> تم الاستيراد بنجاح</span>}
                                {importStatus === 'error' && <span className="text-xs text-red-400 flex items-center gap-1"><XCircleIcon className="w-3 h-3"/> فشل الاستيراد</span>}
                            </div>
                        </div>
                    </div>

                    <hr className="border-zinc-700" />

                    {/* Training Mode Settings */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold border-b border-zinc-700 pb-2 text-primary">إعدادات وضع التدريب</h2>
                        <p className="text-sm text-text-muted pb-2">
                           التحكم في ظهور الأقسام للمستخدمين عند اختيار "التدريب".
                        </p>
                        <ToggleSwitch 
                            label="القسم اللفظي (تدريب)" 
                            enabled={settings.isVerbalEnabled}
                            onToggle={() => handleToggle('isVerbalEnabled')}
                        />
                        <ToggleSwitch 
                            label="القسم الكمي (تدريب)" 
                            enabled={settings.isQuantitativeEnabled}
                            onToggle={() => handleToggle('isQuantitativeEnabled')}
                        />
                    </div>

                    {/* Review Mode Settings */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold border-b border-zinc-700 pb-2 text-primary">إعدادات وضع المراجعة</h2>
                        <p className="text-sm text-text-muted pb-2">
                           التحكم في ظهور الأقسام للمستخدمين عند اختيار "المراجعة".
                        </p>
                        <ToggleSwitch 
                            label="القسم اللفظي (مراجعة)" 
                            enabled={settings.isReviewVerbalEnabled}
                            onToggle={() => handleToggle('isReviewVerbalEnabled')}
                        />
                        <ToggleSwitch 
                            label="القسم الكمي (مراجعة)" 
                            enabled={settings.isReviewQuantitativeEnabled}
                            onToggle={() => handleToggle('isReviewQuantitativeEnabled')}
                        />
                    </div>

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
