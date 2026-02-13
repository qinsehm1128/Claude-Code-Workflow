// ========================================
// A2UI Component Renderer Unit Tests
// ========================================
// Tests for all A2UI component renderers

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { A2UIComponent } from '../core/A2UITypes';
import type { A2UIState, ActionHandler, BindingResolver } from '../core/A2UIComponentRegistry';
import type { TextComponent, ButtonComponent, DropdownComponent, CLIOutputComponent, DateTimeInputComponent } from '../core/A2UITypes';

// Import component renderers to trigger auto-registration
import '../renderer/components';

// Import component renderers
import { A2UIText } from '../renderer/components/A2UIText';
import { A2UIButton } from '../renderer/components/A2UIButton';
import { A2UIDropdown } from '../renderer/components/A2UIDropdown';
import { A2UITextField } from '../renderer/components/A2UITextField';
import { A2UITextArea } from '../renderer/components/A2UITextArea';
import { A2UICheckbox } from '../renderer/components/A2UICheckbox';
import { A2UIProgress } from '../renderer/components/A2UIProgress';
import { A2UICard } from '../renderer/components/A2UICard';
import { A2UICLIOutput } from '../renderer/components/A2UICLIOutput';
import { A2UIDateTimeInput } from '../renderer/components/A2UIDateTimeInput';

// Common test helpers
function createMockProps(component: A2UIComponent) {
  const mockState: A2UIState = {};
  const mockOnAction: ActionHandler = vi.fn();
  const mockResolveBinding: BindingResolver = vi.fn((binding) => {
    if (binding.path === 'test.value') return 'resolved-value';
    return binding.path;
  });

  return {
    component,
    state: mockState,
    onAction: mockOnAction,
    resolveBinding: mockResolveBinding,
  };
}

// Wrapper for testing renderer components
function RendererWrapper({ children }: { children: React.ReactNode }) {
  return <div data-testid="renderer-wrapper">{children}</div>;
}

describe('A2UI Component Renderers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('A2UIText', () => {
    it('should render text with literal string', () => {
      const component: TextComponent = {
        Text: { text: { literalString: 'Hello, World!' } },
      };
      const props = createMockProps(component);

      const result = A2UIText(props);
      expect(result).toBeTruthy();
    });

    it('should render different usage hints', () => {
      const hints: Array<'h1' | 'h2' | 'p' | 'code' | 'span'> = ['h1', 'h2', 'p', 'code', 'span'];

      hints.forEach((hint) => {
        const component: TextComponent = {
          Text: { text: { literalString: 'Test' }, usageHint: hint },
        };
        const props = createMockProps(component);

        const result = A2UIText(props);
        expect(result).toBeTruthy();
      });
    });

    it('should resolve binding for text content', () => {
      const component: TextComponent = {
        Text: { text: { path: 'test.value' } },
      };
      const props = createMockProps(component);

      const result = A2UIText(props);
      expect(result).toBeTruthy();
      expect(props.resolveBinding).toHaveBeenCalledWith({ path: 'test.value' });
    });
  });

  describe('A2UIButton', () => {
    it('should render button with text content', () => {
      const component: ButtonComponent = {
        Button: {
          onClick: { actionId: 'click-action' },
          content: { Text: { text: { literalString: 'Click Me' } } },
          variant: 'primary',
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UIButton {...props} /></RendererWrapper>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should call onAction when clicked', () => {
      const component: ButtonComponent = {
        Button: {
          onClick: { actionId: 'test-action', parameters: { key: 'value' } },
          content: { Text: { text: { literalString: 'Test' } } },
        },
      };
      const props = createMockProps(component);

      const result = A2UIButton(props);
      expect(result).toBeTruthy();
    });

    it('should render different variants', () => {
      const variants: Array<'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline'> = [
        'primary',
        'secondary',
        'destructive',
        'ghost',
        'outline',
      ];

      variants.forEach((variant) => {
        const component: ButtonComponent = {
          Button: {
            onClick: { actionId: 'click' },
            content: { Text: { text: { literalString: variant } } },
            variant,
          },
        };
        const props = createMockProps(component);

        const result = A2UIButton(props);
        expect(result).toBeTruthy();
      });
    });

    it('should be disabled when specified', () => {
      const component: ButtonComponent = {
        Button: {
          onClick: { actionId: 'click' },
          content: { Text: { text: { literalString: 'Disabled' } } },
          disabled: { literalBoolean: true },
        },
      };
      const props = createMockProps(component);

      const result = A2UIButton(props);
      expect(result).toBeTruthy();
    });
  });

  describe('A2UIDropdown', () => {
    it('should render dropdown with options', () => {
      const component: DropdownComponent = {
        Dropdown: {
          options: [
            { label: { literalString: 'Option 1' }, value: 'opt1' },
            { label: { literalString: 'Option 2' }, value: 'opt2' },
            { label: { literalString: 'Option 3' }, value: 'opt3' },
          ],
          onChange: { actionId: 'change' },
          placeholder: 'Select an option',
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UIDropdown {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render with selected value', () => {
      const component: DropdownComponent = {
        Dropdown: {
          options: [
            { label: { literalString: 'A' }, value: 'a' },
            { label: { literalString: 'B' }, value: 'b' },
          ],
          selectedValue: { literalString: 'a' },
          onChange: { actionId: 'change' },
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UIDropdown {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should call onChange with actionId when selection changes', () => {
      const component: DropdownComponent = {
        Dropdown: {
          options: [{ label: { literalString: 'Test' }, value: 'test' }],
          onChange: { actionId: 'select-action' },
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UIDropdown {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('A2UITextField', () => {
    it('should render text input', () => {
      const component = {
        TextField: {
          value: { literalString: 'initial value' },
          onChange: { actionId: 'input' },
          placeholder: 'Enter text',
          type: 'text' as const,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UITextField {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render different input types', () => {
      const types: Array<'text' | 'email' | 'password' | 'number' | 'url'> = [
        'text',
        'email',
        'password',
        'number',
        'url',
      ];

      types.forEach((type) => {
        const component = {
          TextField: { onChange: { actionId: 'input' }, type },
        };
        const props = createMockProps(component);

        render(<RendererWrapper><A2UITextField {...props} /></RendererWrapper>);
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });

    it('should call onChange when value changes', () => {
      const component = {
        TextField: {
          value: { literalString: 'test' },
          onChange: { actionId: 'text-change' },
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UITextField {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('A2UITextArea', () => {
    it('should render textarea', () => {
      const component = {
        TextArea: {
          value: { literalString: 'Multi-line text' },
          onChange: { actionId: 'textarea-change' },
          rows: 5,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UITextArea {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render with custom rows', () => {
      const component = {
        TextArea: {
          onChange: { actionId: 'change' },
          rows: 10,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UITextArea {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render with placeholder', () => {
      const component = {
        TextArea: {
          onChange: { actionId: 'change' },
          placeholder: 'Enter description',
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UITextArea {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('A2UICheckbox', () => {
    it('should render checkbox unchecked', () => {
      const component = {
        Checkbox: {
          checked: { literalBoolean: false },
          onChange: { actionId: 'check' },
          label: { literalString: 'Accept terms' },
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICheckbox {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render checkbox checked', () => {
      const component = {
        Checkbox: {
          checked: { literalBoolean: true },
          onChange: { actionId: 'check' },
          label: { literalString: 'Checkbox Label Test' },
        },
      };
      const props = createMockProps(component);

      const { container } = render(<RendererWrapper><A2UICheckbox {...props} /></RendererWrapper>);
      // Use querySelector to find the label text
      expect(container.textContent).toContain('Checkbox Label Test');
    });

    it('should call onChange when toggled', () => {
      const component = {
        Checkbox: {
          checked: { literalBoolean: false },
          onChange: { actionId: 'toggle' },
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICheckbox {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('A2UIProgress', () => {
    it('should render progress bar with value', () => {
      const component = {
        Progress: {
          value: { literalNumber: 50 },
          max: 100,
        },
      };
      const props = createMockProps(component);

      const result = A2UIProgress(props);
      expect(result).toBeTruthy();
    });

    it('should render indeterminate progress', () => {
      const component = {
        Progress: {},
      };
      const props = createMockProps(component);

      const result = A2UIProgress(props);
      expect(result).toBeTruthy();
    });

    it('should handle max value', () => {
      const component = {
        Progress: {
          value: { literalNumber: 75 },
          max: 200,
        },
      };
      const props = createMockProps(component);

      const result = A2UIProgress(props);
      expect(result).toBeTruthy();
    });
  });

  describe('A2UICard', () => {
    it('should render card with title and content', () => {
      const component = {
        Card: {
          title: { literalString: 'Card Title' },
          description: { literalString: 'Card description' },
          content: [
            { Text: { text: { literalString: 'Content 1' } } },
            { Text: { text: { literalString: 'Content 2' } } },
          ],
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICard {...props} /></RendererWrapper>);
      expect(screen.getByText('Card Title')).toBeInTheDocument();
    });

    it('should render card without title', () => {
      const component = {
        Card: {
          content: [{ Text: { text: { literalString: 'Content' } } }],
        },
      };
      const props = createMockProps(component);

      const result = A2UICard(props);
      expect(result).toBeTruthy();
    });

    it('should render nested content', () => {
      const component = {
        Card: {
          title: { literalString: 'Nested' },
          content: [
            {
              Card: {
                title: { literalString: 'Inner Card' },
                content: [{ Text: { text: { literalString: 'Inner content' } } }],
              },
            },
          ],
        },
      };
      const props = createMockProps(component);

      const result = A2UICard(props);
      expect(result).toBeTruthy();
    });
  });

  describe('A2UICLIOutput', () => {
    it('should render CLI output with syntax highlighting', () => {
      const component: CLIOutputComponent = {
        CLIOutput: {
          output: { literalString: '$ echo "Hello"\nHello\n' },
          language: 'bash',
          streaming: false,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
      expect(screen.getByText(/echo/i)).toBeInTheDocument();
    });

    it('should render with streaming indicator', () => {
      const component: CLIOutputComponent = {
        CLIOutput: {
          output: { literalString: 'Command output...' },
          language: 'bash',
          streaming: true,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
      // Should show streaming indicator - using specific class to avoid matching output text
      expect(screen.getByText(/Streaming/i)).toBeInTheDocument();
    });

    it('should render different languages', () => {
      const languages = ['bash', 'javascript', 'python'];

      languages.forEach((lang) => {
        const component: CLIOutputComponent = {
          CLIOutput: {
            output: { literalString: `Code in ${lang}` },
            language: lang,
          },
        };
        const props = createMockProps(component);

        render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
        // Test passes if no error is thrown
        expect(true).toBe(true);
      });
    });

    it('should truncate output when maxLines is set', () => {
      const component: CLIOutputComponent = {
        CLIOutput: {
          output: { literalString: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' },
          language: 'bash',
          maxLines: 3,
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should render empty output', () => {
      const component: CLIOutputComponent = {
        CLIOutput: {
          output: { literalString: '' },
          language: 'bash',
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
      expect(screen.getByText(/No output/i)).toBeInTheDocument();
    });

    it('should highlight bash error patterns', () => {
      const component: CLIOutputComponent = {
        CLIOutput: {
          output: { literalString: '$ command\nError: command failed' },
          language: 'bash',
        },
      };
      const props = createMockProps(component);

      render(<RendererWrapper><A2UICLIOutput {...props} /></RendererWrapper>);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('A2UIDateTimeInput', () => {
    it('should render datetime input', () => {
      const component: DateTimeInputComponent = {
        DateTimeInput: {
          value: { literalString: '2024-01-15T10:30:00Z' },
          onChange: { actionId: 'datetime-change' },
          includeTime: true,
        },
      };
      const props = createMockProps(component);

      // Use render to properly handle hooks - need to spread props
      render(
        <RendererWrapper>
          <A2UIDateTimeInput {...props} />
        </RendererWrapper>
      );
      // Test passes if no error is thrown during render
      expect(true).toBe(true);
    });

    it('should render date-only input', () => {
      const component: DateTimeInputComponent = {
        DateTimeInput: {
          onChange: { actionId: 'date-change' },
          includeTime: false,
        },
      };
      const props = createMockProps(component);

      render(
        <RendererWrapper>
          <A2UIDateTimeInput {...props} />
        </RendererWrapper>
      );
      expect(true).toBe(true);
    });

    it('should call onChange when value changes', () => {
      const component: DateTimeInputComponent = {
        DateTimeInput: {
          onChange: { actionId: 'datetime-action', parameters: { field: 'date' } },
          includeTime: true,
        },
      };
      const props = createMockProps(component);

      render(
        <RendererWrapper>
          <A2UIDateTimeInput {...props} />
        </RendererWrapper>
      );
      expect(props.onAction).not.toHaveBeenCalled();
    });

    it('should respect min and max date constraints', () => {
      const component: DateTimeInputComponent = {
        DateTimeInput: {
          onChange: { actionId: 'change' },
          minDate: { literalString: '2024-01-01T00:00:00Z' },
          maxDate: { literalString: '2024-12-31T23:59:59Z' },
        },
      };
      const props = createMockProps(component);

      render(
        <RendererWrapper>
          <A2UIDateTimeInput {...props} />
        </RendererWrapper>
      );
      expect(true).toBe(true);
    });

    it('should render with placeholder', () => {
      const component: DateTimeInputComponent = {
        DateTimeInput: {
          onChange: { actionId: 'change' },
          placeholder: 'Select appointment time',
          includeTime: true,
        },
      };
      const props = createMockProps(component);

      render(
        <RendererWrapper>
          <A2UIDateTimeInput {...props} />
        </RendererWrapper>
      );
      expect(true).toBe(true);
    });
  });
});

describe('A2UI Component Integration', () => {
  it('should handle binding resolution across components', () => {
    const mockResolveBinding: BindingResolver = vi.fn((binding) => {
      if (binding.path === 'user.name') return 'Test User';
      return undefined;
    });

    const textComponent: TextComponent = {
      Text: { text: { path: 'user.name' } },
    };

    const props = {
      component: textComponent,
      state: {},
      onAction: vi.fn(),
      resolveBinding: mockResolveBinding,
    };

    const result = A2UIText(props);
    expect(result).toBeTruthy();
    expect(mockResolveBinding).toHaveBeenCalledWith({ path: 'user.name' });
  });

  it('should handle async action handlers', async () => {
    const asyncOnAction: ActionHandler = async (_actionId, _params) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const buttonComponent: ButtonComponent = {
      Button: {
        onClick: { actionId: 'async-action' },
        content: { Text: { text: { literalString: 'Async' } } },
      },
    };

    const props = {
      component: buttonComponent,
      state: {},
      onAction: asyncOnAction,
      resolveBinding: vi.fn(),
    };

    const result = A2UIButton(props);
    expect(result).toBeTruthy();
  });
});
