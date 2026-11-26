import type { ReactNode } from 'react'
import { LogoMark } from './ui/Icon'
import { Link } from './ui/Link'

const LAST_UPDATED = '26 November 2026'
const CONTACT = 'info@genmars.co.ke'

function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="lg-page">
      <header className="lg-bar">
        <Link to="/" className="ml-brand" aria-label="Genmars Meetings">
          <LogoMark size={30} />
          <span className="ml-word">
            GENMARS <span>Meetings</span>
          </span>
        </Link>
        <nav className="lg-nav" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </header>
      <article className="lg-doc">
        <h1>{title}</h1>
        <p className="lg-intro">{intro}</p>
        <p className="lg-meta">Last updated {LAST_UPDATED}</p>
        {children}
      </article>
      <LegalFooter />
    </div>
  )
}

export function LegalFooter() {
  return (
    <footer className="lg-foot">
      <span>© {new Date().getFullYear()} Genmars Tech</span>
      <Link to="/privacy">Privacy policy</Link>
      <Link to="/terms">Terms of service</Link>
      <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
    </footer>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" intro="How Genmars Meetings uses your information, including the data it gets from your Google account.">
      <h2>Who we are</h2>
      <p>
        Genmars Meetings (meetings.genmars.co.ke) is the internal meetings tool of Genmars Tech, a software company in Nairobi, Kenya. The
        Genmars team uses it to schedule meetings, join them on Google Meet and keep a record of what was decided. Genmars Tech is
        responsible for the data described here, and we handle it in line with Kenya’s Data Protection Act, 2019.
      </p>

      <h2>Who uses it</h2>
      <p>
        Only signed-in members of the Genmars team can open Genmars Meetings. People we invite to a meeting from outside Genmars (guests)
        join through Google Meet. They don’t get an account here and can’t see our meeting records.
      </p>

      <h2>Information we keep</h2>
      <ul>
        <li><strong>Team accounts:</strong> name and work email, from the Genmars sign-in.</li>
        <li>
          <strong>Meeting details we enter:</strong> title, time, agenda, notes, discussion points, problems, decisions and action items,
          and who was invited.
        </li>
        <li><strong>Guests:</strong> the email address (and name, if given) of people invited to a meeting, so they can receive the invite.</li>
        <li><strong>From Google:</strong> the items listed in the next section, and nothing else.</li>
      </ul>

      <h2>What we access in your Google account, and why</h2>
      <p>
        An owner of the Genmars team connects one company Google account. Genmars Meetings then uses Google’s APIs for these purposes only:
      </p>
      <ul>
        <li>
          <strong>Your email address</strong> (scopes <code>openid</code>, <code>userinfo.email</code>). We use it to show which Google account is
          connected.
        </li>
        <li>
          <strong>Google Calendar events</strong> (scope <code>calendar.events</code>). When the team schedules a meeting, we create a Calendar event
          with a Google Meet link and send the invitations. We update or cancel that event if the meeting changes, and read it back to get the Meet
          link and who has accepted. We don’t read, change or delete other events in your calendar.
        </li>
        <li>
          <strong>Google Meet meeting spaces</strong> (scope <code>meetings.space.created</code>). We create a Meet link when someone starts an
          instant meeting.
        </li>
        <li>
          <strong>Google Meet meeting records</strong> (scope <code>meetings.space.readonly</code>). This applies only to meetings created through
          Genmars Meetings. After a meeting ends, we read when it started and ended, who joined and for how long, the transcript (if someone
          turned on transcription in Meet), and the link to the recording (if someone recorded it). We copy the transcript text and these details
          into the meeting’s record. We store the recording’s link, not the recording itself.
        </li>
      </ul>
      <p>
        We never turn on recording or transcription ourselves. Participants do that in Google Meet, and Meet shows everyone in the call that it
        is on.
      </p>

      <h2>Limited Use of Google data</h2>
      <p>
        Genmars Meetings’ use and transfer to any other app of information received from Google APIs will adhere to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. In particular:
      </p>
      <ul>
        <li>We use Google data only to provide the meeting features described above.</li>
        <li>We don’t sell it, and we don’t use it for advertising.</li>
        <li>We don’t use it to train artificial intelligence or machine-learning models.</li>
        <li>
          People read it only when the Genmars team works with a meeting record, when needed for security or to fix a problem, or when the law
          requires it.
        </li>
        <li>We don’t give it to anyone else, except the service providers below, who host it for us.</li>
      </ul>

      <h2>Where it is stored and how it is protected</h2>
      <p>
        Meeting records are stored in Genmars Tech’s own database, on a server we run. The website itself is hosted by Vercel. All traffic uses
        HTTPS. The Google sign-in tokens that let us act for the connected account are encrypted in our database and never sent to the browser.
        Only Genmars team members can reach meeting records.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Google tokens:</strong> until an owner presses Disconnect. That deletes them from our database and revokes them with Google
          straight away.
        </li>
        <li>
          <strong>Meeting records:</strong> including any copied transcripts and attendance. These are kept as Genmars Tech company records for as
          long as they’re useful to the team, and deleted on request (see below).
        </li>
        <li><strong>Guest details:</strong> kept with the meeting they were invited to, and deleted with it or on request.</li>
      </ul>

      <h2>Removing access and deleting data</h2>
      <ul>
        <li>
          To stop Genmars Meetings using a Google account, an owner can press <strong>Disconnect</strong> on the Google Meet page in Genmars Meetings.
          Anyone can also remove access at{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>
          To have a meeting record, transcript or your guest details deleted, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We delete it within
          30 days and confirm when it’s done.
        </li>
        <li>
          You can also ask what we hold about you, or ask us to correct it. Under Kenyan law you may complain to the Office of the Data Protection
          Commissioner.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>If we change how we use Google data, we’ll update this page first and change the date at the top.</p>

      <h2>Contact</h2>
      <p>
        Genmars Tech, Nairobi, Kenya · <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of service" intro="The rules for using Genmars Meetings.">
      <h2>What Genmars Meetings is</h2>
      <p>
        Genmars Meetings is an internal tool of Genmars Tech for scheduling, running and recording company meetings. The meetings themselves
        happen on Google Meet. By using Genmars Meetings you agree to these terms and to our <Link to="/privacy">privacy policy</Link>.
      </p>

      <h2>Who may use it</h2>
      <p>
        Only Genmars team members with an active Genmars account. Guests take part in meetings through Google Meet and don’t use this site.
        Google Meet and Google Calendar are also covered by Google’s own terms.
      </p>

      <h2>Using it properly</h2>
      <ul>
        <li>Keep your sign-in to yourself, and sign out on shared computers.</li>
        <li>Only invite people who need to be in the meeting, and only add records that belong to Genmars work.</li>
        <li>
          Tell participants before you record or transcribe a meeting. Don’t record anyone who hasn’t been told, and follow the law and Google
          Workspace rules on recording.
        </li>
        <li>Don’t try to reach records or data you aren’t meant to see, or interfere with how the service works.</li>
      </ul>

      <h2>Meeting records</h2>
      <p>
        Agendas, notes, decisions, action items and transcripts are Genmars Tech company records. A decision counts as approved only after an
        organizer or owner approves it in Genmars Meetings. Suggestions and proposals made in a meeting aren’t decisions.
      </p>

      <h2>Google connection</h2>
      <p>
        Only an owner can connect or disconnect the company Google account. Disconnecting stops new Meet links, invitations and syncing straight
        away. Records already saved stay in Genmars Meetings until deleted.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Genmars Meetings running, but it depends on our own server and on Google’s services. It may sometimes be unavailable,
        for example during updates. Keep anything critical in more than one place.
      </p>

      <h2>Changes and ending access</h2>
      <p>
        We may update these terms. When we do, we’ll change the date at the top. Access ends when your Genmars account is switched off.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of Kenya. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </LegalPage>
  )
}
