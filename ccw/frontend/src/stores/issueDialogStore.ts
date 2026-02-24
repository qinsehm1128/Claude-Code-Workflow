// ========================================
// Issue Dialog Store
// ========================================
// Zustand store for managing issue submission wizard state

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

export type IssueType = 'bug' | 'feature' | 'improvement' | 'other';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IssueFormData {
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  tags: string[];
  project_id?: string;
}

export interface WizardStep {
  id: string;
  field: keyof IssueFormData | 'summary';
  title: string;
  description?: string;
  isOptional?: boolean;
}

export interface IssueDialogState {
  // Dialog state
  isOpen: boolean;
  mode: 'wizard' | 'quick' | 'cli';

  // Wizard state
  currentStep: number;
  steps: WizardStep[];

  // Form data
  formData: IssueFormData;
  validationErrors: Partial<Record<keyof IssueFormData, string>>;

  // Submission state
  isSubmitting: boolean;
  submitError: string | null;
  submittedIssueId: string | null;

  // Actions - Dialog
  openDialog: (mode?: 'wizard' | 'quick' | 'cli') => void;
  closeDialog: () => void;

  // Actions - Wizard navigation
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Actions - Form
  updateField: <K extends keyof IssueFormData>(field: K, value: IssueFormData[K]) => void;
  setFormData: (data: Partial<IssueFormData>) => void;
  resetForm: () => void;
  validateCurrentStep: () => boolean;

  // Actions - Submission
  submitIssue: () => Promise<{ success: boolean; issueId?: string; error?: string }>;
}

// ========== Default Values ==========

const defaultFormData: IssueFormData = {
  title: '',
  description: '',
  type: 'other',
  priority: 'medium',
  tags: [],
  project_id: undefined,
};

const defaultSteps: WizardStep[] = [
  {
    id: 'title',
    field: 'title',
    title: 'Issue 标题',
    description: '请输入一个简洁明确的标题',
  },
  {
    id: 'description',
    field: 'description',
    title: 'Issue 描述',
    description: '请详细描述问题或需求',
  },
  {
    id: 'type',
    field: 'type',
    title: 'Issue 类型',
    description: '选择 Issue 的类型',
  },
  {
    id: 'priority',
    field: 'priority',
    title: '优先级',
    description: '设置 Issue 的处理优先级',
    isOptional: true,
  },
  {
    id: 'summary',
    field: 'summary',
    title: '确认提交',
    description: '请确认以下信息后提交',
  },
];

// ========== Store Implementation ==========

export const useIssueDialogStore = create<IssueDialogState>()(
  devtools(
    (set, get) => ({
      // Initial state
      isOpen: false,
      mode: 'wizard',
      currentStep: 0,
      steps: defaultSteps,
      formData: { ...defaultFormData },
      validationErrors: {},
      isSubmitting: false,
      submitError: null,
      submittedIssueId: null,

      // Dialog actions
      openDialog: (mode = 'wizard') => {
        set({
          isOpen: true,
          mode,
          currentStep: 0,
          formData: { ...defaultFormData },
          validationErrors: {},
          submitError: null,
          submittedIssueId: null,
        });
      },

      closeDialog: () => {
        set({
          isOpen: false,
          isSubmitting: false,
        });
      },

      // Wizard navigation
      goToStep: (step) => {
        const { steps, validateCurrentStep } = get();
        if (step >= 0 && step < steps.length) {
          // Validate current step before moving forward
          if (step > get().currentStep && !validateCurrentStep()) {
            return;
          }
          set({ currentStep: step });
        }
      },

      nextStep: () => {
        const { currentStep, steps, validateCurrentStep } = get();
        if (currentStep < steps.length - 1) {
          if (validateCurrentStep()) {
            set({ currentStep: currentStep + 1 });
          }
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      // Form actions
      updateField: (field, value) => {
        set((state) => ({
          formData: { ...state.formData, [field]: value },
          validationErrors: { ...state.validationErrors, [field]: undefined },
        }));
      },

      setFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data },
        }));
      },

      resetForm: () => {
        set({
          formData: { ...defaultFormData },
          validationErrors: {},
          currentStep: 0,
          submitError: null,
          submittedIssueId: null,
        });
      },

      validateCurrentStep: () => {
        const { currentStep, steps, formData } = get();
        const currentField = steps[currentStep]?.field;

        if (currentField === 'summary') {
          return true; // Summary step doesn't need validation
        }

        const errors: Partial<Record<keyof IssueFormData, string>> = {};

        if (currentField === 'title') {
          if (!formData.title.trim()) {
            errors.title = '标题不能为空';
          } else if (formData.title.length > 200) {
            errors.title = '标题不能超过200个字符';
          }
        }

        if (currentField === 'description') {
          if (!formData.description.trim()) {
            errors.description = '描述不能为空';
          } else if (formData.description.length > 10000) {
            errors.description = '描述不能超过10000个字符';
          }
        }

        set({ validationErrors: errors });
        return Object.keys(errors).length === 0;
      },

      // Submission
      submitIssue: async () => {
        const { formData } = get();
        set({ isSubmitting: true, submitError: null });

        try {
          const response = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `ISSUE-${Date.now()}`,
              title: formData.title,
              context: formData.description,
              priority: formData.priority === 'urgent' ? 1 : 
                        formData.priority === 'high' ? 2 : 
                        formData.priority === 'medium' ? 3 : 4,
              tags: formData.tags,
              status: 'registered',
            }),
          });

          const result = await response.json();

          if (!response.ok || result.error) {
            set({ 
              isSubmitting: false, 
              submitError: result.error || '提交失败，请稍后重试' 
            });
            return { success: false, error: result.error };
          }

          set({ 
            isSubmitting: false, 
            submittedIssueId: result.issue?.id 
          });

          return { success: true, issueId: result.issue?.id };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '网络错误，请稍后重试';
          set({ isSubmitting: false, submitError: errorMessage });
          return { success: false, error: errorMessage };
        }
      },
    }),
    { name: 'issue-dialog-store' }
  )
);

export default useIssueDialogStore;
