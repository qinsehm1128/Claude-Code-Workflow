// ========================================
// Sheet Component
// ========================================
// Bottom sheet for A2UI surfaces with slide-up animation
// Supports drag-to-dismiss and snap points

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ========== Variants ==========

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-card shadow-lg border-t border-border ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        bottom: 'inset-x-0 bottom-0 rounded-t-lg data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        top: 'inset-x-0 top-0 rounded-b-lg data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
      },
      size: {
        auto: 'h-auto',
        half: 'h-[50vh]',
        full: 'h-[90vh]',
        content: 'max-h-[90vh]',
      },
    },
    defaultVariants: {
      side: 'bottom',
      size: 'content',
    },
  }
);

// ========== Root Components ==========

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

// ========== Overlay ==========

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

// ========== Content ==========

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Whether to show the drag handle */
  showHandle?: boolean;
  /** Whether clicking outside should close the sheet */
  closeOnOutsideClick?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    { side = 'bottom', size = 'content', showHandle = true, closeOnOutsideClick = true, className, children, ...props },
    ref
  ) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side, size }), 'flex flex-col', className)}
        onInteractOutside={(e) => {
          if (!closeOnOutsideClick) {
            e.preventDefault();
          }
        }}
        {...props}
      >
        {/* Drag Handle */}
        {showHandle && side === 'bottom' && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
        
        {/* Close Button */}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

// ========== Header ==========

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left pt-2', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

// ========== Footer ==========

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border mt-4', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

// ========== Title ==========

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

// ========== Description ==========

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

// ========== Exports ==========

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  type SheetContentProps,
};
