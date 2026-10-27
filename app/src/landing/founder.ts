// founder.ts — the founder's note, shown near the end of both pages.
//
// A draft for Asim to edit. It stays off the page until `ready` is true, and
// a test refuses `ready: true` while any [bracketed placeholder] is left, so
// a half-written note can't ship. Everything said about the product here is
// true today; anything personal is left for the founder to write.
// No imports: the landing bundle reads this file.

export const FOUNDER = {
  /** Flip to true once the words below are yours. */
  ready: false,
  name: 'Asim [surname]',
  role: 'Founder',
  /** A real photo, e.g. '/founder.jpg' placed in app/public. Empty shows initials. */
  photo: '',
  title: 'Why I’m building Alamut',
  paragraphs: [
    '[One or two sentences on where this started for you: the deal you saw go wrong, the creator who chased an invoice for months, or the brand budget that disappeared into DMs.]',
    'Most brand deals still run on DMs, PDFs and trust. A creator quotes a rate in a chat, a brand asks for one more Story, and the money arrives when it arrives. I wanted one place where the rate is visible before anyone asks, every change is agreed on the deal, and the money is held before the work starts.',
    'Alamut is in public beta. Payments are simulated until real payment rails are in place, and the “Not live yet” list on this page is the honest list of what isn’t finished. The examples here are labelled as examples, and every fee comes from the code that charges it.',
    'If something doesn’t work the way you expect, tell me. [How to reach you: an email address or a link.]',
  ],
};
