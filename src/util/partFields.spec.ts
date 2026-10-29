import { mergeActivityChanges, validatePartFields } from './partFields';

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

/**
 * Ounces above 15 are not a weight eBay can hold.
 *
 * A listing carries WeightMajor (lbs) and WeightMinor (oz) separately, and sixteen
 * ounces is a pound. Part 21997867 was stored from the phone as 25 lbs 35 oz, which
 * means 27 lbs 3 oz; the listing held 14 lbs 1 oz and the two screens disagreed ever
 * after. The admin panel already refuses it (ShippingDetailsTab.tsx, ozInvalid).
 */
describe('package weight', () => {
  const ok = (input: any) => expect(() => validatePartFields(input)).not.toThrow();
  const rejects = (input: any, msg: string | RegExp) =>
    expect(() => validatePartFields(input)).toThrow(msg);

  it('refuses ounces above 15', () => {
    rejects({ lbs: 25, oz: 35 }, /oz must be 15 or less/);
  });

  it('accepts the boundary', () => {
    ok({ lbs: 25, oz: 15 });
  });

  it('accepts no ounces at all', () => {
    ok({ lbs: 25, oz: 0 });
    ok({ lbs: 25 });
    ok({ lbs: 25, oz: '' });
  });

  /** The bound is on ounces only - pounds have no such ceiling here. */
  it('leaves pounds alone', () => {
    ok({ lbs: 70, oz: 2 });
  });

  /** The existing rules still apply. */
  it('still refuses a negative or non-numeric weight', () => {
    rejects({ oz: -1 }, /must not be negative/);
    rejects({ oz: 'heavy' }, /must be a number/);
  });
});
