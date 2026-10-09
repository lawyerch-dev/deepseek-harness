/** Business Test panel interface copy. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  panel: '业务测试',
  title: '业务测试',
  intro: '在这里体验一个最简单的交互：点击下面的按钮，计数就会加一。',
  clicksLabel: '点击次数',
  clicksValue: '次',
  clickButton: '点我 (+1)',
  resetButton: '归零',
  note: '这个计数器只是演示插件如何修改界面状态，真正的业务逻辑后续再接入。',
} satisfies Record<string, string>

/** Business Test locale key union. */
export type MyWorkflowLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  panel: 'Business Test',
  title: 'Business Test',
  intro: 'Experience the simplest interaction here: click the button and the counter increments.',
  clicksLabel: 'Click count',
  clicksValue: 'times',
  clickButton: 'Click me (+1)',
  resetButton: 'Reset',
  note: 'This counter only demonstrates how a plugin updates UI state; real business logic comes later.',
} satisfies Record<MyWorkflowLocaleKey, string>
