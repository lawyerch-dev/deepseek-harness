/** The Business Test welcome page opened in the main column. */

import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './WelcomePage.module.css'

/** Props assembled by the main slot renderer for the welcome page. */
export type WelcomePageProps = PropsRuntime<'main'> & PropsLocale<'myWorkflow'>

/**
 * Render the Business Test welcome page: a title, one sentence of intent, and a
 * simple click counter demonstrating how a plugin updates UI state.
 * @param props - framework locale seat with this plugin's copy.
 * @returns the welcome page element.
 */
export function WelcomePage({ t }: WelcomePageProps) {
  const [count, setCount] = useState(0)

  return (
    <section className={css.page} aria-label={t('title')}>
      <div className={css.content}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.intro}>{t('intro')}</p>
        <div className={css.counter}>
          <span className={css.counterValue}>{count}</span>
          <span className={css.counterUnit}>{t('clicksValue')}</span>
        </div>
        <div className={css.actions}>
          <button type="button" className={css.primary} onClick={() => setCount(c => c + 1)}>
            {t('clickButton')}
          </button>
          <button type="button" className={css.secondary} onClick={() => setCount(0)}>
            {t('resetButton')}
          </button>
        </div>
        <p className={css.note}>{t('note')}</p>
      </div>
    </section>
  )
}
