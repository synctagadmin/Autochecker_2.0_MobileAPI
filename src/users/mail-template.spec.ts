import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { inline } from 'css-inline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The empty forgot-password email.
 *
 * Reported 2026-10-30 and reproduced on the production box by curling the endpoint:
 * subject present, body blank, and the service logging "Email sent sucessfully". The
 * template was present and valid and the context complete, so none of the obvious
 * causes applied.
 *
 * The adapter runs every rendered template through css-inline, which downloads any
 * <link rel=stylesheet> it finds - confirmation.hbs links bootstrap and two Google
 * Fonts sheets. On a box that cannot reach them the call throws, and the adapter
 * catches it with an EMPTY catch:
 *
 *     try { mail.data.html = inline(rendered, this.config.inlineCssOptions); }
 *     catch (e) { }
 *     return callback();
 *
 * so `html` is never assigned and the mail goes out with no body, reported as success.
 * One network call per email is also why it looked intermittent, and why staging - which
 * can reach the CDNs - was fine throughout.
 */

/** A stylesheet host that cannot resolve, standing in for blocked egress. */
const UNREACHABLE = 'https://cdn.blocked-host.invalid/x.css';

describe('css-inline, which is what blanked the body', () => {
  const html = `<html><head><link rel="stylesheet" href="${UNREACHABLE}"></head>`
    + '<body><p>Dear Thenilavan,</p></body></html>';

  it('throws when it cannot fetch a remote stylesheet', () => {
    expect(() => inline(html)).toThrow();
  });

  it('succeeds, and keeps the body, once remote loading is off', () => {
    const out = inline(html, { load_remote_stylesheets: false });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('Dear Thenilavan,');
  });
});

describe('the adapter as users.module configures it', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtpl-'));
    // A template that links a stylesheet nothing can fetch - the production case.
    fs.writeFileSync(
      path.join(dir, 'confirmation.hbs'),
      `<html><head><link rel="stylesheet" href="${UNREACHABLE}"></head>`
      + '<body><p>Dear {{name}},</p><p>{{Username}}</p><p>{{Password}}</p></body></html>',
    );
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const render = (adapter: HandlebarsAdapter) => {
    const mail: any = {
      data: {
        template: './confirmation',
        context: { name: 'Thenilavan', Username: 'a@b.com', Password: 'x' },
      },
      message: {},
    };
    adapter.compile(mail, () => undefined, {
      template: { dir, adapter, options: { strict: true } },
    } as any);
    return mail.data.html;
  };

  /** The configuration this module ships. The body must survive a blocked CDN. */
  it('produces a body even when the stylesheet cannot be fetched', () => {
    const html = render(new HandlebarsAdapter(undefined, {
      inlineCssOptions: { load_remote_stylesheets: false },
    }));
    expect(html).toBeTruthy();
    expect(html).toContain('Dear Thenilavan,');
    expect(html).toContain('a@b.com');
  });

  /**
   * The default, and the bug: html is never assigned and the caller is told nothing.
   * If this ever stops being true the option above has become unnecessary - but until
   * then, removing it brings the empty emails straight back.
   */
  it('leaves the body undefined on the default settings', () => {
    expect(render(new HandlebarsAdapter())).toBeUndefined();
  });
});
