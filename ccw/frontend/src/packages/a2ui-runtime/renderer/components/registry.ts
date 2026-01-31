// ========================================
// A2UI Component Registry Initialization
// ========================================
// Registers all A2UI component renderers

import { a2uiRegistry } from '../../core/A2UIComponentRegistry';
import { A2UIText } from './A2UIText';
import { A2UIButton } from './A2UIButton';
import { A2UIDropdown } from './A2UIDropdown';
import { A2UITextField } from './A2UITextField';
import { A2UITextArea } from './A2UITextArea';
import { A2UICheckbox } from './A2UICheckbox';
import { A2UIProgress } from './A2UIProgress';
import { A2UICard } from './A2UICard';

/**
 * Initialize and register all built-in A2UI component renderers
 */
export function registerBuiltInComponents(): void {
  // Register all component types
  a2uiRegistry.register('Text', A2UIText);
  a2uiRegistry.register('Button', A2UIButton);
  a2uiRegistry.register('Dropdown', A2UIDropdown);
  a2uiRegistry.register('TextField', A2UITextField);
  a2uiRegistry.register('TextArea', A2UITextArea);
  a2uiRegistry.register('Checkbox', A2UICheckbox);
  a2uiRegistry.register('Progress', A2UIProgress);
  a2uiRegistry.register('Card', A2UICard);
}

/**
 * Auto-initialize on import
 * This ensures all components are registered when the renderer package is loaded
 */
registerBuiltInComponents();

export * from './A2UIText';
export * from './A2UIButton';
export * from './A2UIDropdown';
export * from './A2UITextField';
export * from './A2UITextArea';
export * from './A2UICheckbox';
export * from './A2UIProgress';
export * from './A2UICard';
