import { useId } from 'react';

/**
 * Stylized classical Roman/Trajan chiseled typography for EVERFOLK
 * (monochrome luminous alabaster-white & silver relief, centered without side statue).
 */
interface StylizedLetter {
  letter: string;
  /** Full outer silhouette path of the stylized letterform (with flared serifs & swashes) */
  silhouette: string;
  /** Left / top sunlit bevel facets (pure gleaming white) */
  sunFacets: string;
  /** Right / bottom shaded V-cut bevel facets (cool silver-alabaster) */
  shadeFacets: string;
  /** Central chiseled ridge line (V-groove apex) */
  ridge: string;
}

const LETTERS: readonly StylizedLetter[] = [
  {
    // E1: x = 52..116 (stem 62..75, stylized spearhead crossbar projecting left at y=73)
    letter: 'E',
    silhouette: [
      'M 54 36 L 115 36 L 116 50 L 113 50 Q 111 42 101 41 L 75 41',
      'L 75 70 L 99 70 Q 106 70 108 65 L 110 65 L 110 81 L 108 81 Q 106 76 99 76 L 75 76',
      'L 75 106 L 103 106 Q 113 106 116 96 L 119 96 L 116 112 L 54 112 L 54 109 Q 62 109 62 101',
      'L 62 76 L 56 76 L 50 73 L 56 70 L 62 70',
      'L 62 47 Q 62 39 54 39 Z',
    ].join(' '),
    sunFacets: [
      'M 54 36 L 115 36 L 110 39 L 68.5 39 L 68.5 73 L 50 73 L 56 70 L 62 70 L 62 47 Q 62 39 54 39 Z',
      'M 68.5 73 L 106 73 L 108 65 L 106 70 L 75 70 L 75 73 Z',
      'M 62 76 L 68.5 73 L 68.5 108.5 L 54 112 L 54 109 Q 62 109 62 101 Z',
      'M 68.5 108.5 L 75 106 L 103 106 Q 113 106 116 96 L 113 108.5 Z',
    ].join(' '),
    shadeFacets: [
      'M 68.5 39 L 110 39 L 115 36 L 116 50 L 113 50 Q 111 42 101 41 L 75 41 L 75 70 L 68.5 73 Z',
      'M 50 73 L 106 73 L 110 81 L 108 81 Q 106 76 99 76 L 75 76 L 75 106 L 68.5 108.5 L 68.5 73 L 62 76 L 56 76 Z',
      'M 54 112 L 68.5 108.5 L 113 108.5 L 116 96 L 119 96 L 116 112 Z',
    ].join(' '),
    ridge: 'M 68.5 39 L 68.5 108.5 M 68.5 39 L 111 39 M 52 73 L 106 73 M 68.5 108.5 L 113 108.5',
  },
  {
    // V: x = 126..200 (apex dipping to y=116 at x=164)
    letter: 'V',
    silhouette: [
      'M 126 36 L 153 36 L 153 39 Q 145 39 147 46 L 166 97',
      'L 183 47 Q 186 39 177 39 L 177 36 L 200 36 L 200 39 Q 193 39 189 49',
      'L 165 116 L 161 116 L 134 47 Q 131 39 126 39 Z',
    ].join(' '),
    sunFacets: [
      'M 126 36 L 153 36 L 140 39 L 163 106 L 161 116 L 134 47 Q 131 39 126 39 Z',
      'M 177 36 L 200 36 L 188 39 L 163 106 L 166 97 L 183 47 Q 186 39 177 39 Z',
    ].join(' '),
    shadeFacets: [
      'M 140 39 L 153 36 L 153 39 Q 145 39 147 46 L 166 97 L 163 106 Z',
      'M 188 39 L 200 36 L 200 39 Q 193 39 189 49 L 165 116 L 161 116 L 163 106 Z',
    ].join(' '),
    ridge: 'M 140 38 L 163 109 L 188 38',
  },
  {
    // E2: x = 208..272 (stylized middle crossbar with diamond boss)
    letter: 'E',
    silhouette: [
      'M 208 36 L 268 36 L 269 50 L 266 50 Q 264 42 254 41 L 229 41',
      'L 229 70 L 252 70 Q 259 70 261 65 L 263 65 L 263 81 L 261 81 Q 259 76 252 76 L 229 76',
      'L 229 106 L 256 106 Q 266 106 269 96 L 272 96 L 269 112 L 208 112 L 208 109 Q 216 109 216 101',
      'L 216 76 L 211 76 L 206 73 L 211 70 L 216 70',
      'L 216 47 Q 216 39 208 39 Z',
    ].join(' '),
    sunFacets: [
      'M 208 36 L 268 36 L 263 39 L 222.5 39 L 222.5 73 L 206 73 L 211 70 L 216 70 L 216 47 Q 216 39 208 39 Z',
      'M 222.5 73 L 259 73 L 261 65 L 259 70 L 229 70 L 229 73 Z',
      'M 216 76 L 222.5 73 L 222.5 108.5 L 208 112 L 208 109 Q 216 109 216 101 Z',
      'M 222.5 108.5 L 229 106 L 256 106 Q 266 106 269 96 L 266 108.5 Z',
    ].join(' '),
    shadeFacets: [
      'M 222.5 39 L 263 39 L 268 36 L 269 50 L 266 50 Q 264 42 254 41 L 229 41 L 229 70 L 222.5 73 Z',
      'M 206 73 L 259 73 L 263 81 L 261 81 Q 259 76 252 76 L 229 76 L 229 106 L 222.5 108.5 L 222.5 73 L 216 76 L 211 76 Z',
      'M 208 112 L 222.5 108.5 L 266 108.5 L 269 96 L 272 96 L 269 112 Z',
    ].join(' '),
    ridge: 'M 222.5 39 L 222.5 108.5 M 222.5 39 L 264 39 M 208 73 L 259 73 M 222.5 108.5 L 266 108.5',
  },
  {
    // R: x = 280..354 (classical bowl + sweeping calligraphic tail below baseline to y=117)
    letter: 'R',
    silhouette: [
      'M 280 36 L 314 36 C 332 36 341 44 341 55 C 341 66 332 73 319 75',
      'L 338 103 C 343 110 348 113 355 113 L 355 116 C 343 117 334 113 327 102',
      'L 308 76 L 301 76 L 301 101 Q 301 109 309 109 L 309 112 L 280 112 L 280 109 Q 288 109 288 101',
      'L 288 47 Q 288 39 280 39 Z',
      'M 301 41 L 301 71 L 311 71 C 322 71 328 65 328 56 C 328 46 322 41 311 41 Z',
    ].join(' '),
    sunFacets: [
      'M 280 36 L 314 36 C 326 36 334 40 338 46 L 332 49 C 328 42 321 39 312 39 L 294.5 39 L 294.5 108.5 L 280 112 L 280 109 Q 288 109 288 101 L 288 47 Q 288 39 280 39 Z',
      'M 308 76 L 314 75 L 335 106 C 340 112 346 114 355 113 L 355 115 C 344 115 336 111 329 101 Z',
    ].join(' '),
    shadeFacets: [
      'M 294.5 39 L 301 41 L 301 101 Q 301 109 309 109 L 309 112 L 280 112 L 294.5 108.5 Z',
      'M 332 49 L 338 46 C 340 49 341 52 341 55 C 341 66 332 73 319 75 L 308 76 L 301 71 L 311 71 C 322 71 328 65 328 56 C 328 53 329 51 332 49 Z',
      'M 314 75 L 319 75 L 338 103 C 343 110 348 113 355 113 L 335 106 Z',
    ].join(' '),
    ridge: 'M 294.5 39 L 294.5 108.5 M 294.5 39 L 314 39 C 329 39 335 46 335 55 C 335 65 327 73 312 73 L 301 73 M 314 74 L 335 105 C 340 112 346 114 353 114',
  },
  {
    // F: x = 358..418 (sweeping top arm + spearhead middle crossbar)
    letter: 'F',
    silhouette: [
      'M 358 36 L 417 36 L 418 50 L 415 50 Q 413 42 403 41 L 379 41',
      'L 379 71 L 401 71 Q 408 71 410 66 L 412 66 L 412 82 L 410 82 Q 408 77 401 77 L 379 77',
      'L 379 101 Q 379 109 388 109 L 388 112 L 358 112 L 358 109 Q 366 109 366 101',
      'L 366 77 L 361 77 L 356 74 L 361 71 L 366 71',
      'L 366 47 Q 366 39 358 39 Z',
    ].join(' '),
    sunFacets: [
      'M 358 36 L 417 36 L 412 39 L 372.5 39 L 372.5 74 L 356 74 L 361 71 L 366 71 L 366 47 Q 366 39 358 39 Z',
      'M 372.5 74 L 408 74 L 410 66 L 408 71 L 379 71 L 379 74 Z',
      'M 366 77 L 372.5 74 L 372.5 108.5 L 358 112 L 358 109 Q 366 109 366 101 Z',
    ].join(' '),
    shadeFacets: [
      'M 372.5 39 L 412 39 L 417 36 L 418 50 L 415 50 Q 413 42 403 41 L 379 41 L 379 71 L 372.5 74 Z',
      'M 356 74 L 408 74 L 412 82 L 410 82 Q 408 77 401 77 L 379 77 L 379 101 Q 379 109 388 109 L 388 112 L 358 112 L 372.5 108.5 L 372.5 74 L 366 77 L 361 77 Z',
    ].join(' '),
    ridge: 'M 372.5 39 L 372.5 108.5 M 372.5 39 L 413 39 M 358 74 L 408 74',
  },
  {
    // O: x = 424..496 (classical Trajan oval cx=460, cy=74, rx=36, ry=39.5)
    letter: 'O',
    silhouette: [
      'M 460 34.5 C 482 34.5 496 51 496 74 C 496 97 482 113.5 460 113.5 C 438 113.5 424 97 424 74 C 424 51 438 34.5 460 34.5 Z',
      'M 460 40 C 445 40 437 54 437 74 C 437 94 445 108 460 108 C 475 108 483 94 483 74 C 483 54 475 40 460 40 Z',
    ].join(' '),
    sunFacets: [
      'M 460 34.5 C 438 34.5 424 51 424 74 C 424 92 433 106 447 111 L 450 105 C 438 100 430.5 89 430.5 74 C 430.5 53 443 37.5 460 37.5 C 472 37.5 481 44 486 55 L 491 51 C 485 40 474 34.5 460 34.5 Z',
      'M 460 108 C 475 108 483 94 483 74 C 483 62 479 52 473 46 L 478 43 C 486 50 489.5 61 489.5 74 C 489.5 95 477 110.5 460 110.5 Z',
    ].join(' '),
    shadeFacets: [
      'M 460 37.5 C 443 37.5 430.5 53 430.5 74 C 430.5 89 438 100 450 105 L 447 111 C 451 112.5 455 113.5 460 113.5 C 482 113.5 496 97 496 74 C 496 65 494 57 491 51 L 486 55 C 488 60 489.5 67 489.5 74 C 489.5 95 477 110.5 460 110.5 L 460 108 C 445 108 437 94 437 74 C 437 54 445 40 460 40 Z',
    ].join(' '),
    ridge: 'M 460 37.5 C 478 37.5 489.5 53 489.5 74 C 489.5 95 478 110.5 460 110.5 C 442 110.5 430.5 95 430.5 74 C 430.5 53 442 37.5 460 37.5 Z',
  },
  {
    // L: x = 504..564 (tall stem + sweeping baseline beak)
    letter: 'L',
    silhouette: [
      'M 504 36 L 533 36 L 533 39 Q 525 39 525 47 L 525 106',
      'L 550 106 Q 560 106 563 95 L 566 95 L 563 112 L 504 112 L 504 109 Q 512 109 512 101',
      'L 512 47 Q 512 39 504 39 Z',
    ].join(' '),
    sunFacets: [
      'M 504 36 L 533 36 L 518.5 39 L 518.5 108.5 L 504 112 L 504 109 Q 512 109 512 101 L 512 47 Q 512 39 504 39 Z',
      'M 518.5 108.5 L 525 106 L 550 106 Q 560 106 563 95 L 560 108.5 Z',
    ].join(' '),
    shadeFacets: [
      'M 518.5 39 L 533 36 L 533 39 Q 525 39 525 47 L 525 106 L 518.5 108.5 Z',
      'M 504 112 L 518.5 108.5 L 560 108.5 L 563 95 L 566 95 L 563 112 Z',
    ].join(' '),
    ridge: 'M 518.5 39 L 518.5 108.5 L 560 108.5',
  },
  {
    // K: x = 568..636 (stem + high-contrast upper diagonal + sweeping calligraphic tail to y=117)
    letter: 'K',
    silhouette: [
      'M 568 36 L 596 36 L 596 39 Q 589 39 589 47 L 589 71',
      'L 614 45 Q 619 40 612 39 L 612 36 L 633 36 L 633 39 Q 625 39 618 46',
      'L 598 67 L 623 102 C 628 110 633 113 640 113 L 640 116 C 628 117 619 113 612 102',
      'L 590 72 L 589 73 L 589 101 Q 589 109 596 109 L 596 112 L 568 112 L 568 109 Q 576 109 576 101',
      'L 576 47 Q 576 39 568 39 Z',
    ].join(' '),
    sunFacets: [
      'M 568 36 L 596 36 L 582.5 39 L 582.5 108.5 L 568 112 L 568 109 Q 576 109 576 101 L 576 47 Q 576 39 568 39 Z',
      'M 612 36 L 633 36 L 621 39 L 593 69 L 589 71 L 614 45 Q 619 40 612 39 Z',
      'M 593 69 L 598 67 L 620 105 C 625 112 631 114 640 113 L 640 115 C 629 115 621 111 614 101 L 590 72 Z',
    ].join(' '),
    shadeFacets: [
      'M 582.5 39 L 596 36 L 596 39 Q 589 39 589 47 L 589 101 Q 589 109 596 109 L 596 112 L 568 112 L 582.5 108.5 Z',
      'M 621 39 L 633 36 L 633 39 Q 625 39 618 46 L 598 67 L 593 69 Z',
      'M 598 67 L 623 102 C 628 110 633 113 640 113 L 620 105 Z',
    ].join(' '),
    ridge: 'M 582.5 39 L 582.5 108.5 M 622 39 L 591 70 M 594 68 L 620 105 C 625 112 631 114 638 114',
  },
];

export default function RoyalPixelWordmark(_props: { sculptureHref?: string } = {}) {
  const id = useId().replaceAll(':', '') + '-royal';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="ef-royal-wordmark"
      viewBox="0 0 680 146"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* Main alabaster-porcelain vertical relief gradient */}
        <linearGradient id={`${id}-body`} x1="0" y1="34" x2="0" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#f8fafc" />
          <stop offset="78%" stopColor="#e6edf5" />
          <stop offset="100%" stopColor="#cbd6e3" />
        </linearGradient>
        {/* Sunlit top/left chiseled facet */}
        <linearGradient id={`${id}-sun`} x1="0" y1="34" x2="0" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#fcfdff" />
          <stop offset="100%" stopColor="#eef3f8" />
        </linearGradient>
        {/* Shaded right/bottom V-cut facet */}
        <linearGradient id={`${id}-shade`} x1="0" y1="36" x2="0" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dbe4ee" />
          <stop offset="52%" stopColor="#b8c7d8" />
          <stop offset="100%" stopColor="#869bb0" />
        </linearGradient>
        {/* Sweeping specular light reflection across all letterforms */}
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-metal`}>
          {LETTERS.map((item, idx) => (
            <path key={idx} d={item.silhouette} transform="translate(-5, 0)" />
          ))}
        </clipPath>
      </defs>

      {/* Symmetric classical upper crest & tapered silver flanking lines (centered at x = 340) */}
      <g className="ef-logo-emblem">
        {/* Left & right tapered classical rules */}
        <path fill="#6d8499" opacity="0.65" d="M 88 21.5 L 304 21 L 304 22.5 L 88 22 Z M 376 21 L 592 21.5 L 592 22 L 376 22.5 Z" />
        <path fill="#f8fafc" d="M 96 20.5 L 306 20 L 306 21.3 L 96 21 Z M 374 20 L 584 20.5 L 584 21 L 374 21.3 Z" />
        {/* Small terminal serifs & diamond stops on the upper rule */}
        <path fill="#ffffff" d="M 312 18 L 315 20.8 L 312 23.6 L 309 20.8 Z M 368 18 L 371 20.8 L 368 23.6 L 365 20.8 Z" />
        {/* Center classical 4-point horizon star & open chronicle emblem at x = 340 */}
        <path fill="#18303c80" d="M 340 5 L 342.4 16.5 L 354 19 L 342.4 21.5 L 340 33 L 337.6 21.5 L 326 19 L 337.6 16.5 Z" />
        <path fill="#ffffff" d="M 340 3.5 L 342 15.5 L 354 18 L 342 20.5 L 340 32.5 L 338 20.5 L 326 18 L 338 15.5 Z" />
        <path fill="#b8c9da" d="M 340 18 L 354 18 L 342 20.5 L 340 32.5 Z" />
      </g>

      {/* Main stylized chiseled inscription: centered at x = 340 via translate(-5, 0) */}
      <g className="ef-logo-carving">
        {LETTERS.map((item, index) => (
          <g
            key={index}
            className="ef-royal-pixel-batch ef-royal-letter"
            data-letter={item.letter}
            transform="translate(-5, 0)"
          >
            {/* Soft dark slate drop shadow for legibility over bright sunlit water */}
            <path
              d={item.silhouette}
              transform="translate(2.5, 4)"
              fill="#0e24306b"
              fillRule="evenodd"
            />
            {/* Crisp 3D chiseled stone/silver extrusion */}
            <path
              d={item.silhouette}
              transform="translate(1.2, 2)"
              fill="#566f8499"
              fillRule="evenodd"
            />
            {/* Sculpted alabaster letter body */}
            <path
              d={item.silhouette}
              fill={`url(#${id}-body)`}
              stroke="#7e94a8"
              strokeWidth="0.55"
              fillRule="evenodd"
            />
            {/* Shaded right/bottom V-cut bevel facets */}
            <path d={item.shadeFacets} fill={`url(#${id}-shade)`} />
            {/* Sunlit left/top V-cut bevel facets */}
            <path d={item.sunFacets} fill={`url(#${id}-sun)`} />
            {/* Central chiseled V-groove shadow & white specular apex */}
            <path
              d={item.ridge}
              fill="none"
              stroke="#748ba1"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(0.7, 0.7)"
              opacity="0.7"
            />
            <path
              d={item.ridge}
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          </g>
        ))}

        {/* Animated light sweep across the chiseled letters */}
        <g clipPath={`url(#${id}-metal)`}>
          <path
            className="ef-logo-reflection"
            d="M -110 28 L -45 28 L -85 124 L -150 124 Z"
            fill={`url(#${id}-light)`}
            opacity="0"
          />
        </g>
      </g>

      {/* Symmetric lower classical architectural rules & center diamond (Assassin's Creed style) */}
      <g className="ef-logo-lower-rule">
        <path fill="#6d8499" opacity="0.65" d="M 74 130.5 L 318 130 L 318 131.5 L 74 131 Z M 362 130 L 606 130.5 L 606 131 L 362 131.5 Z" />
        <path fill="#f8fafc" d="M 82 129.5 L 320 129 L 320 130.4 L 82 130 Z M 360 129 L 598 129.5 L 598 130 L 360 130.4 Z" />
        <path fill="#ffffff" d="M 340 124.5 L 345.5 129.8 L 340 135.1 L 334.5 129.8 Z" />
        <path fill="#9eb2c6" d="M 340 129.8 L 345.5 129.8 L 340 135.1 Z" />
        <path fill="#e2e8f0" d="M 326 127.8 L 328.5 129.8 L 326 131.8 L 323.5 129.8 Z M 354 127.8 L 356.5 129.8 L 354 131.8 L 351.5 129.8 Z" />
      </g>

      <g className="ef-royal-dust" fill="#ffffff" opacity="0">
        <circle cx="148" cy="26" r="1.2" />
        <circle cx="340" cy="18" r="1.4" />
        <circle cx="526" cy="30" r="1.2" />
      </g>
    </svg>
  );
}
