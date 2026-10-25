/**
 * Full height of `PreviewAsUserBanner`: a 3rem row (`h-12`) plus its 1px
 * bottom border. The sticky top bar sticks this far down; keep the two in
 * step.
 *
 * Lives outside the banner's file because that file is a client module, and a
 * server component importing a plain value from one gets a client reference
 * instead of the value.
 */
export const PREVIEW_BANNER_HEIGHT = '3.0625rem'
