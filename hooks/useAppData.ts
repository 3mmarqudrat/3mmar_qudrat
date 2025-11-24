
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';

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

export const useAppData = (userId: string | null, isDevUser: boolean, isPreviewMode: boolean) => {
  // 1. Global State (Tests) - Shared across all users
  const [globalTests, setGlobalTests] = useState<AppData['tests']>({
    quantitative: [],
    verbal: initialVerbalTests,
  });

  // 2. User Specific State (History, Folders, Reviews)
  const [userData, setUserData] = useState<Omit<AppData, 'tests'>>({
      folders: getInitialData().folders,
      history: [],
      reviewTests: { quantitative: [], verbal: [] },
      reviewedQuestionIds: {}
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Load Global Tests
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'globalContent', 'main'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Merge with initial structure to ensure no undefined errors if fields are missing
            const loadedVerbal = { ...initialVerbalTests, ...(data.tests?.verbal || {}) };
            setGlobalTests({
                quantitative: data.tests?.quantitative || [],
                verbal: loadedVerbal
            });
        }
    });
    return () => unsub();
  }, []);

  // Load User Data
  useEffect(() => {
    if (!userId) {
        setUserData({
             folders: getInitialData().folders,
             history: [],
             reviewTests: { quantitative: [], verbal: [] },
             reviewedQuestionIds: {}
        });
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    const docRef = doc(db, 'userData', userId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const loaded = docSnap.data();
            setUserData({
                folders: loaded.folders || getInitialData().folders,
                history: loaded.history || [],
                reviewTests: loaded.reviewTests || { quantitative: [], verbal: [] },
                reviewedQuestionIds: loaded.reviewedQuestionIds || {}
            });
        } else {
             // Initialize empty user doc if it doesn't exist? 
             // Or just let it be empty until first save.
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error loading user data:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Combined Data for UI
  const data: AppData = useMemo(() => ({
      tests: globalTests,
      ...userData
  }), [globalTests, userData]);

  // --- Helpers for Database Updates ---

  const saveGlobalTests = async (updater: (draft: AppData['tests']) => void) => {
      // Create a deep copy of current state to modify
      const newTests = JSON.parse(JSON.stringify(globalTests));
      updater(newTests);
      
      // Optimistic update
      setGlobalTests(newTests);

      // Write to Firestore
      try {
          await setDoc(doc(db, 'globalContent', 'main'), { tests: newTests }, { merge: true });
      } catch (e) {
          console.error("Failed to save global tests:", e);
      }
  };

  const saveUserSpecificData = async (updater: (draft: Omit<AppData, 'tests'>) => void) => {
      if (!userId) return;
      const newData = JSON.parse(JSON.stringify(userData));
      updater(newData);
      
      // Optimistic update
      setUserData(newData);

      try {
          await setDoc(doc(db, 'userData', userId), newData, { merge: true });
      } catch (e) {
          console.error("Failed to save user data:", e);
      }
  };

  // --- Actions ---

  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    if (!isDevUser) return '';
    
    const newTest: Test = {
      id: `test_${Date.now()}`,
      name: testName,
      questions: [],
      sourceText,
    };
    
    saveGlobalTests(draft => {
        if (section === 'verbal' && bankKey && categoryKey) {
            if (!draft.verbal[bankKey]) draft.verbal[bankKey] = {};
            if (!draft.verbal[bankKey][categoryKey]) draft.verbal[bankKey][categoryKey] = [];
            draft.verbal[bankKey][categoryKey].push(newTest);
        } else if (section === 'quantitative') {
            draft.quantitative.push(newTest);
        }
    });
    return newTest.id;
  };

  const addQuestionsToTest = (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    const questionsWithIds: Question[] = newQuestions.map(q => ({ ...q, id: `q_${Date.now()}_${Math.random()}` }));
    
    saveGlobalTests(draft => {
        if (section === 'verbal' && bankKey && categoryKey) {
            if (draft.verbal[bankKey] && draft.verbal[bankKey][categoryKey]) {
                const testIndex = draft.verbal[bankKey][categoryKey].findIndex((t: Test) => t.id === testId);
                if (testIndex !== -1) {
                    draft.verbal[bankKey][categoryKey][testIndex].questions.push(...questionsWithIds);
                }
            }
        } else if (section === 'quantitative') {
            const testIndex = draft.quantitative.findIndex((test: Test) => test.id === testId);
            if (testIndex !== -1) {
                draft.quantitative[testIndex].questions.push(...questionsWithIds);
            }
        }
    });
  };
  
  const updateQuestionAnswer = (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => {
      if (!isDevUser) return;
      saveGlobalTests(draft => {
          if (section === 'verbal' && bankKey && categoryKey) {
              const test = draft.verbal[bankKey]?.[categoryKey]?.find((t: Test) => t.id === testId);
              if (test) {
                  const q = test.questions.find((q: Question) => q.id === questionId);
                  if (q) q.correctAnswer = newAnswer;
              }
          } else if (section === 'quantitative') {
              const test = draft.quantitative.find((t: Test) => t.id === testId);
              if (test) {
                  const q = test.questions.find((q: Question) => q.id === questionId);
                  if (q) q.correctAnswer = newAnswer;
              }
          }
      });
  };
  
  const deleteTest = (section: Section, testId: string, bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    saveGlobalTests(draft => {
      if (section === 'verbal' && bankKey && categoryKey) {
         if (draft.verbal[bankKey] && draft.verbal[bankKey][categoryKey]) {
            draft.verbal[bankKey][categoryKey] = draft.verbal[bankKey][categoryKey].filter((t: Test) => t.id !== testId);
         }
      } else if (section === 'quantitative') {
        draft.quantitative = draft.quantitative.filter((test: Test) => test.id !== testId);
      }
    });
  };
  
  const deleteTests = (section: Section, testIds: string[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    saveGlobalTests(draft => {
      if (section === 'verbal' && bankKey && categoryKey) {
         if (draft.verbal[bankKey] && draft.verbal[bankKey][categoryKey]) {
            draft.verbal[bankKey][categoryKey] = draft.verbal[bankKey][categoryKey].filter((t: Test) => !testIds.includes(t.id));
         }
      } else if (section === 'quantitative') {
        draft.quantitative = draft.quantitative.filter((test: Test) => !testIds.includes(test.id));
      }
    });
  };

    const addQuestionsToReview = (section: Section, questions: Omit<FolderQuestion, 'id'>[]) => {
        if ((isDevUser && !isPreviewMode) || questions.length === 0) return;

        saveUserSpecificData(draft => {
            const REVIEW_TEST_MAX_QUESTIONS = 75;
            
            if (!draft.reviewTests) {
                draft.reviewTests = { quantitative: [], verbal: [] };
            }
             if (!draft.reviewedQuestionIds) {
                draft.reviewedQuestionIds = {};
            }
            
            const reviewTestsInSection = draft.reviewTests[section];

            const existingOriginalIds = new Set<string>();
            reviewTestsInSection.forEach((test: Test) => {
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

    saveUserSpecificData(draft => {
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
    saveUserSpecificData(draft => {
        draft.folders[section].push(newFolder);
    });
    return newFolder.id;
  };

  const deleteFolder = (section: Section, folderId: string) => {
    if ((isDevUser && !isPreviewMode) || folderId.startsWith('mistakes_')) return;
    saveUserSpecificData(draft => {
        draft.folders[section] = draft.folders[section].filter((folder: Folder) => folder.id !== folderId);
    });
  };

  const addQuestionToFolder = (section: Section, folderId: string, question: Question) => {
    if (isDevUser && !isPreviewMode) return;
    saveUserSpecificData(draft => {
        const folder = draft.folders[section].find((f: Folder) => f.id === folderId);
        if (folder && !folder.questions.some((q: Question) => q.id === question.id)) {
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
    
    // Delete user data (Profile from Admin)
    const deleteUserData = async (userKey?: string) => {
        if (!userKey) return;
        try {
            await deleteDoc(doc(db, 'userData', userKey));
        } catch (e) {
            console.error("Failed to delete user data:", e);
        }
    };

  const exportAllData = () => {
      try {
          // Export combined data
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
                  // Import User Data
                  if (importedData) {
                      const { tests, ...rest } = importedData;
                      await saveUserSpecificData(draft => {
                         Object.assign(draft, rest);
                      });
                      // Only Admin can overwrite global tests theoretically, 
                      // but here we prioritize preserving global integrity or asking user.
                      // For now, let's only import user data and ignore tests to avoid accidental overwrites.
                  }
                  resolve(true);
              } catch (err) {
                  reject(err);
              }
          };
          reader.readAsText(file);
      });
  };
  
  const reviewedQuestionIdsSet = useMemo(() => new Set(Object.keys(userData.reviewedQuestionIds || {})), [userData.reviewedQuestionIds]);

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
