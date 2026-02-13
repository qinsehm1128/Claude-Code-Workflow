// ========================================
// A2UI Card Component Renderer
// ========================================
// Maps A2UI Card component to shadcn/ui Card

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';
import type { CardComponent } from '../../core/A2UITypes';

/**
 * A2UI Card Component Renderer
 * Container component with optional title and description
 */
export const A2UICard: ComponentRenderer = ({ component, resolveBinding }) => {
  const cardComp = component as CardComponent;
  const { Card: cardConfig } = cardComp;

  // Resolve title and description
  const title = cardConfig.title ? resolveTextContent(cardConfig.title, resolveBinding) : undefined;
  const description = cardConfig.description ? resolveTextContent(cardConfig.description, resolveBinding) : undefined;

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        {cardConfig.content.map((childComp, index) => {
          // For nested components, we would typically use the registry
          // But for simplicity in this renderer, we just render a placeholder
          const childType = Object.keys(childComp)[0];
          return (
            <div key={index} data-component-type={childType}>
              {/* Nested components would be rendered here via A2UIRenderer */}
              {childType}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
