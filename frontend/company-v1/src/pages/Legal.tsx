import type { ReactNode } from 'react'
import { CONTACT_EMAIL, company } from '../data/site'
import './Legal.css'

// Draft wording: have a lawyer review both pages before relying on them.
const LAST_UPDATED = '25 November 2026'

function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="wrap lg">
      <header className="lg-head">
        <span className="eyebrow eyebrow--line">Legal</span>
        <h1>{title}</h1>
        <p className="lead">{intro}</p>
        <p className="lg-meta">
          Last updated {LAST_UPDATED} · <span className="lg-draft">Draft, under legal review</span>
        </p>
      </header>
      <div className="lg-body">{children}</div>
    </article>
  )
}

const who = company.legalName || 'Genmars Tech'

export function Privacy() {
  return (
    <LegalPage title="Privacy policy" intro={`How ${who} collects, uses and protects your personal data.`}>
      <h2>Who we are</h2>
      <p>
        {who} is a software company based in {company.city}. We are the data controller for personal data collected
        through this website and our client portal. We handle personal data in line with Kenya’s Data Protection Act,
        2019.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Details you give us: your name, email, phone number, company and what you tell us about your project.</li>
        <li>Account details if you sign up: your login email and an encrypted (hashed) password.</li>
        <li>Project records: messages, files and links, milestones and invoices related to work we do for you.</li>
        <li>Basic technical data: your IP address when you send a form, used to prevent spam and abuse.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To reply to enquiries, prepare quotes and deliver the work you ask for (performing a contract).</li>
        <li>To run your client account, send project updates and invoices (performing a contract).</li>
        <li>To keep our services secure and prevent misuse (legitimate interest).</li>
        <li>To meet tax and accounting obligations (legal obligation).</li>
      </ul>
      <p>We don’t sell your data, and we don’t use it for advertising.</p>
      <h2>Who we share it with</h2>
      <p>
        Only with service providers that help us run our business, such as our hosting provider, email delivery service
        and payment providers, and only as needed. They must keep your data secure and use it only on our instructions.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Enquiries that don’t become projects are deleted after 24 months. Client and invoice records are kept for as
        long as the law requires for tax purposes, then deleted.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal data, object to how we use it, or ask us to move it to
        another provider. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we’ll respond within 30
        days. You can also complain to the Office of the Data Protection Commissioner.
      </p>
      <h2>Security</h2>
      <p>
        Data is sent over HTTPS, passwords are hashed, and access to client records is limited to the Genmars team
        working on your project.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms of service" intro={`The terms for using this website and working with ${who}.`}>
      <h2>Using this website</h2>
      <p>
        You may use this website to learn about our services, contact us and use your client account. Don’t misuse it,
        try to break its security or use it for anything unlawful.
      </p>
      <h2>Quotes and projects</h2>
      <p>
        Prices on this website are starting points. Each project is governed by a written quote or proposal that sets
        out the scope, timeline, price and payment milestones. If these terms and a signed proposal disagree, the
        proposal wins.
      </p>
      <h2>Payments</h2>
      <p>
        Invoices are payable by the due date shown, by M-Pesa, bank transfer or card. Work may pause while an invoice is
        overdue.
      </p>
      <h2>Ownership</h2>
      <p>
        Once you have paid in full, you own the code, designs and content we create for you. We may reuse general tools
        and know-how that aren’t specific to your project.
      </p>
      <h2>Client accounts</h2>
      <p>
        Keep your login details private and tell us straight away if you think someone else has used your account.
        You’re responsible for what happens under your account.
      </p>
      <h2>Liability</h2>
      <p>
        We take care to deliver working, secure software, but we can’t guarantee the website or portal will always be
        available or error-free. Our total liability for any claim is limited to the fees paid for the project
        concerned.
      </p>
      <h2>Changes and law</h2>
      <p>
        We may update these terms and will change the date above when we do. These terms are governed by the laws of
        Kenya.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
