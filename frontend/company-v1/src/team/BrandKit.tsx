import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { TeamLayout } from '../portal/PortalLayout'
import { AuthImg, DownloadLink } from './brandFiles'
import './BrandKit.css'

const logos = [
  { name: 'Full logo', file: 'genmars-logo', bg: 'light', use: 'Default. Websites, documents, light backgrounds.' },
  { name: 'Full logo, white', file: 'genmars-logo-white', bg: 'dark', use: 'Dark or photo backgrounds.' },
  { name: 'Stacked logo', file: 'genmars-logo-stacked', bg: 'light', use: 'Square spaces: posters, merchandise.' },
  { name: 'Stacked logo, white', file: 'genmars-logo-stacked-white', bg: 'dark', use: 'Square spaces on dark backgrounds.' },
  { name: 'Mark', file: 'genmars-mark', bg: 'light', use: 'App icons, favicons, small spaces.' },
  { name: 'Mark, white', file: 'genmars-mark-white', bg: 'cobalt', use: 'On the brand blue or dark colours.' },
  { name: 'Logo, black', file: 'genmars-logo-black', bg: 'light', use: 'One-colour printing only.' },
  { name: 'Mark, black', file: 'genmars-mark-black', bg: 'light', use: 'Stamps, embossing, one-colour print.' },
]

const colours = [
  { name: 'Cobalt', hex: '#2F5BF5', rgb: '47, 91, 245', role: 'Primary. Buttons, links, the mark.' },
  { name: 'Ink', hex: '#0B1530', rgb: '11, 21, 48', role: 'Headings and the wordmark.' },
  { name: 'Slate', hex: '#33415E', rgb: '51, 65, 94', role: 'Body text.' },
  { name: 'Muted', hex: '#55627D', rgb: '85, 98, 125', role: 'Secondary text and captions.' },
  { name: 'Mist', hex: '#F5F8FF', rgb: '245, 248, 255', role: 'Page background.' },
  { name: 'White', hex: '#FFFFFF', rgb: '255, 255, 255', role: 'Cards and panels.' },
  { name: 'Signal', hex: '#0F9D88', rgb: '15, 157, 136', role: 'Success and confirmations only.' },
  { name: 'Midnight', hex: '#05070D', rgb: '5, 7, 13', role: 'Dark backgrounds, product previews.' },
  { name: 'Ice', hex: '#8EA6FF', rgb: '142, 166, 255', role: 'Accent on dark backgrounds.' },
]

const social = [
  { name: 'Profile picture, blue', file: 'profile-cobalt-1080', size: '1080 × 1080', where: 'All platforms' },
  { name: 'Profile picture, white', file: 'profile-white-1080', size: '1080 × 1080', where: 'All platforms' },
  { name: 'LinkedIn banner', file: 'linkedin-banner-1584x396', size: '1584 × 396', where: 'LinkedIn profile' },
  { name: 'LinkedIn company cover', file: 'linkedin-company-cover-1128x191', size: '1128 × 191', where: 'LinkedIn page' },
  { name: 'X header', file: 'x-header-1500x500', size: '1500 × 500', where: 'X (Twitter)' },
  { name: 'Facebook cover', file: 'facebook-cover-1640x624', size: '1640 × 624', where: 'Facebook page' },
  { name: 'Instagram post', file: 'instagram-post-1080', size: '1080 × 1080', where: 'Instagram, WhatsApp status' },
  { name: 'Instagram story', file: 'instagram-story-1080x1920', size: '1080 × 1920', where: 'Stories and reels covers' },
  { name: 'Link preview', file: 'og-image-1200x630', size: '1200 × 630', where: 'Shared links' },
]

const type = [
  { label: 'Display', sample: 'Websites that just work.', css: 'bk-t-display', spec: 'Geist Bold · 36–64px · -4% tracking' },
  { label: 'Heading', sample: 'What we do', css: 'bk-t-h2', spec: 'Geist Bold · 30–46px · -3.5% tracking' },
  { label: 'Lead', sample: 'Plain words that tell people what we do.', css: 'bk-t-lead', spec: 'Geist Regular · 17–20px · 1.55 line height' },
  { label: 'Body', sample: 'A fixed price, agreed before we start.', css: 'bk-t-body', spec: 'Geist Regular · 16px · 1.55 line height' },
  { label: 'Small', sample: 'From KES 20,000', css: 'bk-t-small', spec: 'Geist Medium · 13–14px' },
]

const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96]

export function BrandKit() {
  return (
    <TeamLayout title="Brand kit" subtitle="Logos, colours, fonts and social images for the team. Not shared on the public site.">
    <div className="bk">
      <div className="bk-actions">
        <DownloadLink className="btn" path="genmars-brand-kit.zip">
          Download everything (.zip)
        </DownloadLink>
        <DownloadLink className="btn btn--ghost" path="genmars-brand-guidelines.pdf">
          Guidelines (PDF)
        </DownloadLink>
      </div>

      <Section id="logo" title="Logo" intro="Use the full logo wherever there’s room, and the mark on its own for small spaces.">
        <div className="bk-logos">
          {logos.map((l) => (
            <article key={l.file} className="card bk-logo">
              <div className={`bk-logo-preview bk-bg-${l.bg}`}>
                <AuthImg path={`logos/${l.file}.svg`} alt={l.name} />
              </div>
              <div className="bk-logo-meta">
                <h3>{l.name}</h3>
                <p className="muted">{l.use}</p>
                <div className="bk-dl">
                  <DownloadLink path={`logos/${l.file}.svg`}>
                    SVG
                  </DownloadLink>
                  <DownloadLink path={`logos/${l.file}.png`}>
                    PNG
                  </DownloadLink>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="bk-rules">
          <div className="card bk-rule">
            <h3>Clear space</h3>
            <div className="bk-clear">
              <AuthImg path={`logos/genmars-logo.svg`} alt="" />
            </div>
            <p className="muted">Keep empty space around the logo at least half the height of the mark on every side.</p>
          </div>
          <div className="card bk-rule">
            <h3>Minimum size</h3>
            <div className="bk-min">
              <AuthImg path={`logos/genmars-logo.svg`} alt="" style={{ height: 24 }} />
              <AuthImg path={`logos/genmars-mark.svg`} alt="" style={{ height: 20 }} />
            </div>
            <p className="muted">Full logo at least 120px (30mm) wide. The mark on its own at least 20px (5mm).</p>
          </div>
          <div className="card bk-rule">
            <h3>Please don’t</h3>
            <ul className="bk-donts">
              <li>Change the colours or add gradients</li>
              <li>Stretch, squash or rotate it</li>
              <li>Add shadows, outlines or glows</li>
              <li>Put it on busy photos without a calm area</li>
              <li>Retype the wordmark in another font</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="colour" title="Colour" intro="Mostly white and mist with ink text. Cobalt is for the things people should click. Click a swatch to copy its code.">
        <div className="bk-colours">
          {colours.map((c) => (
            <Swatch key={c.hex} {...c} />
          ))}
        </div>
      </Section>

      <Section id="type" title="Typography" intro="Geist for everything, with one Instrument Serif italic phrase per headline for warmth. Both are free, open-licence fonts.">
        <div className="card bk-type">
          {type.map((t) => (
            <div key={t.label} className="bk-type-row">
              <span className="bk-type-label">{t.label}</span>
              <span className={t.css}>
                {t.label === 'Display' ? (
                  <>
                    Websites that <span className="serif">just work.</span>
                  </>
                ) : (
                  t.sample
                )}
              </span>
              <span className="bk-type-spec">{t.spec}</span>
            </div>
          ))}
        </div>
        <div className="bk-fonts">
          <FontCard name="Geist" use="Headings, body and interface" files={['Geist-Regular', 'Geist-Medium', 'Geist-SemiBold', 'Geist-Bold']} licence="OFL-Geist.txt" />
          <FontCard name="Instrument Serif Italic" use="One accent phrase per headline" files={['InstrumentSerif-Italic', 'InstrumentSerif-Regular']} licence="OFL-InstrumentSerif.txt" serif />
          <FontCard name="Geist Mono" use="Numbers, codes and data" files={['GeistMono-Regular', 'GeistMono-Medium']} licence="OFL-Geist.txt" mono />
        </div>
      </Section>

      <Section id="layout" title="Spacing and shape" intro="Space comes from one scale, so layouts feel calm and consistent. Corners are rounded, never sharp.">
        <div className="bk-two">
          <div className="card bk-spacing">
            {spacing.map((s) => (
              <div key={s} className="bk-space-row">
                <span className="bk-space-bar" style={{ width: s * 2 }} />
                <span>{s}px</span>
              </div>
            ))}
          </div>
          <div className="card bk-radii">
            {[
              ['12px', 'Inputs, small tiles', 12],
              ['20px', 'Cards', 20],
              ['28px', 'Large panels, photos', 28],
              ['Pill', 'Buttons, tags', 999],
            ].map(([label, use, r]) => (
              <div key={label as string} className="bk-radius">
                <span className="bk-radius-box" style={{ borderRadius: r as number }} />
                <strong>{label}</strong>
                <span className="muted">{use}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card bk-buttons">
          <button type="button" className="btn">
            Get a free quote <Icon name="arrow" size={18} />
          </button>
          <button type="button" className="btn btn--ghost">
            See services &amp; prices
          </button>
          <a className="text-link" href="#layout">
            Text link
          </a>
          <p className="muted">One blue button per view for the main action. Everything else is a white button or a link.</p>
        </div>
      </Section>

      <Section id="voice" title="Voice" intro="Write like a helpful person, not a brochure.">
        <div className="bk-two">
          <div className="card bk-voice bk-voice--do">
            <h3>Do</h3>
            <ul>
              <li>Say what it is, what it costs and how long it takes.</li>
              <li>Write “businesses”, not just one country’s businesses.</li>
              <li>Show prices in KES, with “from” for starting prices.</li>
              <li>Use short sentences and everyday words.</li>
            </ul>
          </div>
          <div className="card bk-voice bk-voice--dont">
            <h3>Avoid</h3>
            <ul>
              <li>Buzzwords like “synergy”, “cutting-edge”, “revolutionary”.</li>
              <li>Claims we can’t back up with real projects or numbers.</li>
              <li>More than one serif-italic phrase in a headline.</li>
              <li>Exclamation marks in headlines.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="social" title="Social media" intro="Sized for each platform, with the important parts kept clear of profile photos and cropping.">
        <div className="bk-social">
          {social.map((s) => (
            <article key={s.file} className="card bk-social-item">
              <DownloadLink className="bk-social-preview" path={`social/${s.file}.png`}>
                <AuthImg path={`social/${s.file}.png`} alt={`${s.name} preview`} loading="lazy" />
              </DownloadLink>
              <div className="bk-social-meta">
                <span>
                  <strong>{s.name}</strong>
                  <span className="muted">
                    {s.size} · {s.where}
                  </span>
                </span>
                <DownloadLink className="btn btn--sm btn--ghost" path={`social/${s.file}.png`}>
                  Download
                </DownloadLink>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </div>
    </TeamLayout>
  )
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section id={id} className="bk-section">
      <div className="bk-head">
        <h2 className="h2">{title}</h2>
        <p className="muted">{intro}</p>
      </div>
      {children}
    </section>
  )
}

function Swatch({ name, hex, rgb, role }: { name: string; hex: string; rgb: string; role: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the code is still visible to copy by hand
    }
  }
  return (
    <button type="button" className="card bk-swatch" onClick={copy} aria-label={`Copy ${name} ${hex}`}>
      <span className="bk-chip" style={{ background: hex }} />
      <span className="bk-swatch-text">
        <strong>{name}</strong>
        <span className="bk-code">{copied ? 'Copied' : hex}</span>
        <span className="bk-code">RGB {rgb}</span>
        <span className="muted">{role}</span>
      </span>
    </button>
  )
}

function FontCard({ name, use, files, licence, serif, mono }: { name: string; use: string; files: string[]; licence: string; serif?: boolean; mono?: boolean }) {
  return (
    <article className="card bk-font">
      <span className={`bk-font-sample${serif ? ' serif' : ''}${mono ? ' bk-mono' : ''}`}>Aa</span>
      <h3>{name}</h3>
      <p className="muted">{use}</p>
      <div className="bk-dl">
        {files.map((f) => (
          <DownloadLink key={f} path={`fonts/${f}.ttf`}>
            {f.replace(/^.*-/, '')}
          </DownloadLink>
        ))}
        <DownloadLink path={`fonts/${licence}`}>
          Licence
        </DownloadLink>
      </div>
    </article>
  )
}
