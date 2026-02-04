// ========================================
// A2UI Component Renderers Index
// ========================================
// Exports all A2UI component renderers
// Importing this file automatically registers all components

import { a2uiRegistry } from '../../core/A2UIComponentRegistry';
import type { A2UIComponentType } from '../../core/A2UITypes';

// Import all component renderers synchronously
import { A2UIText } from './A2UIText';
import { A2UIButton } from './A2UIButton';
import { A2UIDropdown } from './A2UIDropdown';
import { A2UITextField } from './A2UITextField';
import { A2UITextArea } from './A2UITextArea';
import { A2UICheckbox } from './A2UICheckbox';
import { A2UIRadioGroup } from './A2UIRadioGroup';
import { A2UIProgress } from './A2UIProgress';
import { A2UICard } from './A2UICard';
import { A2UICLIOutput } from './A2UICLIOutput';
import { A2UIDateTimeInput } from './A2UIDateTimeInput';

// Synchronous auto-registration of all built-in components
// This runs immediately when the module is loaded
a2uiRegistry.register('Text' as A2UIComponentType, A2UIText);
a2uiRegistry.register('Button' as A2UIComponentType, A2UIButton);
a2uiRegistry.register('Dropdown' as A2UIComponentType, A2UIDropdown);
a2uiRegistry.register('TextField' as A2UIComponentType, A2UITextField);
a2uiRegistry.register('TextArea' as A2UIComponentType, A2UITextArea);
a2uiRegistry.register('Checkbox' as A2UIComponentType, A2UICheckbox);
a2uiRegistry.register('RadioGroup' as A2UIComponentType, A2UIRadioGroup);
a2uiRegistry.register('Progress' as A2UIComponentType, A2UIProgress);
a2uiRegistry.register('Card' as A2UIComponentType, A2UICard);
a2uiRegistry.register('CLIOutput' as A2UIComponentType, A2UICLIOutput);
a2uiRegistry.register('DateTimeInput' as A2UIComponentType, A2UIDateTimeInput);

// Export all components
export * from './A2UIText';
export * from './A2UIButton';
export * from './A2UIDropdown';
export * from './A2UITextField';
export * from './A2UITextArea';
export * from './A2UICheckbox';
export * from './A2UIRadioGroup';
export * from './A2UIProgress';
export * from './A2UICard';
export * from './A2UICLIOutput';
export * from './A2UIDateTimeInput';

