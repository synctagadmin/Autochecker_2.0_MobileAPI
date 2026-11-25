/**
 * Is this a part id the activity log can be queried by?
 *
 * Sentry AUTOCHECKER-5 (2026-11-25, production): the phone called getActivityStatus with
 * `partId: ""` - a part not saved yet has no id - and ProductActivityLog.find({ partId: "" })
 * threw "Cast to ObjectId failed for value \"\"", because partId is an ObjectId field. The
 * error was not caught, so the request failed with a 500 and the screen broke.
 *
 * A part with no id has no activity: the callers answer "none" instead of querying. Only a
 * 24-hex-character id (or an ObjectId) qualifies - Mongoose's own isValid also accepts any
 * 12-character string, which would still reach the query and fail the cast.
 */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export const isPartId = (value: unknown): boolean => {
    if (typeof value === 'string') return OBJECT_ID.test(value);
    return !!value && typeof value === 'object' && OBJECT_ID.test(String(value));
};
