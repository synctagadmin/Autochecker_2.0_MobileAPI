import { isPartId } from './part-id';
import { productService as ProductService } from './product.service';

/**
 * Sentry AUTOCHECKER-5 (production, 2026-11-25): getActivityStatus with partId "" threw
 * "Cast to ObjectId failed for value \"\" (type string) at path \"partId\"" and failed the
 * request, breaking the phone's screen. A part with no id has no activity: both activity
 * routes now answer "none" instead of querying.
 */

const ID = '6361fbebce3845e35b2027da';

describe('isPartId', () => {
    it('accepts a real part id', () => {
        expect(isPartId(ID)).toBe(true);
        expect(isPartId({ toString: () => ID })).toBe(true);
    });

    it('refuses what would fail the ObjectId cast - the empty id first of all', () => {
        for (const bad of ['', '   ', 'undefined', 'null', 'abc', '123456789012', `${ID} `, ID + '0', null, undefined, 0, 42, {}]) {
            expect(isPartId(bad)).toBe(false);
        }
    });
});

/** The service with only what these two routes touch. */
const serviceWith = () => {
    const count = jest.fn().mockReturnValue({ exec: () => Promise.resolve(3) });
    const limit = jest.fn().mockResolvedValue([]);
    const find = jest.fn().mockImplementation(() => ({
        select: () => ({ count }),
        sort: () => ({ skip: () => ({ limit }) }),
    }));
    const svc = Object.create(ProductService.prototype) as ProductService;
    (svc as any).usersService = { ValidateUser: jest.fn().mockResolvedValue({ _id: 'u1' }) };
    (svc as any).ProductActivityLog = { find };
    return { svc, find };
};

describe('getActivityStatus', () => {
    it('answers 0 for a part with no id, without querying - no CastError', async () => {
        const { svc, find } = serviceWith();
        for (const partId of ['', undefined, null, 'not-an-id']) {
            await expect(svc.getActivityStatus({ partId }, 'u1')).resolves.toEqual(expect.objectContaining({ data: 0 }));
        }
        await expect(svc.getActivityStatus(undefined, 'u1')).resolves.toEqual(expect.objectContaining({ data: 0 }));
        expect(find).not.toHaveBeenCalled();
    });

    it('still counts the activity of a real part', async () => {
        const { svc, find } = serviceWith();
        await expect(svc.getActivityStatus({ partId: ID }, 'u1')).resolves.toEqual(expect.objectContaining({ data: 3 }));
        expect(find).toHaveBeenCalledWith({ partId: ID });
    });
});

describe('getActivitylist', () => {
    const page = (id: unknown) => ({ id, paginator: { nextPage: 1, pageSize: 10 } });

    it('answers an empty first page for a part with no id, without querying', async () => {
        const { svc, find } = serviceWith();
        const out: any = await svc.getActivitylist(page(''), 'u1');
        expect(find).not.toHaveBeenCalled();
        expect(out.data.list).toEqual([]);
        expect(out.data.paginator).toEqual({ pageSize: 10, pageNumber: 2, totalPages: 2, nextPage: 0, previousPage: 0 });
    });

    it('still queries for a real part', async () => {
        const { svc, find } = serviceWith();
        await svc.getActivitylist(page(ID), 'u1');
        expect(find).toHaveBeenCalledWith(expect.objectContaining({ partId: ID }));
    });
});
