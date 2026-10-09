/**
 * Business Test plugin, browser half: the **Business Test** entry of the
 * sidebar and the welcome page it opens in the main column. The page is a
 * global panel: it belongs to the profile rather than to a Session, and the
 * sidebar's entry selects it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the root `main` keyed slot the page registers into, declared by
// ui-layout with the panel id brand, and the `sidebar.panellist` list the
// entry registers into, declared by ui-sidebar.
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the renderer plugin's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { PanelIcon } from './PanelIcon.tsx'
import { WelcomePage } from './WelcomePage.tsx'
import { en, zh, type MyWorkflowLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Business Test panel copy. */
    'myWorkflow': MyWorkflowLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'myWorkflow'

/** The id shared by the sidebar entry and the main panel it opens. */
const PANEL_ID = 'my-workflow' as MainPanelId

/** Services required by the sidebar registration and the main panel page. */
export const inject = ['slots', 'locale']

/**
 * Contribute the Business Test entry to the sidebar with the welcome page it
 * opens in the main column.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'my-workflow: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
  }, WelcomePage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    locale: NS,
    label: () => t('panel'),
  }, PanelIcon))
}
