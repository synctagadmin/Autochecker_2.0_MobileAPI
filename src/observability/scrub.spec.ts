import { REDACTED, TRUNCATED, scrubDeep, scrubString } from './scrub';

/**
 * Nothing leaves this process with a credential or a customer in it.
 *
 * These are the rules that matter most in the whole exercise: an error report is sent to
 * a third party, and the most sensitive values here travel inside ordinary error TEXT
 * rather than in fields anyone would think to exclude. Mongoose puts the entire
 * connection URI - username and password - into the message of a connection failure,
 * which is both the most likely error to be reported and the most damaging to leak.
 */
describe('scrubString', () => {
  it('redacts a Mongo URI but keeps the shape', () => {
    const out = scrubString('failed to connect to mongodb+srv://user:hunter2@cluster.mongodb.net/db');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('user:');
    // "a Mongo connection failed" is the diagnosis, and it must survive.
    expect(out).toContain('mongodb+srv://');
  });

  it('redacts a plain mongodb:// URI too', () => {
    expect(scrubString('mongodb://admin:p%40ss@host:27017/x')).not.toContain('p%40ss');
  });

  /** The JWT this service issues IS the user's session. */
  it('redacts a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(scrubString(`token ${jwt}`)).not.toContain(jwt);
  });

  /** eBay tokens have an unmistakable prefix, and are enough to act as the seller. */
  it('redacts an eBay OAuth token', () => {
    const t = 'v^1.1#i^1#r^1#I^3#f^0#p^3#t^Ul4xMF83OkI3NTAzRTAyNkE4NjVGMDQ0Qzg1OEY5M0VDNURDQkIy';
    expect(scrubString(`refused: ${t}`)).not.toContain('Ul4xMF83');
  });

  it('keeps the auth scheme while losing the value', () => {
    const out = scrubString('Authorization: Bearer abcdefghijklmnop123456');
    expect(out).toContain('Bearer');
    expect(out).not.toContain('abcdefghijklmnop123456');
  });

  /** JSON is the ordinary shape in a Node service, not just `key=value`. */
  it('redacts a secret written as JSON', () => {
    expect(scrubString('{"password": "hunter2"}')).not.toContain('hunter2');
    expect(scrubString('{"apiKey":"abc123xyz"}')).not.toContain('abc123xyz');
  });

  it('redacts an Azure AccountKey while keeping the account name', () => {
    const out = scrubString('AccountName=autochecker;AccountKey=Zm9vYmFyYmF6cXV4;');
    expect(out).not.toContain('Zm9vYmFyYmF6cXV4');
    // WHICH account was wrong is the one useful thing in a blob error.
    expect(out).toContain('AccountName=autochecker');
  });

  it('redacts a private key block whole, header included', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow==\n-----END RSA PRIVATE KEY-----';
    const out = scrubString(`boom ${pem}`);
    expect(out).not.toContain('MIIEow');
    expect(out).not.toContain('BEGIN RSA PRIVATE KEY');
  });

  it('replaces an encrypted body rather than dropping it', () => {
    const envelope = 'A'.repeat(140);
    const out = scrubString(`payload ${envelope}`);
    expect(out).not.toContain(envelope);
    // That an encrypted body was involved is often the clue.
    expect(out).toContain('encrypted-body');
  });

  it('leaves ordinary text alone', () => {
    const plain = 'product MR990817 not found in box E9619';
    expect(scrubString(plain)).toBe(plain);
  });
});

describe('scrubDeep', () => {
  it('drops a secret-named value whatever it looks like', () => {
    // "hunter2" matches no pattern - the KEY is what condemns it.
    expect(scrubDeep({ password: 'hunter2' })).toEqual({ password: REDACTED });
  });

  /**
   * The customer. Not a secret in the credential sense, but nothing is diagnosed by
   * reading one - and this service answers a mobile app full of them.
   */
  it('drops customer details', () => {
    const out = scrubDeep({ email: 'a@b.com', phone: '555', street: '1 Test St' }) as Record<string, string>;
    expect(out).toEqual({ email: REDACTED, phone: REDACTED, street: REDACTED });
  });

  it('scrubs strings nested inside structures', () => {
    const out = scrubDeep({ err: { message: 'mongodb://u:p@h/db' } }) as any;
    expect(out.err.message).not.toContain(':p@');
  });

  /**
   * This runs inside an error path. If it does not return, nothing is reported and the
   * failure that triggered it is lost with it - so a self-referencing Mongoose document
   * must not hang it.
   */
  it('survives a cycle', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    expect(() => scrubDeep(a)).not.toThrow();
  });

  /** Anything NOT walked is anything NOT scrubbed, so it must not travel. */
  it('replaces a structure deeper than the cap instead of passing it through', () => {
    let deep: Record<string, unknown> = { secretish: 'mongodb://u:p@h/db' };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(JSON.stringify(scrubDeep(deep))).toContain(TRUNCATED);
  });

  it('leaves non-objects alone', () => {
    expect(scrubDeep(42)).toBe(42);
    expect(scrubDeep(null)).toBeNull();
    expect(scrubDeep(undefined)).toBeUndefined();
  });
});
