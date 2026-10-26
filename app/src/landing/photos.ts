// photos.ts — the pictures on the landing pages.
//
// Real photographs of the work this market is about, from Unsplash under the
// free Unsplash License (each served from images.unsplash.com; Unsplash+
// images are served from plus.unsplash.com and none is used). Each is
// credited on the page beside the picture.
//
// None of these people is an Alamut user, and no caption says or implies it.
// A caption describes what is in the picture, nothing more.

export interface Photo {
  id: string;
  alt: string;
  caption: string;
  by: string;
  page: string;
}

const P = (id: string, alt: string, caption: string, by: string, slug: string): Photo =>
  ({ id, alt, caption, by, page: `https://unsplash.com/photos/${slug}` });

export const PHOTOS = {
  phoneOnTripod: P('1791213434342-de9e682b7bca',
    'A phone on a tripod, its camera app recording a desk with a lamp',
    'Recording on a phone mounted on a tripod.', 'Kseniia Poroshkova', 'BkJDoyidt2Y'),
  ringLight: P('1718874380569-7a44071f01c3',
    'A woman checks her phone beside a ring light',
    'Checking a take beside a ring light.', 'siddharth vyas', 'VIQKDL6-TpU'),
  makeupTable: P('1680696227092-8a9d689a0f25',
    'Hands laying out makeup and brushes on a dark table',
    'Laying out products before a shoot.', 'Rhamely', 'u88INhZV4ok'),
  kitchenShoot: P('1695408247109-3bf125ad0538',
    'A woman films with a camera in a bright kitchen',
    'Filming in a home kitchen.', 'Wesley Tingey', 'RAH1ipSQh24'),
  boxHandover: P('1566576721346-d4a3b4eaeb55',
    'One person hands a cardboard box to another',
    'Handing over a product to be filmed.', 'RoseBox', 'BFdSCxmqvYc'),
  reviewTogether: P('1551836022-d5d88e9218df',
    'Two women talk at a desk with a laptop and notes',
    'Going through options at a laptop.', 'Amy Hirschi', 'JaoVGh5aJ3E'),
  productSet: P('1611149974482-764b0c2a211a',
    'A small product set on a white backdrop, with a studio light and camera',
    'A product set ready to shoot.', 'Olga Serjantu', 'qu2JENeCaE4'),
  editTimeline: P('1614963326505-843868e1d83a',
    'A monitor showing a video edit timeline in a dark room',
    'Cutting a video in an editor.', 'Sanjeev Nagaraj', 'u4bvBOOpZB4'),
} as const;

/** An Unsplash (imgix) URL cropped to `ratio` (width / height) at `w` px. */
export function photoUrl(id: string, w: number, ratio: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=entropy&q=70&w=${w}&h=${Math.round(w / ratio)}`;
}
