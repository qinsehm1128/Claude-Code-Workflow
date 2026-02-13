// ========================================
// A2UI Button Component Renderer
// ========================================
// Maps A2UI Button component to shadcn/ui Button

import { Button } from '@/components/ui/Button';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import type { ButtonComponent } from '../../core/A2UITypes';
import { resolveLiteralOrBinding } from '../A2UIRenderer';

/**
 * A2UI Button Component Renderer
 * Maps A2UI variants (primary/secondary/destructive) to shadcn/ui variants (default/secondary/destructive/ghost)
 */
export const A2UIButton: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const buttonComp = component as ButtonComponent;
  const { Button: buttonConfig } = buttonComp;

  // Resolve content (nested component - typically Text)
  const ContentComponent = () => {
    const contentType = Object.keys(buttonConfig.content)[0];
    if (contentType === 'Text') {
      const textValue = buttonConfig.content.Text.text;
      const resolved = resolveLiteralOrBinding(textValue, resolveBinding);
      return <>{String(resolved)}</>;
    }
    return <>{contentType}</>;
  };

  // Map A2UI variants to shadcn/ui variants
  // A2UI: primary, secondary, destructive, ghost, outline
  // shadcn/ui: default, secondary, destructive, ghost, outline
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline'> = {
    primary: 'default',
    secondary: 'secondary',
    destructive: 'destructive',
    ghost: 'ghost',
    outline: 'outline',
  };

  const variant = buttonConfig.variant ? variantMap[buttonConfig.variant] ?? 'default' : 'default';

  // Resolve disabled state
  let disabled = false;
  if (buttonConfig.disabled) {
    if (typeof buttonConfig.disabled === 'object' && 'literalBoolean' in buttonConfig.disabled) {
      disabled = buttonConfig.disabled.literalBoolean === false;
    } else if (typeof buttonConfig.disabled === 'object' && 'path' in buttonConfig.disabled) {
      const resolved = resolveBinding(buttonConfig.disabled);
      disabled = resolved !== true;
    }
  }

  const handleClick = () => {
    onAction(buttonConfig.onClick.actionId, buttonConfig.onClick.parameters || {});
  };

  return (
    <Button variant={variant} disabled={disabled} onClick={handleClick}>
      <ContentComponent />
    </Button>
  );
};
