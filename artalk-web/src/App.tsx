import { useEffect, useRef, useMemo } from 'react'
import './index.css'

declare global {
  interface Window {
    Artalk: {
      init: (config: {
        el: HTMLElement
        server: string
        site: string
        pageKey: string
        pageTitle: string
        locale: string
        darkMode: string
      }) => ArtalkInstance
    }
  }
}

interface ArtalkInstance {
  destroy: () => void
}

function parsePathParams() {
  const pathname = window.location.pathname.replace(/\/$/, '') // remove trailing slash
  // Match pattern: /{a}/{b}/post
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/post$/)
  if (match) {
    return {
      a: match[1],
      b: match[2],
      pageKey: pathname,
      pageTitle: match[2],
    }
  }
  return null
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const artalkRef = useRef<ArtalkInstance | null>(null)

  const params = useMemo(() => parsePathParams(), [])

  useEffect(() => {
    if (!params) return

    // Update document title
    document.title = `${params.pageTitle} - Feedback`

    // Load Artalk CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://artalk.zotero.store/dist/Artalk.css'
    document.head.appendChild(link)

    // Load Artalk JS
    const script = document.createElement('script')
    script.src = 'https://artalk.zotero.store/dist/Artalk.js'
    script.onload = () => {
      if (containerRef.current && !artalkRef.current) {
        artalkRef.current = window.Artalk.init({
          el: containerRef.current,
          server: 'https://artalk.zotero.store',
          site: 'Zotero Plugin Market',
          pageKey: params.pageKey,
          pageTitle: params.pageTitle,
          locale: 'zh-CN',
          darkMode: 'auto',
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      if (artalkRef.current) {
        artalkRef.current.destroy()
        artalkRef.current = null
      }
      link.remove()
      script.remove()
    }
  }, [params])

  if (!params) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Invalid URL
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <main className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {params.pageTitle}
            </h1>
          </div>
          <div
            ref={containerRef}
            className="artalk-container"
          />
        </div>
      </main>
    </div>
  )
}
