import React from 'react';
import '@testing-library/jest-dom/vitest';
import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Rating, Stars } from '../components/ui';
test('ratings expose half stars and an unrated option accessibly', () => {
  const change = vi.fn();
  render(<Rating value={null} change={change} />);
  const select = screen.getByLabelText('Rating');
  fireEvent.change(select, { target: { value: '4.5' } });
  expect(change).toHaveBeenCalledWith(4.5);
  fireEvent.change(select, { target: { value: '' } });
  expect(change).toHaveBeenCalledWith(null);
  cleanup();
});
test('rating has a textual screen-reader equivalent', () => {
  render(<Stars rating={3.5} />);
  expect(screen.getByLabelText('3.5 out of 5 stars')).toBeInTheDocument();
  cleanup();
});
