import { mergeActivityChanges } from './partFields';

/**
 * One history row per change.
 *
 * updateProduct wrote the app's `changes` and the server's derived changes one after the
 * other. Finish is in both, so every finish edit landed twice - the same change, a second
 * apart in spelling: "Primer, Textured" from the app against "Primer,Textured" from here.
 * Reported from the app side as "I only send it one time", which was true.
 *
 * The server's copy is the one kept, and not as a preference. The app numbers Finish 13,
 * which is Lbs here, so the app's row files a finish change under the Lbs activityId -
 * filtering Lbs returns finish changes, and filtering Finish misses them.
 */
describe('merging the app changes with the derived ones', () => {
  /** The payload that produced the duplicates, as the API received it. */
  const appChanges = [
    { Id: 13, name: 'Finish', value: 'Other, Painted, Primer, Textured -> Primer, Textured' },
    { Id: 5, name: 'Box Number', value: 'L11 -> L12' },
    { Id: 2, name: 'Quantity', value: '2 -> 4' },
  ];
  const derived = [
    { Id: 12, name: 'Finish', value: 'Other,Painted,Primer,Textured -> Primer,Textured', colorValue: [] },
    { Id: 13, name: 'Lbs', value: '1 -> 2.8', colorValue: [] },
  ];

  it('records one finish change, not two', () => {
    const merged = mergeActivityChanges(appChanges, derived);

    expect(merged.filter((c) => c.name === 'Finish')).toHaveLength(1);
  });

  it('keeps the server Id, so finish does not land under Lbs', () => {
    const merged = mergeActivityChanges(appChanges, derived);

    const finish = merged.find((c) => c.name === 'Finish');
    expect(finish.Id).toBe(12);
    expect(finish.value).toBe('Other,Painted,Primer,Textured -> Primer,Textured');
  });

  it('leaves Lbs its own row at 13', () => {
    const merged = mergeActivityChanges(appChanges, derived);

    expect(merged.filter((c) => c.Id === 13)).toEqual([
      { Id: 13, name: 'Lbs', value: '1 -> 2.8', colorValue: [] },
    ]);
  });

  it('passes through every change the server does not derive', () => {
    const merged = mergeActivityChanges(appChanges, derived);

    expect(merged.filter((c) => ['Box Number', 'Quantity'].includes(c.name))).toHaveLength(2);
  });

  /**
   * The app may send a finish change when the server derives none - the values can be
   * equal here and different there. Dropping it regardless is deliberate: a finish row
   * under Id 13 is worse than no row, because it corrupts the Lbs filter.
   */
  it('drops an app finish change even when nothing was derived', () => {
    const merged = mergeActivityChanges(appChanges, []);

    expect(merged.some((c) => c.name === 'Finish')).toBe(false);
    expect(merged).toHaveLength(2);
  });

  it('matches the name whatever its casing or spacing', () => {
    const odd = [{ Id: 13, name: ' finish ', value: 'a -> b' }];

    expect(mergeActivityChanges(odd, [])).toHaveLength(0);
  });

  it('survives an app that sends no changes at all', () => {
    expect(mergeActivityChanges(undefined, derived)).toEqual(derived);
    expect(mergeActivityChanges(null, derived)).toEqual(derived);
    expect(mergeActivityChanges('nonsense', derived)).toEqual(derived);
  });

  it('drops every derived field the app duplicates, not just finish', () => {
    const noisy = [
      { Id: 13, name: 'Finish', value: 'x -> y' },
      { Id: 20, name: 'Height', value: '1 -> 2' },
      { Id: 21, name: 'Oz', value: '1 -> 2' },
      { Id: 1, name: 'Title', value: 'a -> b' },
    ];

    const merged = mergeActivityChanges(noisy, []);

    expect(merged).toEqual([{ Id: 1, name: 'Title', value: 'a -> b' }]);
  });
});
