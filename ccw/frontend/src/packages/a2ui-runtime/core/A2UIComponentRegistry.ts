// ========================================
// A2UI Component Registry
// ========================================
// Maps A2UI component types to React renderer functions

import type { A2UIComponent, A2UIComponentType } from './A2UITypes';

// ========== Renderer Types ==========

/** State object for A2UI surfaces */
export type A2UIState = Record<string, unknown>;

/** Action handler callback */
export type ActionHandler = (actionId: string, params: Record<string, unknown>) => void | Promise<void>;

/** Binding resolver function */
export type BindingResolver = (binding: { path: string }) => unknown;

/** Component renderer function */
export type ComponentRenderer = (props: {
  component: A2UIComponent;
  state: A2UIState;
  onAction: ActionHandler;
  resolveBinding: BindingResolver;
}) => JSX.Element | null;

// ========== Registry Class ==========

/**
 * A2UI Component Registry
 * Maps A2UI component types to React renderer functions
 */
export class A2UIComponentRegistry {
  private readonly renderers = new Map<A2UIComponentType, ComponentRenderer>();

  /**
   * Register a component renderer
   * @param type - Component type name (e.g., 'Text', 'Button')
   * @param renderer - React component function
   */
  register(type: A2UIComponentType, renderer: ComponentRenderer): void {
    this.renderers.set(type, renderer);
  }

  /**
   * Unregister a component renderer
   * @param type - Component type name
   */
  unregister(type: A2UIComponentType): void {
    this.renderers.delete(type);
  }

  /**
   * Get a component renderer
   * @param type - Component type name
   * @returns Renderer function or undefined if not registered
   */
  get(type: A2UIComponentType): ComponentRenderer | undefined {
    return this.renderers.get(type);
  }

  /**
   * Check if a component type is registered
   * @param type - Component type name
   * @returns True if renderer exists
   */
  has(type: A2UIComponentType): boolean {
    return this.renderers.has(type);
  }

  /**
   * Get all registered component types
   * @returns Array of registered type names
   */
  getRegisteredTypes(): A2UIComponentType[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Clear all registered renderers
   */
  clear(): void {
    this.renderers.clear();
  }

  /**
   * Get the number of registered renderers
   * @returns Count of registered renderers
   */
  get size(): number {
    return this.renderers.size;
  }
}

// ========== Singleton Export ==========

/** Global component registry instance */
export const a2uiRegistry = new A2UIComponentRegistry();

// ========== Built-in Component Registration ==========

/**
 * Initialize built-in component renderers
 * Called from renderer components index to avoid circular dependencies
 */
export function initializeBuiltInComponents(): void {
  // Deferred import to avoid circular dependencies
  // This will be called from renderer/components/index.ts
  // after all component implementations are loaded
}
