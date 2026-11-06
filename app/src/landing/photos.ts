// photos.ts — the pictures on the landing pages.
//
// Real photographs of the work this market is about, from Unsplash under the
// free Unsplash License (each served from images.unsplash.com; Unsplash+
// images are served from plus.unsplash.com and none is used). Each is
// credited on the page in the note nearest it.
//
// None of these people is an Alamut user, and nothing on the page says or
// implies it: the footer says so plainly.

export interface Photo {
  id: string;
  alt: string;
  by: string;
}

// Each entry's page is unsplash.com/photos/<the slug in its comment>.
export const PHOTOS = {
  // BkJDoyidt2Y
  phoneOnTripod: { id: '1791213434342-de9e682b7bca', alt: 'A phone on a tripod, its camera app recording a desk with a lamp', by: 'Kseniia Poroshkova' },
  // VIQKDL6-TpU
  ringLight: { id: '1718874380569-7a44071f01c3', alt: 'A woman checks her phone beside a ring light', by: 'siddharth vyas' },
  // u88INhZV4ok
  makeupTable: { id: '1680696227092-8a9d689a0f25', alt: 'Hands laying out makeup and brushes on a dark table', by: 'Rhamely' },
  // RAH1ipSQh24
  kitchenShoot: { id: '1695408247109-3bf125ad0538', alt: 'A woman films with a camera in a bright kitchen', by: 'Wesley Tingey' },
  // u4bvBOOpZB4
  editTimeline: { id: '1614963326505-843868e1d83a', alt: 'A monitor showing a video edit timeline in a dark room', by: 'Sanjeev Nagaraj' },
  // 37gtcn-flbc
  foodTutorial: { id: '1758522487757-44485b009cf5', alt: 'A woman holds up peppers while filming a cooking tutorial in her kitchen', by: 'Vitaly Gariev' },
  // i_xVfNtQjwI
  foodOverhead: { id: '1472393365320-db77a5abbecc', alt: 'Hands hold a phone over a table of food to photograph it', by: 'Eaters Collective' },
  // V2F0K0FuwPM
  dumbbells: { id: '1733077151330-a6f3a257926b', alt: 'A woman lifts two dumbbells, seen from behind on white', by: 'Logan Weaver' },
  // mfWsMDdN-Ro
  beachVlog: { id: '1630797160666-38e8c5ba44c1', alt: 'A man on a beach talks to a camera on a tripod', by: 'Andrés' },
  // 15Joe9gChn4
  sunsetGimbal: { id: '1776151255105-61c1ea9fce65', alt: 'A gimbal camera recording a sunset over the water', by: 'jason hu' },
  // OulqnjAE33E
  canalSelfie: { id: '1764162051504-7d74009a5bf7', alt: 'A woman in a scarf takes a selfie in front of a canal', by: 'Detail .co' },
  // DqmXihYx5UE
  cameraRed: { id: '1611784728558-6c7d9b409cdf', alt: 'A man checks the screen of a video camera in red light', by: 'Kyle Loftus' },
  // n30_i7mx62o
  podcastMic: { id: '1593697909683-bccb1b9e68a4', alt: 'A woman in headphones talks into a microphone beside a laptop', by: 'Soundtrap' },
  // F9gWctom-pI
  makeupTutorial: { id: '1758272421578-840698d05a00', alt: 'A woman filming a makeup tutorial on the floor of her living room', by: 'Vitaly Gariev' },
  // 1S5Pc9tsuZg
  pinkBlue: { id: '1779400496430-073efbb4f976', alt: 'Two women sitting in bright pink and blue outfits', by: 'ola szkolda' },
  // ezzydylL6GA
  runway: { id: '1793395778448-a2dd720f7059', alt: 'A model walking a runway in a patterned dress', by: 'Azim Khan Ronnie' },
} as const satisfies Record<string, Photo>;

/** An Unsplash (imgix) URL cropped to `ratio` (width / height) at `w` px. */
export function photoUrl(id: string, w: number, ratio: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=entropy&q=70&w=${w}&h=${Math.round(w / ratio)}`;
}
