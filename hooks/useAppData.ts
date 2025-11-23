
import { useState, useEffect, useMemo } from 'react';
import { AppData, Test, Section, Question, TestAttempt, Folder, VerbalTests, VERBAL_BANKS, VERBAL_CATEGORIES, FolderQuestion } from '../types';
import { authService } from '../services/authService';

const DEV_TESTS_USER_ID = 'developer-tests-data';

const initialVerbalTests: VerbalTests = Object.keys(VERBAL_BANKS).reduce((acc, bankKey) => {
  acc[bankKey] = Object.keys(VERBAL_CATEGORIES).reduce((catAcc, catKey) => {
    catAcc[catKey] = [];
    return catAcc;
  }, {} as { [category: string]: Test[] });
  return acc;
}, {} as VerbalTests);

const sampleTest: Test = {
    id: 'sample_test_1',
    name: 'اختبار تجريبي 1',
    questions: [
        { id: 'q_sample_1', questionText: 'ليل : نهار', options: ['شمس : قمر', 'صيف : ربيع', 'دفتر : قلم', 'سيارة : شارع'], correctAnswer: 'شمس : قمر' },
        { id: 'q_sample_2', questionText: 'مستشفى : مرضى', options: ['مدرسة : طلاب', 'ملعب : كرة', 'حديقة : أشجار', 'بيت : أسرة'], correctAnswer: 'مدرسة : طلاب' },
    ]
};


// Fix: Export `getInitialData` so it can be used in other modules.
export const getInitialData = (): AppData => ({
  tests: {
    quantitative: [],
    verbal: {
        ...JSON.parse(JSON.stringify(initialVerbalTests)),
        'bank1': {
            ...JSON.parse(JSON.stringify(initialVerbalTests['bank1'])),
            'verbalAnalogy': [sampleTest]
        }
    },
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

const loadAllUsersData = (): { [key: string]: AppData } => {
    try {
        const item = window.localStorage.getItem('qudratUsersData');
        const data = item ? JSON.parse(item) : {};
        // Ensure dev tests container exists
        if (!data[DEV_TESTS_USER_ID]) {
            data[DEV_TESTS_USER_ID] = getInitialData();
        }
        return data;
    } catch (error) {
        console.error("Failed to load user data from localStorage", error);
        return {};
    }
};

const saveAllUsersData = (allData: { [key: string]: AppData }) => {
    try {
        window.localStorage.setItem('qudratUsersData', JSON.stringify(allData));
        // Dispatch a custom event to notify other hook instances (in the same window) to reload
        window.dispatchEvent(new Event('qudratDataUpdated'));
    } catch (error) {
        console.error("Failed to save user data to localStorage", error);
    }
};

export const useAppData = (userId: string | null, isDevUser: boolean, isPreviewMode: boolean) => {
  const [allUsersData, setAllUsersData] = useState(loadAllUsersData);

  // Listen for updates from other instances of this hook (e.g. Management views updating data)
  useEffect(() => {
      const handleDataUpdate = () => {
          setAllUsersData(loadAllUsersData());
      };
      
      window.addEventListener('qudratDataUpdated', handleDataUpdate);
      // Listen to storage event for cross-tab synchronization
      window.addEventListener('storage', handleDataUpdate);
      
      return () => {
          window.removeEventListener('qudratDataUpdated', handleDataUpdate);
          window.removeEventListener('storage', handleDataUpdate);
      };
  }, []);

  const data: AppData = useMemo(() => {
    const activeUserId = userId;
    if (!activeUserId) return getInitialData();
    
    // Ensure the user data exists and has all initial fields
    const userDataFromStorage = allUsersData[activeUserId];
    const initialData = getInitialData();
    const userData = {
        ...initialData,
        ...userDataFromStorage,
        reviewTests: userDataFromStorage?.reviewTests || initialData.reviewTests,
        reviewedQuestionIds: userDataFromStorage?.reviewedQuestionIds || initialData.reviewedQuestionIds
    };
    const devTestsData = allUsersData[DEV_TESTS_USER_ID] || getInitialData();

    // Devs see dev tests. Regular users (or devs in preview) see dev tests too.
    // Personal data (folders, history, reviewTests) comes from the active user's data slot.
    return {
      tests: devTestsData.tests,
      folders: userData.folders,
      history: userData.history,
      reviewTests: userData.reviewTests,
      reviewedQuestionIds: userData.reviewedQuestionIds,
    };
  }, [userId, allUsersData]);
  
  useEffect(() => {
    // Only save if the data actually changed compared to loaded data to avoid loops,
    // but here we rely on the setters to trigger saves.
    // We don't auto-save 'data' because it's a derived view.
    // The modifiers below call saveAllUsersData.
  }, []);

  // Updater for the currently active user's data (history, folders)
  const updateCurrentUserData = (updater: (draft: AppData) => void) => {
    const activeUserId = userId;
    if (!activeUserId) return;
    setAllUsersData(prevAll => {
      const newAll = { ...prevAll };
      const userDraft = JSON.parse(JSON.stringify(newAll[activeUserId] || getInitialData()));
      updater(userDraft);
      newAll[activeUserId] = userDraft;
      saveAllUsersData(newAll); // Save immediately
      return newAll;
    });
  };

  // Updater for the central test bank data
  const updateDevTestsData = (updater: (draft: AppData) => void) => {
    if (!isDevUser) return;
    setAllUsersData(prevAll => {
      const newAll = { ...prevAll };
      const devDraft = JSON.parse(JSON.stringify(newAll[DEV_TESTS_USER_ID] || getInitialData()));
      updater(devDraft);
      newAll[DEV_TESTS_USER_ID] = devDraft;
      saveAllUsersData(newAll); // Save immediately
      return newAll;
    });
  };
  
  const deleteUserData = (userKey: string) => {
    setAllUsersData(prevAll => {
      const newAll = { ...prevAll };
      if (newAll[userKey]) {
        delete newAll[userKey];
        saveAllUsersData(newAll);
      }
      return newAll;
    });
  };

  const addTest = (section: Section, testName: string, bankKey?: string, categoryKey?: string, sourceText?: string) => {
    if (!isDevUser) return '';
    const newTest: Test = {
      id: `test_${Date.now()}`,
      name: testName,
      questions: [],
      sourceText,
    };
    updateDevTestsData(draft => {
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
    
    updateDevTestsData(draft => {
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
  
  const deleteTest = (section: Section, testId: string, bankKey?: string, categoryKey?: string) => {
    if (!isDevUser) return;
    updateDevTestsData(draft => {
      if (section === 'verbal' && bankKey && categoryKey) {
         if (draft.tests.verbal[bankKey] && draft.tests.verbal[bankKey][categoryKey]) {
            draft.tests.verbal[bankKey][categoryKey] = draft.tests.verbal[bankKey][categoryKey].filter((t: Test) => t.id !== testId);
         }
      } else if (section === 'quantitative') {
        draft.tests.quantitative = draft.tests.quantitative.filter(test => test.id !== testId);
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

            // 1. Collect all existing original IDs in the review section to prevent duplicates
            const existingOriginalIds = new Set<string>();
            reviewTestsInSection.forEach(test => {
                test.questions.forEach(q => {
                    const fq = q as FolderQuestion;
                    if (fq.originalId) existingOriginalIds.add(fq.originalId);
                });
            });

            // 2. Filter incoming questions
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
                // Mark original question ID as reviewed
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

        if (!isCorrect) { // This covers both incorrect and unanswered questions
            questionsToReview.push({
                ...question,
                originalId: question.id, // Store the original ID for tracking
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
  
  const reviewedQuestionIdsSet = useMemo(() => new Set(Object.keys(data.reviewedQuestionIds || {})), [data.reviewedQuestionIds]);

  return { data, addTest, addQuestionsToTest, deleteTest, addAttemptToHistory, createFolder, addQuestionToFolder, deleteFolder, addQuestionsToReview, deleteUserData, addDelayedQuestionToReview, addSpecialLawQuestionToReview, reviewedQuestionIds: reviewedQuestionIdsSet };
};
