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

    const STRINGS = {
      ru: {
        title: 'DeepSeek Web',
        caption: 'не API',
        open: 'Открыть DeepSeek Web',
        close: 'Закрыть',
        reload: 'Перезагрузить страницу',
        external: 'Открыть в системном браузере',
        loading: 'Загружаю страницу…',
        failed: 'Не удалось загрузить страницу',
        unsupported: 'Встроенное окно работает только в приложении Harness Desktop.',
        openExternal: 'Открыть в браузере',
        idea: 'Ваша мысль или черновик…',
        copyLabel: 'Скопировать готовый запрос',
        chips: {
          thought: 'Мысль',
          prompt: 'Промпт',
          text: 'Текст',
        },
        hint: 'и вставьте в окно DeepSeek (Ctrl+V)',
        empty: 'Сначала напишите мысль.',
        copied: 'Скопировано — вставьте в окно DeepSeek (Ctrl+V).',
        copyFailed: 'Не удалось скопировать. Попробуйте ещё раз.',
        notice: 'Вход — один раз за запуск приложения: окно использует временный профиль браузера.',
        templates: {
          thought: (x) => 'Сформулируй одну мысль точно и коротко, без вступлений и без воды.\n\nМысль: ' + x,
          prompt: (x) => 'Ты — редактор промптов. Преврати мою мысль в точный промпт для агента-программиста.\n'
            + 'Структура: роль, контекст, задача, ограничения, ожидаемый результат, формат ответа.\n'
            + 'Верни только промпт, без пояснений вокруг.\n\nМоя мысль: ' + x,
          text: (x) => 'Напиши короткий текст объёмом 3–5 предложений, нейтральный тон, без клише и без вступлений.\n\nСуть: ' + x,
        },
      },
      en: {
        title: 'DeepSeek Web',
        caption: 'no API',
        open: 'Open DeepSeek Web',
        close: 'Close',
        reload: 'Reload the page',
        external: 'Open in the system browser',
        loading: 'Loading the page…',
        failed: 'The page failed to load',
        unsupported: 'The embedded window works only in the Harness Desktop app.',
        openExternal: 'Open in browser',
        idea: 'Your thought or draft…',
        copyLabel: 'Copy a ready request',
        chips: {
          thought: 'Thought',
          prompt: 'Prompt',
          text: 'Text',
        },
        hint: 'and paste it into the DeepSeek window (Ctrl+V)',
        empty: 'Write a thought first.',
        copied: 'Copied — paste it into the DeepSeek window (Ctrl+V).',
        copyFailed: 'Copy failed. Try again.',
        notice: 'Sign-in lasts one app run: the window uses a temporary browser profile.',
        templates: {
          thought: (x) => 'State one thought precisely and briefly, with no preamble and no filler.\n\nThought: ' + x,
          prompt: (x) => 'You are a prompt editor. Turn my thought into a precise prompt for a coding agent.\n'
            + 'Structure: role, context, task, constraints, expected result, response format.\n'
            + 'Return only the prompt, with no commentary around it.\n\nMy thought: ' + x,
          text: (x) => 'Write a short text of 3–5 sentences, neutral tone, no clichés, no preamble.\n\nEssence: ' + x,
        },
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

    const copyText = async (text) => {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (error) {
        try {
          const area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', '')
          area.style.position = 'fixed'
          area.style.top = '0'
          area.style.left = '0'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          const ok = document.execCommand('copy')
          area.remove()
          return ok
        } catch (fallbackError) {
          return false
        }
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
      .wd-row-note{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
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
      .wd-loading{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;
        padding:20px;text-align:center;pointer-events:none;color:var(--dsw-alias-label-secondary);font-size:12.5px;
        background:var(--dsw-alias-bg-base)}
      .wd-loading small{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-tertiary);max-width:280px}
      .wd-fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:10px;padding:20px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
      .wd-foot{position:relative;flex:none;display:flex;flex-direction:column;gap:6px;padding:8px;
        border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
      .wd-input{width:100%;box-sizing:border-box;resize:none;height:46px;padding:6px 8px;border-radius:8px;
        border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
        font:inherit;font-size:12.5px;line-height:1.35}
      .wd-input:focus{outline:none;border-color:var(--dsw-alias-border-selected)}
      .wd-copy-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}
      .wd-chips{display:flex;gap:6px}
      .wd-chip{flex:1 1 0;height:26px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);
        background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
      .wd-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .wd-chip:focus-visible{outline:2px solid var(--dsw-alias-border-selected);outline-offset:-1px}
      .wd-hint{font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary)}
      .wd-toast{position:absolute;left:8px;right:8px;bottom:calc(100% + 6px);padding:6px 8px;border-radius:7px;
        border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);
        font-size:12px;line-height:1.35;pointer-events:none}
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
     * @param props - measured placement above the footer row and the close callback.
     * @returns the compact DeepSeek web window.
     */
    function WebWindow({ anchor, onClose }) {
      useLanguageRevision()
      const hostRef = useRef(null)
      const panelRef = useRef(null)
      const [status, setStatus] = useState('loading')
      const [nonce, setNonce] = useState(0)
      const [idea, setIdea] = useState('')
      const [toast, setToast] = useState()
      const view = useSiteGuest(hostRef, setStatus, nonce)

      useLayoutEffect(() => {
        try {
          panelRef.current?.focus({ preventScroll: true })
        } catch (error) {
          console.error('[web-deepseek] focus failed', error)
        }
      }, [])

      useEffect(() => {
        if (toast === undefined) return undefined
        const timer = setTimeout(() => setToast(undefined), 2600)
        return () => clearTimeout(timer)
      }, [toast])

      const say = (message) => {
        setToast({ message })
      }

      const compose = async (kind) => {
        const text = idea.trim()
        if (text === '') {
          say(t().empty)
          return
        }
        const ok = await copyText(t().templates[kind](text))
        say(ok ? t().copied : t().copyFailed)
      }

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
        status === 'loading'
          ? h('div', { className: 'wd-loading' }, h('div', null, t().loading), h('small', null, t().notice))
          : null,
        status === 'unsupported' || status === 'failed'
          ? h('div', { className: 'wd-fallback' },
            h('div', null, status === 'unsupported' ? t().unsupported : t().failed),
            h('button', {
              type: 'button', className: 'wd-chip', style: { flex: 'none', padding: '0 12px' },
              onClick: () => openExternally(),
            }, t().openExternal))
          : null,
      ),
      h('div', { className: 'wd-foot' },
        toast === undefined ? null : h('div', { className: 'wd-toast', role: 'status' }, toast.message),
        h('textarea', {
          className: 'wd-input',
          placeholder: t().idea,
          value: idea,
          spellCheck: false,
          onChange: (event) => setIdea(event.target.value),
        }),
        h('div', { className: 'wd-copy-label' }, t().copyLabel),
        h('div', { className: 'wd-chips' },
          h('button', { type: 'button', className: 'wd-chip', onClick: () => { void compose('thought') } }, t().chips.thought),
          h('button', { type: 'button', className: 'wd-chip', onClick: () => { void compose('prompt') } }, t().chips.prompt),
          h('button', { type: 'button', className: 'wd-chip', onClick: () => { void compose('text') } }, t().chips.text),
        ),
        h('div', { className: 'wd-hint' }, t().hint),
      ),
      )
    }

    /**
     * Footer row above the balance chip; the window hugs it from above.
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
          const width = clamp(320, 440, Math.round(window.innerWidth * 0.32))
          const available = Math.max(240, rect.top - 24)
          const height = Math.min(clamp(360, 620, Math.round(window.innerHeight * 0.68)), available)
          setAnchor({
            left: clamp(8, window.innerWidth - width - 8, Math.round(rect.left)),
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
        wide ? h('span', { className: 'wd-row-note' }, t().caption) : null,
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
        open ? h(WebWindow, { anchor, onClose }) : null,
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
