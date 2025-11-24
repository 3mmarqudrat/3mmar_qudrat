
export type Section = 'quantitative' | 'verbal';

export interface LoginRecord {
  loginTime: string;
  logoutTime: string | null;
}

// Fix: Add and export the User interface for authentication.
export interface User {
  uid?: string; // Firebase UID
  email: string;
  username: string;
  password?: string; // Optional now as Firebase handles auth
  isDeveloper?: boolean;
  registrationDate?: string; // ISO string
  loginHistory?: LoginRecord[];
}

export const VERBAL_BANKS: { [key: string]: string } = {
  bank1: 'البنك الاول',
  bank2: 'البنك الثاني',
  bank3: 'البنك الثالث',
  bank4: 'البنك الرابع',
  bank5: 'البنك الخامس',
  bank6: 'البنك السادس',
};

export const VERBAL_CATEGORIES: { [key:string]: string } = {
  verbalAnalogy: 'التناظر اللفظي',
  sentenceCompletion: 'اكمال الجمل',
  contextualError: 'الخطا السياقي',
  readingComprehension: 'استيعاب المقروء',
  oddOneOut: 'المفرده الشاذه',
};


export interface Question {
  id: string;
  questionText: string;
  questionImage?: string;
  verificationImage?: string; // Image of the answer section for dev verification
  options: string[];
  correctAnswer: string;
}

export interface Test {
  id:string;
  name: string;
  questions: Question[];
  sourceText?: string;
}

export interface FolderQuestion extends Question {
  originalId?: string; // The ID of the question in its original test
  userAnswer?: string; // To store the incorrect answer in the mistakes folder
  addedDate?: string; // ISO string for when it was added
  bankKey?: string;
  categoryKey?: string;
  testName?: string;
  originalQuestionIndex?: number;
  // New fields for user review feature
  reviewType?: 'mistake' | 'delay' | 'specialLaw';
  sourceBank?: string;
  sourceSection?: string;
  sourceTest?: string;
}

export interface Folder {
  id: string;
  name: string;
  questions: FolderQuestion[];
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testName: string;
  section: Section;
  bankKey?: string;
  categoryKey?: string;
  date: string; // ISO string
  score: number;
  totalQuestions: number;
  answers: UserAnswer[];
  questions: Question[];
  durationSeconds: number;
}

export interface VerbalTests {
  [bank: string]: {
    [category: string]: Test[];
  };
}

export interface AppData {
  tests: {
    quantitative: Test[];
    verbal: VerbalTests;
  };
  folders: {
    quantitative: Folder[];
    verbal: Folder[];
  };
  history: TestAttempt[];
  reviewTests: {
    quantitative: Test[];
    verbal: Test[];
  };
  reviewedQuestionIds?: { [originalQuestionId: string]: boolean };
}

// New types for Review Page Filtering
export type ReviewDateFilter = 'today' | 'week' | 'month' | 'byDay' | 'byMonth' | null;
export type ReviewAttributeFilterType = 'all' | 'mistake' | 'delay' | 'specialLaw';

export interface ReviewAttributeFilters {
  bank: string[];      // Changed to array
  category: string[];  // Changed to array
  type: ReviewAttributeFilterType[]; // Changed to array
  selectedTestIds: string[]; 
}

export type ReviewActiveFilterPanel = 'time' | 'attribute' | null;

export interface ReviewFilterState {
  activeTab: 'all' | 'mistake' | 'delay' | 'specialLaw' | 'other';
  dateFilter: ReviewDateFilter;
  attributeFilters: ReviewAttributeFilters;
  activePanel: ReviewActiveFilterPanel;
}