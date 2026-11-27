window.__ModuleLoader__.load({
  id: 'dsh-web-deepseek',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useLayoutEffect, useRef, useState } = React

    /** The real DeepSeek web chat: browser limits, the user's own account, no API tokens. */
    const SITE = 'https://chat.deepseek.com/'
    /** One storage account per process, shared by every open/close of this window. */
    const STORAGE = 'web-deepseek'
    /** Remembered window width, so a resized window survives reloads. */
    const WIDTH_KEY = 'web-deepseek:width'

    const STRINGS = {
      ru: {
        title: 'DeepSeek Web',
        open: 'Открыть DeepSeek Web',
        close: 'Закрыть',
        reload: 'Перезагрузить страницу',
        external: 'Открыть в системном браузере',
        resize: 'Потяните, чтобы изменить ширину. Двойной клик — по ширине панели.',
        loading: 'Загружаю страницу…',
        failed: 'Не удалось загрузить страницу',
        unsupported: 'Встроенное окно работает только в приложении Harness Desktop.',
        openExternal: 'Открыть в браузере',
      },
      en: {
        title: 'DeepSeek Web',
        open: 'Open DeepSeek Web',
        close: 'Close',
        reload: 'Reload the page',
        external: 'Open in the system browser',
        resize: 'Drag to change the width. Double-click for the sidebar width.',
        loading: 'Loading the page…',
        failed: 'The page failed to load',
        unsupported: 'The embedded window works only in the Harness Desktop app.',
        openExternal: 'Open in browser',
      },
    }

    /** The interface language, kept current by the plugin body. */
    let activeLanguage = ''
    /** Components subscribe here so a language change repaints visible text. */
    const languageListeners = new Set()
    const notifyLanguage = () => {
      for (const listener of languageListeners) listener()
    }

    const localeKey = () => {
      const tag = String(activeLanguage || (typeof document !== 'undefined' && document.documentElement.lang)
        || (typeof navigator !== 'undefined' && navigator.language) || 'en').toLowerCase()
      return tag.startsWith('ru') ? 'ru' : 'en'
    }
    const t = () => STRINGS[localeKey()]

    /** @returns a revision that changes whenever the interface language changes. */
    const useLanguageRevision = () => {
      const [revision, setRevision] = useState(0)
      useEffect(() => {
        const listener = () => setRevision((value) => value + 1)
        languageListeners.add(listener)
        return () => {
          languageListeners.delete(listener)
        }
      }, [])
      return revision
    }

    const clamp = (min, max, value) => Math.max(min, Math.min(max, value))

    const savedWidth = () => {
      try {
        const value = Number(localStorage.getItem(WIDTH_KEY))
        return Number.isFinite(value) && value >= 220 ? value : undefined
      } catch (error) {
        return undefined
      }
    }
    const rememberWidth = (value) => {
      try {
        if (value === undefined) localStorage.removeItem(WIDTH_KEY)
        else localStorage.setItem(WIDTH_KEY, String(Math.round(value)))
      } catch (error) {
        /* Storage can be unavailable; the window still works for this run. */
      }
    }

    const desktopBridge = () => {
      const carrier = globalThis.dshDesktop
      if (!carrier || carrier.protocolVersion !== 1) return undefined
      return carrier.browser
    }

    const openExternally = () => {
      window.open(SITE, '_blank', 'noopener')
    }

    const STYLE = `
      /* The footer seat is a flex row; give this row its own line above the balance. */
      [data-slot='sidebar.footer.action']{display:contents}
      :has(> [data-slot='sidebar.footer.action']){flex-wrap:wrap;align-content:flex-start}
      .wd-row{display:flex;align-items:center;width:100%;flex:0 0 100%;box-sizing:border-box;gap:8px;
        min-height:32px;padding:0 10px;margin:0 0 2px 0;border:1px solid transparent;border-radius:8px;
        background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;overflow:hidden;text-align:left}
      .wd-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .wd-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-alias-border-selected);outline-offset:-1px}
      .wd-row[data-open='true']{background:var(--dsw-alias-interactive-bg-hover)}
      .wd-row-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      .wd-row[data-wide='false']{width:auto;flex:0 0 auto;flex-direction:column;justify-content:center;gap:2px;
        min-height:40px;padding:4px 6px}
      .wd-panel{position:fixed;z-index:60;display:flex;flex-direction:column;overflow:hidden;
        border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);
        box-shadow:var(--dsw-elevation-panel,0 12px 32px var(--dsw-alias-bg-mask-2))}
      .wd-head{display:flex;align-items:center;gap:8px;height:34px;padding:0 6px 0 10px;flex:none;
        border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
      .wd-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary)}
      .wd-dot[data-status='ready']{background:var(--dsw-alias-hovercard-state-done)}
      .wd-dot[data-status='failed']{background:var(--dsw-alias-hovercard-state-error)}
      .wd-title{font-size:12.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wd-spacer{flex:1 1 auto}
      .wd-icon{width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;
        color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
      .wd-icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .wd-icon:focus-visible{outline:2px solid var(--dsw-alias-border-selected);outline-offset:-1px}
      .wd-body{position:relative;flex:1 1 auto;min-height:0;background:var(--dsw-alias-bg-base)}
      .wd-body webview{display:flex;width:100%;height:100%}
      .wd-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;
        pointer-events:none;color:var(--dsw-alias-label-secondary);font-size:12.5px;background:var(--dsw-alias-bg-base)}
      .wd-fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:10px;padding:20px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
      .wd-action{height:26px;padding:0 12px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);
        background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
      .wd-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .wd-grip{position:absolute;top:0;right:0;bottom:0;width:7px;cursor:col-resize;z-index:2;touch-action:none}
      .wd-grip:hover{background:var(--dsw-alias-border-l2)}
    `

    const glyph = (children) => h('svg', {
      width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true,
      style: { display: 'block' },
    }, children)

    const globeIcon = () => glyph([
      h('circle', { key: 'c', cx: 12, cy: 12, r: 8.4, stroke: 'currentColor', strokeWidth: 1.7 }),
      h('path', {
        key: 'm',
        d: 'M3.8 12h16.4M12 3.6c2.6 2.4 3.9 5.2 3.9 8.4s-1.3 6-3.9 8.4c-2.6-2.4-3.9-5.2-3.9-8.4S9.4 6 12 3.6Z',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
      }),
    ])

    const reloadIcon = () => glyph([
      h('path', {
        key: 'r',
        d: 'M19.4 12a7.4 7.4 0 1 1-2.2-5.2M19.4 4.6V9h-4.4',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    ])

    const externalIcon = () => glyph([
      h('path', {
        key: 'e',
        d: 'M13.6 5.4h5v5M18.6 5.4 11 13M10.2 5.8H7a2.2 2.2 0 0 0-2.2 2.2v8.8A2.2 2.2 0 0 0 7 19h8.8a2.2 2.2 0 0 0 2.2-2.2v-3.2',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    ])

    const closeIcon = () => glyph([
      h('path', { key: 'x', d: 'M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
    ])

    /**
     * Mount one approved Electron guest for the site. The desktop shell owns the partition,
     * the sandbox policy and the native history; this hook only places the tag.
     * @param hostRef - element the guest attaches to.
     * @param onStatus - loading / ready / failed reporter.
     * @param nonce - bumps to rebuild a guest that failed or crashed.
     * @returns the live guest element, when present.
     */
    function useSiteGuest(hostRef, onStatus, nonce) {
      const view = useRef()
      useEffect(() => {
        const bridge = desktopBridge()
        if (!bridge) {
          onStatus('unsupported')
          return undefined
        }
        let cancelled = false
        let element
        let lease
        let unsubscribeOpen
        onStatus('loading')
        void (async () => {
          try {
            const reservation = await bridge.acquire(STORAGE)
            if (cancelled) {
              void bridge.release(reservation.lease)
              return
            }
            lease = reservation.lease
            element = document.createElement('webview')
            element.setAttribute('name', reservation.lease)
            element.setAttribute('partition', reservation.partition)
            element.setAttribute('allowpopups', '')
            element.setAttribute('src', 'about:blank#' + reservation.lease)
            unsubscribeOpen = bridge.onOpenRequested(lease, (url) => {
              if (cancelled) return
              // Main asks the embedder first; keep the target inside the panel so a
              // link or an authorization page still opens for this guest's profile.
              try {
                element.loadURL(url).catch((error) => {
                  console.error('[web-deepseek] open request failed', error)
                  window.open(url, '_blank', 'noopener')
                })
              } catch (error) {
                window.open(url, '_blank', 'noopener')
              }
            })
            element.addEventListener('dom-ready', () => {
              if (cancelled || element === undefined) return
              try {
                element.clearHistory()
              } catch (error) {
                console.error('[web-deepseek] clearHistory failed', error)
              }
              element.loadURL(SITE).catch((error) => {
                console.error('[web-deepseek] loadURL failed', error)
                if (!cancelled) onStatus('failed')
              })
            }, { once: true })
            element.addEventListener('did-finish-load', () => {
              if (cancelled || element === undefined) return
              if (String(element.getURL()).startsWith('http')) onStatus('ready')
            })
            element.addEventListener('did-fail-load', (event) => {
              if (cancelled || !event || event.errorCode === -3 || event.isMainFrame === false) return
              onStatus('failed')
            })
            element.addEventListener('render-process-gone', () => {
              if (!cancelled) onStatus('failed')
            })
            if (hostRef.current === null || hostRef.current === undefined) {
              onStatus('failed')
              lease = undefined
              void bridge.release(reservation.lease)
              return
            }
            hostRef.current.appendChild(element)
            view.current = element
          } catch (error) {
            console.error('[web-deepseek] guest creation failed', error)
            if (!cancelled) onStatus('failed')
          }
        })()
        return () => {
          cancelled = true
          view.current = undefined
          try {
            unsubscribeOpen?.()
          } catch (error) {
            console.error('[web-deepseek] open-request unsubscribe failed', error)
          }
          if (element !== undefined) {
            try {
              element.remove()
            } catch (error) {
              console.error('[web-deepseek] guest removal failed', error)
            }
          }
          if (lease !== undefined) {
            bridge.release(lease).catch((error) => {
              console.error('[web-deepseek] lease release failed', error)
            })
          }
        }
      }, [hostRef, onStatus, nonce])
      return view
    }

    /**
     * @param props - measured placement above the footer row, the close callback and the resize starter.
     * @returns the compact DeepSeek web window.
     */
    function WebWindow({ anchor, onClose, onResizeStart, onResizeReset }) {
      useLanguageRevision()
      const hostRef = useRef(null)
      const panelRef = useRef(null)
      const [status, setStatus] = useState('loading')
      const [nonce, setNonce] = useState(0)
      const view = useSiteGuest(hostRef, setStatus, nonce)

      useLayoutEffect(() => {
        try {
          panelRef.current?.focus({ preventScroll: true })
        } catch (error) {
          console.error('[web-deepseek] focus failed', error)
        }
      }, [])

      const reload = () => {
        if (status === 'failed' || view.current === undefined) {
          setNonce((value) => value + 1)
          return
        }
        try {
          view.current.reload()
        } catch (error) {
          console.error('[web-deepseek] reload failed', error)
          setNonce((value) => value + 1)
        }
      }

      const placement = anchor === undefined ? { display: 'none' } : {
        left: anchor.left,
        bottom: anchor.bottom,
        width: anchor.width,
        height: anchor.height,
      }

      return h('div', {
        ref: panelRef,
        className: 'wd-panel',
        style: placement,
        role: 'dialog',
        'aria-modal': 'false',
        'aria-label': t().title,
        tabIndex: -1,
        onKeyDown: (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        },
      },
      h('div', { className: 'wd-head' },
        h('span', { className: 'wd-dot', 'data-status': status }),
        h('span', { className: 'wd-title' }, t().title),
        h('span', { className: 'wd-spacer' }),
        h('button', {
          type: 'button', className: 'wd-icon', title: t().reload, 'aria-label': t().reload,
          onClick: reload,
        }, reloadIcon()),
        h('button', {
          type: 'button', className: 'wd-icon', title: t().external, 'aria-label': t().external,
          onClick: () => openExternally(),
        }, externalIcon()),
        h('button', {
          type: 'button', className: 'wd-icon', title: t().close, 'aria-label': t().close,
          onClick: onClose,
        }, closeIcon()),
      ),
      h('div', { className: 'wd-body' },
        h('div', { ref: hostRef, style: { position: 'absolute', inset: 0 } }),
        status === 'loading' ? h('div', { className: 'wd-loading' }, t().loading) : null,
        status === 'unsupported' || status === 'failed'
          ? h('div', { className: 'wd-fallback' },
            h('div', null, status === 'unsupported' ? t().unsupported : t().failed),
            h('button', {
              type: 'button', className: 'wd-action',
              onClick: () => openExternally(),
            }, t().openExternal))
          : null,
      ),
      h('div', {
        className: 'wd-grip',
        title: t().resize,
        'aria-hidden': true,
        onPointerDown: onResizeStart,
        onDoubleClick: onResizeReset,
      }),
      )
    }

    /**
     * Footer row above the balance chip; the window hugs it from above and matches the
     * sidebar's own width until the user drags its right edge.
     * @param props - sidebar geometry.
     * @returns the trigger and, while open, the web window.
     */
    function WebAskRow({ wide }) {
      useLanguageRevision()
      const rowRef = useRef(null)
      const [open, setOpen] = useState(false)
      const [anchor, setAnchor] = useState()
      const [unavailableNotice, setUnavailableNotice] = useState(0)
      const onClose = () => setOpen(false)

      useEffect(() => {
        if (unavailableNotice === 0) return undefined
        const timer = setTimeout(() => setUnavailableNotice(0), 4200)
        return () => clearTimeout(timer)
      }, [unavailableNotice])

      const sidebarWidth = () => {
        const row = rowRef.current
        if (row === null) return undefined
        const host = row.parentElement ?? row
        const rect = host.getBoundingClientRect()
        if (rect.width >= 200) return Math.round(rect.width)
        return Math.round(row.getBoundingClientRect().width + 16)
      }

      useLayoutEffect(() => {
        if (!open) return undefined
        let placed = false
        const place = () => {
          const row = rowRef.current
          if (row === null) return
          const rect = row.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0 || row.getClientRects().length === 0) {
            // The sidebar collapsed or hid its foot: the anchor no longer exists.
            if (placed) setOpen(false)
            return
          }
          placed = true
          const host = row.parentElement ?? row
          const hostRect = host.getBoundingClientRect()
          const width = clamp(220, 900, savedWidth() ?? Math.round(hostRect.width) ?? rect.width)
          const available = Math.max(260, rect.top - 16)
          const height = Math.min(clamp(360, 860, Math.round(window.innerHeight * 0.78)), available)
          setAnchor({
            left: Math.max(0, Math.round(hostRect.left)),
            bottom: Math.max(8, window.innerHeight - rect.top + 8),
            width,
            height,
          })
        }
        place()
        window.addEventListener('resize', place)
        let observer
        if (typeof ResizeObserver === 'function' && rowRef.current !== null) {
          observer = new ResizeObserver(place)
          observer.observe(rowRef.current)
        }
        return () => {
          window.removeEventListener('resize', place)
          observer?.disconnect()
        }
      }, [open])

      const startResize = (event) => {
        if (anchor === undefined) return
        event.preventDefault()
        const handle = event.currentTarget
        try {
          handle.setPointerCapture(event.pointerId)
        } catch (error) {
          /* Capture is best effort; without it the drag stops over the guest. */
        }
        const startX = event.clientX
        const startWidth = anchor.width
        let width = startWidth
        const move = (moveEvent) => {
          width = clamp(220, 900, Math.round(startWidth + (moveEvent.clientX - startX)))
          setAnchor((current) => (current === undefined ? current : { ...current, width }))
        }
        const finish = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          rememberWidth(width)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }

      const resetWidth = () => {
        rememberWidth(undefined)
        const width = sidebarWidth()
        if (width === undefined) return
        setAnchor((current) => (current === undefined ? current : { ...current, width }))
      }

      const toggle = () => {
        if (desktopBridge() === undefined) {
          openExternally()
          setUnavailableNotice(Date.now())
          return
        }
        setOpen((value) => !value)
      }
      const inline = desktopBridge() !== undefined

      return h(React.Fragment, null,
        h('style', null, STYLE),
        h('button', {
          ref: rowRef,
          type: 'button',
          className: 'wd-row',
          'data-wide': wide ? 'true' : 'false',
          'data-open': open ? 'true' : 'false',
          title: open ? t().close : t().open,
          'aria-label': t().title,
          'aria-expanded': inline ? open : undefined,
          'aria-haspopup': inline ? 'dialog' : undefined,
          onClick: toggle,
        },
        globeIcon(),
        wide ? h('span', { className: 'wd-row-label' }, t().title) : null,
        ),
        unavailableNotice === 0 ? null : h('span', {
          key: unavailableNotice,
          role: 'status',
          style: {
            position: 'fixed', left: 12, bottom: 12, zIndex: 61, padding: '6px 9px', borderRadius: 8,
            border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)',
            color: 'var(--dsw-alias-label-primary)', fontSize: 12, pointerEvents: 'none', maxWidth: 280,
          },
        }, t().unsupported),
        open ? h(WebWindow, { anchor, onClose, onResizeStart: startResize, onResizeReset: resetWidth }) : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const readLanguage = () => {
          try {
            activeLanguage = String(ctx.locale.getSnapshot().active || '')
          } catch (error) {
            activeLanguage = ''
          }
        }
        readLanguage()
        ctx.effect(() => ctx.on('locale/change', () => {
          readLanguage()
          notifyLanguage()
        }), 'web-deepseek: locale')
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-web-deepseek',
            order: 5,
          },
          WebAskRow,
        ))
      },
    }
  },
})
