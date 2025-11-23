
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Test, UserAnswer, TestAttempt, Question, FolderQuestion, VERBAL_BANKS, VERBAL_CATEGORIES } from '../types';
import { ArrowRightIcon, ClockIcon, CheckCircleIcon, XCircleIcon, BookmarkIcon, ChevronDownIcon, InfoIcon, FileTextIcon, EyeIcon, ZoomInIcon, StarIcon, LogOutIcon, BookOpenIcon } from './Icons';

const toArabic = (n: number | string) => ('' + n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${toArabic(String(minutes).padStart(2, '0'))}:${toArabic(String(seconds).padStart(2, '0'))}`;
};

// Helper to separate passage from question text
const extractPassageAndQuestion = (fullText: string) => {
    const passageMarker = "**النص:**";
    const questionMarker = "**السؤال:**";
    
    // Check if the formatted markers exist
    if (fullText.includes(passageMarker) && fullText.includes(questionMarker)) {
        const parts = fullText.split(questionMarker);
        // Clean up the passage part
        const passagePart = parts[0].replace(passageMarker, '').trim();
        // Clean up the question part
        const questionPart = parts[1].trim();
        
        return { passage: passagePart, cleanQuestion: questionPart };
    }
    
    // Fallback/Standard question
    return { passage: null, cleanQuestion: fullText };
};

const QuestionAccordion: React.FC<{
    question: Question | FolderQuestion;
    qNumber: number;
    isReviewMode: boolean;
    userAnswer: string | undefined;
    onSelectAnswer: (answer: string) => void;
    // For flagging questions
    isFlagged: boolean;
    onToggleFlag: () => void;
    // For Special Law (Quantitative)
    isSpecialLaw: boolean;
    onToggleSpecialLaw: () => void;
    isFlagButtonDisabled: boolean;
    onShowInfo: () => void;
    isReviewTest: boolean;
    isQuantitative: boolean;
    onZoomImage: (src: string) => void;
}> = ({ question, qNumber, isReviewMode, userAnswer, onSelectAnswer, isFlagged, onToggleFlag, isSpecialLaw, onToggleSpecialLaw, isFlagButtonDisabled, onShowInfo, isReviewTest, isQuantitative, onZoomImage }) => {
    const hasAnswered = userAnswer !== undefined;
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleHeaderClick = () => {
        // In Quantitative, we don't collapse. 
        // In Verbal, allow collapsing/expanding only after answering in training mode, or anytime in review mode.
        if (isQuantitative) return;
        
        if (hasAnswered || isReviewMode) {
            setIsCollapsed(!isCollapsed);
        }
    };
    
    const getOptionClass = (option: string) => {
        if (!isReviewMode) {
             return userAnswer === option ? 'bg-sky-700 text-white ring-2 ring-sky-300 shadow-lg shadow-sky-500/20' : 'bg-surface hover:bg-zinc-700/50 border-zinc-700 hover:border-zinc-500';
        }
        
        // Review Mode Styling
        const isCorrect = option === question.correctAnswer;
        const isSelected = option === userAnswer;

        if (isCorrect) return 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]';
        if (isSelected && !isCorrect) return 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]';
        
        return 'bg-zinc-800 border-border opacity-60';
    };

    const folderQuestion = question as FolderQuestion;
    const sourceSectionName = folderQuestion.sourceSection;
    const reviewType = folderQuestion.reviewType;

    const gridClass = isQuantitative 
        ? 'grid-cols-4' // Quantitative: Always 4 in a row
        : 'grid-cols-1 sm:grid-cols-2'; // Verbal: 2 columns on desktop

    return (
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <div 
                className={`flex justify-between items-center p-4 ${(!isQuantitative && (hasAnswered || isReviewMode)) ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={handleHeaderClick}
            >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                     <div className="flex-shrink-0 flex items-center gap-2">
                        {isReviewTest && (
                            <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-2 rounded-full hover:bg-zinc-600 transition-colors" title="معلومات السؤال">
                                <InfoIcon className="w-5 h-5 text-sky-400"/>
                            </button>
                        )}
                        {!isReviewMode && !isReviewTest && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onToggleFlag(); }} disabled={isFlagButtonDisabled} className="p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={isFlagButtonDisabled ? "هذا السؤال تمت إضافته للمراجعة بالفعل" : "تأجيل / إضافة للمراجعة"}>
                                    <BookmarkIcon className="w-5 h-5 text-yellow-400" isFilled={isFlagged} />
                                </button>
                                {isQuantitative && (
                                     <button onClick={(e) => { e.stopPropagation(); onToggleSpecialLaw(); }} disabled={isFlagButtonDisabled} className="p-2 rounded-full hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={isFlagButtonDisabled ? "هذا السؤال تمت إضافته للمراجعة بالفعل" : "إضافة السؤال لقانون خاص"}>
                                        <StarIcon className="w-5 h-5 text-purple-400" isFilled={isSpecialLaw} />
                                    </button>
                                )}
                            </>
                        )}
                     </div>
                    <div className="w-full overflow-hidden">
                         <div className="text-xl font-semibold leading-relaxed text-right flex justify-between items-center gap-4" style={{color: 'var(--color-gold)'}}>
                            <div className="flex flex-col gap-1 w-full">
                                <div className="flex justify-between items-start w-full">
                                     <span className="break-words w-full">
                                        <span className="text-text-muted select-none">{toArabic(qNumber)}. </span>
                                        {question.questionText}
                                    </span>
                                </div>
                                
                                {isReviewMode && (
                                    <div className="mt-1 flex flex-wrap gap-4 items-center">
                                        <span className="text-sm font-bold text-success bg-green-900/30 px-2 py-1 rounded inline-block">
                                            الإجابة الصحيحة: {question.correctAnswer}
                                        </span>
                                        {/* Show Verification Image Automatically in Review Mode - Increased size for better visibility */}
                                        {question.verificationImage && (
                                            <div className="flex items-center gap-2 bg-zinc-900/50 px-2 py-1 rounded border border-zinc-700 max-w-full overflow-hidden">
                                                <span className="text-xs text-text-muted flex-shrink-0">المصدر:</span>
                                                <img src={question.verificationImage} alt="Answer Source" className="h-16 object-contain rounded-sm bg-white" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                             {isReviewTest && sourceSectionName && (
                                <div className="flex flex-col items-end gap-1 text-xs font-mono flex-shrink-0 hidden sm:flex">
                                    <span className="bg-zinc-700 text-cyan-400 px-2 py-1 rounded-md">{sourceSectionName}</span>
                                    {reviewType === 'mistake' && <span className="bg-red-900/70 text-red-300 px-2 py-1 rounded-md">(خطأ)</span>}
                                    {reviewType === 'delay' && <span className="bg-yellow-800/70 text-yellow-300 px-2 py-1 rounded-md">(تأخير)</span>}
                                    {reviewType === 'specialLaw' && <span className="bg-purple-900/70 text-purple-300 px-2 py-1 rounded-md">(قانون خاص)</span>}
                                </div>
                            )}
                        </div>
                        {question.questionImage && (
                            <div className="mt-4 flex justify-center relative group">
                                <img 
                                    src={question.questionImage} 
                                    alt="سؤال" 
                                    onClick={(e) => { e.stopPropagation(); if(isQuantitative) onZoomImage(question.questionImage!); }}
                                    className={`max-w-full max-h-64 rounded-lg border border-border ${isQuantitative ? 'cursor-zoom-in hover:border-primary transition-colors' : ''}`} 
                                />
                                {isQuantitative && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                            <ZoomInIcon className="w-3 h-3" /> تكبير
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {!isQuantitative && (hasAnswered || isReviewMode) && (
                     <ChevronDownIcon className={`w-6 h-6 text-text-muted transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`} />
                )}
            </div>
            
            <div 
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isCollapsed 
                    ? 'grid-rows-[0fr] opacity-0' 
                    : 'grid-rows-[1fr] opacity-100'
                }`}
            >
                 <div className="overflow-hidden">
                    <div className="p-4 border-t border-border bg-black/10">
                        <div className={`grid gap-4 ${gridClass}`}>
                            {question.options.map((option, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => onSelectAnswer(option)} 
                                    disabled={isReviewMode}
                                    className={`w-full text-center p-4 rounded-lg border text-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 ${getOptionClass(option)} ${!isReviewMode && 'disabled:opacity-50'}`}
                                >
                                    {isReviewMode && !isQuantitative && (
                                        <span className="inline-block flex-shrink-0">
                                            {option === question.correctAnswer && <CheckCircleIcon className="w-6 h-6 text-white"/>}
                                            {option === userAnswer && option !== question.correctAnswer && <XCircleIcon className="w-6 h-6 text-white"/>}
                                        </span>
                                    )}
                                    <span className="break-words">{option}</span>
                                </button>
                            ))}
                        </div>
                        {isReviewMode && userAnswer === undefined && (
                            <div className="mt-4 text-center p-3 bg-red-900/40 border border-red-700 rounded-md">
                                <p className="font-bold text-red-400">لم يتم حل السؤال</p>
                            </div>
                        )}
                     </div>
                 </div>
            </div>
        </div>
    )
}


interface TakeTestViewProps {
    test: Test;
    onFinishTest: (answers: UserAnswer[], duration: number) => void;
    onBack?: () => void;
    reviewAttempt?: TestAttempt;
    // For session resumption
    initialAnswers?: UserAnswer[];
    initialElapsedTime?: number;
    onStateChange?: (answers: UserAnswer[], time: number) => void;
    onAddDelayedReview?: (question: Question, qIndex: number) => void;
    onAddSpecialLawReview?: (question: Question, qIndex: number) => void; // New prop
    reviewedQuestionIds?: Set<string>;
    // For review mode navigation
    onBackToSummary?: () => void;
    onBackToSection?: () => void;
}

export const TakeTestView: React.FC<TakeTestViewProps> = ({ test, onFinishTest, onBack, reviewAttempt, initialAnswers, initialElapsedTime, onStateChange, onAddDelayedReview, onAddSpecialLawReview, reviewedQuestionIds = new Set(), onBackToSummary, onBackToSection }) => {
    const isReviewMode = !!reviewAttempt;
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers || (reviewAttempt ? reviewAttempt.answers : []));
    const [elapsedTime, setElapsedTime] = useState(initialElapsedTime || 0);
    const [sessionFlaggedIds, setSessionFlaggedIds] = useState<Set<string>>(new Set());
    const [sessionSpecialLawIds, setSessionSpecialLawIds] = useState<Set<string>>(new Set());

    const [infoModalQuestion, setInfoModalQuestion] = useState<FolderQuestion | null>(null);
    
    // New State for Full Screen Image
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    
    const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
    const timerRef = useRef<number | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const isReviewTest = test.id.includes('review_');
    
    // Determine if test is Quantitative based on questions content or context.
    const isQuantitative = useMemo(() => {
        return test.questions.length > 0 && !!test.questions[0].questionImage;
    }, [test]);

    // Compute unique passages to number them sequentially
    const uniquePassages = useMemo(() => {
        const passages: string[] = [];
        test.questions.forEach(q => {
             const { passage } = extractPassageAndQuestion(q.questionText);
             if (passage && !passages.includes(passage)) {
                 passages.push(passage);
             }
        });
        return passages;
    }, [test.questions]);

    const commitSessionFlagsToReview = useCallback(() => {
        // Commit bookmarks/delay
        if (onAddDelayedReview) {
            sessionFlaggedIds.forEach(questionId => {
                if (reviewedQuestionIds.has(questionId)) return; 
                const question = test.questions.find(q => q.id === questionId);
                const qIndex = test.questions.findIndex(q => q.id === questionId);
                if (question) onAddDelayedReview(question, qIndex);
            });
        }
        // Commit special law
        if (onAddSpecialLawReview) {
             sessionSpecialLawIds.forEach(questionId => {
                if (reviewedQuestionIds.has(questionId)) return; 
                const question = test.questions.find(q => q.id === questionId);
                const qIndex = test.questions.findIndex(q => q.id === questionId);
                if (question) onAddSpecialLawReview(question, qIndex);
            });
        }
    }, [sessionFlaggedIds, sessionSpecialLawIds, onAddDelayedReview, onAddSpecialLawReview, test.questions, reviewedQuestionIds]);

    useEffect(() => {
        if (!isReviewMode) {
            timerRef.current = window.setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isReviewMode]);

     useEffect(() => {
        if (onStateChange) {
            onStateChange(userAnswers, elapsedTime);
        }
    }, [userAnswers, elapsedTime, onStateChange]);
    
    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isReviewMode) return;
        setUserAnswers(prev => {
            const existing = prev.find(a => a.questionId === questionId);
            if (existing) {
                return prev.map(a => a.questionId === questionId ? { ...a, answer } : a);
            }
            return [...prev, { questionId, answer }];
        });
    };

    const handleToggleFlag = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
        
        setSessionFlaggedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };
    
    const handleToggleSpecialLaw = (questionId: string) => {
        if (isReviewMode || reviewedQuestionIds.has(questionId)) return;
        
         setSessionSpecialLawIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };
    
    const handleFinish = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        commitSessionFlagsToReview();
        onFinishTest(userAnswers, elapsedTime);
    }
    
    const handleConfirmExit = () => {
        if (onBack) {
            // NOTE: User requested that exiting via back button considers they "didn't enter".
            // So we do NOT commit session flags to review here. We just abort.
            onBack();
        }
    };

    const reviewSummary = useMemo(() => {
        if (!isReviewMode || !reviewAttempt) return { all: 0, correct: 0, incorrect: 0, unanswered: 0 };
        
        const answersMap = new Map(reviewAttempt.answers.map(a => [a.questionId, a.answer]));
        let correctCount = 0;
        let incorrectCount = 0;
        
        reviewAttempt.questions.forEach(q => {
            const userAnswer = answersMap.get(q.id);
            if (userAnswer !== undefined && userAnswer !== '') {
                if (userAnswer === q.correctAnswer) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            }
        });
        const unansweredCount = reviewAttempt.totalQuestions - (correctCount + incorrectCount);

        return {
            all: reviewAttempt.totalQuestions,
            correct: correctCount,
            incorrect: incorrectCount,
            unanswered: unansweredCount
        };
    }, [isReviewMode, reviewAttempt]);

    const filteredQuestions = useMemo(() => {
        if (!isReviewMode || reviewFilter === 'all' || !reviewAttempt) {
            return test.questions;
        }

        const answersMap = new Map(reviewAttempt.answers.map(a => [a.questionId, a.answer]));

        return test.questions.filter(q => {
            const userAnswer = answersMap.get(q.id);
            const isCorrect = userAnswer === q.correctAnswer;
            const isAnswered = userAnswer !== undefined && userAnswer !== '';

            switch (reviewFilter) {
                case 'correct':
                    return isCorrect;
                case 'incorrect':
                    return isAnswered && !isCorrect;
                case 'unanswered':
                    return !isAnswered;
                default:
                    return true;
            }
        });
    }, [test.questions, reviewFilter, isReviewMode, reviewAttempt]);

    const handleBackNavigation = () => {
        if (isReviewMode) {
             if(onBackToSummary) onBackToSummary();
        } else {
            setShowExitConfirm(true);
        }
    };
    
    // Helper var for grouping
    let lastRenderedPassage: string | null = null;

    return (
        <div className="bg-bg min-h-screen flex flex-col">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border shadow-md">
                <div className="container mx-auto flex flex-col gap-4 md:block">
                    {/* Header Layout: Right (Back+Title), Left (Timer), Center (Filters) - RTL */}
                    <div className="flex items-center justify-between w-full">
                        
                        {/* 1. Back Button & Title (Right Side) */}
                        <div className="flex justify-start items-center gap-3">
                             <button onClick={handleBackNavigation} className="p-2 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors">
                               <ArrowRightIcon className="w-5 h-5 text-text-muted"/>
                            </button>
                            <h1 className="text-lg md:text-xl font-bold text-text truncate max-w-[200px] md:max-w-md text-right" title={test.name}>{isReviewMode ? `مراجعة: ${test.name}` : test.name}</h1>
                        </div>

                        {/* 3. Timer (Left Side) */}
                         <div className="flex items-center justify-end gap-3">
                            { !isReviewMode && (
                                 <div className="font-mono text-xl text-cyan-400 bg-black/40 px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] flex items-center gap-2">
                                   <ClockIcon className="w-5 h-5"/> <span>{formatTime(elapsedTime)}</span>
                                </div>
                            )}
                         </div>
                    </div>

                    {/* 2. Filters (Center) - Below on mobile, center on desktop if needed, but for now stack works better or separate line */}
                    {isReviewMode && (
                        <div className="flex justify-center w-full mt-2 md:mt-0">
                             <div className="flex flex-wrap justify-center items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-zinc-700/50 backdrop-blur-sm w-full md:w-auto shadow-inner">
                                <button onClick={() => setReviewFilter('all')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reviewFilter === 'all' ? 'bg-zinc-100 text-black shadow-lg' : 'text-zinc-300 hover:bg-white/10'}`}>
                                    <span>الكل</span>
                                    <span className={`px-1.5 rounded-full text-xs ${reviewFilter === 'all' ? 'bg-black/20 text-black' : 'bg-black/40 text-white'}`}>{toArabic(reviewSummary.all)}</span>
                                </button>
                                <button onClick={() => setReviewFilter('correct')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reviewFilter === 'correct' ? 'bg-green-500 text-white shadow-lg' : 'text-zinc-300 hover:bg-white/10'}`}>
                                    <span>الصحيحة</span>
                                    <span className={`px-1.5 rounded-full text-xs ${reviewFilter === 'correct' ? 'bg-black/20' : 'bg-black/40'}`}>{toArabic(reviewSummary.correct)}</span>
                                </button>
                                <button onClick={() => setReviewFilter('incorrect')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reviewFilter === 'incorrect' ? 'bg-red-500 text-white shadow-lg' : 'text-zinc-300 hover:bg-white/10'}`}>
                                    <span>الخاطئة</span>
                                    <span className={`px-1.5 rounded-full text-xs ${reviewFilter === 'incorrect' ? 'bg-black/20' : 'bg-black/40'}`}>{toArabic(reviewSummary.incorrect)}</span>
                                </button>
                                <button onClick={() => setReviewFilter('unanswered')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reviewFilter === 'unanswered' ? 'bg-yellow-500 text-white shadow-lg' : 'text-zinc-300 hover:bg-white/10'}`}>
                                    <span>المتروكة</span>
                                    <span className={`px-1.5 rounded-full text-xs ${reviewFilter === 'unanswered' ? 'bg-black/20' : 'bg-black/40'}`}>{toArabic(reviewSummary.unanswered)}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>
            
            <main className="container mx-auto p-4 md:p-8 flex-grow w-full max-w-full px-4 sm:px-6 lg:px-8">
               <div className="space-y-4">
                 {filteredQuestions.map((q, index) => {
                    const originalIndex = test.questions.findIndex(origQ => origQ.id === q.id);
                    
                    // Parse logic to extract Passage
                    const { passage, cleanQuestion } = extractPassageAndQuestion(q.questionText);
                    
                    let showPassage = false;
                    let passageNumber = 0;
                    
                    // If we have a passage, and it's distinct from the previously rendered one in this list, show it.
                    if (passage && passage !== lastRenderedPassage) {
                        showPassage = true;
                        lastRenderedPassage = passage;
                        // Calculate absolute passage number in the test
                        passageNumber = uniquePassages.indexOf(passage) + 1;
                    }
                    
                    return (
                        <div key={q.id}>
                            {showPassage && (
                                <div className="mb-4 mt-6 p-5 bg-zinc-800/80 rounded-lg border-r-4 border-primary shadow-md">
                                    <h3 className="text-primary font-bold mb-3 flex items-center gap-2 text-lg border-b border-zinc-700 pb-2">
                                        <BookOpenIcon className="w-5 h-5"/>
                                        قطعة {toArabic(passageNumber)}
                                    </h3>
                                    <div className="text-lg leading-loose text-slate-200 whitespace-pre-wrap pl-2 font-medium">
                                        {passage}
                                    </div>
                                </div>
                            )}
                            <QuestionAccordion 
                                question={{...q, questionText: cleanQuestion}}
                                qNumber={originalIndex + 1}
                                isReviewMode={isReviewMode}
                                userAnswer={userAnswers.find(a => a.questionId === q.id)?.answer}
                                onSelectAnswer={(answer) => handleSelectAnswer(q.id, answer)}
                                isFlagged={reviewedQuestionIds.has(q.id) || sessionFlaggedIds.has(q.id)}
                                onToggleFlag={() => handleToggleFlag(q.id)}
                                isSpecialLaw={reviewedQuestionIds.has(q.id) || sessionSpecialLawIds.has(q.id)}
                                onToggleSpecialLaw={() => handleToggleSpecialLaw(q.id)}
                                isFlagButtonDisabled={reviewedQuestionIds.has(q.id)}
                                onShowInfo={() => setInfoModalQuestion(q as FolderQuestion)}
                                isReviewTest={isReviewTest}
                                isQuantitative={isQuantitative}
                                onZoomImage={(src) => setFullScreenImage(src)}
                            />
                        </div>
                    );
                 })}
               </div>
                 {filteredQuestions.length === 0 && (
                    <div className="text-center text-text-muted py-16">
                        <p className="text-lg">لا توجد أسئلة تطابق هذا الفلتر.</p>
                    </div>
                 )}
                {!isReviewMode && (
                    <div className="mt-12 text-center pb-8">
                         <button onClick={handleFinish} className="px-12 py-3 bg-accent border-2 border-accent text-white font-bold rounded-lg hover:opacity-90 transition-all duration-200 hover:scale-105 text-lg transform shadow-xl shadow-accent/20">
                             إنهاء الاختبار
                         </button>
                    </div>
                )}
            </main>

            {isReviewMode && (
                <footer className="bg-surface/90 backdrop-blur-xl p-4 sticky bottom-0 z-20 border-t border-border mt-8 shadow-2xl">
                    <div className="container mx-auto flex justify-center items-center gap-6">
                         <button 
                            onClick={onBackToSummary} 
                            className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 transform hover:scale-105 shadow-lg shadow-blue-500/20 hover:bg-blue-500"
                        >
                             <FileTextIcon className="w-5 h-5"/>
                             عرض النتائج
                         </button>
                         <button 
                            onClick={onBackToSection} 
                            className="px-8 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
                        >
                             <LogOutIcon className="w-5 h-5"/>
                             المغادرة
                         </button>
                    </div>
                </footer>
            )}
            
            {/* Modals */}
             {infoModalQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setInfoModalQuestion(null)}>
                    <div className="bg-surface rounded-lg p-6 m-4 max-w-sm w-full shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-primary">مصدر السؤال</h3>
                        <div className="space-y-2 text-sm">
                            <p><strong className="text-text-muted">البنك:</strong> {infoModalQuestion.sourceBank || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">القسم:</strong> {infoModalQuestion.sourceSection || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">الاختبار الأصلي:</strong> {infoModalQuestion.sourceTest || 'غير محدد'}</p>
                            <p><strong className="text-text-muted">رقم السؤال الأصلي:</strong> {infoModalQuestion.originalQuestionIndex !== undefined ? toArabic(infoModalQuestion.originalQuestionIndex + 1) : 'غير محدد'}</p>
                            <p><strong className="text-text-muted">تاريخ الإضافة للمراجعة:</strong> {infoModalQuestion.addedDate ? new Date(infoModalQuestion.addedDate).toLocaleString('ar-SA') : 'غير محدد'}</p>
                        </div>
                         <button onClick={() => setInfoModalQuestion(null)} className="mt-6 w-full px-4 py-2 bg-zinc-600 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إغلاق</button>
                    </div>
                </div>
            )}
            
            {fullScreenImage && (
                 <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 backdrop-blur-sm cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
                    <div className="w-full h-full flex items-center justify-center p-4">
                         <img src={fullScreenImage} alt="Full Screen Question" className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                        <h2 className="text-xl font-bold mb-4">تأكيد الخروج</h2>
                        <p className="text-text-muted mb-6">هل أنت متأكد من رغبتك في الخروج؟ لن يتم حفظ هذه المحاولة.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowExitConfirm(false)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                            <button onClick={handleConfirmExit} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold">خروج</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
