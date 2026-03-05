// ========================================
// A2UIPopupCard Component
// ========================================
// Centered popup dialog for A2UI surfaces with minimalist design
// Used for displayMode: 'popup' surfaces (e.g., ask_question)
// Supports markdown content parsing and multi-page navigation

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useIntl } from 'react-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/Drawer';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/Sheet';
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer';
import { useNotificationStore } from '@/stores';
import { useDialogStyleContext, type DialogStyle } from '@/contexts/DialogStyleContext';
import type { SurfaceUpdate, SurfaceComponent } from '@/packages/a2ui-runtime/core/A2UITypes';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface A2UIPopupCardProps {
  /** A2UI Surface to render */
  surface: SurfaceUpdate;
  /** Callback when dialog is closed */
  onClose: () => void;
}

type QuestionType = 'confirm' | 'select' | 'multi-select' | 'input' | 'multi-question' | 'unknown';

interface PageMeta {
  index: number;
  questionId: string;
  title: string;
  type: string;
}

// ========== Helpers ==========

/** Get text content from A2UI Text component */
function getTextContent(component: SurfaceComponent | undefined): string {
  if (!component?.component) return '';
  const comp = component.component as any;
  if (!comp?.Text?.text) return '';
  const text = comp.Text.text;
  if ('literalString' in text) return text.literalString;
  return '';
}

/** Detect question type from surface */
function detectQuestionType(surface: SurfaceUpdate): QuestionType {
  const state = surface.initialState as Record<string, unknown> | undefined;
  if (state?.questionType) {
    return state.questionType as QuestionType;
  }
  // Fallback: detect from components
  const hasCheckbox = surface.components.some((c) => 'Checkbox' in (c.component as any));
  const hasRadioGroup = surface.components.some((c) => 'RadioGroup' in (c.component as any));
  const hasDropdown = surface.components.some((c) => 'Dropdown' in (c.component as any));
  const hasTextField = surface.components.some((c) => 'TextField' in (c.component as any));
  const hasConfirmCancel = surface.components.some(
    (c) => c.id === 'confirm-btn' || c.id === 'cancel-btn'
  );

  if (hasCheckbox) return 'multi-select';
  if (hasRadioGroup) return 'select';
  if (hasDropdown) return 'select';
  if (hasTextField) return 'input';
  if (hasConfirmCancel) return 'confirm';
  return 'unknown';
}

/** Check if component is an action button */
function isActionButton(component: SurfaceComponent): boolean {
  const comp = component.component as any;
  return 'Button' in comp;
}

// ========== "Other" Text Input Component ==========

interface OtherInputProps {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function OtherInput({ visible, value, onChange, placeholder }: OtherInputProps) {
  if (!visible) return null;

  return (
    <div className="mt-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter your answer...'}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-md border border-border',
          'bg-background text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          'transition-colors'
        )}
        autoFocus
      />
    </div>
  );
}

// ========== Markdown Component ==========

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize rendered elements
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="px-1 py-0.5 bg-muted rounded text-sm">{children}</code>
            ) : (
              <code className={cn('block p-2 bg-muted rounded text-sm overflow-x-auto', className)}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ========== Single-Page Popup (Legacy) ==========

function SinglePagePopup({ surface, onClose }: A2UIPopupCardProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  // Detect question type
  const questionType = useMemo(() => detectQuestionType(surface), [surface]);

  // "Other" option state
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState('');

  const questionId = (surface.initialState as any)?.questionId as string | undefined;

  // Countdown timer for auto-selection
  const timeoutAt = (surface.initialState as any)?.timeoutAt as string | undefined;
  const defaultLabel = (surface.initialState as any)?.defaultValue as string | undefined;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timeoutAt || !defaultLabel) return;
    const target = new Date(timeoutAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeoutAt, defaultLabel]);

  // Extract title, message, and description from surface components
  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in (c.component as any)
  );
  const messageComponent = surface.components.find(
    (c) => c.id === 'message' && 'Text' in (c.component as any)
  );
  const descriptionComponent = surface.components.find(
    (c) => c.id === 'description' && 'Text' in (c.component as any)
  );

  const title =
    getTextContent(titleComponent) ||
    formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' });
  const message = getTextContent(messageComponent);
  const description = getTextContent(descriptionComponent);

  // Separate body components (interactive elements) from action buttons
  const { bodyComponents, actionButtons } = useMemo(() => {
    const body: SurfaceComponent[] = [];
    const actions: SurfaceComponent[] = [];

    for (const comp of surface.components) {
      // Skip title, message, description
      if (['title', 'message', 'description'].includes(comp.id)) continue;

      // Separate action buttons (confirm, cancel, submit)
      if (isActionButton(comp) && ['confirm-btn', 'cancel-btn', 'submit-btn'].includes(comp.id)) {
        actions.push(comp);
      } else {
        body.push(comp);
      }
    }

    return { bodyComponents: body, actionButtons: actions };
  }, [surface.components]);

  // Create surfaces for body and actions
  const bodySurface: SurfaceUpdate = useMemo(
    () => ({ ...surface, components: bodyComponents }),
    [surface, bodyComponents]
  );

  const actionsSurface: SurfaceUpdate = useMemo(
    () => ({ ...surface, components: actionButtons }),
    [surface, actionButtons]
  );

  // Handle "Other" text change
  const handleOtherTextChange = useCallback(
    (value: string) => {
      setOtherText(value);
      if (questionId) {
        sendA2UIAction('input-change', surface.surfaceId, {
          questionId: `__other__:${questionId}`,
          value,
        });
      }
    },
    [sendA2UIAction, surface.surfaceId, questionId]
  );

  // Handle A2UI actions
  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      // Track "Other" selection state
      if (actionId === 'select' && params?.value === '__other__') {
        setOtherSelected(true);
      } else if (actionId === 'select' && params?.value !== '__other__') {
        setOtherSelected(false);
      }
      if (actionId === 'toggle' && params?.value === '__other__') {
        setOtherSelected((prev) => !prev);
      }

      // Send action to backend via WebSocket
      sendA2UIAction(actionId, surface.surfaceId, params);

      // Check if this action should close the dialog
      const resolvingActions = ['confirm', 'cancel', 'submit', 'answer'];
      if (resolvingActions.includes(actionId)) {
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  // Handle dialog close (ESC key or overlay click)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  // Determine dialog width based on question type
  const dialogWidth = useMemo(() => {
    switch (questionType) {
      case 'multi-select':
        return 'sm:max-w-[480px]';
      case 'input':
        return 'sm:max-w-[500px]';
      default:
        return 'sm:max-w-[420px]';
    }
  }, [questionType]);

  // Check if this question type supports "Other" input
  const hasOtherOption = questionType === 'select' || questionType === 'multi-select';

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          // Base styles
          dialogWidth,
          'max-h-[80vh] overflow-y-auto',
          'bg-card p-6 rounded-xl shadow-lg border border-border/50',
          // Animation classes
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200'
        )}
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside - only cancel button can close
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key - only cancel button can close
          e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-lg font-semibold leading-tight">{title}</DialogTitle>
          {message && (
            <div className="text-base text-foreground">
              <MarkdownContent content={message} />
            </div>
          )}
          {description && (
            <div className="text-sm text-muted-foreground">
              <MarkdownContent content={description} className="prose-muted" />
            </div>
          )}
        </DialogHeader>

        {/* Body - Interactive elements */}
        {bodyComponents.length > 0 && (
          <div className={cn(
            'py-3',
            // Add specific styling for multi-select (checkbox list)
            questionType === 'multi-select' && 'space-y-2 max-h-[300px] overflow-y-auto px-1'
          )}>
            {questionType === 'multi-select' ? (
              // Render each checkbox individually for better control
              bodyComponents.map((comp) => (
                <div key={comp.id} className="py-1">
                  <A2UIRenderer
                    surface={{ ...bodySurface, components: [comp] }}
                    onAction={handleAction}
                  />
                </div>
              ))
            ) : (
              <A2UIRenderer surface={bodySurface} onAction={handleAction} />
            )}
            {/* "Other" text input — shown when Other is selected */}
            {hasOtherOption && (
              <OtherInput
                visible={otherSelected}
                value={otherText}
                onChange={handleOtherTextChange}
              />
            )}
          </div>
        )}

        {/* Countdown for auto-selection */}
        {remaining !== null && defaultLabel && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            {remaining > 0
              ? `${remaining}s 后将自动选择「${defaultLabel}」`
              : `即将自动选择「${defaultLabel}」`}
          </div>
        )}

        {/* Footer - Action buttons */}
        {actionButtons.length > 0 && (
          <DialogFooter className="pt-4">
            <div className="flex flex-row justify-end gap-3">
              {actionButtons.map((comp) => (
                <A2UIRenderer
                  key={comp.id}
                  surface={{ ...actionsSurface, components: [comp] }}
                  onAction={handleAction}
                />
              ))}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ========== Multi-Page Popup ==========

function MultiPagePopup({ surface, onClose }: A2UIPopupCardProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  const state = surface.initialState as Record<string, unknown>;
  const pages = state.pages as PageMeta[];
  const totalPages = state.totalPages as number;
  const compositeId = state.questionId as string;

  const [currentPage, setCurrentPage] = useState(0);

  // Countdown timer for auto-selection
  const timeoutAt = (state as any)?.timeoutAt as string | undefined;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timeoutAt) return;
    const target = new Date(timeoutAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeoutAt]);

  // "Other" per-page state
  const [otherSelectedPages, setOtherSelectedPages] = useState<Set<number>>(new Set());
  const [otherTexts, setOtherTexts] = useState<Map<number, string>>(new Map());

  // Group components by page
  const pageComponentGroups = useMemo(() => {
    const groups: SurfaceComponent[][] = [];
    for (let i = 0; i < totalPages; i++) {
      groups.push(
        surface.components.filter((c) => (c as any).page === i)
      );
    }
    return groups;
  }, [surface.components, totalPages]);

  // Extract current page title and body components
  const currentPageData = useMemo(() => {
    const comps = pageComponentGroups[currentPage] || [];
    const titleComp = comps.find((c) => c.id.endsWith('-title'));
    const messageComp = comps.find((c) => c.id.endsWith('-message'));
    const descComp = comps.find((c) => c.id.endsWith('-description'));
    const bodyComps = comps.filter(
      (c) => !c.id.endsWith('-title') && !c.id.endsWith('-message') && !c.id.endsWith('-description')
    );

    return {
      title: getTextContent(titleComp),
      message: getTextContent(messageComp),
      description: getTextContent(descComp),
      bodyComponents: bodyComps,
      pageMeta: pages[currentPage],
    };
  }, [pageComponentGroups, currentPage, pages]);

  // Handle "Other" text change for a specific page
  const handleOtherTextChange = useCallback(
    (pageIdx: number, value: string) => {
      setOtherTexts((prev) => {
        const next = new Map(prev);
        next.set(pageIdx, value);
        return next;
      });
      // Send input-change to backend with __other__:{questionId}
      const qId = pages[pageIdx]?.questionId;
      if (qId) {
        sendA2UIAction('input-change', surface.surfaceId, {
          questionId: `__other__:${qId}`,
          value,
        });
      }
    },
    [sendA2UIAction, surface.surfaceId, pages]
  );

  // Handle A2UI actions (pass through to backend without closing dialog)
  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      // Track "Other" selection state per page
      if (actionId === 'select' && params?.value === '__other__') {
        setOtherSelectedPages((prev) => new Set(prev).add(currentPage));
      } else if (actionId === 'select' && params?.value !== '__other__') {
        setOtherSelectedPages((prev) => {
          const next = new Set(prev);
          next.delete(currentPage);
          return next;
        });
      }
      if (actionId === 'toggle' && params?.value === '__other__') {
        setOtherSelectedPages((prev) => {
          const next = new Set(prev);
          if (next.has(currentPage)) {
            next.delete(currentPage);
          } else {
            next.add(currentPage);
          }
          return next;
        });
      }

      sendA2UIAction(actionId, surface.surfaceId, params);
    },
    [sendA2UIAction, surface.surfaceId, currentPage]
  );

  // Handle Cancel
  const handleCancel = useCallback(() => {
    sendA2UIAction('cancel', surface.surfaceId, { questionId: compositeId });
    onClose();
  }, [sendA2UIAction, surface.surfaceId, compositeId, onClose]);

  // Handle Submit All
  const handleSubmitAll = useCallback(() => {
    sendA2UIAction('submit-all', surface.surfaceId, {
      compositeId,
      questionIds: pages.map((p) => p.questionId),
    });
    onClose();
  }, [sendA2UIAction, surface.surfaceId, compositeId, pages, onClose]);

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleCancel();
      }
    },
    [handleCancel]
  );

  // Navigation
  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-[480px]',
          'max-h-[80vh]',
          'bg-card p-6 rounded-xl shadow-lg border border-border/50',
          // Animation classes
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200'
        )}
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside - only cancel button can close
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key - only cancel button can close
          e.preventDefault();
        }}
      >
        {/* Header with current page title */}
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-lg font-semibold leading-tight">
            {currentPageData.title ||
              formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' })}
          </DialogTitle>
          {currentPageData.message && (
            <div className="text-base text-foreground">
              <MarkdownContent content={currentPageData.message} />
            </div>
          )}
          {currentPageData.description && (
            <div className="text-sm text-muted-foreground">
              <MarkdownContent content={currentPageData.description} className="prose-muted" />
            </div>
          )}
        </DialogHeader>

        {/* Page content with slide animation */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentPage * 100}%)` }}
          >
            {pageComponentGroups.map((pageComps, pageIdx) => {
              const bodyComps = pageComps.filter(
                (c) =>
                  !c.id.endsWith('-title') &&
                  !c.id.endsWith('-message') &&
                  !c.id.endsWith('-description')
              );
              const pageType = pages[pageIdx]?.type || 'unknown';
              const hasOther = pageType === 'select' || pageType === 'multi-select';
              const isOtherSelected = otherSelectedPages.has(pageIdx);

              return (
                <div key={pageIdx} className="w-full flex-shrink-0">
                  {bodyComps.length > 0 && (
                    <div
                      className={cn(
                        'py-3',
                        pageType === 'multi-select' && 'space-y-2 max-h-[300px] overflow-y-auto px-1'
                      )}
                    >
                      {pageType === 'multi-select' ? (
                        bodyComps.map((comp) => (
                          <div key={comp.id} className="py-1">
                            <A2UIRenderer
                              surface={{ ...surface, components: [comp] }}
                              onAction={handleAction}
                            />
                          </div>
                        ))
                      ) : (
                        <A2UIRenderer
                          surface={{ ...surface, components: bodyComps }}
                          onAction={handleAction}
                        />
                      )}
                      {/* "Other" text input */}
                      {hasOther && (
                        <OtherInput
                          visible={isOtherSelected}
                          value={otherTexts.get(pageIdx) || ''}
                          onChange={(v) => handleOtherTextChange(pageIdx, v)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicator */}
        <div className="flex justify-center gap-2 py-3">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentPage(i)}
              className={cn(
                'rounded-full transition-all duration-200',
                i === currentPage
                  ? 'bg-primary w-4 h-2'
                  : 'bg-muted-foreground/30 w-2 h-2 hover:bg-muted-foreground/50'
              )}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>

        {/* Countdown for auto-selection */}
        {remaining !== null && (
          <div className="text-xs text-muted-foreground text-center">
            {remaining > 0
              ? `${remaining}s 后将自动提交默认选项`
              : '即将自动提交默认选项'}
          </div>
        )}

        {/* Footer - Navigation buttons */}
        <DialogFooter className="pt-2">
          <div className="flex flex-row justify-between w-full">
            {/* Left: Cancel */}
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
            >
              {formatMessage({ id: 'askQuestion.cancel', defaultMessage: 'Cancel' })}
            </button>

            {/* Right: Prev / Next / Submit */}
            <div className="flex flex-row gap-2">
              {!isFirstPage && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  {formatMessage({ id: 'askQuestion.previous', defaultMessage: 'Previous' })}
                </button>
              )}
              {isLastPage ? (
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {formatMessage({ id: 'askQuestion.submit', defaultMessage: 'Submit' })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {formatMessage({ id: 'askQuestion.next', defaultMessage: 'Next' })}
                </button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Component ==========

export function A2UIPopupCard({ surface, onClose }: A2UIPopupCardProps) {
  const state = surface.initialState as Record<string, unknown> | undefined;
  const isMultiPage = state?.questionType === 'multi-question' && (state?.totalPages as number) > 1;
  const questionType = detectQuestionType(surface);
  
  // Get dialog style from context
  const { preferences, getRecommendedStyle } = useDialogStyleContext();
  const dialogStyle = preferences.smartModeEnabled 
    ? getRecommendedStyle(questionType)
    : preferences.dialogStyle;

  // Common props for all styles
  const styleProps = {
    surface,
    onClose,
    questionType,
    dialogStyle,
    drawerSide: preferences.drawerSide,
    drawerSize: preferences.drawerSize,
  };

  if (isMultiPage) {
    return <MultiPagePopup surface={surface} onClose={onClose} />;
  }

  // Render based on dialog style
  switch (dialogStyle) {
    case 'drawer':
      return <DrawerPopup {...styleProps} />;
    case 'sheet':
      return <SheetPopup {...styleProps} />;
    case 'fullscreen':
      return <FullscreenPopup {...styleProps} />;
    default:
      return <SinglePagePopup surface={surface} onClose={onClose} />;
  }
}

// ========== Drawer Popup ==========

interface StyleProps {
  surface: SurfaceUpdate;
  onClose: () => void;
  questionType: QuestionType;
  dialogStyle: DialogStyle;
  drawerSide: 'left' | 'right';
  drawerSize: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

function DrawerPopup({ surface, onClose, drawerSide, drawerSize }: StyleProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in (c.component as any)
  );
  const title = getTextContent(titleComponent) || formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      sendA2UIAction(actionId, surface.surfaceId, params);
      const resolvingActions = ['confirm', 'cancel', 'submit', 'answer'];
      if (resolvingActions.includes(actionId)) {
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const questionType = detectQuestionType(surface);
  const bodyComponents = surface.components.filter(
    (c) => !['title', 'message', 'description'].includes(c.id) && !isActionButton(c)
  );
  const actionButtons = surface.components.filter((c) => isActionButton(c));

  return (
    <Drawer open onOpenChange={handleOpenChange}>
      <DrawerContent side={drawerSide} size={drawerSize} className="p-6">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto">
          {bodyComponents.length > 0 && (
            <div className={cn(
              'py-3',
              questionType === 'multi-select' && 'space-y-3 px-1'
            )}>
              {questionType === 'multi-select' ? (
                bodyComponents.map((comp) => (
                  <div key={comp.id} className="py-1">
                    <A2UIRenderer
                      surface={{ ...surface, components: [comp] }}
                      onAction={handleAction}
                    />
                  </div>
                ))
              ) : (
                <A2UIRenderer
                  surface={{ ...surface, components: bodyComponents }}
                  onAction={handleAction}
                />
              )}
            </div>
          )}
        </div>
        {actionButtons.length > 0 && (
          <DrawerFooter>
            {actionButtons.map((comp) => (
              <A2UIRenderer
                key={comp.id}
                surface={{ ...surface, components: [comp] }}
                onAction={handleAction}
              />
            ))}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ========== Sheet Popup ==========

function SheetPopup({ surface, onClose }: StyleProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in (c.component as any)
  );
  const title = getTextContent(titleComponent) || formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      sendA2UIAction(actionId, surface.surfaceId, params);
      const resolvingActions = ['confirm', 'cancel', 'submit', 'answer'];
      if (resolvingActions.includes(actionId)) {
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const bodyComponents = surface.components.filter(
    (c) => !['title', 'message', 'description'].includes(c.id) && !isActionButton(c)
  );
  const actionButtons = surface.components.filter((c) => isActionButton(c));

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent size="content">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {bodyComponents.length > 0 && (
            <A2UIRenderer
              surface={{ ...surface, components: bodyComponents }}
              onAction={handleAction}
            />
          )}
        </div>
        {actionButtons.length > 0 && (
          <SheetFooter>
            {actionButtons.map((comp) => (
              <A2UIRenderer
                key={comp.id}
                surface={{ ...surface, components: [comp] }}
                onAction={handleAction}
              />
            ))}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ========== Fullscreen Popup ==========

function FullscreenPopup({ surface, onClose }: StyleProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in (c.component as any)
  );
  const title = getTextContent(titleComponent) || formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      sendA2UIAction(actionId, surface.surfaceId, params);
      const resolvingActions = ['confirm', 'cancel', 'submit', 'answer'];
      if (resolvingActions.includes(actionId)) {
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  const bodyComponents = surface.components.filter(
    (c) => !['title', 'message', 'description'].includes(c.id) && !isActionButton(c)
  );
  const actionButtons = surface.components.filter((c) => isActionButton(c));

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent fullscreen className="p-6">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-6">
          {bodyComponents.length > 0 && (
            <A2UIRenderer
              surface={{ ...surface, components: bodyComponents }}
              onAction={handleAction}
            />
          )}
        </div>
        {actionButtons.length > 0 && (
          <DialogFooter className="border-t border-border pt-4">
            <div className="flex gap-3">
              {actionButtons.map((comp) => (
                <A2UIRenderer
                  key={comp.id}
                  surface={{ ...surface, components: [comp] }}
                  onAction={handleAction}
                />
              ))}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default A2UIPopupCard;
