/** Joins the member ids into the id of a merged row; Scope ids never carry it. */
export const MERGED_ROW_ID_JOINER = '+';
/** Bounds of a persisted arrangement, so a corrupt cache cannot balloon the rows. */
export const MAX_LANES = 1000;
export const MAX_MEMBER_ID_LENGTH = 200;
export const MAX_LANE_NAME_LENGTH = 80;
