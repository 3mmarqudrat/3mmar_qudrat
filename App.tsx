
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Section, Test, TestAttempt, UserAnswer, Question, Folder, VERBAL_BANKS, VERBAL_CATEGORIES, VerbalTests, FolderQuestion, AppData, User, ReviewFilterState } from './types';
import { useAppData } from './hooks/useAppData';
import { BarChartIcon, BookOpenIcon, PlusCircleIcon, ArrowLeftIcon, HistoryIcon, TrashIcon, UploadCloudIcon, CheckCircleIcon, XCircleIcon, FolderIcon, SaveIcon, ChevronDownIcon, ArrowRightIcon, PlayIcon, LogOutIcon, UserIcon, MailIcon, KeyIcon, FileTextIcon, EyeIcon, EyeOffIcon, InfoIcon, ClockIcon, SettingsIcon, BookmarkIcon, CalendarIcon } from './components/Icons';
import { AuthView } from './components/AuthView';
import { AdminView } from './components/AdminView';
import { authService } from './services/authService';
import { AppSettings, settingsService } from './services/settingsService';
import { SiteManagementView } from './components/SiteManagementView';
import { VerbalManagementView } from './components/VerbalManagementView';
import { QuantitativeManagementView } from './components/QuantitativeManagementView';
import { TakeTestView } from './components/TakeTestView';
import { SessionState, sessionService } from './services/sessionService';
import { SummaryView } from './components/SummaryView';

// Fix: Add formatTime function to be used in multiple components for displaying durations.
const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const toArabicNumerals = (str: string) => {
    return str.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
};

const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    const dayName = date.toLocaleDateString('ar-SA', { weekday: 'long' });
    
    // Manual formatting for exact control
    const gregDay = toArabicNumerals(date.getDate().toString());
    const gregMonth = toArabicNumerals((date.getMonth() + 1).toString()); // Numeric month
    const gregYear = toArabicNumerals(date.getFullYear().toString());
    const gregDate = `${gregDay}/${gregMonth}/${gregYear} م`;

    const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'numeric', // Numeric month
        year: 'numeric'
    });
    const hijriParts = hijriFormatter.formatToParts(date);
    const hijriDay = toArabicNumerals(hijriParts.find(p => p.type === 'day')?.value || '');
    const hijriMonth = toArabicNumerals(hijriParts.find(p => p.type === 'month')?.value || '');
    const hijriYear = toArabicNumerals(hijriParts.find(p => p.type === 'year')?.value || '');
    const hijriDate = `${hijriDay}/${hijriMonth}/${hijriYear} هـ`;

    const time = toArabicNumerals(date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    return { dayName, gregDate, hijriDate, time };
};

const UserMenu: React.FC<{ user: User; onLogout: () => void; children?: React.ReactNode; }> = ({ user, onLogout, children }) => (
    <div className="flex items-center gap-2 md:gap-4">
        {children}
        <div className="flex items-center gap-2 bg-zinc-800/50 py-1 px-3 rounded-full border border-zinc-700 hidden md:flex">
            <UserIcon className="w-4 h-4 text-text-muted" />
            <span className="font-bold text-text text-sm">{user.username}</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-red-900/50 transition-colors bg-zinc-800 border border-zinc-700 hover:border-red-500/50 group" aria-label="تسجيل الخروج">
            <span className="text-sm font-bold text-text-muted group-hover:text-red-400 transition-colors">خروج</span>
            <LogOutIcon className="w-4 h-4 text-red-500"/>
        </button>
    </div>
);


const Header: React.FC<{
    title: string;
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
}> = ({ title, leftSlot, rightSlot }) => (
    <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b" style={{borderColor: 'var(--color-border)'}}>
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex-1 flex justify-start items-center gap-2">{leftSlot}</div>
            <h1 className="text-lg md:text-2xl font-bold text-text text-center truncate px-2 md:px-4">{title}</h1>
            <div className="flex-1 flex justify-end items-center gap-2">{rightSlot}</div>
        </div>
    </header>
);


const SectionCard: React.FC<{ title: string; icon: React.ReactNode; onClick: () => void; description?: string; enabled?: boolean; }> = ({ title, icon, onClick, description, enabled = true }) => (
    <div 
        onClick={enabled ? onClick : undefined} 
        className={`group relative bg-surface rounded-xl shadow-lg p-8 transition-all duration-300 border ${enabled ? 'cursor-pointer hover:border-primary hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2' : 'border-zinc-700 opacity-70 cursor-not-allowed'}`}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
        <div className={`relative z-10 ${!enabled ? 'blur-[1px] grayscale' : ''}`}>
            <div className="transition-transform duration-300 group-hover:scale-110 text-center">
                {icon}
            </div>
            <h2 className={`text-2xl font-bold mt-6 text-text text-center transition-colors duration-300 ${enabled ? 'group-hover:text-primary': ''}`}>{title}</h2>
            {description && <p className="text-text-muted text-center mt-2">{description}</p>}
        </div>
        {!enabled && (
             <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="bg-zinc-900/90 border border-amber-500/50 px-6 py-3 rounded-lg transform -rotate-6 shadow-xl backdrop-blur-sm">
                     <span className="text-amber-400 font-bold text-xl tracking-wider">قريباً</span>
                </div>
            </div>
        )}
    </div>
);

const HomeView: React.FC<{
    username: string;
    onSelectUserMode: (mode: 'training' | 'review') => void;
    onLogout: () => void;
    onGoToAdmin: () => void;
    onGoToSiteManagement: () => void;
    onGoToVerbalManagement: () => void;
    onGoToQuantitativeManagement: () => void;
    isDevUser: boolean;
    isPreviewMode: boolean;
    onTogglePreviewMode: () => void;
    previewingUser: User | null;
}> = ({
    username,
    onSelectUserMode,
    onLogout,
    onGoToAdmin,
    onGoToSiteManagement,
    onGoToVerbalManagement,
    onGoToQuantitativeManagement,
    isDevUser,
    isPreviewMode,
    onTogglePreviewMode,
    previewingUser
}) => {
    const showDevView = isDevUser && !isPreviewMode;
    
    return (
        <div className="bg-bg min-h-screen">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b" style={{borderColor: 'var(--color-border)'}}>
                <div className="container mx-auto flex items-center justify-between">
                    {/* Header Title Removed as requested */}
                    <div className="flex-1"></div> 
                    <div className="flex items-center gap-2 md:gap-4">
                        { isDevUser && (
                             <div className="flex items-center gap-2 bg-zinc-800 p-1.5 rounded-lg border border-zinc-700">
                                <label htmlFor="preview-switch" className="flex items-center cursor-pointer gap-2 select-none">
                                    <span className={`text-xs font-bold transition-colors ${!isPreviewMode ? 'text-primary' : 'text-zinc-500'}`}>وضع المطور</span>
                                    <div className="relative">
                                        <input type="checkbox" id="preview-switch" className="sr-only" checked={isPreviewMode} onChange={onTogglePreviewMode} />
                                        <div className={`block w-10 h-5 rounded-full transition-colors ${isPreviewMode ? 'bg-accent' : 'bg-zinc-600'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${isPreviewMode ? 'translate-x-5' : ''}`}></div>
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${isPreviewMode ? 'text-accent' : 'text-zinc-500'}`}>وضع المعاينة</span>
                                </label>
                            </div>
                        )}
                         { isDevUser && <span className="hidden sm:inline font-semibold text-text-muted opacity-50">|</span> }
                        <UserMenu user={{username} as User} onLogout={onLogout} />
                    </div>
                </div>
                { isPreviewMode && previewingUser && (
                    <div className="bg-amber-500/20 border-t border-amber-500/30 text-amber-300 text-center py-1 text-sm font-semibold">
                        أنت الآن في وضع المعاينة لحساب: {previewingUser.username} ({previewingUser.email})
                    </div>
                )}
            </header>
            <main className="container mx-auto p-4 md:p-8">
                <div className="text-center mb-12">
                     <h2 className="text-3xl md:text-4xl font-bold text-text">أهلاً بك، <span style={{color: 'var(--color-primary)'}}>{username}</span>!</h2>
                     <p className="mt-4 text-lg text-text-muted">
                        {showDevView ? "اختر مهمة للبدء." : "اختر الخيار الذي تود البدء به."}
                     </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    { showDevView ? (
                        <>
                           <SectionCard 
                                title="إدارة المستخدمين" 
                                icon={<UserIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={onGoToAdmin}
                                description="عرض وإدارة حسابات المستخدمين."
                            />
                             <SectionCard
                                title="إدارة الموقع"
                                icon={<SettingsIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={onGoToSiteManagement}
                                description="تفعيل أو إلغاء تفعيل الأقسام."
                            />
                            <SectionCard 
                                title="إدارة القسم اللفظي" 
                                icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={onGoToVerbalManagement}
                                description="إضافة وتعديل اختبارات القسم اللفظي."
                            />
                             <SectionCard 
                                title="إدارة القسم الكمي" 
                                icon={<BarChartIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={onGoToQuantitativeManagement}
                                description="إضافة وتعديل اختبارات القسم الكمي."
                            />
                        </>
                    ) : (
                        <>
                            <SectionCard 
                                title="التدريب" 
                                icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={() => onSelectUserMode('training')}
                                description="ابدأ التدرب على اختبارات جديدة."
                            />
                            <SectionCard 
                                title="المراجعة" 
                                icon={<FileTextIcon className="w-16 h-16 text-primary mx-auto"/>}
                                onClick={() => onSelectUserMode('review')}
                                description="راجع الأخطاء والأسئلة المحفوظة."
                            />
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

const ModeSelectionView: React.FC<{
    onBack: () => void;
    onSelectSection: (section: Section, mode: 'training' | 'review') => void;
    userMode: 'training' | 'review';
    settings: AppSettings;
    user: User;
    onLogout: () => void;
}> = ({ onBack, onSelectSection, userMode, settings, user, onLogout }) => {
    const title = userMode === 'training' ? 'التدريب' : 'المراجعة';
    const description = userMode === 'training' ? 'اختر القسم الذي تود التدرب عليه.' : 'اختر القسم الذي تود مراجعته.';
    
    // Logic Update: Apply granular settings
    const isVerbalEnabled = userMode === 'training' ? settings.isVerbalEnabled : settings.isReviewVerbalEnabled;
    const isQuantitativeEnabled = userMode === 'training' ? settings.isQuantitativeEnabled : settings.isReviewQuantitativeEnabled;

    return (
        <div className="bg-bg min-h-screen">
            <Header 
                title={title} 
                leftSlot={<button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted"/></button>}
                rightSlot={<UserMenu user={user} onLogout={onLogout} />}
            />
            <main className="container mx-auto p-4 md:p-8">
                <div className="text-center mb-12">
                     <h2 className="text-3xl md:text-4xl font-bold text-text">{title}</h2>
                     <p className="mt-4 text-lg text-text-muted">{description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto justify-center">
                    <SectionCard 
                        title="القسم اللفظي" 
                        icon={<BookOpenIcon className="w-16 h-16 text-primary mx-auto"/>}
                        onClick={() => onSelectSection('verbal', userMode)}
                        description="التناظر اللفظي، إكمال الجمل، والمزيد."
                        enabled={isVerbalEnabled}
                    />
                    <SectionCard 
                        title="القسم الكمي" 
                        icon={<BarChartIcon className="w-16 h-16 text-primary mx-auto"/>}
                        onClick={() => onSelectSection('quantitative', userMode)}
                        description="الجبر، الهندسة، والإحصاء."
                        enabled={isQuantitativeEnabled}
                    />
                </div>
            </main>
        </div>
    );
};

const SectionView: React.FC<{
    section: Section;
    data: AppData;
    onBack: () => void;
    onStartTest: (test: Test, bankKey?: string, categoryKey?: string) => void;
    onReviewAttempt: (attempt: TestAttempt) => void;
    headerLeftSlot?: React.ReactNode;
    headerRightSlot?: React.ReactNode;
    openBankKeys: Set<string>;
    onToggleBank: (bankKey: string) => void;
    selectedTestId: string | null;
    onSelectTest: (test: Test, bankKey?: string, categoryKey?: string) => void;
}> = ({ section, data, onBack, onStartTest, onReviewAttempt, headerLeftSlot, headerRightSlot, openBankKeys, onToggleBank, selectedTestId, onSelectTest }) => {
    
    const selectedTestInfo = useMemo(() => {
        if (!selectedTestId) return null;
        
        if (section === 'quantitative') {
            const test = data.tests.quantitative.find(t => t.id === selectedTestId);
            return test ? { test, bankKey: undefined, categoryKey: undefined } : null;
        }

        for (const bankKey in data.tests.verbal) {
            for (const catKey in data.tests.verbal[bankKey]) {
                const test = data.tests.verbal[bankKey][catKey].find(t => t.id === selectedTestId);
                if (test) {
                    return { test, bankKey, categoryKey: catKey };
                }
            }
        }
        return null;
    }, [selectedTestId, data.tests.verbal, data.tests.quantitative, section]);

    const attemptsForSelectedTest = selectedTestInfo ? data.history.filter(a => a.testId === selectedTestInfo.test.id) : [];
    
    const renderSidebar = () => {
        if (section === 'quantitative') {
            // Sort Quantitative tests numerically
            const sortedTests = [...data.tests.quantitative].sort((a, b) => {
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });

             return (
                <nav className="space-y-3">
                    <h2 className="text-lg font-bold text-text-muted px-2 mb-4">الاختبارات ({sortedTests.length})</h2>
                    <div className="space-y-2">
                        {sortedTests.length > 0 ? (
                            sortedTests.map(test => (
                                <div 
                                    key={test.id} 
                                    onClick={(e) => { e.preventDefault(); onSelectTest(test); }}
                                    className={`flex justify-between items-center p-3 rounded-lg border transition-all cursor-pointer group ${
                                        selectedTestId === test.id 
                                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/5' 
                                        : 'border-zinc-700 bg-surface hover:border-zinc-500 hover:bg-zinc-700/50'
                                    }`}
                                >
                                    <span 
                                        className={`flex-grow text-right text-base font-medium pr-2 truncate ${
                                            selectedTestId === test.id ? 'text-primary' : 'text-text group-hover:text-slate-200'
                                        }`}
                                    >
                                        {test.name}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); onStartTest(test); }} className="px-3 py-1 bg-zinc-800 border border-zinc-600 text-accent font-bold rounded hover:bg-accent hover:text-white hover:border-accent transition-colors flex items-center gap-1" title={`بدء ${test.name}`}>
                                        <PlayIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-text-muted italic bg-surface rounded-lg border border-dashed border-zinc-700">لا توجد اختبارات متاحة حالياً.</div>
                        )}
                    </div>
                </nav>
            );
        }

        const verbalTests = data.tests.verbal;
        const totalTestsCount = Object.values(verbalTests)
        .reduce((total, bank) =>
            total + Object.keys(bank).reduce((bankTotal, catKey) => bankTotal + bank[catKey].length, 0),
        0);
        
        return (
             <nav className="space-y-2">
                <h2 className="text-lg font-bold text-text-muted px-2 mb-2">البنوك ({totalTestsCount})</h2>
                {Object.entries(VERBAL_BANKS).map(([bankKey, bankName]) => {
                    const bankData = verbalTests[bankKey] || {};
                    const bankTestCount = Object.keys(bankData).reduce((count, catKey) => count + bankData[catKey].length, 0);

                    return (
                        <div key={bankKey} className="mb-2">
                            <button 
                                onClick={() => onToggleBank(bankKey)} 
                                className={`w-full flex justify-between items-center text-right p-4 rounded-lg border transition-all duration-200 ${openBankKeys.has(bankKey) ? 'bg-zinc-800 border-primary text-primary' : 'bg-surface border-border hover:border-zinc-500 text-text'}`}
                            >
                                <span className="font-bold text-lg">{bankName} <span className="text-sm font-normal text-text-muted opacity-70">({bankTestCount})</span></span>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${openBankKeys.has(bankKey) ? 'rotate-180 text-primary' : 'text-text-muted'}`} />
                            </button>
                            {openBankKeys.has(bankKey) && (
                                <div className="pr-3 mt-2 space-y-4 border-r-2 border-zinc-800 mr-2">
                                    {Object.entries(VERBAL_CATEGORIES).map(([catKey, catName]) => {
                                        const tests = bankData[catKey] || [];
                                        return (
                                            <div key={catKey} className="bg-zinc-900/30 rounded-lg p-2">
                                                <h4 className="font-bold text-sky-400 text-base mb-3 px-2 tracking-wide flex items-center gap-2 border-b border-zinc-800 pb-2">
                                                   <span className="w-2 h-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50"></span>
                                                   {catName}
                                                </h4>
                                                <div className="space-y-2 pl-1">
                                                    {tests.length > 0 ? (
                                                        tests.map(test => (
                                                        <div 
                                                            key={test.id} 
                                                            onClick={(e) => { e.preventDefault(); onSelectTest(test, bankKey, catKey); }}
                                                            className={`flex justify-between items-center p-3 rounded-md transition-all cursor-pointer group border ${
                                                                selectedTestId === test.id 
                                                                ? 'border-accent bg-accent/10 shadow-sm' 
                                                                : 'border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600'
                                                            }`}
                                                        >
                                                            <span 
                                                                className={`flex-grow text-right text-sm pr-2 ${
                                                                    selectedTestId === test.id ? 'text-accent font-bold' : 'text-text-muted group-hover:text-text'
                                                                }`}
                                                            >
                                                                {test.name}
                                                            </span>
                                                            <button onClick={(e) => { e.stopPropagation(); onStartTest(test, bankKey, catKey); }} className="p-1.5 bg-zinc-700 border border-zinc-600 text-accent rounded hover:bg-accent hover:text-white transition-colors" title={`بدء ${test.name}`}>
                                                                <PlayIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-2 text-xs text-zinc-600 italic text-center">لا توجد اختبارات.</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
        );
    };

    return (
        <div className="bg-bg min-h-screen flex flex-col">
            <Header title={`التدريب - ${section === 'quantitative' ? 'القسم الكمي' : 'القسم اللفظي'}`} leftSlot={headerLeftSlot} rightSlot={headerRightSlot} />
            {/* Mobile: Stack vertical. Desktop: Row. No fixed height to allow scrolling */}
            <div className="container mx-auto flex flex-col md:flex-row flex-grow">
                {/* Sidebar - Mobile Order 1 */}
                <aside className="w-full md:w-1/3 lg:w-1/4 p-4 border-b md:border-b-0 md:border-l border-border md:max-h-none overflow-y-auto">
                   {renderSidebar()}
                </aside>
                {/* Main Content - Mobile Order 2 */}
                <main className="w-full md:w-2/3 lg:w-3/4 p-4 md:p-6 flex flex-col">
                    {/* Ensure this container grows to fill available space */}
                    <div className="bg-surface rounded-lg p-4 md:p-6 border border-border flex-grow flex flex-col">
                        {selectedTestInfo ? (
                            <div className="flex-grow flex flex-col">
                                <h3 className="text-3xl font-bold text-primary mb-2">{selectedTestInfo.test.name}</h3>
                                {section === 'verbal' && (
                                    <p className="text-md text-text-muted mb-6">{VERBAL_BANKS[selectedTestInfo.bankKey!]} - {VERBAL_CATEGORIES[selectedTestInfo.categoryKey!]}</p>
                                )}
                                {section === 'quantitative' && (
                                    <p className="text-md text-text-muted mb-6">القسم الكمي</p>
                                )}
                                <div className="bg-zinc-900/50 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-lg">عدد الأسئلة: <span className="font-bold text-xl">{selectedTestInfo.test.questions.length}</span></p>
                                    <button 
                                        onClick={() => onStartTest(selectedTestInfo.test, selectedTestInfo.bankKey, selectedTestInfo.categoryKey)}
                                        className="w-full sm:w-auto px-8 py-3 bg-accent border-2 border-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-lg transform transition-transform hover:scale-105"
                                    >
                                        بدء الاختبار
                                    </button>
                                </div>

                                <div className="flex justify-between items-center mt-8 mb-4 border-b border-border pb-2">
                                    <h4 className="text-xl font-bold">سجل المحاولات</h4>
                                    <span className="text-sm font-bold text-text-muted bg-zinc-700 px-3 py-1 rounded-full">{attemptsForSelectedTest.length} محاولات</span>
                                </div>
                                {attemptsForSelectedTest.length > 0 ? (
                                    // Use grow to let it expand naturally
                                    <div className="space-y-3 flex-grow">
                                        {attemptsForSelectedTest.map(attempt => {
                                            const answeredCount = attempt.answers.filter(a => a.answer).length;
                                            const unanswered = attempt.totalQuestions - answeredCount;
                                            const incorrect = answeredCount - attempt.score;
                                            const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                                            const { dayName, gregDate, hijriDate, time } = formatDateShort(attempt.date);

                                            return (
                                                <div key={attempt.id} onClick={() => onReviewAttempt(attempt)} className="p-4 bg-zinc-800 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-start gap-3">
                                                            <div className="bg-zinc-700 p-2 rounded-md hidden sm:block h-fit">
                                                                <CalendarIcon className="w-5 h-5 text-text-muted" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-base text-text">{dayName}</p>
                                                                <div className="flex flex-col gap-1 text-xs text-text-muted mt-1 font-bold">
                                                                     <span>{hijriDate}</span>
                                                                     <span>{gregDate}</span>
                                                                     <span className="text-primary mt-1 block font-mono" dir="ltr">{time}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className={`font-bold text-xl ${percentage >= 50 ? 'text-green-400' : 'text-red-400'}`}>{percentage}%</p>
                                                            <span className="text-sm text-text-muted">({attempt.score}/{attempt.totalQuestions})</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-text-muted border-t border-zinc-700 pt-3 mt-1 gap-2 flex-wrap">
                                                        <span className="truncate"><span className="text-green-400 font-semibold">{attempt.score}</span> صح</span>
                                                        <span className="truncate"><span className="text-red-400 font-semibold">{incorrect}</span> خطأ</span>
                                                        <span className="truncate"><span className="text-yellow-400 font-semibold">{unanswered}</span> متروك</span>
                                                        <span className="truncate flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {formatTime(attempt.durationSeconds)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-text-muted text-center py-8">لا توجد محاولات سابقة لهذا الاختبار.</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-text-muted py-16 flex-grow">
                                <ArrowLeftIcon className="w-16 h-16 mb-4 animate-pulse" />
                                <p className="text-lg">الرجاء تحديد اختبار من الشريط الجانبي لعرض التفاصيل.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

const ReviewView: React.FC<{
    section: Section;
    data: AppData;
    onBack: () => void;
    onStartTest: (test: Test) => void;
    headerLeftSlot?: React.ReactNode;
    headerRightSlot?: React.ReactNode;
    filters: ReviewFilterState;
    setFilters: React.Dispatch<React.SetStateAction<ReviewFilterState>>;
}> = ({ section, data, onBack, onStartTest, headerLeftSlot, headerRightSlot, filters, setFilters }) => {
    
    // Safety check to ensure we don't show invalid filters if section changed
    useEffect(() => {
        if (section === 'verbal') {
            if ((filters.activeTab as any) === 'specialLaw') {
                 setFilters(prev => ({ ...prev, activeTab: 'all' }));
            }
            if (filters.attributeFilters.type === 'specialLaw') {
                setFilters(prev => ({ 
                    ...prev, 
                    attributeFilters: { ...prev.attributeFilters, type: 'all' } 
                }));
            }
        }
    }, [section, filters.activeTab, filters.attributeFilters.type, setFilters]);

    const [testSelectionInput, setTestSelectionInput] = useState('');
    const [isTestSelectCustom, setIsTestSelectCustom] = useState(false);

    // Derived data for test selection
    const availableTestsForSelection = useMemo(() => {
        if (section === 'quantitative') {
            return data.tests.quantitative.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        } else {
            // Flatten all Verbal tests into a single list for selection logic
            const verbal = data.tests.verbal;
            let allTests: Test[] = [];
            Object.keys(verbal).forEach(bankKey => {
                Object.keys(verbal[bankKey]).forEach(catKey => {
                    allTests = allTests.concat(verbal[bankKey][catKey]);
                });
            });
            return allTests;
        }
    }, [data.tests, section]);

    // Helper to parse test ranges
    const handleTestSelectionInputBlur = () => {
        if (!testSelectionInput.trim()) return;
        
        const newSelectedIds = new Set(filters.attributeFilters.selectedTestIds || []);
        
        // Check for range pattern "1-10"
        const rangeMatch = testSelectionInput.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            
            availableTestsForSelection.forEach(t => {
                // Extract number from test name if possible
                const numMatch = t.name.match(/\d+/);
                if (numMatch) {
                    const num = parseInt(numMatch[0]);
                    if (num >= min && num <= max) {
                        newSelectedIds.add(t.id);
                    }
                }
            });
        } else {
            // Try to match by exact number or name inclusion
            availableTestsForSelection.forEach(t => {
                if (t.name.includes(testSelectionInput) || t.id === testSelectionInput) {
                    newSelectedIds.add(t.id);
                }
            });
        }
        
        setFilters(prev => ({
            ...prev,
            activePanel: 'attribute',
            dateFilter: null,
            attributeFilters: {
                ...prev.attributeFilters,
                selectedTestIds: Array.from(newSelectedIds)
            }
        }));
        setTestSelectionInput('');
        setIsTestSelectCustom(false);
    };

    const toggleTestSelection = (testId: string) => {
        setFilters(prev => {
            const current = new Set(prev.attributeFilters.selectedTestIds || []);
            // If selecting a single test via dropdown, clear previous selections unless user logic implies adding
            // For now, simpler to toggle. 
            // The user wanted "choices... but space to write if I want more than one".
            // So logic: Dropdown selects one. Typing adds range.
            if (current.has(testId)) current.delete(testId);
            else current.add(testId);
            return {
                ...prev,
                activePanel: 'attribute',
                dateFilter: null,
                attributeFilters: {
                    ...prev.attributeFilters,
                    selectedTestIds: Array.from(current)
                }
            };
        });
    };

    const handleTestSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'custom') {
            setIsTestSelectCustom(true);
            return;
        }
        if (value === 'all') {
            setFilters(prev => ({
                ...prev,
                activePanel: 'attribute',
                dateFilter: null,
                attributeFilters: { ...prev.attributeFilters, selectedTestIds: [] }
            }));
            return;
        }
        
        // Select one specific test
        setFilters(prev => ({
            ...prev,
            activePanel: 'attribute',
            dateFilter: null,
            attributeFilters: { ...prev.attributeFilters, selectedTestIds: [value] }
        }));
    };

    const chunkQuestions = (questions: FolderQuestion[], chunkSize: number) => {
        const chunked = [];
        for (let i = 0; i < questions.length; i += chunkSize) {
            chunked.push(questions.slice(i, i + chunkSize));
        }
        return chunked.map((questions, index) => ({
            id: `filtered_review_${filters.activeTab}_${section}_${index+1}`,
            name: `مراجعة ${index + 1}${chunked.length > 1 ? ` (الجزء ${index + 1})` : ''}`,
            questions,
        }));
    };

    const filteredReviewTests = useMemo(() => {
        const sourceQuestions = data.reviewTests[section].flatMap(t => t.questions as FolderQuestion[]);
        
        // Sort questions by addedDate (oldest first) before any filtering or chunking
        sourceQuestions.sort((a, b) => {
            if (!a.addedDate || !b.addedDate) return 0;
            return new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime();
        });

        let questionsToChunk: FolderQuestion[] = [];
        
        if (filters.activeTab !== 'other') {
             questionsToChunk = sourceQuestions.filter(q => {
                if (filters.activeTab === 'all') return true;
                return q.reviewType === filters.activeTab;
            });
        } else {
            // "Other" tab logic
            if (filters.activePanel === 'time' && filters.dateFilter) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Starts at 00:00:00
                
                questionsToChunk = sourceQuestions.filter(q => {
                    if (!q.addedDate) return false;
                    const added = new Date(q.addedDate);
                    switch(filters.dateFilter) {
                        case 'today':
                            return added >= today;
                        case 'week':
                            const lastWeek = new Date(today);
                            lastWeek.setDate(today.getDate() - 7);
                            return added >= lastWeek;
                        case 'month':
                            const lastMonth = new Date(today);
                            lastMonth.setMonth(today.getMonth() - 1);
                            return added >= lastMonth;
                        // For grouping cases, we filter all questions first then group them
                        case 'byDay':
                        case 'byMonth':
                            return true;
                        default: return false;
                    }
                });

                if (filters.dateFilter === 'byDay') {
                    const groupedByDay = questionsToChunk.reduce((acc, q) => {
                        const day = new Date(q.addedDate!).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        if (!acc[day]) acc[day] = [];
                        acc[day].push(q);
                        return acc;
                    }, {} as Record<string, FolderQuestion[]>);
                    
                    return Object.entries(groupedByDay).flatMap(([day, questions]) => {
                        const chunks = chunkQuestions(questions, 75);
                        return chunks.map((chunk, i) => ({
                            ...chunk,
                            id: `filtered_review_byDay_${day.replace(/\s/g, '_')}_${i}`,
                            name: chunks.length > 1 ? `${day} (الجزء ${i + 1})` : day,
                        }));
                    });

                } else if (filters.dateFilter === 'byMonth') {
                    const groupedByMonth = questionsToChunk.reduce((acc, q) => {
                        const month = new Date(q.addedDate!).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
                        if (!acc[month]) acc[month] = [];
                        acc[month].push(q);
                        return acc;
                    }, {} as Record<string, FolderQuestion[]>);

                     return Object.entries(groupedByMonth).flatMap(([month, questions]) => {
                        const chunks = chunkQuestions(questions, 75);
                        return chunks.map((chunk, i) => ({
                            ...chunk,
                            id: `filtered_review_byMonth_${month.replace(/\s/g, '_')}_${i}`,
                            name: chunks.length > 1 ? `${month} (الجزء ${i + 1})` : month,
                        }));
                    });
                }

            } else if (filters.activePanel === 'attribute') {
                const { type, selectedTestIds, bank, category } = filters.attributeFilters;
                
                questionsToChunk = sourceQuestions.filter(q => {
                    let match = true;

                    if (section === 'quantitative') {
                        // Quantitative specific filtering
                        let testMatch = true;
                        if (selectedTestIds && selectedTestIds.length > 0) {
                            const selectedTestNames = new Set(
                                availableTestsForSelection.filter(t => selectedTestIds.includes(t.id)).map(t => t.name)
                            );
                            testMatch = !!q.sourceTest && selectedTestNames.has(q.sourceTest);
                        }
                        const typeMatch = type === 'all' || q.reviewType === type;
                        match = testMatch && typeMatch;

                    } else if (section === 'verbal') {
                        // Verbal specific filtering (Bank & Category)
                        const bankMatch = bank === 'all' || q.bankKey === bank;
                        const catMatch = category === 'all' || q.categoryKey === category;
                        const typeMatch = type === 'all' || q.reviewType === type;
                        match = bankMatch && catMatch && typeMatch;
                    }
                    
                    return match;
                });
            }
        }

        return chunkQuestions(questionsToChunk, 75);

    }, [data.reviewTests, section, filters, availableTestsForSelection]);

    if (section === 'quantitative') {
         // Allow access to review section if quantitative is enabled, even if empty
         // But ensure filters are set if not empty
    }
    
    const renderActiveFilterText = () => {
        if (filters.activeTab !== 'other' || !filters.activePanel) return null;

        let text = [];
        if(filters.activePanel === 'attribute') {
            const { type, selectedTestIds, bank, category } = filters.attributeFilters;
            
            if (section === 'quantitative' && selectedTestIds && selectedTestIds.length > 0) {
                text.push(`${selectedTestIds.length} اختبارات محددة`);
            }
            if (section === 'verbal') {
                if (bank !== 'all') text.push(`البنك: ${VERBAL_BANKS[bank]}`);
                if (category !== 'all') text.push(`القسم: ${VERBAL_CATEGORIES[category]}`);
            }
            
            if (type === 'mistake') text.push("الأخطاء فقط");
            if (type === 'delay') text.push("التأخير فقط");
            if (type === 'specialLaw') text.push("قانون خاص");
        }
        if (text.length === 0) return null;
        return <div className="text-center text-sm text-text-muted mb-4">التصنيف الحالي: <span className="font-bold text-primary">{text.join(' - ')}</span></div>;
    };
    
    // Define tabs. Only include 'specialLaw' if section is Quantitative.
    const reviewTabs = [
        { id: 'all', label: 'الكل' },
        { id: 'mistake', label: 'الأخطاء' },
        { id: 'delay', label: 'التأخير' },
        // Conditionally add Special Law
        ...(section === 'quantitative' ? [{ id: 'specialLaw', label: 'قانون خاص' }] : []),
        { id: 'other', label: 'أخرى' }
    ] as const;

    return (
         <div className="bg-bg min-h-screen">
            <Header title={`مراجعة ${section === 'quantitative' ? 'القسم الكمي' : 'القسم اللفظي'}`} leftSlot={headerLeftSlot} rightSlot={headerRightSlot} />
            <main className="container mx-auto p-4">
                <div className="bg-surface p-4 rounded-lg border border-border mb-6">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                       {reviewTabs.map(f => (
                           <button key={f.id} onClick={() => setFilters(prev => ({...prev, activeTab: f.id as any}))}
                            className={`px-6 py-2 text-md font-bold rounded-md transition-colors ${filters.activeTab === f.id ? 'bg-primary text-white ring-2 ring-primary-hover' : 'text-text-muted hover:bg-zinc-600'}`}>
                               {f.label}
                           </button>
                       ))}
                    </div>
                    {filters.activeTab === 'other' && (
                        <div className="mt-4 p-4 border-t border-border space-y-4">
                            {/* Time Filters */}
                            <div className={`bg-zinc-800 p-3 rounded-md border  ${filters.activePanel === 'time' ? 'border-accent' : 'border-zinc-700'} transition-colors`}>
                                <h3 className="text-lg font-bold mb-2">التصنيف حسب الوقت</h3>
                                <div className="flex flex-wrap gap-2">
                                     {(['today', 'week', 'month', 'byDay', 'byMonth'] as const).map(df => (
                                         <button key={df} onClick={() => setFilters(prev => ({...prev, activePanel: 'time', dateFilter: df }))}
                                            className={`px-4 py-1 text-sm rounded-md transition-colors ${filters.activePanel === 'time' && filters.dateFilter === df ? 'bg-accent text-white ring-2 ring-accent-hover' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                                            {df === 'today' && 'اليوم'}
                                            {df === 'week' && 'آخر أسبوع'}
                                            {df === 'month' && 'آخر شهر'}
                                            {df === 'byDay' && 'حسب الأيام'}
                                            {df === 'byMonth' && 'حسب الأشهر'}
                                         </button>
                                     ))}
                                </div>
                            </div>
                             {/* Attribute Filters - ONLY SHOW FOR QUANTITATIVE AS REQUESTED */}
                            {section === 'quantitative' && (
                                <div 
                                    onClick={() => setFilters(prev => ({ ...prev, activePanel: 'attribute', dateFilter: null }))}
                                    className={`bg-zinc-800 p-3 rounded-md border ${filters.activePanel === 'attribute' ? 'border-accent' : 'border-zinc-700'} space-y-3 transition-colors cursor-pointer`}
                                >
                                    <h3 className="text-lg font-bold mb-2">التصنيف حسب الخصائص</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onClick={e => e.stopPropagation()}>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">رقم الاختبار</label>
                                            {!isTestSelectCustom ? (
                                                <select
                                                    onChange={handleTestSelectChange}
                                                    className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600 h-11"
                                                >
                                                    <option value="all">الكل</option>
                                                    {availableTestsForSelection.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                    <option value="custom">-- مخصص / نطاق (كتابة) --</option>
                                                </select>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    autoFocus
                                                    value={testSelectionInput}
                                                    onChange={e => setTestSelectionInput(e.target.value)}
                                                    onBlur={handleTestSelectionInputBlur}
                                                    onKeyDown={e => e.key === 'Enter' && handleTestSelectionInputBlur()}
                                                    placeholder="رقم الاختبار"
                                                    className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600 h-11"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">نوع السؤال</label>
                                            <select 
                                                onChange={e => setFilters(prev => ({...prev, activePanel: 'attribute', dateFilter: null, attributeFilters: {...prev.attributeFilters, type: e.target.value as ReviewFilterState['attributeFilters']['type']}}))} 
                                                value={filters.attributeFilters.type} 
                                                className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600 h-11"
                                            >
                                                <option value="all">الكل</option>
                                                <option value="mistake">الأخطاء فقط</option>
                                                <option value="delay">التأخير فقط</option>
                                                <option value="specialLaw">قانون خاص</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                             {/* Attribute Filters - VERBAL */}
                             {section === 'verbal' && (
                                <div 
                                    onClick={() => setFilters(prev => ({ ...prev, activePanel: 'attribute', dateFilter: null }))}
                                    className={`bg-zinc-800 p-3 rounded-md border ${filters.activePanel === 'attribute' ? 'border-accent' : 'border-zinc-700'} space-y-3 transition-colors cursor-pointer`}
                                >
                                    <h3 className="text-lg font-bold mb-2">التصنيف حسب الخصائص</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3" onClick={e => e.stopPropagation()}>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">البنك</label>
                                            <select 
                                                value={filters.attributeFilters.bank} 
                                                onChange={e => setFilters(prev => ({...prev, activePanel: 'attribute', dateFilter: null, attributeFilters: {...prev.attributeFilters, bank: e.target.value}}))}
                                                className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600"
                                            >
                                                <option value="all">الكل</option>
                                                {Object.entries(VERBAL_BANKS).map(([key, name]) => (
                                                    <option key={key} value={key}>{name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">القسم</label>
                                            <select 
                                                value={filters.attributeFilters.category}
                                                onChange={e => setFilters(prev => ({...prev, activePanel: 'attribute', dateFilter: null, attributeFilters: {...prev.attributeFilters, category: e.target.value}}))}
                                                className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600"
                                            >
                                                <option value="all">الكل</option>
                                                {Object.entries(VERBAL_CATEGORIES).map(([key, name]) => (
                                                    <option key={key} value={key}>{name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-text-muted">نوع السؤال</label>
                                            <select 
                                                value={filters.attributeFilters.type}
                                                onChange={e => setFilters(prev => ({...prev, activePanel: 'attribute', dateFilter: null, attributeFilters: {...prev.attributeFilters, type: e.target.value as ReviewFilterState['attributeFilters']['type']}}))}
                                                className="w-full p-2 border rounded-md bg-zinc-700 text-slate-200 border-zinc-600"
                                            >
                                                <option value="all">الكل</option>
                                                <option value="mistake">الأخطاء فقط</option>
                                                <option value="delay">التأخير فقط</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {renderActiveFilterText()}
                <div className="space-y-4">
                    {filteredReviewTests.map(test => (
                         <div key={test.id}
                            className="bg-surface p-4 rounded-lg border border-border transition-all group hover:border-primary hover:shadow-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-xl text-text mb-1 group-hover:text-primary transition-colors">{test.name}</h3>
                                    <p className="text-sm text-text-muted">{test.questions.length} سؤال</p>
                                </div>
                                <button onClick={() => onStartTest(test)} className="px-6 py-2 bg-transparent border-2 border-accent text-accent font-bold rounded-md text-sm hover:bg-accent hover:text-white transition-colors flex items-center gap-1">
                                    <PlayIcon className="w-4 h-4" />
                                    <span>بدء</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredReviewTests.length === 0 && (
                    <div className="text-center text-text-muted py-16">
                        <p className="text-lg">لا توجد أسئلة للمراجعة تطابق هذا الفلتر.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

const HistoryView: React.FC<{ history: TestAttempt[]; onBack: () => void; onReviewAttempt: (attempt: TestAttempt) => void; user: User; onLogout: () => void; }> = ({ history, onBack, onReviewAttempt, user, onLogout }) => (
    <div className="bg-bg min-h-screen">
        <Header 
            title="سجل المحاولات" 
            leftSlot={<button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted"/></button>} 
            rightSlot={<UserMenu user={user} onLogout={onLogout} />}
        />
        <main className="container mx-auto p-4">
            <div className="flex justify-between items-center mt-2 mb-6 border-b border-border pb-4">
                <h2 className="text-xl font-bold">كل المحاولات</h2>
                <span className="text-sm font-bold text-text-muted bg-zinc-700 px-3 py-1 rounded-full">{history.length} محاولات</span>
            </div>
            {history.length > 0 ? (
                <div className="space-y-3">
                    {history.map(attempt => {
                        const bankName = attempt.bankKey ? VERBAL_BANKS[attempt.bankKey] : '';
                        const categoryName = attempt.categoryKey ? VERBAL_CATEGORIES[attempt.categoryKey] : '';
                        const answeredCount = attempt.answers.filter(a => a.answer).length;
                        const unanswered = attempt.totalQuestions - answeredCount;
                        const incorrect = answeredCount - attempt.score;
                        const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                        
                        const { dayName, gregDate, hijriDate, time } = formatDateShort(attempt.date);

                        return (
                        <div key={attempt.id} onClick={() => onReviewAttempt(attempt)} className="bg-surface p-4 rounded-lg border border-border cursor-pointer hover:border-primary transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-text mb-2">{attempt.testName}</h3>
                                     <div className="flex items-start gap-3 mb-2">
                                        <div className="bg-zinc-700 p-2 rounded-md h-fit">
                                            <CalendarIcon className="w-5 h-5 text-text-muted" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-text">{dayName}</p>
                                            <div className="flex flex-col gap-1 text-sm text-text-muted mt-1 font-bold">
                                                 <span>{hijriDate}</span>
                                                 <span>{gregDate}</span>
                                                 <span className="text-primary mt-1 block font-mono" dir="ltr">{time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-muted">
                                        {attempt.section === 'verbal' && bankName && categoryName ? `${bankName} - ${categoryName}` : (attempt.section === 'verbal' ? 'لفظي' : 'كمي')}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className={`font-bold text-2xl ${percentage >= 50 ? 'text-green-400' : 'text-red-400'}`}>{percentage}%</p>
                                    <p className="text-xs text-text-muted">({attempt.score}/{attempt.totalQuestions})</p>
                                </div>
                            </div>
                             <div className="flex justify-between items-center text-sm text-text-muted border-t border-border mt-3 pt-3 flex-wrap gap-2">
                                <span><span className="text-green-400 font-semibold">{attempt.score}</span> صحيح</span>
                                <span><span className="text-red-400 font-semibold">{incorrect}</span> خاطئ</span>
                                <span><span className="text-yellow-400 font-semibold">{unanswered}</span> متروك</span>
                                <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4"/> {formatTime(attempt.durationSeconds)}</span>
                            </div>
                        </div>
                    )})}
                </div>
            ) : (
                <p className="text-center text-text-muted mt-8">لا توجد محاولات سابقة.</p>
            )}
        </main>
    </div>
);

const App: React.FC = () => {
    const [currentUserKey, setCurrentUserKey] = useState<string | null>(authService.getCurrentUser());
    const [previewUserKey, setPreviewUserKey] = useState<string | null>(null);
    // New state to remember a user who timed out for quick login
    const [recentUserKey, setRecentUserKey] = useState<string | null>(null);

    const activeUserKey = previewUserKey || currentUserKey;
    const currentUser = useMemo(() => authService.getUser(currentUserKey || ''), [currentUserKey]);
    const previewingUser = useMemo(() => authService.getUser(previewUserKey || ''), [previewUserKey]);
    const recentUser = useMemo(() => authService.getUser(recentUserKey || ''), [recentUserKey]);

    const isDevUser = authService.isDevUser(currentUserKey);
    const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());

    const [pageHistory, setPageHistory] = useState<string[]>([currentUserKey ? 'home' : 'auth']);
    const page = pageHistory[pageHistory.length - 1];
    
    const [returnPath, setReturnPath] = useState<string | null>(null);

    // Session Management Logic
    useEffect(() => {
        // On mount, check if session is valid (less than 10 mins)
        const lastActive = localStorage.getItem('lastActiveTime');
        const userKey = authService.getCurrentUser();
        
        if (userKey && lastActive) {
            const diff = Date.now() - parseInt(lastActive);
            const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
            
            if (diff > SESSION_TIMEOUT) {
                // Session timed out
                setRecentUserKey(userKey);
                authService.logout();
                setCurrentUserKey(null);
                setPageHistory(['auth']);
            } else {
                 // Update timestamp
                 localStorage.setItem('lastActiveTime', Date.now().toString());
            }
        }
    }, []);

    // Update last active time on any page change
    useEffect(() => {
        if (currentUserKey) {
            localStorage.setItem('lastActiveTime', Date.now().toString());
        }
    }, [page, currentUserKey]);


    const navigate = (newPage: string, replace = false) => {
        setPageHistory(prev => {
            if (replace) {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = newPage;
                return newHistory;
            }
            if (prev[prev.length - 1] === newPage) return prev;
            return [...prev, newPage];
        });
    };

    const goBack = () => {
        setPageHistory(prev => {
            if (prev.length > 1) {
                return prev.slice(0, -1);
            }
            return prev; 
        });
    };


    const [userMode, setUserMode] = useState<'training' | 'review' | null>(null);
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [currentTest, setCurrentTest] = useState<Test | null>(null);
    const [currentTestContext, setCurrentTestContext] = useState<{ bankKey?: string; categoryKey?: string }>({});
    const [currentAttempt, setCurrentAttempt] = useState<TestAttempt | null>(null);
    const [attemptToReview, setAttemptToReview] = useState<TestAttempt | null>(null);
    const [summaryReturnPage, setSummaryReturnPage] = useState<string>('section');
    
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    const [openBankKeys, setOpenBankKeys] = useState<Set<string>>(new Set());
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

    const [pendingSession, setPendingSession] = useState<SessionState | null>(null);
    
    const [reviewFilters, setReviewFilters] = useState<ReviewFilterState>({
        activeTab: 'all',
        activePanel: null,
        dateFilter: null,
        attributeFilters: { bank: 'all', category: 'all', type: 'all' },
    });

    const { data, addTest, addQuestionsToTest, deleteTest, addAttemptToHistory, deleteUserData, addDelayedQuestionToReview, addSpecialLawQuestionToReview, reviewedQuestionIds } = useAppData(activeUserKey, isDevUser, isPreviewMode);
    
    // Session Loading (Modified to check for active test session after login)
    useEffect(() => {
        if (activeUserKey) {
            const saved = sessionService.loadSessionState(activeUserKey);
            if (saved) {
                // Always restore general UI state
                setOpenBankKeys(new Set(saved.openBankKeys || []));
                setSelectedTestId(saved.selectedTestId || null);
                setUserMode(saved.userMode || null);
                if (saved.reviewFilters) setReviewFilters(saved.reviewFilters);

                // If there is an active test session, prompt to resume
                if (saved.currentTest) {
                    setPendingSession(saved);
                }
            }
        }
    }, [activeUserKey]);

    // Session Saving
    useEffect(() => {
        if (activeUserKey) {
            const stateToSave: SessionState = {
                pageHistory: pageHistory, selectedSection, userMode,
                currentTest, currentTestContext, userAnswers, elapsedTime,
                openBankKeys: Array.from(openBankKeys), selectedTestId,
                reviewFilters,
            };
            sessionService.saveSessionState(stateToSave, activeUserKey);
        }
    }, [pageHistory, selectedSection, userMode, currentTest, currentTestContext, userAnswers, elapsedTime, openBankKeys, selectedTestId, activeUserKey, reviewFilters]);

    const clearTestSession = () => {
        setCurrentTest(null);
        setUserAnswers([]);
        setElapsedTime(0);
        if (activeUserKey) {
            sessionService.clearTestState(activeUserKey);
        }
    };

    const handleLoginSuccess = (user: User, rememberMe: boolean) => {
        const userKey = user.email === 'guest@local.session' ? `guest|${Date.now()}` : `${user.email}|${user.username}`;
        // If "remember me" was checked or just logged in, we set the current user in local storage
        if (rememberMe) {
            authService.setCurrentUser(userKey);
        }
        localStorage.setItem('lastActiveTime', Date.now().toString());
        setCurrentUserKey(userKey);
        setRecentUserKey(null); // Clear recent user since we logged in
        setPageHistory(['home']);
    };

    const handleLogout = () => {
        authService.logout(); // Clears main key
        localStorage.removeItem('lastActiveTime');
        setCurrentUserKey(null);
        setPreviewUserKey(null);
        setIsPreviewMode(false);
        setPageHistory(['auth']);
        setShowLogoutConfirm(false);
        clearTestSession();
    };

    const handleTogglePreviewMode = () => {
        if (isDevUser) {
            const newPreviewMode = !isPreviewMode;
            setIsPreviewMode(newPreviewMode);
            if (!newPreviewMode) {
                setPreviewUserKey(null);
            }
        }
    };
    
    const handleStartTest = (test: Test, bankKey?: string, categoryKey?: string, returnTo?: string) => {
        clearTestSession(); // Start fresh
        setCurrentTest(test);
        setCurrentTestContext({ bankKey, categoryKey });
        setSelectedTestId(test.id);
        setReturnPath(returnTo || null);
        
        // If started from quantitative management, we need to ensure selectedSection is set
        if (!selectedSection && test.questions[0]?.questionImage) {
             setSelectedSection('quantitative');
        }
        navigate('takeTest');
    };

    const handleFinishTest = (answers: UserAnswer[], durationSeconds: number) => {
        // Fallback for section if missing (e.g. started from Management view)
        const section = selectedSection || (currentTest?.questions[0]?.questionImage ? 'quantitative' : 'verbal');

        if (!currentTest) return;
        
        const score = answers.reduce((count, userAnswer) => {
            const question = currentTest.questions.find(q => q.id === userAnswer.questionId);
            return question && question.correctAnswer === userAnswer.answer ? count + 1 : count;
        }, 0);

        const newAttempt: TestAttempt = {
            id: `attempt_${Date.now()}`,
            testId: currentTest.id,
            testName: currentTest.name,
            section: section,
            bankKey: currentTestContext.bankKey,
            categoryKey: currentTestContext.categoryKey,
            date: new Date().toISOString(),
            score,
            totalQuestions: currentTest.questions.length,
            answers,
            questions: currentTest.questions,
            durationSeconds,
        };
        
        if (!isDevUser || isPreviewMode) {
            addAttemptToHistory(newAttempt);
        }
        
        setCurrentAttempt(newAttempt);
        setAttemptToReview(newAttempt); // Also set for direct review
        
        // Determine proper return path for Summary "Back"
        if (returnPath) {
             setSummaryReturnPage(returnPath);
        } else if (currentTest.id.includes('review_')) {
            setSummaryReturnPage('review');
        } else {
            setSummaryReturnPage(userMode === 'training' ? 'section' : 'review');
        }
        
        clearTestSession();
        // Use replace: true to remove 'takeTest' from history, so 'Back' from Summary goes to 'Section'
        navigate('summary', true);
    };
    
    const handleStartReviewAttempt = (attempt: TestAttempt) => {
        setAttemptToReview(attempt); 
        setSummaryReturnPage(page);
        navigate('reviewAttempt');
    };

    const handleResumeTest = (savedState: SessionState) => {
        setCurrentTest(savedState.currentTest);
        setCurrentTestContext(savedState.currentTestContext || {});
        setUserAnswers(savedState.userAnswers || []);
        setElapsedTime(savedState.elapsedTime || 0);
        setSelectedSection(savedState.selectedSection);
        setUserMode(savedState.userMode);
        setPageHistory(savedState.pageHistory || ['takeTest']);
        setPendingSession(null);
    }
    
    if (pendingSession) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-surface rounded-lg p-8 m-4 max-w-md w-full text-center shadow-2xl border border-border">
                    <div className="mb-4">
                        <ClockIcon className="w-16 h-16 mx-auto text-primary animate-pulse"/>
                    </div>
                    <h2 className="text-xl font-bold mb-4">استئناف الاختبار السابق</h2>
                    <p className="text-text-muted mb-6">
                        يبدو أنك كنت في منتصف اختبار <strong>{pendingSession.currentTest?.name}</strong>.
                        <br/>
                        هل تريد العودة إلى حيث توقفت؟
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => { clearTestSession(); setPendingSession(null); }} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">
                            لا، بدء جديد
                        </button>
                        <button onClick={() => handleResumeTest(pendingSession)} className="px-6 py-2 text-white rounded-md bg-accent hover:opacity-90 transition-colors font-bold shadow-lg shadow-accent/20">
                            نعم، إكمال الاختبار
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (showLogoutConfirm) {
         return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                    <h2 className="text-xl font-bold mb-4">تأكيد تسجيل الخروج</h2>
                    <p className="text-text-muted mb-6">هل أنت متأكد أنك تريد تسجيل الخروج؟</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setShowLogoutConfirm(false)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                        <button onClick={handleLogout} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold">تسجيل الخروج</button>
                    </div>
                </div>
            </div>
        );
    }
    
    const activeUser = previewingUser || currentUser;

    if (!currentUserKey || !activeUser) {
        return <AuthView onLoginSuccess={handleLoginSuccess} recentUser={recentUser} />;
    }

    if (page === 'home') {
        return <HomeView
            username={activeUser.username}
            onSelectUserMode={(mode) => { setUserMode(mode); navigate('modeSelection'); }}
            onLogout={() => setShowLogoutConfirm(true)}
            onGoToAdmin={() => navigate('admin')}
            onGoToSiteManagement={() => navigate('siteManagement')}
            onGoToVerbalManagement={() => navigate('verbalManagement')}
            onGoToQuantitativeManagement={() => navigate('quantitativeManagement')}
            isDevUser={isDevUser}
            isPreviewMode={isPreviewMode}
            onTogglePreviewMode={handleTogglePreviewMode}
            previewingUser={previewingUser}
        />;
    }
    
    if (page === 'modeSelection' && userMode) {
        return <ModeSelectionView 
            userMode={userMode} 
            onBack={goBack} 
            onSelectSection={(section, mode) => { 
                setSelectedSection(section); 
                setUserMode(mode);
                navigate(mode === 'training' ? 'section' : 'review'); 
            }}
            settings={settings}
            user={activeUser}
            onLogout={() => setShowLogoutConfirm(true)}
        />
    }
    
    const sectionHeaderLeftSlot = (
         <div className="flex items-center gap-4">
            <button onClick={goBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors"><ArrowRightIcon className="w-6 h-6 text-text-muted"/></button>
            <button 
                onClick={() => {
                    // Correctly update userMode when switching between Training and Review
                    const targetMode = page === 'section' ? 'review' : 'training';
                    setUserMode(targetMode);
                    navigate(targetMode === 'training' ? 'section' : 'review');
                }} 
                className="px-3 py-2 text-sm font-bold rounded-md transition-colors bg-zinc-700 hover:bg-zinc-600"
            >
                {page === 'section' ? 'الانتقال إلى المراجعة' : 'الانتقال إلى التدريب'}
            </button>
        </div>
    );

    const commonHeaderRightSlot = (
        <UserMenu user={activeUser} onLogout={() => setShowLogoutConfirm(true)}>
             <button onClick={() => navigate('history')} className="px-3 py-2 text-sm font-bold rounded-md transition-all bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 hover:border-accent hover:shadow-lg hover:shadow-accent/30">سجل المحاولات</button>
        </UserMenu>
    );
    
    if (page === 'review' && selectedSection) {
        return <ReviewView
            section={selectedSection}
            data={data}
            onBack={goBack}
            onStartTest={(test) => handleStartTest(test)}
            headerLeftSlot={sectionHeaderLeftSlot}
            headerRightSlot={commonHeaderRightSlot}
            filters={reviewFilters}
            setFilters={setReviewFilters}
        />
    }

    if (page === 'section' && selectedSection) {
        return <SectionView 
            section={selectedSection}
            data={data}
            onBack={() => { goBack(); setSelectedTestId(null); }}
            onStartTest={handleStartTest}
            onReviewAttempt={(attempt) => handleStartReviewAttempt(attempt)}
            headerLeftSlot={sectionHeaderLeftSlot}
            headerRightSlot={commonHeaderRightSlot}
            openBankKeys={openBankKeys}
            onToggleBank={(key) => setOpenBankKeys(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            })}
            selectedTestId={selectedTestId}
            onSelectTest={(test, bank, cat) => setSelectedTestId(test.id)}
        />
    }
    
    if (page === 'takeTest' && currentTest) {
        // Note: selectedSection might be null if coming from Management view directly.
        // We fallback to 'quantitative' inside TakeTest or handleFinish if needed, but for display it's fine.
        return <TakeTestView 
            test={currentTest} 
            onFinishTest={handleFinishTest} 
            onBack={() => {
                if (returnPath) {
                    navigate(returnPath, true);
                } else {
                    goBack();
                }
            }}
            initialAnswers={userAnswers}
            initialElapsedTime={elapsedTime}
            onStateChange={(answers, time) => { setUserAnswers(answers); setElapsedTime(time); }}
            onAddDelayedReview={(q, qIndex) => selectedSection && addDelayedQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: qIndex})}
            onAddSpecialLawReview={(q, qIndex) => selectedSection && addSpecialLawQuestionToReview(selectedSection, q, {bankKey: currentTestContext.bankKey, categoryKey: currentTestContext.categoryKey, testName: currentTest.name, originalQuestionIndex: qIndex})}
            reviewedQuestionIds={reviewedQuestionIds}
        />;
    }

    if (page === 'history') {
        return <HistoryView 
            history={data.history} 
            onBack={goBack} 
            onReviewAttempt={(attempt) => handleStartReviewAttempt(attempt)}
            user={activeUser}
            onLogout={() => setShowLogoutConfirm(true)}
        />;
    }
    
    const summaryData = currentAttempt || attemptToReview;
    if (page === 'summary' && summaryData) {
        return <SummaryView 
            attempt={summaryData} 
            onBack={() => { 
                // Logic: Go back to where we started and clear stack to pretend we never entered test mode
                if (returnPath) {
                    navigate(returnPath, true); 
                } else {
                     // Ensure we go back to the correct section mode (Review vs Training)
                     // based on current userMode state
                     const targetPage = userMode === 'training' ? 'section' : 'review';
                     navigate(targetPage, true);
                }
                setCurrentAttempt(null); 
                setAttemptToReview(null); 
                setReturnPath(null);
            }} 
            onReview={(attempt) => { setAttemptToReview(attempt); navigate('reviewAttempt'); }}
            user={activeUser}
            onLogout={() => setShowLogoutConfirm(true)}
        />;
    }
    
    if (page === 'reviewAttempt' && attemptToReview) {
        return <TakeTestView
             test={{ id: attemptToReview.testId, name: attemptToReview.testName, questions: attemptToReview.questions }}
             reviewAttempt={attemptToReview}
             onFinishTest={()=>{}} // Not applicable in review mode
             reviewedQuestionIds={reviewedQuestionIds}
             onBackToSummary={() => navigate('summary', true)}
             onBackToSection={() => {
                 // Force navigation back to the section view, effectively skipping summary in history
                 if (returnPath) {
                    navigate(returnPath, true);
                 } else {
                    const targetPage = userMode === 'training' ? 'section' : 'review';
                    navigate(targetPage, true);
                 }
                 setAttemptToReview(null);
                 setReturnPath(null);
             }}
        />;
    }

    if (page === 'admin') {
        return <AdminView
            onBack={goBack}
            onPreviewUser={(userKey) => { setPreviewUserKey(userKey); setIsPreviewMode(true); navigate('home', true); }}
            onDeleteUser={(userKey) => { deleteUserData(userKey); }}
        />
    }
    
    if (page === 'siteManagement') {
        return <SiteManagementView onBack={goBack} onUpdateSettings={(newSettings) => setSettings(newSettings)} />
    }
    
    if (page === 'verbalManagement') {
        return <VerbalManagementView
            data={data}
            onBack={goBack}
            onAddTest={addTest}
            onAddQuestionsToTest={addQuestionsToTest}
            onDeleteTest={deleteTest}
         />
    }
    
    if (page === 'quantitativeManagement') {
        // Now passing props instead of relying on internal useAppData
        return <QuantitativeManagementView 
            onBack={goBack} 
            onStartTest={(test, returnTo) => handleStartTest(test, undefined, undefined, returnTo || 'quantitativeManagement')}
            data={data}
            onAddTest={addTest}
            onAddQuestionsToTest={addQuestionsToTest}
            onDeleteTest={deleteTest}
        />
    }

    return (
        <div className="bg-bg min-h-screen flex items-center justify-center text-center">
            <div>
                <h1 className="text-2xl font-bold">حدث خطأ ما</h1>
                <p className="text-text-muted">الصفحة المطلوبة غير متوفرة.</p>
                <button onClick={() => { setPageHistory(['home']); }} className="mt-4 px-6 py-2 bg-primary text-white rounded-md">العودة للصفحة الرئيسية</button>
            </div>
        </div>
    );
};

export default App;
