import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './RotatingWords.css'

/**
 * Cycles through phrases in place. The box eases to each phrase's width, so a
 * centered heading stays centered. Screen readers get one stable sentence, and
 * reduced-motion users see the first phrase only.
 */
export function RotatingWords({ words, interval = 3200 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState<number | undefined>(undefined)
  const refs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval)
    return () => window.clearInterval(id)
  }, [words.length, interval])

  useLayoutEffect(() => {
    const measure = () => setWidth(refs.current[index]?.offsetWidth)
    measure()
    // fonts loading or the viewport resizing change the widths
    document.fonts?.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [index])

  const prev = (index - 1 + words.length) % words.length

  return (
    <span className="rw">
      <span className="sr-only">{words[0]}</span>
      <span className="rw-stack" aria-hidden="true" style={{ width }}>
        {words.map((w, i) => (
          <span
            key={w}
            ref={(el) => {
              refs.current[i] = el
            }}
            className={`rw-word${i === index ? ' is-on' : ''}${i === prev ? ' is-out' : ''}`}
          >
            {w}
          </span>
        ))}
      </span>
    </span>
  )
}
