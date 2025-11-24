
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

const initialVerbalTests: VerbalTests = Object.keys(VERBAL_BANKS).reduce((acc, bankKey) => {
  acc[bankKey] = Object.keys(VERBAL_CATEGORIES).reduce((catAcc, catKey) => {
    catAcc[catKey] = [];
    return catAcc;
  }, {} as { [category: string]: Test[] });
  return acc;
}, {} as VerbalTests);

export const getInitialData = (): AppData => ({
  tests: {
    quantitative: [],
    verbal: initialVerbalTests,
  },
  folders: {
    quantitative: [{ id: 'mistakes_quantitative', name: 'مجلد الأخطاء', questions: [] }],
    verbal: [{ id: 'mistakes_verbal', name: 'مجلد الأخطاء', questions: [] }],
  },
  reviewTests: {
    quantitative: [],
    verbal: [],
  },
  history: [],
  reviewedQuestionIds: {},
});

// Helper to deep merge initial data structure with loaded data to ensure no undefined errors
const mergeWithInitial = (loadedData: any): AppData => {
    const initial = getInitialData();
    if (!loadedData) return initial;

    return {
        tests: {
            quantitative: loadedData.tests?.quantitative || [],
            verbal: { ...initial.tests.verbal, ...(loadedData.tests?.verbal || {}) }
        },
        folders: {
            quantitative: loadedData.folders?.quantitative || initial.folders.quantitative,
            verbal: loadedData.folders?.verbal || initial.folders.verbal
        },
        history: loadedData.history || [],
        reviewTests: {
            quantitative: loadedData.reviewTests?.quantitative || [],
            verbal: loadedData.reviewTests?.verbal || []
        },
        reviewedQuestionIds: loadedData.reviewedQuestionIds || {}
    };
};

export const useAppData = (userId: string | null, isDevUser: boolean, isPreviewMode: boolean) => {
  const [data, setData] = useState<AppData>(getInitialData());
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a ref to track if we should save updates (avoid saving initial load)
  const isLoadedRef = useRef(false);

  // Load Data from Firestore
  useEffect(() => {
    if (!userId) {
        setData(getInitialData());
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    isLoadedRef.current = false;

    // Real-time listener
    const docRef = doc(db, 'userData', userId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const loadedData = docSnap.data() as AppData;
            setData(mergeWithInitial(loadedData));
        } else {
            // New user, init data
            setData(getInitialData());
        }
        setIsLoading(false);
        // After first load, enable saving
        setTimeout(() => { isLoadedRef.current = true; }, 500);
    }, (error) => {
        console.error("Error loading user data:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Save Data to Firestore (Debounced)
  const saveDataToFirestore = async (newData: AppData) => {
      if (!userId || !isLoadedRef.current) return;
      try {
          await setDoc(doc(db, 'userData', userId), newData);
      } catch (e) {
          console.error("Failed to save data to Firestore:", e);
      }
  };

  const updateCurrentUserData = (updater: (draft: AppData) => void) => {
    if (!userId) return;
    setData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      updater(newData);
      saveDataToFirestore(newData); // Fire and forget
      return newData;
    });
  };

  // --- Actions ---

  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    // Only dev user can add tests, usually. 
    // Assuming for now simple logic: direct update to current user data (which acts as dev if isDevUser)
    if (!isDevUser) return '';
    
    const newTest: Test = {
      id: `test_${Date.now()}`,
      name: testName,
      questions: [],
      sourceText,
    };
    
    updateCurrentUserData(draft => {
        if (section === 'verbal' && bankKey && categoryKey) {
            if (!draft.tests.verbal[bankKey]) draft.tests.verbal[bankKey] = {};
            if (!draft.tests.verbal[bankKey][categoryKey]) draft.tests.verbal[bankKey][categoryKey] = [];
            draft.tests.verbal[bankKey][categoryKey].push(newTest);
        } else if (section === 'quantitative') {
            draft.tests.quantitative.push(newTest);
        }
    });
    return newTest.id;
  };

  const addQuestionsToTest = (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    const questionsWithIds: Question[] = newQuestions.map(q => ({ ...q, id: `q_${Date.now()}_${Math.random()}` }));
    
    updateCurrentUserData(draft => {
        if (section === 'verbal' && bankKey && categoryKey) {
            if (draft.tests.verbal[bankKey] && draft.tests.verbal[bankKey][categoryKey]) {
                const testIndex = draft.tests.verbal[bankKey][categoryKey].findIndex((t: Test) => t.id === testId);
                if (testIndex !== -1) {
                    draft.tests.verbal[bankKey][categoryKey][testIndex].questions.push(...questionsWithIds);
                }
            }
        } else if (section === 'quantitative') {
            const testIndex = draft.tests.quantitative.findIndex(test => test.id === testId);
            if (testIndex !== -1) {
                draft.tests.quantitative[testIndex].questions.push(...questionsWithIds);
            }
        }
    });
  };
  
  const updateQuestionAnswer = (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => {
      if (!isDevUser) return;
      updateCurrentUserData(draft => {
          if (section === 'verbal' && bankKey && categoryKey) {
              const test = draft.tests.verbal[bankKey]?.[categoryKey]?.find((t: Test) => t.id === testId);
              if (test) {
                  const q = test.questions.find(q => q.id === questionId);
                  if (q) q.correctAnswer = newAnswer;
              }
          } else if (section === 'quantitative') {
              const test = draft.tests.quantitative.find((t: Test) => t.id === testId);
              if (test) {
                  const q = test.questions.find(q => q.id === questionId);
                  if (q) q.correctAnswer = newAnswer;
              }
          }
      });
  };
  
  const deleteTest = (section: Section, testId: string, bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    updateCurrentUserData(draft => {
      if (section === 'verbal' && bankKey && categoryKey) {
         if (draft.tests.verbal[bankKey] && draft.tests.verbal[bankKey][categoryKey]) {
            draft.tests.verbal[bankKey][categoryKey] = draft.tests.verbal[bankKey][categoryKey].filter((t: Test) => t.id !== testId);
         }
      } else if (section === 'quantitative') {
        draft.tests.quantitative = draft.tests.quantitative.filter(test => test.id !== testId);
      }
    });
  };
  
  const deleteTests = (section: Section, testIds: string[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    updateCurrentUserData(draft => {
      if (section === 'verbal' && bankKey && categoryKey) {
         if (draft.tests.verbal[bankKey] && draft.tests.verbal[bankKey][categoryKey]) {
            draft.tests.verbal[bankKey][categoryKey] = draft.tests.verbal[bankKey][categoryKey].filter((t: Test) => !testIds.includes(t.id));
         }
      } else if (section === 'quantitative') {
        draft.tests.quantitative = draft.tests.quantitative.filter(test => !testIds.includes(test.id));
      }
    });
  };

    const addQuestionsToReview = (section: Section, questions: Omit<FolderQuestion, 'id'>[]) => {
        if ((isDevUser && !isPreviewMode) || questions.length === 0) return;

        updateCurrentUserData(draft => {
            const REVIEW_TEST_MAX_QUESTIONS = 75;
            
            if (!draft.reviewTests) {
                draft.reviewTests = { quantitative: [], verbal: [] };
            }
             if (!draft.reviewedQuestionIds) {
                draft.reviewedQuestionIds = {};
            }
            
            const reviewTestsInSection = draft.reviewTests[section];

            const existingOriginalIds = new Set<string>();
            reviewTestsInSection.forEach(test => {
                test.questions.forEach(q => {
                    const fq = q as FolderQuestion;
                    if (fq.originalId) existingOriginalIds.add(fq.originalId);
                });
            });

            const uniqueQuestionsToAdd = questions.filter(q => {
                return q.originalId && !existingOriginalIds.has(q.originalId);
            });

            if (uniqueQuestionsToAdd.length === 0) return;

            const newQuestionsWithIds: FolderQuestion[] = uniqueQuestionsToAdd.map(q => ({
                ...q,
                id: `q_review_${Date.now()}_${Math.random()}`
            }));
            
            let targetTest = reviewTestsInSection.length > 0 ? reviewTestsInSection[reviewTestsInSection.length - 1] : null;

            for (const questionToAdd of newQuestionsWithIds) {
                if (!targetTest || targetTest.questions.length >= REVIEW_TEST_MAX_QUESTIONS) {
                    const newTestNumber = reviewTestsInSection.length + 1;
                    targetTest = {
                        id: `review_${section}_${newTestNumber}_${Date.now()}`,
                        name: `مراجعة ${newTestNumber}`,
                        questions: []
                    };
                    draft.reviewTests[section].push(targetTest);
                }
                targetTest.questions.push(questionToAdd);
                draft.reviewedQuestionIds[questionToAdd.originalId || questionToAdd.id] = true;
            }
        });
    };

  const addAttemptToHistory = (attempt: Omit<TestAttempt, 'id'>) => {
    if ((isDevUser && !isPreviewMode) || attempt.testId.includes('review_')) return;
    
    const newAttempt: TestAttempt = { ...attempt, id: `attempt_${Date.now()}` };
    
    const questionsToReview: FolderQuestion[] = [];
    
    const answeredQuestions = new Map(attempt.answers.map(a => [a.questionId, a.answer]));

    attempt.questions.forEach((question, index) => {
        const userAnswer = answeredQuestions.get(question.id);
        const isCorrect = userAnswer && userAnswer.trim() === question.correctAnswer.trim();

        if (!isCorrect) {
            questionsToReview.push({
                ...question,
                originalId: question.id,
                userAnswer: userAnswer,
                addedDate: new Date().toISOString(),
                bankKey: attempt.bankKey,
                categoryKey: attempt.categoryKey,
                testName: attempt.testName,
                originalQuestionIndex: index,
                reviewType: 'mistake',
                sourceBank: attempt.bankKey ? VERBAL_BANKS[attempt.bankKey] : undefined,
                sourceSection: attempt.categoryKey ? VERBAL_CATEGORIES[attempt.categoryKey] : undefined,
                sourceTest: attempt.testName,
            });
        }
    });
    
    if (questionsToReview.length > 0) {
        addQuestionsToReview(attempt.section, questionsToReview);
    }

    updateCurrentUserData(draft => {
      draft.history.unshift(newAttempt);
    });
  };

  const createFolder = (section: Section, folderName: string): string => {
    if (isDevUser && !isPreviewMode) return '';
    const newFolder: Folder = {
      id: `folder_${Date.now()}`,
      name: folderName,
      questions: [],
    };
    updateCurrentUserData(draft => {
        draft.folders[section].push(newFolder);
    });
    return newFolder.id;
  };

  const deleteFolder = (section: Section, folderId: string) => {
    if ((isDevUser && !isPreviewMode) || folderId.startsWith('mistakes_')) return;
    updateCurrentUserData(draft => {
        draft.folders[section] = draft.folders[section].filter(folder => folder.id !== folderId);
    });
  };

  const addQuestionToFolder = (section: Section, folderId: string, question: Question) => {
    if (isDevUser && !isPreviewMode) return;
    updateCurrentUserData(draft => {
        const folder = draft.folders[section].find(f => f.id === folderId);
        if (folder && !folder.questions.some(q => q.id === question.id)) {
            const questionToAdd: FolderQuestion = { ...question, addedDate: new Date().toISOString() };
            folder.questions.push(questionToAdd);
        }
    });
  };
  
    const addDelayedQuestionToReview = (section: Section, question: Question, context: { bankKey?: string; categoryKey?: string, testName?: string, originalQuestionIndex?: number }) => {
        if (isDevUser && !isPreviewMode) return;
        
        const questionToAdd: Omit<FolderQuestion, 'id'> = {
            ...question,
            originalId: question.id,
            reviewType: 'delay',
            addedDate: new Date().toISOString(),
            ...context,
            sourceBank: context.bankKey ? VERBAL_BANKS[context.bankKey] : undefined,
            sourceSection: context.categoryKey ? VERBAL_CATEGORIES[context.categoryKey] : undefined,
            sourceTest: context.testName,
        };
        addQuestionsToReview(section, [questionToAdd]);
    };
    
    const addSpecialLawQuestionToReview = (section: Section, question: Question, context: { bankKey?: string; categoryKey?: string, testName?: string, originalQuestionIndex?: number }) => {
        if (isDevUser && !isPreviewMode) return;
        
        const questionToAdd: Omit<FolderQuestion, 'id'> = {
            ...question,
            originalId: question.id,
            reviewType: 'specialLaw',
            addedDate: new Date().toISOString(),
            ...context,
            sourceBank: context.bankKey ? VERBAL_BANKS[context.bankKey] : undefined,
            sourceSection: context.categoryKey ? VERBAL_CATEGORIES[context.categoryKey] : undefined,
            sourceTest: context.testName,
        };
        addQuestionsToReview(section, [questionToAdd]);
    };
    
    // Updated: Delete user data (tests, history)
    const deleteUserData = async (userKey?: string) => {
        if (!userKey) return;
        try {
            await deleteDoc(doc(db, 'userData', userKey));
        } catch (e) {
            console.error("Failed to delete user data:", e);
        }
    };

  const exportAllData = () => {
      // Logic would be similar, but strictly from current data
      try {
          const dataStr = JSON.stringify(data);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const date = new Date().toISOString().split('T')[0];
          link.download = `qudrat_backup_${date}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return true;
      } catch (e) {
          console.error("Export failed:", e);
          return false;
      }
  };

  const importAllData = async (file: File): Promise<boolean> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
              const text = e.target?.result as string;
              try {
                  const importedData = JSON.parse(text);
                  await saveDataToFirestore(importedData);
                  setData(importedData);
                  resolve(true);
              } catch (err) {
                  reject(err);
              }
          };
          reader.readAsText(file);
      });
  };
  
  const reviewedQuestionIdsSet = useMemo(() => new Set(Object.keys(data.reviewedQuestionIds || {})), [data.reviewedQuestionIds]);

  return { 
    data, 
    isLoading, 
    addTest, 
    addQuestionsToTest, 
    deleteTest, 
    deleteTests,
    updateQuestionAnswer,
    addAttemptToHistory, 
    createFolder, 
    addQuestionToFolder, 
    deleteFolder, 
    addQuestionsToReview, 
    deleteUserData, 
    addDelayedQuestionToReview, 
    addSpecialLawQuestionToReview, 
    exportAllData,
    importAllData,
    reviewedQuestionIds: reviewedQuestionIdsSet 
  };
};
