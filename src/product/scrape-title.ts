import { decryptData } from '../util/utils';

/**
 * A scrape is "found" only when it carries a TITLE.
 *
 * isLoadStatus 1 is what turns the Search icon green on the admin New Inventory list.
 * The background scrape jobs (brandSearchList every 3 minutes, scrapMinusOne every 7)
 * decided it from the size of the encrypted reply and `PartNumber != 'NA'`, so a reply
 * with a price or compatibility rows but no title still went green.
 *
 * Rule since 2026-11-19 (requested by Sabarish): no title, no green. The existing size
 * and part-number checks stay - this only adds to them. AdminAPI applies the same rule
 * to the Search icon and to editing a part (its own src/product/scrape-title.ts).
 *
 * "NA" is the scraper's placeholder for a field it could not read, in any case.
 */
export const hasScrapeTitle = (data: unknown): boolean => {
    let scrape: any = data;
    if (typeof scrape === 'string') {
        try { scrape = JSON.parse(scrape); } catch { return false; }
    }
    const title = scrape?.ListingDetails?.Title;
    if (typeof title !== 'string') return false;
    const t = title.trim();
    return t !== '' && t.toUpperCase() !== 'NA';
};

/**
 * The same test for a scrape already saved in productscrapdetails, where it is stored
 * encrypted. Anything that cannot be read counts as untitled, never as found.
 */
export const savedScrapeHasTitle = (otherData: unknown): boolean => {
    if (typeof otherData !== 'string' || otherData === '') return false;
    try {
        return hasScrapeTitle(decryptData(otherData));
    } catch {
        return false;
    }
};

/** How many saved scrapes of one part to look through for a titled one. */
export const SAVED_SCRAPE_LOOKBACK = 20;
