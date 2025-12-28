/**
 * React Testing Setup
 *
 * Setup file for React component testing with Testing Library.
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

import { configure } from '@testing-library/react';
import React from 'react';

// ==================== Polyfills ====================

// TextEncoder/TextDecoder polyfill for Node.js
Object.assign(global, { TextDecoder, TextEncoder });

// Mock IntersectionObserver
class MockIntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: ReadonlyArray<number> = [];

  constructor(callback: IntersectionObserverCallback) {
    // Store callback for potential use in tests
    (this as any)._callback = callback;
  }

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    (this as any)._callback = callback;
  }

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// ==================== Testing Library Configuration ====================

configure({
  // Increase async utilities timeout
  asyncUtilTimeout: 5000,

  // Use data-testid as the default attribute
  testIdAttribute: 'data-testid',

  // Throw suggestions for better queries
  throwSuggestions: true,
});

// ==================== React Testing Utilities ====================

/**
 * Mock component for testing
 */
export function createMockComponent(name: string) {
  const MockComponent = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': `mock-${name}`, ...props }, children);
  MockComponent.displayName = `Mock${name}`;
  return MockComponent;
}

/**
 * Mock hook for testing
 */
export function createMockHook<T>(name: string, defaultValue: T) {
  const mockHook = jest.fn(() => defaultValue);
  mockHook.mockName(name);
  return mockHook;
}

// ==================== Context Helpers ====================

/**
 * Create a wrapper component for providing context in tests
 */
export function createContextWrapper(providers: React.ReactElement[]) {
  return function ContextWrapper({ children }: { children: React.ReactNode }) {
    return providers.reduceRight(
      (acc, provider) => React.cloneElement(provider, {}, acc),
      children as React.ReactElement
    );
  };
}

// ==================== User Event Helpers ====================

/**
 * Simulate typing in an input
 */
export async function typeInInput(
  element: HTMLElement,
  text: string,
  options: { clear?: boolean } = {}
) {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();

  if (options.clear) {
    await user.clear(element);
  }
  await user.type(element, text);
}

/**
 * Simulate selecting an option in a select element
 */
export async function selectOption(element: HTMLElement, value: string) {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  await user.selectOptions(element, value);
}

// ==================== Async Testing Helpers ====================

/**
 * Wait for element to be removed
 */
export async function waitForElementToBeRemoved(
  callback: () => HTMLElement | null,
  options: { timeout?: number } = {}
) {
  const { waitForElementToBeRemoved: waitFor } = await import('@testing-library/react');
  return waitFor(callback, options);
}

/**
 * Wait for specific text to appear
 */
export async function waitForText(
  container: HTMLElement,
  text: string,
  options: { timeout?: number } = {}
) {
  const { findByText } = await import('@testing-library/react');
  return findByText(container, text, { exact: false, ...options });
}

// ==================== Cleanup ====================

afterEach(() => {
  // Clear localStorage between tests
  localStorageMock.clear();
});
