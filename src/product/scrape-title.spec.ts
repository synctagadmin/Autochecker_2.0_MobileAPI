import { encryptDataAccount } from '../util/utils';
import { hasScrapeTitle, savedScrapeHasTitle } from './scrape-title';

/**
 * No title, no green - in the background scrape jobs.
 *
 * saveScrap decided isLoadStatus 1 from the size of the encrypted reply and
 * `PartNumber != 'NA'`. A title is now required as well (2026-11-19).
 */
/** The scraper's reply shape (scraper-v2 partSchema), with a price and fitment filled in. */
const scrape = (title: unknown, partNumber = 'MN117202WA') => ({
    ListingDetails: { Title: title, PartNumber: partNumber, Supersession: 'NA', ImageURL: 'NA' },
    ItemSpecifics: { ItemType: 'NA', Capacity: 'NA', ManufacturePartNumber: 'NA', OEOEMPartNumber: 'NA' },
    ItemDescription: 'NA',
    SellingDetails: { YourPrice1: '$41.20', YourPrice2: '$41.20', AllDiscount: 'NA', DiscountOff: 'NA', MSRP: '$58.86' },
    Compatibility: ['2008', '2009', '2010', '2011'].map((Year) => ({ Name: 'Mitsubishi Lancer', Year })),
});

describe('hasScrapeTitle', () => {
    it('accepts a real title', () => {
        expect(hasScrapeTitle(scrape('GRILLE, RADIATOR'))).toBe(true);
    });

    it('rejects the placeholder "NA", blank and missing titles', () => {
        for (const t of ['NA', 'na', ' NA ', '', '   ', undefined, 42]) expect(hasScrapeTitle(scrape(t))).toBe(false);
        expect(hasScrapeTitle({ SellingDetails: { YourPrice1: '$1.00' } })).toBe(false);
        expect(hasScrapeTitle(undefined)).toBe(false);
    });

    it('reads a scrape passed as JSON text, and rejects text that is not JSON', () => {
        expect(hasScrapeTitle(JSON.stringify(scrape('COVER, LWR')))).toBe(true);
        expect(hasScrapeTitle('not json')).toBe(false);
    });

    it('a reply that passes the old size and part-number checks but has no title is not found', () => {
        const priced = scrape('NA');
        expect(encryptDataAccount(priced).length).toBeGreaterThan(576);
        expect(priced.ListingDetails.PartNumber).not.toBe('NA');
        expect(hasScrapeTitle(priced)).toBe(false);
    });
});

describe('savedScrapeHasTitle', () => {
    it('reads a saved (encrypted) scrape the way productscrapdetails stores it', () => {
        expect(savedScrapeHasTitle(encryptDataAccount(scrape('NECK, FUEL FILLER')))).toBe(true);
        expect(savedScrapeHasTitle(encryptDataAccount(scrape('NA')))).toBe(false);
    });

    it('treats anything unreadable as untitled, never as found', () => {
        expect(savedScrapeHasTitle(undefined)).toBe(false);
        expect(savedScrapeHasTitle('')).toBe(false);
        expect(savedScrapeHasTitle('garbage-not-ciphertext')).toBe(false);
    });
});
