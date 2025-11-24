
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { AppSettings } from '../services/settingsService'; 
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc, updateDoc, collection, query, writeBatch, arrayUnion } from 'firebase/firestore';

const initialVerbalTests: VerbalTests = Object.keys(VERBAL_BANKS).reduce((acc, bankKey) => {
  acc[bankKey] = Object.keys(VERBAL_CATEGORIES).reduce((catAcc, catKey) => {
    catAcc[catKey] = [];
    return catAcc;
  }, {} as { [category: string]: Test[] });
  return acc;
}, {} as VerbalTests);

const defaultGlobalSettings: AppSettings = {
    isQuantitativeEnabled: true,
    isVerbalEnabled: true,
    isReviewQuantitativeEnabled: true,
    isReviewVerbalEnabled: true,
};

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
  // 1. Global State (Tests) - Fetched from 'globalTests' collection
  const [globalTests, setGlobalTests] = useState<AppData['tests']>({
    quantitative: [],
    verbal: initialVerbalTests,
  });
  
  // 2. Global Settings
  const [settings, setSettings] = useState<AppSettings>(defaultGlobalSettings);

  // 3. User Specific State
  const [userData, setUserData] = useState<Omit<AppData, 'tests'>>({
      folders: getInitialData().folders,
      history: [],
      reviewTests: { quantitative: [], verbal: [] },
      reviewedQuestionIds: {}
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // LOAD GLOBAL TESTS (Real-time Collection Listener)
  useEffect(() => {
    const q = query(collection(db, 'globalTests'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const newTestsStructure: AppData['tests'] = {
            quantitative: [],
            verbal: JSON.parse(JSON.stringify(initialVerbalTests)) // Deep copy initial structure
        };

        querySnapshot.forEach((doc) => {
            const testData = { id: doc.id, ...doc.data() } as any;
            
            if (testData.section === 'quantitative') {
                newTestsStructure.quantitative.push(testData);
            } else if (testData.section === 'verbal') {
                const { bankKey, categoryKey } = testData;
                if (bankKey && categoryKey && newTestsStructure.verbal[bankKey]?.[categoryKey]) {
                    newTestsStructure.verbal[bankKey][categoryKey].push(testData);
                }
            }
        });

        setGlobalTests(newTestsStructure);
    }, (error) => {
        console.error("Error fetching global tests:", error);
    });

    return () => unsubscribe();
  }, []);

  // Load Global Settings
  useEffect(() => {
    const settingsUnsub = onSnapshot(doc(db, 'globalContent', 'settings'), (docSnap) => {
        if (docSnap.exists()) {
            setSettings(docSnap.data() as AppSettings);
        } else {
            setSettings(defaultGlobalSettings);
        }
    });
    return () => settingsUnsub();
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
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error loading user data:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const data: AppData = useMemo(() => ({
      tests: globalTests,
      ...userData
  }), [globalTests, userData]);

  // --- ACTIONS (Now using Collection-based logic) ---

  // Update Global Settings
  const updateGlobalSettings = async (newSettings: AppSettings) => {
      if (!isDevUser && !isPreviewMode) return; 
      setSettings(newSettings);
      try {
          await setDoc(doc(db, 'globalContent', 'settings'), newSettings, { merge: true });
      } catch (e) {
          console.error("Failed to save settings:", e);
      }
  };

  const saveUserSpecificData = async (updater: (draft: Omit<AppData, 'tests'>) => void) => {
      if (!userId) return;
      const newData = JSON.parse(JSON.stringify(userData));
      updater(newData);
      setUserData(newData);
      try {
          await setDoc(doc(db, 'userData', userId), newData, { merge: true });
      } catch (e) {
          console.error("Failed to save user data:", e);
      }
  };

  // 1. ADD TEST (Creates a new Document)
  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    if (!isDevUser) return '';
    
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTest: any = {
      id: testId,
      name: testName,
      questions: [],
      section,
      createdAt: new Date().toISOString()
    };

    if (sourceText) newTest.sourceText = sourceText;
    if (bankKey) newTest.bankKey = bankKey;
    if (categoryKey) newTest.categoryKey = categoryKey;

    // Fire and forget (Optimistic updates handled by onSnapshot listener)
    setDoc(doc(db, 'globalTests', testId), newTest).catch(e => console.error("Add Test Failed:", e));
    
    return testId;
  };

  // 2. ADD QUESTIONS (Updates specific Document)
  const addQuestionsToTest = (section: Section, testId: string, newQuestions: Omit<Question, 'id'>[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    
    const questionsWithIds = newQuestions.map(q => ({ ...q, id: `q_${Date.now()}_${Math.random()}` }));
    
    // Use arrayUnion to add efficiently without reading the whole doc
    updateDoc(doc(db, 'globalTests', testId), {
        questions: arrayUnion(...questionsWithIds)
    }).catch(e => console.error("Add Questions Failed:", e));
  };
  
  // 3. UPDATE ANSWER
  const updateQuestionAnswer = async (section: Section, testId: string, questionId: string, newAnswer: string, bankKey?: string, categoryKey?: string) => {
      if (!isDevUser) return;
      
      try {
          const testRef = doc(db, 'globalTests', testId);
          const testSnap = await getDoc(testRef);
          if (testSnap.exists()) {
              const testData = testSnap.data();
              const updatedQuestions = testData.questions.map((q: Question) => 
                  q.id === questionId ? { ...q, correctAnswer: newAnswer } : q
              );
              await updateDoc(testRef, { questions: updatedQuestions });
          }
      } catch (e) {
          console.error("Update Answer Failed:", e);
      }
  };
  
  // 4. DELETE TEST
  const deleteTest = (section: Section, testId: string, bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    deleteDoc(doc(db, 'globalTests', testId)).catch(e => console.error("Delete Test Failed:", e));
  };
  
  // 5. BULK DELETE
  const deleteTests = (section: Section, testIds: string[], bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    
    const batch = writeBatch(db);
    testIds.forEach(id => {
        const ref = doc(db, 'globalTests', id);
        batch.delete(ref);
    });
    
    batch.commit().catch(e => console.error("Bulk Delete Failed:", e));
  };

  // --- User Data Actions (History, Reviews) ---

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

            const newQuestionsWithIds = uniqueQuestionsToAdd.map(q => ({
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
                  if (importedData) {
                      const { tests, ...rest } = importedData;
                      await saveUserSpecificData(draft => {
                         Object.assign(draft, rest);
                      });
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
    settings,
    isLoading, 
    addTest, 
    addQuestionsToTest, 
    deleteTest, 
    deleteTests,
    updateQuestionAnswer,
    updateGlobalSettings,
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
