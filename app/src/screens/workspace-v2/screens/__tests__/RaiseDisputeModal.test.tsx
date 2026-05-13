// @vitest-environment jsdom
//
// Component test — RaiseDisputeModal.
//
// Pins:
//   - 6 category options render in the dropdown
//   - Submit disabled until description >= 20 chars
//   - Submit dispatches the selected category + trimmed description
//   - Default category is 'non-delivery' (the most-common case)

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { RaiseDisputeModal } from '../RaiseDisputeModal';

afterEach(() => cleanup());

describe('RaiseDisputeModal', () => {
  it('renders the brand + campaign in the body copy', () => {
    render(
      <RaiseDisputeModal
        brandName="Aesop"
        campaignName="Spring Renewal"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: /Raise a dispute/i })).toBeInTheDocument();
    expect(screen.getByText(/Spring Renewal/)).toBeInTheDocument();
    expect(screen.getByText(/Aesop/)).toBeInTheDocument();
  });

  it('renders all 6 category options with `non-delivery` selected by default', () => {
    render(
      <RaiseDisputeModal
        brandName="X"
        campaignName="Y"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(6);
    expect(select.value).toBe('non-delivery');
    // Spot-check the labels
    expect(screen.getByText(/Brand stopped responding/)).toBeInTheDocument();
    expect(screen.getByText(/Disagreement on quality/)).toBeInTheDocument();
    expect(screen.getByText(/Content takedown/)).toBeInTheDocument();
  });

  it('disables File dispute until description has ≥20 chars', () => {
    render(
      <RaiseDisputeModal
        brandName="X"
        campaignName="Y"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const submit = screen.getByRole('button', { name: /File dispute/i });
    expect(submit).toBeDisabled();

    // 19 chars — still disabled
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'a'.repeat(19) } });
    expect(submit).toBeDisabled();

    // 20 chars — enabled
    fireEvent.change(ta, { target: { value: 'a'.repeat(20) } });
    expect(submit).not.toBeDisabled();
  });

  it('calls onSubmit with selected category + trimmed description', () => {
    const onSubmit = vi.fn();
    render(
      <RaiseDisputeModal
        brandName="X"
        campaignName="Y"
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    // Change category to 'late-payment'
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'late-payment' },
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '   Brand never paid me after delivery despite all approvals   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /File dispute/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      'late-payment',
      'Brand never paid me after delivery despite all approvals',
    );
  });

  it('Cancel button calls onClose without calling onSubmit', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <RaiseDisputeModal
        brandName="X"
        campaignName="Y"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    // Fill in valid form first to confirm Cancel still wins.
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a'.repeat(25) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT show a dispute window warning since the modal does not display one', () => {
    // Pin the current behaviour: copy talks about freezing escrow + admin
    // review, but does NOT surface the 7-day window. If that changes,
    // update the test.
    render(
      <RaiseDisputeModal
        brandName="X"
        campaignName="Y"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.queryByText(/7.day/i)).not.toBeInTheDocument();
    expect(screen.getByText(/freezes the/)).toBeInTheDocument();
  });
});
