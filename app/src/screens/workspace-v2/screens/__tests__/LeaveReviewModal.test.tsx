// @vitest-environment jsdom
//
// Component test — LeaveReviewModal.
//
// Pins the validation gates:
//   - Submit disabled until rating > 0 AND text >= 10 chars
//   - Star click sets rating; aria-label per star
//   - Submit calls onSubmit with (rating, trimmed text)
//   - Cancel calls onClose
//   - Click on the overlay closes; click on the card does not

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { LeaveReviewModal } from '../LeaveReviewModal';

afterEach(() => cleanup());

describe('LeaveReviewModal', () => {
  it('renders the brand + campaign in the header', () => {
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="Spring Renewal"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: /Review Aesop/i })).toBeInTheDocument();
    expect(screen.getByText(/Spring Renewal/)).toBeInTheDocument();
  });

  it('renders 5 star buttons with aria labels', () => {
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="X"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByLabelText('1 star')).toBeInTheDocument();
    expect(screen.getByLabelText('2 stars')).toBeInTheDocument();
    expect(screen.getByLabelText('5 stars')).toBeInTheDocument();
  });

  it('disables submit until rating + ≥10 char note both present', () => {
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="X"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const submit = screen.getByRole('button', { name: /Submit review/i });
    expect(submit).toBeDisabled();

    // Click 4 stars — still disabled (no text)
    fireEvent.click(screen.getByLabelText('4 stars'));
    expect(submit).toBeDisabled();

    // Type 9 chars — still disabled
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'too short' } });
    expect(submit).toBeDisabled();

    // Type 10+ chars — now enabled
    fireEvent.change(ta, { target: { value: 'enough characters here' } });
    expect(submit).not.toBeDisabled();
  });

  it('calls onSubmit with rating + trimmed text', () => {
    const onSubmit = vi.fn();
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="X"
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByLabelText('5 stars'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '   Great collab, would do again   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit review/i }));
    expect(onSubmit).toHaveBeenCalledWith(5, 'Great collab, would do again');
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="X"
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the dialog body does NOT close (only the backdrop closes)', () => {
    const onClose = vi.fn();
    render(
      <LeaveReviewModal
        brandName="Aesop"
        campaignName="X"
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    );
    // Click on the heading inside the card — stopPropagation should prevent close
    fireEvent.click(screen.getByRole('heading', { name: /Review Aesop/i }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
