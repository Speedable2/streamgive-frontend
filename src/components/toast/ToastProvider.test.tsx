import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

function TestComponent() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast('success', 'Success Toast')}>Show Success</button>
      <button onClick={() => showToast('error', 'Error Toast')}>Show Error</button>
      <button onClick={() => showToast('info', 'Info Toast')}>Show Info</button>
    </>
  );
}

function OutsideProvider() {
  useToast();
  return null;
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast and removes it after 5 seconds', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    
    expect(screen.getByText('Success Toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Success Toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Success Toast')).not.toBeInTheDocument();
  });

  it('renders error-type toasts with role="alert" while other toast types render with role="status"', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByText('Error Toast')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Success Toast')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Info Toast')).toHaveAttribute('role', 'status');
  });

  it('throws an error when useToast is used outside of ToastProvider', () => {
    const originalError = console.error;
    console.error = vi.fn();
    
    expect(() => render(<OutsideProvider />)).toThrow('useToast must be used within a ToastProvider');
    
    console.error = originalError;
  });
});
