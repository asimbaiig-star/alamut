// photos.ts — the pictures on the landing pages.
//
// Real photographs of the work this market is about, from Unsplash under the
// free Unsplash License (each served from images.unsplash.com; Unsplash+
// images are served from plus.unsplash.com and none is used). Each is
// credited on the page beside the picture.
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
  // qu2JENeCaE4
  productSet: { id: '1611149974482-764b0c2a211a', alt: 'A small product set on a white backdrop, with a studio light and camera', by: 'Olga Serjantu' },
  // u4bvBOOpZB4
  editTimeline: { id: '1614963326505-843868e1d83a', alt: 'A monitor showing a video edit timeline in a dark room', by: 'Sanjeev Nagaraj' },
} as const satisfies Record<string, Photo>;

/** An Unsplash (imgix) URL cropped to `ratio` (width / height) at `w` px. */
export function photoUrl(id: string, w: number, ratio: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=entropy&q=70&w=${w}&h=${Math.round(w / ratio)}`;
}
