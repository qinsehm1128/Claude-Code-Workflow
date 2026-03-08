// ========================================
// Association Highlight Tests
// ========================================

import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssociationHighlightProvider, useAssociationHighlight } from './AssociationHighlight';

function Probe({ chain, scopeKey }: { chain: { issueId: string | null; queueItemId: string | null; sessionId: string | null } | null; scopeKey: string }) {
  return (
    <AssociationHighlightProvider scopeKey={scopeKey}>
      <ProbeInner chain={chain} />
    </AssociationHighlightProvider>
  );
}

function ProbeInner({ chain }: { chain: { issueId: string | null; queueItemId: string | null; sessionId: string | null } | null }) {
  const { chain: activeChain, setChain } = useAssociationHighlight();

  useEffect(() => {
    setChain(chain);
  }, [chain, setChain]);

  return <div data-testid="chain">{activeChain?.issueId ?? 'none'}</div>;
}

describe('AssociationHighlightProvider', () => {
  it('clears highlighted chain when scopeKey changes', () => {
    const { rerender } = render(
      <Probe
        scopeKey="workspace-a"
        chain={{ issueId: 'ISSUE-1', queueItemId: 'Q-1', sessionId: 'S-1' }}
      />
    );

    expect(screen.getByTestId('chain').textContent).toBe('ISSUE-1');

    rerender(
      <Probe
        scopeKey="workspace-b"
        chain={null}
      />
    );

    expect(screen.getByTestId('chain').textContent).toBe('none');
  });
});
