import { useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '../auth/session'
import { Icon } from '../components/Icon'
import { navigate } from '../router'
import { MOD_KEY, OPEN_EVENT } from './paletteKeys'
import type { SearchResult } from './types'

type Item = { key: string; group: string; title: string; subtitle?: string; url: string; hint?: string }

// "g" then a letter jumps to a page, like Gmail and Linear.
const PAGES: { key: string; title: string; url: string }[] = [
  { key: 't', title: 'Today', url: '/team' },
  { key: 'w', title: 'My work', url: '/team/work' },
  { key: 'e', title: 'Meetings', url: '/team/meetings' },
  { key: 'c', title: 'Clients', url: '/team/clients' },
  { key: 'p', title: 'Projects', url: '/team/projects' },
  { key: 'l', title: 'Leads', url: '/team/leads' },
  { key: 'o', title: 'Pipeline', url: '/team/pipeline' },
  { key: 'h', title: 'Time & profit', url: '/team/time' },
  { key: 'f', title: 'Finance', url: '/team/finance' },
  { key: 'i', title: 'Invoices', url: '/team/invoices' },
  { key: 'm', title: 'Messages', url: '/team/messages' },
  { key: 'b', title: 'Brand kit', url: '/team/brand' },
]

const ACTIONS: { title: string; url: string; hint?: string }[] = [
  { title: 'New task', url: '/team/work?new=1', hint: 'N' },
  { title: 'Log time', url: '/team/time' },
  { title: 'Schedule a meeting', url: '/team/meetings?new=1' },
  { title: 'New project', url: '/team/projects?new=1' },
  { title: 'New invoice', url: '/team/invoices?new=1' },
  { title: 'Orders needing a quote', url: '/team/orders?view=needs_quote' },
]

const KIND_GROUP: Record<SearchResult['kind'], string> = {
  client: 'Clients',
  project: 'Projects',
  invoice: 'Invoices',
  lead: 'Leads',
  order: 'Orders',
  task: 'Tasks',
  meeting: 'Meetings',
}


function typingIn(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}


/** Search everything and jump anywhere. Ctrl/⌘ K or / to open; g + letter to jump; ? for the list. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const show = (withHelp = false) => {
    returnFocus.current = document.activeElement as HTMLElement | null
    setHelp(withHelp)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setQ('')
    setResults([])
    returnFocus.current?.focus?.()
  }

  // global keys
  useEffect(() => {
    let gPressed = 0
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) close()
        else show()
        return
      }
      if (open || typingIn(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        show()
      } else if (e.key === '?') {
        e.preventDefault()
        show(true)
      } else if (e.key === 'n' || e.key === 'N') {
        navigate('/team/work?new=1')
      } else if (e.key === 'g') {
        gPressed = Date.now()
      } else if (Date.now() - gPressed < 1200) {
        const page = PAGES.find((p) => p.key === e.key.toLowerCase())
        gPressed = 0
        if (page) {
          e.preventDefault()
          navigate(page.url)
        }
      }
    }
    const onOpen = () => show()
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [open])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // search as you type, after a short pause
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const res = await authFetch(`/api/v1/team/search/?q=${encodeURIComponent(term)}`)
        const json = res.ok ? ((await res.json()) as SearchResult[]) : []
        if (!cancelled) {
          setResults(json)
          setActive(0)
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q])

  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (s: string) => !term || s.toLowerCase().includes(term)
    const found = results.map((r) => ({ key: `${r.kind}-${r.id}`, group: KIND_GROUP[r.kind], title: r.title, subtitle: r.subtitle, url: r.url }))
    const actions = ACTIONS.filter((a) => match(a.title)).map((a) => ({ key: `a-${a.title}`, group: 'Actions', title: a.title, url: a.url, hint: a.hint }))
    const pages = PAGES.filter((p) => match(p.title)).map((p) => ({ key: `p-${p.key}`, group: 'Go to', title: p.title, url: p.url, hint: `G ${p.key.toUpperCase()}` }))
    return term ? [...found, ...actions, ...pages] : [...actions, ...pages]
  }, [q, results])

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const go = (item: Item | undefined) => {
    if (!item) return
    close()
    navigate(item.url)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(items[active])
    }
  }

  let lastGroup = ''
  return (
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cp" role="dialog" aria-modal="true" aria-label="Search and go" onKeyDown={onKeyDown}>
        <div className="cp-input">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              const value = e.target.value
              setQ(value)
              setHelp(false)
              setActive(0)
              const searching = value.trim().length >= 2
              setLoading(searching)
              if (!searching) setResults([])
            }}
            placeholder="Search clients, projects, invoices, leads, tasks…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
            aria-activedescendant={items[active] ? `cp-${items[active].key}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
          />
          {loading && <span className="cp-spin" aria-label="Searching" />}
          <kbd>Esc</kbd>
        </div>

        {help ? (
          <Shortcuts />
        ) : (
          <ul className="cp-list" id="cp-list" role="listbox" ref={list}>
            {q.trim().length >= 2 && !loading && results.length === 0 && <li className="cp-none">Nothing matches “{q.trim()}”.</li>}
            {items.map((item, i) => {
              const heading = item.group !== lastGroup ? item.group : null
              lastGroup = item.group
              return (
                <li key={item.key} role="presentation">
                  {heading && <div className="cp-group">{heading}</div>}
                  <div
                    id={`cp-${item.key}`}
                    role="option"
                    aria-selected={i === active}
                    className="cp-item"
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => go(item)}
                  >
                    <span className="cp-text">
                      <strong>{item.title}</strong>
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </span>
                    {item.hint && <kbd>{item.hint}</kbd>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="cp-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open
          </span>
          <button type="button" className="tm-link-btn" onClick={() => setHelp((h) => !h)}>
            {help ? 'Back to search' : 'Keyboard shortcuts'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Shortcuts() {
  const rows: [string[], string][] = [
    [[MOD_KEY, 'K'], 'Search and go anywhere'],
    [['/'], 'Search'],
    [['N'], 'New task'],
    [['?'], 'This list'],
    ...PAGES.map((p): [string[], string] => [['G', p.key.toUpperCase()], p.title]),
  ]
  return (
    <dl className="cp-keys">
      {rows.map(([keys, label]) => (
        <div key={label}>
          <dt>
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </dt>
          <dd>{label}</dd>
        </div>
      ))}
    </dl>
  )
}
