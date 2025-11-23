
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Question, Section, Test, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, CheckCircleIcon, FileTextIcon, InfoIcon, SaveIcon, TrashIcon, XCircleIcon, SettingsIcon } from './Icons';

interface ParsedQuestion extends Omit<Question, 'id' | 'correctAnswer'> {
    passage?: string; // New field to hold the extracted passage text
}

/**
 * Advanced parser that handles Reading Comprehension passages.
 */
const parseQuestionsFromText = (text: string): ParsedQuestion[] => {
    if (!text.trim()) return [];

    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('*'));
    const questions: ParsedQuestion[] = [];
    
    // 1. Identify all "Question Blocks" based on the separator
    const separatorIndices: number[] = [];
    lines.forEach((line, index) => {
        if (line === 'نقطة واحدة' || line === 'ليس هناك نقاط') {
            separatorIndices.push(index);
        }
    });

    if (separatorIndices.length === 0) return [];

    let lastBlockEndIndex = -1; // Tracks where the last processed line (options) ended
    let currentPassage: string | undefined = undefined;

    separatorIndices.forEach((sepIndex) => {
        // Validation: Ensure there is a line before the separator (The Question)
        if (sepIndex === 0) return;

        const questionLineIndex = sepIndex - 1;
        const questionText = lines[questionLineIndex];

        // 2. Detect Passage (Text between last block end and current question)
        const potentialPassageLines = lines.slice(lastBlockEndIndex + 1, questionLineIndex);
        
        if (potentialPassageLines.length > 0) {
            currentPassage = potentialPassageLines.join('\n');
        } 

        // 3. Extract Options
        const options: string[] = [];
        let currentOptionIndex = sepIndex + 1;
        
        const nextSepIndex = separatorIndices.find(idx => idx > sepIndex);
        const nextQuestionIndex = nextSepIndex ? nextSepIndex - 1 : lines.length;
        
        let maxOptions = 4;
        while (currentOptionIndex < lines.length && 
               currentOptionIndex < nextQuestionIndex && 
               options.length < maxOptions) { 
            
            options.push(lines[currentOptionIndex]);
            currentOptionIndex++;
        }
        
        lastBlockEndIndex = currentOptionIndex - 1;

        questions.push({
            questionText,
            options,
            passage: currentPassage 
        });
    });

    return questions;
};


interface VerbalManagementViewProps {
    data: AppData;
    onBack: () => void;
    onAddTest: (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => string;
    onAddQuestionsToTest: (section: Section, testId: string, questions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => void;
    onDeleteTest: (section: Section, testId: string, bankKey?: string, categoryKey?: string) => void;
    onUpdateQuestionAnswer: (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => void;
}

type TestToDelete = { test: Test; bankKey: string; catKey: string; };

const FORM_STATE_KEY = 'verbalManagementFormState';

const getInitialFormState = () => {
  try {
    const saved = localStorage.getItem(FORM_STATE_KEY);
    return saved ? JSON.parse(saved) : {
      selectedBank: Object.keys(VERBAL_BANKS)[0],
      selectedCategory: Object.keys(VERBAL_CATEGORIES)[0],
      testNumber: '',
      questionsText: '',
    };
  } catch {
    return {
      selectedBank: Object.keys(VERBAL_BANKS)[0],
      selectedCategory: Object.keys(VERBAL_CATEGORIES)[0],
      testNumber: '',
      questionsText: '',
    };
  }
};

export const VerbalManagementView: React.FC<VerbalManagementViewProps> = ({ data, onBack, onAddTest, onAddQuestionsToTest, onDeleteTest, onUpdateQuestionAnswer }) => {
    const [activeBank, setActiveBank] = useState<string | null>(Object.keys(VERBAL_BANKS)[0]);
    const [activeCategory, setActiveCategory] = useState<string | null>(Object.keys(VERBAL_CATEGORIES)[0]);
    
    const [formState, setFormState] = useState(getInitialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [correctAnswers, setCorrectAnswers] = useState<Record<number, string>>({});

    const [showDeleteConfirm, setShowDeleteConfirm] = useState<TestToDelete | null>(null);
    const [viewingSourceText, setViewingSourceText] = useState<string | null>(null);
    
    // New state for editing an existing test
    const [editingTest, setEditingTest] = useState<{ test: Test, bankKey: string, catKey: string } | null>(null);

    // Persist form state to localStorage
    useEffect(() => {
        localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState));
    }, [formState]);
    
    const updateFormState = (updates: Partial<typeof formState>) => {
        setFormState(prev => ({ ...prev, ...updates }));
    };

    // Auto-parse questions from text with debounce
    useEffect(() => {
        const handler = setTimeout(() => {
            if (formState.questionsText.trim()) {
                try {
                    const questions = parseQuestionsFromText(formState.questionsText);
                    setParsedQuestions(questions);
                    setCorrectAnswers({});
                    setFeedback(null);
                } catch (error: any) {
                    setParsedQuestions([]);
                    setFeedback({ type: 'error', message: error.message });
                }
            } else {
                setParsedQuestions([]);
            }
        }, 500); // 500ms debounce

        return () => {
            clearTimeout(handler);
        };
    }, [formState.questionsText]);


    const handleCorrectAnswerSelect = (qIndex: number, answer: string) => {
        setCorrectAnswers(prev => ({ ...prev, [qIndex]: answer }));
    };

    const handleFinalSubmit = () => {
        setIsSubmitting(true);
        setFeedback(null);

        if (!formState.selectedBank || !formState.selectedCategory || !formState.testNumber.trim()) {
            setFeedback({ type: 'error', message: 'يرجى ملء البنك والقسم ورقم الاختبار.' });
            setIsSubmitting(false);
            return;
        }

        if (Object.keys(correctAnswers).length !== parsedQuestions.length) {
            setFeedback({ type: 'error', message: 'يرجى تحديد إجابة صحيحة لكل سؤال.' });
            setIsSubmitting(false);
            return;
        }

        try {
            // Prepare questions for saving
            const finalQuestions: Omit<Question, 'id'>[] = parsedQuestions.map((q, index) => {
                let finalQuestionText = q.questionText;
                if (q.passage) {
                    finalQuestionText = `**النص:**\n${q.passage}\n\n**السؤال:**\n${q.questionText}`;
                }

                return {
                    questionText: finalQuestionText,
                    options: q.options,
                    correctAnswer: correctAnswers[index],
                };
            });

            const testId = onAddTest('verbal', `اختبار ${formState.testNumber.trim()}`, formState.selectedBank, formState.selectedCategory, formState.questionsText);
            onAddQuestionsToTest('verbal', testId, finalQuestions, formState.selectedBank, formState.selectedCategory);

            setFeedback({ type: 'success', message: `تمت إضافة "اختبار ${formState.testNumber.trim()}" بنجاح مع ${finalQuestions.length} سؤال.` });
            
            // Reset form
            setFormState({
                selectedBank: formState.selectedBank,
                selectedCategory: formState.selectedCategory,
                testNumber: '',
                questionsText: '',
            });
            setParsedQuestions([]);
            setCorrectAnswers({});
            localStorage.removeItem(FORM_STATE_KEY);

        } catch (error: any) {
            setFeedback({ type: 'error', message: error.message || "حدث خطأ أثناء إضافة الاختبار." });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleDeleteConfirm = () => {
        if (showDeleteConfirm) {
            onDeleteTest('verbal', showDeleteConfirm.test.id, showDeleteConfirm.bankKey, showDeleteConfirm.catKey);
            setShowDeleteConfirm(null);
        }
    };

    const testsToShow = useMemo(() => {
        if (activeBank && activeCategory) {
            return data.tests.verbal[activeBank]?.[activeCategory] || [];
        }
        return [];
    }, [activeBank, activeCategory, data.tests.verbal]);

    return (
        <div className="bg-bg min-h-screen flex flex-col">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-text mx-auto">إدارة القسم اللفظي</h1>
                </div>
            </header>
            
            <div className="flex-grow container mx-auto flex flex-row overflow-hidden">
                {/* Sidebar */}
                <aside className="w-1/4 p-4 border-l border-border overflow-y-auto hidden md:block">
                    <nav className="space-y-1">
                        {Object.entries(VERBAL_BANKS).map(([bankKey, bankName]) => (
                            <div key={bankKey}>
                                <button onClick={() => setActiveBank(bankKey)} className={`w-full text-right p-3 rounded-lg font-bold text-lg transition-colors ${activeBank === bankKey ? 'bg-primary/20 text-primary' : 'hover:bg-surface'}`}>
                                    {bankName}
                                </button>
                                {activeBank === bankKey && (
                                    <div className="pr-4 mt-2 space-y-1 border-r-2 border-zinc-700">
                                        {Object.entries(VERBAL_CATEGORIES).map(([catKey, catName]) => {
                                            const testCount = data.tests.verbal[bankKey]?.[catKey]?.length || 0;
                                            return (
                                                <button key={catKey} onClick={() => setActiveCategory(catKey)} className={`w-full text-right p-2 rounded-md transition-colors text-base flex justify-between items-center ${activeCategory === catKey ? 'bg-zinc-700 font-semibold' : 'hover:bg-zinc-800'}`}>
                                                    <span>{catName}</span>
                                                    <span className="text-xs font-mono bg-zinc-600 px-2 py-0.5 rounded-full">{testCount}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="w-full md:w-3/4 p-4 md:p-6 overflow-y-auto space-y-8">
                    {/* Add Test Form */}
                    <div className="bg-surface p-6 rounded-lg border border-border">
                        <h2 className="text-2xl font-bold mb-4">إضافة اختبار جديد</h2>
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Form Inputs & Text Area */}
                            <div className="w-full lg:w-1/2 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select value={formState.selectedBank} onChange={e => updateFormState({ selectedBank: e.target.value })} className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border">
                                        {Object.entries(VERBAL_BANKS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                                    </select>
                                    <select value={formState.selectedCategory} onChange={e => updateFormState({ selectedCategory: e.target.value })} className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border">
                                        {Object.entries(VERBAL_CATEGORIES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                                    </select>
                                    <input type="text" value={formState.testNumber} onChange={e => updateFormState({ testNumber: e.target.value })} placeholder="رقم الاختبار" className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border" />
                                </div>
                                <textarea 
                                    value={formState.questionsText}
                                    onChange={e => updateFormState({ questionsText: e.target.value })}
                                    placeholder="الصق نص الأسئلة هنا للاستخراج التلقائي..."
                                    rows={12}
                                    className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border font-mono text-sm"
                                />
                                <div className="flex items-start gap-2 p-3 bg-sky-900/50 border border-sky-700 text-sky-300 rounded-md text-sm">
                                    <InfoIcon className="w-6 h-6 flex-shrink-0 mt-1" />
                                    <span><strong>النظام الذكي:</strong> سيتم اكتشاف "استيعاب المقروء" تلقائياً. أي نص يظهر قبل السؤال (الذي يسبق كلمة "نقطة واحدة") سيتم اعتباره فقرة القراءة التابعة للسؤال.</span>
                                </div>
                                {feedback && (
                                    <div className={`p-3 rounded-md border flex items-center gap-2 text-sm font-bold ${feedback.type === 'success' ? 'bg-green-900/50 border-green-700 text-green-300' : 'bg-red-900/50 border-red-700 text-red-300'}`}>
                                        {feedback.type === 'success' ? <CheckCircleIcon /> : <XCircleIcon />}
                                        {feedback.message}
                                    </div>
                                )}
                            </div>
                            {/* Questions Preview */}
                            <div className="w-full lg:w-1/2">
                                {parsedQuestions.length > 0 ? (
                                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-border h-full flex flex-col max-h-[800px]">
                                        <h3 className="text-lg font-bold mb-2">معاينة ({parsedQuestions.length} سؤال)</h3>
                                        <div className="flex-grow space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                            {parsedQuestions.map((q, qIndex) => (
                                                <div key={qIndex} className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
                                                    {q.passage && (
                                                        <div className="mb-3 p-3 bg-zinc-900/80 rounded border-r-4 border-accent text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                                                            <strong className="text-accent block mb-1">النص:</strong>
                                                            {q.passage}
                                                        </div>
                                                    )}
                                                    <p className="font-bold text-md text-gold mb-2">
                                                        <span className="text-text-muted text-xs ml-1">{qIndex + 1}.</span> 
                                                        {q.questionText}
                                                    </p>
                                                    <div className="space-y-1">
                                                        {q.options.map((option, oIndex) => (
                                                            <label key={oIndex} className={`flex items-center gap-3 p-2 rounded-md hover:bg-zinc-700 cursor-pointer border-2 transition-all ${correctAnswers[qIndex] === option ? 'bg-accent/20 border-accent' : 'border-transparent'}`}>
                                                                <input type="radio" name={`q-${qIndex}`} value={option} checked={correctAnswers[qIndex] === option} onChange={() => handleCorrectAnswerSelect(qIndex, option)} className="w-4 h-4 text-accent bg-zinc-600 border-zinc-500 focus:ring-accent focus-ring"/>
                                                                <span>{option}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end mt-4 pt-4 border-t border-border">
                                            <button onClick={handleFinalSubmit} disabled={isSubmitting || Object.keys(correctAnswers).length !== parsedQuestions.length} className="flex items-center gap-2 px-6 py-2 bg-accent text-white font-bold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity">
                                                <SaveIcon className="w-5 h-5" />
                                                {isSubmitting ? 'جارٍ الحفظ...' : `حفظ الاختبار (${Object.keys(correctAnswers).length}/${parsedQuestions.length})`}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-zinc-900/50 rounded-lg text-text-muted text-center p-4 border border-border min-h-[300px]">
                                        <p>ستظهر معاينة الأسئلة هنا بعد لصق النص.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Existing Tests View */}
                     <div>
                        <h2 className="text-2xl font-bold mb-4">
                            الاختبارات الحالية في: <span className="text-primary">{activeBank ? VERBAL_BANKS[activeBank] : ''} / {activeCategory ? VERBAL_CATEGORIES[activeCategory] : ''}</span>
                        </h2>
                        <div className="bg-surface p-4 rounded-lg border border-border">
                            {testsToShow.length > 0 ? (
                                <div className="space-y-2">
                                    {testsToShow.map(test => (
                                        <div key={test.id} className="flex items-center justify-between bg-zinc-800 p-3 rounded-md">
                                            <span className="font-semibold">{test.name} ({test.questions.length} سؤال)</span>
                                            <div className="flex items-center gap-3">
                                                {test.sourceText && (
                                                    <button onClick={() => setViewingSourceText(test.sourceText || 'لا يوجد نص مصدري محفوظ.')} className="p-1 text-text-muted hover:text-primary transition-colors" title="عرض النص المصدري">
                                                        <FileTextIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button onClick={() => setEditingTest({ test, bankKey: activeBank!, catKey: activeCategory! })} className="p-1 text-text-muted hover:text-accent transition-colors" title="تعديل الإجابات">
                                                    <SettingsIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setShowDeleteConfirm({ test, bankKey: activeBank!, catKey: activeCategory! })} className="p-1 text-text-muted hover:text-danger transition-colors" title={`حذف اختبار ${test.name}`}>
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-text-muted py-8">لا يوجد اختبارات في هذا القسم. اختر بنكاً وقسماً من الشريط الجانبي لعرض الاختبارات.</p>
                            )}
                        </div>
                    </div>
                </main>
            </div>
            
            {/* Modals */}
             {editingTest && (
                <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setEditingTest(null)}>
                     <div className="bg-surface rounded-lg p-6 m-4 max-w-4xl w-full h-[80vh] flex flex-col border border-border" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-700">
                             <h3 className="text-xl font-bold">تعديل الإجابات - {editingTest.test.name}</h3>
                             <button onClick={() => setEditingTest(null)} className="p-2 hover:bg-zinc-700 rounded-full">
                                 <XCircleIcon className="w-6 h-6 text-text-muted"/>
                             </button>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {editingTest.test.questions.map((q, idx) => (
                                <div key={q.id} className="bg-zinc-800 p-4 rounded-lg flex items-start justify-between gap-4">
                                     <div className="flex-grow">
                                         <p className="font-bold mb-2 text-sm md:text-base"><span className="text-accent">{idx + 1}.</span> {q.questionText}</p>
                                         <div className="text-xs text-text-muted flex gap-2">
                                             {q.options.map(opt => <span key={opt} className={`px-2 py-0.5 rounded border ${opt === q.correctAnswer ? 'border-green-500/50 bg-green-900/20' : 'border-zinc-700'}`}>{opt}</span>)}
                                         </div>
                                     </div>
                                     <div className="flex-shrink-0 flex flex-col items-center">
                                        <span className="text-xs text-text-muted mb-1">الإجابة الصحيحة</span>
                                        <select
                                            value={q.correctAnswer}
                                            onChange={(e) => onUpdateQuestionAnswer('verbal', editingTest.test.id, q.id, e.target.value, editingTest.bankKey, editingTest.catKey)}
                                            className="bg-zinc-700 border border-zinc-600 rounded px-3 py-1 text-sm font-bold focus:ring-accent focus:border-accent"
                                        >
                                            {q.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                     </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                        <h2 className="text-xl font-bold mb-4">تأكيد الحذف</h2>
                        <p className="text-text-muted mb-6">
                            هل أنت متأكد أنك تريد حذف الاختبار <span className="font-bold text-text">"{showDeleteConfirm.test.name}"</span>؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowDeleteConfirm(null)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                            <button onClick={handleDeleteConfirm} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold">حذف</button>
                        </div>
                    </div>
                </div>
            )}
             {viewingSourceText !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setViewingSourceText(null)}>
                    <div className="bg-surface rounded-lg p-6 m-4 max-w-2xl w-full shadow-2xl border border-border flex flex-col" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-primary">النص المصدري للاختبار</h3>
                        <textarea readOnly value={viewingSourceText} rows={15} className="w-full p-2 border rounded-md bg-zinc-800 text-slate-300 border-border font-mono text-sm"></textarea>
                        <button onClick={() => setViewingSourceText(null)} className="mt-4 px-6 py-2 bg-zinc-600 self-end rounded-md hover:bg-zinc-500 transition-colors font-semibold">إغلاق</button>
                    </div>
                </div>
            )}
        </div>
    );
};
