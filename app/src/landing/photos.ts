// photos.ts — the pictures on the landing pages.
//
// Real photographs of the work this market is about, from Unsplash under the
// free Unsplash License (no Unsplash+ image is used). Each is credited on the
// page in the note nearest it.
//
// They're served from our own host, public/photos, at the widths in
// PHOTO_WIDTHS (scripts/photos.py writes them), so the pictures don't depend
// on another site being up.
//
// None of these people is an Alamut user, and nothing on the page says or
// implies it: the footer says so plainly.

export interface Photo {
  /** Unsplash's id for it, where it came from. */
  id: string;
  /** Its name in public/photos. */
  file: string;
  alt: string;
  by: string;
  /** What to keep in frame when a box crops it: across and down, out of 100. */
  focus?: readonly [number, number];
}

// Each entry's page is unsplash.com/photos/<the slug in its comment>.
export const PHOTOS = {
  // BkJDoyidt2Y
  phoneOnTripod: { id: '1791213434342-de9e682b7bca', file: 'phoneOnTripod', alt: 'A phone on a tripod, its camera app recording a desk with a lamp', by: 'Kseniia Poroshkova' },
  // VIQKDL6-TpU
  ringLight: { id: '1718874380569-7a44071f01c3', file: 'ringLight', alt: 'A woman checks her phone beside a ring light', by: 'siddharth vyas', focus: [60, 34] },
  // u88INhZV4ok
  makeupTable: { id: '1680696227092-8a9d689a0f25', file: 'makeupTable', alt: 'Hands laying out makeup and brushes on a dark table', by: 'Rhamely' },
  // RAH1ipSQh24
  kitchenShoot: { id: '1695408247109-3bf125ad0538', file: 'kitchenShoot', alt: 'A woman films with a camera in a bright kitchen', by: 'Wesley Tingey' },
  // u4bvBOOpZB4
  editTimeline: { id: '1614963326505-843868e1d83a', file: 'editTimeline', alt: 'A monitor showing a video edit timeline in a dark room', by: 'Sanjeev Nagaraj' },
  // 37gtcn-flbc
  foodTutorial: { id: '1758522487757-44485b009cf5', file: 'foodTutorial', alt: 'A woman holds up peppers while filming a cooking tutorial in her kitchen', by: 'Vitaly Gariev', focus: [50, 25] },
  // i_xVfNtQjwI
  foodOverhead: { id: '1472393365320-db77a5abbecc', file: 'foodOverhead', alt: 'Hands hold a phone over a table of food to photograph it', by: 'Eaters Collective' },
  // V2F0K0FuwPM
  dumbbells: { id: '1733077151330-a6f3a257926b', file: 'dumbbells', alt: 'A woman lifts two dumbbells, seen from behind on white', by: 'Logan Weaver', focus: [55, 22] },
  // mfWsMDdN-Ro
  beachVlog: { id: '1630797160666-38e8c5ba44c1', file: 'beachVlog', alt: 'A man on a beach talks to a camera on a tripod', by: 'Andrés', focus: [50, 40] },
  // 15Joe9gChn4
  sunsetGimbal: { id: '1776151255105-61c1ea9fce65', file: 'sunsetGimbal', alt: 'A gimbal camera recording a sunset over the water', by: 'jason hu', focus: [50, 55] },
  // OulqnjAE33E
  canalSelfie: { id: '1764162051504-7d74009a5bf7', file: 'canalSelfie', alt: 'A woman in a scarf takes a selfie in front of a canal', by: 'Detail .co', focus: [40, 40] },
  // DqmXihYx5UE
  cameraRed: { id: '1611784728558-6c7d9b409cdf', file: 'cameraRed', alt: 'A man checks the screen of a video camera in red light', by: 'Kyle Loftus', focus: [60, 40] },
  // n30_i7mx62o
  podcastMic: { id: '1593697909683-bccb1b9e68a4', file: 'podcastMic', alt: 'A woman in headphones talks into a microphone beside a laptop', by: 'Soundtrap', focus: [50, 40] },
  // F9gWctom-pI
  makeupTutorial: { id: '1758272421578-840698d05a00', file: 'makeupTutorial', alt: 'A woman filming a makeup tutorial on the floor of her living room', by: 'Vitaly Gariev', focus: [50, 22] },
  // 1S5Pc9tsuZg
  pinkBlue: { id: '1779400496430-073efbb4f976', file: 'pinkBlue', alt: 'Two women sitting in bright pink and blue outfits', by: 'ola szkolda', focus: [50, 15] },
  // ezzydylL6GA
  runway: { id: '1793395778448-a2dd720f7059', file: 'runway', alt: 'A model walking a runway in a patterned dress', by: 'Azim Khan Ronnie' },
} as const satisfies Record<string, Photo>;

/** The widths each photo is kept at in public/photos. */
export const PHOTO_WIDTHS = [240, 480, 960, 1600] as const;

export const photoSrc = (p: Photo, w: (typeof PHOTO_WIDTHS)[number]) => `/photos/${p.file}-${w}.webp`;

/** Every width, so the browser picks what the box and the screen need. */
export const photoSrcSet = (p: Photo) => PHOTO_WIDTHS.map((w) => `${photoSrc(p, w)} ${w}w`).join(', ');
