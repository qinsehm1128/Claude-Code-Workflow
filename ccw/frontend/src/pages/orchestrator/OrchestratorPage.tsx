// ========================================
// Orchestrator Page
// ========================================
// Visual workflow template editor with React Flow, drag-drop node palette, and property panel
// Execution functionality moved to Terminal Dashboard

import { useEffect, useState, useCallback } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import { useFlowStore } from '@/stores';
import { Button } from '@/components/ui/Button';
import { FlowCanvas } from './FlowCanvas';
import { LeftSidebar } from './LeftSidebar';
import { PropertyPanel } from './PropertyPanel';
import { FlowToolbar } from './FlowToolbar';
import { TemplateLibrary } from './TemplateLibrary';

export function OrchestratorPage() {
  const fetchFlows = useFlowStore((state) => state.fetchFlows);
  const isPaletteOpen = useFlowStore((state) => state.isPaletteOpen);
  const setIsPaletteOpen = useFlowStore((state) => state.setIsPaletteOpen);
  const isPropertyPanelOpen = useFlowStore((state) => state.isPropertyPanelOpen);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);

  // Load flows on mount
  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Handle open template library
  const handleOpenTemplateLibrary = useCallback(() => {
    setIsTemplateLibraryOpen(true);
  }, []);

  return (
    <div className="h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] flex flex-col -m-4 md:-m-6">
      {/* Toolbar */}
      <FlowToolbar onOpenTemplateLibrary={handleOpenTemplateLibrary} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar with collapse toggle */}
        {!isPaletteOpen && (
          <div className="w-10 bg-card border-r border-border flex flex-col items-center py-4">
            <Button variant="ghost" size="icon" onClick={() => setIsPaletteOpen(true)} title="Expand">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        <Collapsible.Root open={isPaletteOpen} onOpenChange={setIsPaletteOpen} className="h-full">
          <Collapsible.Content className="h-full overflow-hidden data-[state=open]:animate-collapsible-slide-down data-[state=closed]:animate-collapsible-slide-up">
            <LeftSidebar />
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Flow Canvas (Center) + PropertyPanel Overlay */}
        <div className="flex-1 relative">
          <FlowCanvas className="absolute inset-0" />

          {/* Property Panel as overlay - only shown when a node is selected */}
          {isPropertyPanelOpen && (
            <div className="absolute top-2 right-2 bottom-2 z-10">
              <PropertyPanel className="h-full" />
            </div>
          )}
        </div>
      </div>

      {/* Template Library Dialog */}
      <TemplateLibrary
        open={isTemplateLibraryOpen}
        onOpenChange={setIsTemplateLibraryOpen}
      />
    </div>
  );
}
