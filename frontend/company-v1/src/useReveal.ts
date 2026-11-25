import { useEffect } from 'react'

// Sections and cards that fade up as they scroll into view.
const REVEAL = [
  '.hm-glance li',
  '.hm-strip-inner',
  '.hm-head',
  '.hm-svc > *',
  '.hm-steps > li',
  '.hm-about-head',
  '.hm-principles > li',
  '.ts-section',
  '.sv-hero-copy',
  '.sv-hero-art',
  '.sv-tile',
  '.sv-row',
  '.sv-model',
  '.sv-faq-item',
  '.hw-copy',
  '.hw-step',
  '.hw-promise',
  '.cs-intro',
  '.cs-form',
  '.cs-sent',
].join(',')

/** Tag revealable elements on each page and fade them in once as they enter the viewport. */
export function useReveal(path: string) {
  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return

    const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )

    for (const el of elements) {
      if (el.dataset.reveal !== undefined) continue
      // stagger siblings in the same grid or list
      const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0
      el.dataset.reveal = ''
      el.style.setProperty('--reveal-i', String(Math.min(index, 6)))
      observer.observe(el)
    }
    root.classList.add('js-reveal')
    return () => observer.disconnect()
  }, [path])
}
