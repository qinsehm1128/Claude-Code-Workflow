// ========================================
// Issue Dialog Components
// ========================================
// Interactive wizard for submitting issues/requirements

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { useIssueDialogStore } from '@/stores/issueDialogStore';
import { cn } from '@/lib/utils';
import type { IssueType, IssuePriority } from '@/stores/issueDialogStore';

// ========== Types ==========

interface IssueDialogProps {
  trigger?: React.ReactNode;
}

// ========== Step Components ==========

function TitleStep() {
  const { formatMessage } = useIntl();
  const { formData, validationErrors, updateField } = useIssueDialogStore();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title" className="text-base font-medium">
          {formatMessage({ id: 'issueDialog.titleLabel', defaultMessage: '标题' })}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder={formatMessage({ 
            id: 'issueDialog.titlePlaceholder', 
            defaultMessage: '请输入Issue标题...' 
          })}
          className={cn('mt-2', validationErrors.title && 'border-destructive')}
          maxLength={200}
          autoFocus
        />
        {validationErrors.title && (
          <p className="text-sm text-destructive mt-1">{validationErrors.title}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formData.title.length}/200
        </p>
      </div>
    </div>
  );
}

function DescriptionStep() {
  const { formatMessage } = useIntl();
  const { formData, validationErrors, updateField } = useIssueDialogStore();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="description" className="text-base font-medium">
          {formatMessage({ id: 'issueDialog.descriptionLabel', defaultMessage: '描述' })}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder={formatMessage({ 
            id: 'issueDialog.descriptionPlaceholder', 
            defaultMessage: '请详细描述问题或需求...' 
          })}
          className={cn('mt-2 min-h-[200px]', validationErrors.description && 'border-destructive')}
          maxLength={10000}
        />
        {validationErrors.description && (
          <p className="text-sm text-destructive mt-1">{validationErrors.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formData.description.length}/10000
        </p>
      </div>
    </div>
  );
}

function TypeStep() {
  const { formatMessage } = useIntl();
  const { formData, updateField } = useIssueDialogStore();

  const typeOptions: { value: IssueType; label: string; description: string }[] = [
    { 
      value: 'bug', 
      label: formatMessage({ id: 'issueDialog.typeBug', defaultMessage: 'Bug' }),
      description: formatMessage({ id: 'issueDialog.typeBugDesc', defaultMessage: '功能异常或错误' })
    },
    { 
      value: 'feature', 
      label: formatMessage({ id: 'issueDialog.typeFeature', defaultMessage: 'Feature' }),
      description: formatMessage({ id: 'issueDialog.typeFeatureDesc', defaultMessage: '新功能需求' })
    },
    { 
      value: 'improvement', 
      label: formatMessage({ id: 'issueDialog.typeImprovement', defaultMessage: 'Improvement' }),
      description: formatMessage({ id: 'issueDialog.typeImprovementDesc', defaultMessage: '现有功能改进' })
    },
    { 
      value: 'other', 
      label: formatMessage({ id: 'issueDialog.typeOther', defaultMessage: 'Other' }),
      description: formatMessage({ id: 'issueDialog.typeOtherDesc', defaultMessage: '其他类型' })
    },
  ];

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">
        {formatMessage({ id: 'issueDialog.typeLabel', defaultMessage: '选择类型' })}
      </Label>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {typeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateField('type', option.value)}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              formData.type === option.value
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <div className="font-medium">{option.label}</div>
            <div className="text-sm text-muted-foreground">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PriorityStep() {
  const { formatMessage } = useIntl();
  const { formData, updateField } = useIssueDialogStore();

  const priorityOptions: { value: IssuePriority; label: string; color: string }[] = [
    { value: 'low', label: formatMessage({ id: 'issueDialog.priorityLow', defaultMessage: '低' }), color: 'bg-gray-500' },
    { value: 'medium', label: formatMessage({ id: 'issueDialog.priorityMedium', defaultMessage: '中' }), color: 'bg-blue-500' },
    { value: 'high', label: formatMessage({ id: 'issueDialog.priorityHigh', defaultMessage: '高' }), color: 'bg-orange-500' },
    { value: 'urgent', label: formatMessage({ id: 'issueDialog.priorityUrgent', defaultMessage: '紧急' }), color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">
        {formatMessage({ id: 'issueDialog.priorityLabel', defaultMessage: '选择优先级' })}
      </Label>
      <Select value={formData.priority} onValueChange={(v) => updateField('priority', v as IssuePriority)}>
        <SelectTrigger className="mt-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {priorityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', option.color)} />
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryStep() {
  const { formatMessage } = useIntl();
  const { formData, submitError } = useIssueDialogStore();

  const typeLabels: Record<IssueType, string> = {
    bug: formatMessage({ id: 'issueDialog.typeBug', defaultMessage: 'Bug' }),
    feature: formatMessage({ id: 'issueDialog.typeFeature', defaultMessage: 'Feature' }),
    improvement: formatMessage({ id: 'issueDialog.typeImprovement', defaultMessage: 'Improvement' }),
    other: formatMessage({ id: 'issueDialog.typeOther', defaultMessage: 'Other' }),
  };

  const priorityLabels: Record<IssuePriority, string> = {
    low: formatMessage({ id: 'issueDialog.priorityLow', defaultMessage: '低' }),
    medium: formatMessage({ id: 'issueDialog.priorityMedium', defaultMessage: '中' }),
    high: formatMessage({ id: 'issueDialog.priorityHigh', defaultMessage: '高' }),
    urgent: formatMessage({ id: 'issueDialog.priorityUrgent', defaultMessage: '紧急' }),
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <div>
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issueDialog.summaryTitle', defaultMessage: '标题' })}
          </span>
          <p className="font-medium mt-1">{formData.title}</p>
        </div>

        <div>
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issueDialog.summaryDescription', defaultMessage: '描述' })}
          </span>
          <p className="mt-1 text-sm whitespace-pre-wrap">{formData.description}</p>
        </div>

        <div className="flex gap-4">
          <div>
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'issueDialog.summaryType', defaultMessage: '类型' })}
            </span>
            <div className="mt-1">
              <Badge variant="outline">{typeLabels[formData.type]}</Badge>
            </div>
          </div>

          <div>
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'issueDialog.summaryPriority', defaultMessage: '优先级' })}
            </span>
            <div className="mt-1">
              <Badge variant="outline">{priorityLabels[formData.priority]}</Badge>
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {submitError}
        </div>
      )}
    </div>
  );
}

// ========== Main Dialog Component ==========

export function IssueDialog({ trigger }: IssueDialogProps) {
  const { formatMessage } = useIntl();
  const {
    isOpen,
    currentStep,
    steps,
    isSubmitting,
    closeDialog,
    nextStep,
    prevStep,
    submitIssue,
  } = useIssueDialogStore();

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const currentStepData = steps[currentStep];

  const handleSubmit = useCallback(async () => {
    const result = await submitIssue();
    if (result.success) {
      closeDialog();
    }
  }, [submitIssue, closeDialog]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleSubmit();
    } else {
      nextStep();
    }
  }, [isLastStep, handleSubmit, nextStep]);

  const stepContent = useMemo(() => {
    const field = currentStepData?.field;
    switch (field) {
      case 'title':
        return <TitleStep />;
      case 'description':
        return <DescriptionStep />;
      case 'type':
        return <TypeStep />;
      case 'priority':
        return <PriorityStep />;
      case 'summary':
        return <SummaryStep />;
      default:
        return null;
    }
  }, [currentStepData?.field]);

  return (
    <>
      {trigger}
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentStepData?.title}</DialogTitle>
            {currentStepData?.description && (
              <DialogDescription>{currentStepData.description}</DialogDescription>
            )}
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 py-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => useIssueDialogStore.getState().goToStep(index)}
                className={cn(
                  'rounded-full transition-all duration-200',
                  index === currentStep
                    ? 'bg-primary w-6 h-2'
                    : index < currentStep
                    ? 'bg-primary/50 w-2 h-2'
                    : 'bg-muted-foreground/30 w-2 h-2 hover:bg-muted-foreground/50'
                )}
                aria-label={`Step ${index + 1}: ${step.title}`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="py-4 min-h-[200px]">
            {stepContent}
          </div>

          <DialogFooter>
            <div className="flex w-full justify-between">
              <Button
                variant="outline"
                onClick={isFirstStep ? closeDialog : prevStep}
              >
                {isFirstStep 
                  ? formatMessage({ id: 'issueDialog.cancel', defaultMessage: '取消' })
                  : formatMessage({ id: 'issueDialog.previous', defaultMessage: '上一步' })
                }
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? formatMessage({ id: 'issueDialog.submitting', defaultMessage: '提交中...' })
                  : isLastStep
                  ? formatMessage({ id: 'issueDialog.submit', defaultMessage: '提交' })
                  : formatMessage({ id: 'issueDialog.next', defaultMessage: '下一步' })
                }
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default IssueDialog;
