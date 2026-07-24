import { CompareSplit } from './CompareSplit'
import { MetricFocus } from './MetricFocus'
import { QuoteLockup } from './QuoteLockup'
import type {
  CompareSplitParams,
  MetricFocusParams,
  MotionDefinition,
  MotionId,
  QuoteLockupParams,
} from './types'

type RegisteredMotion =
  | MotionDefinition<MetricFocusParams>
  | MotionDefinition<CompareSplitParams>
  | MotionDefinition<QuoteLockupParams>

export const motionRegistry: RegisteredMotion[] = [
  {
    id: 'metric-focus',
    index: '01',
    name: 'MetricFocus',
    category: 'DATA / SIGNAL',
    description: '核心数字动效',
    component: MetricFocus,
    defaults: {
      eyebrow: 'QUARTERLY GROWTH',
      value: 248,
      prefix: '+',
      suffix: '%',
      description: '同比增长',
      trend: '↑ 32.4 PT',
      decimals: 0,
      duration: 1.4,
    },
    controls: [
      { type: 'text', key: 'eyebrow', label: '指标名称', maxLength: 24 },
      { type: 'number', key: 'value', label: '核心数值', min: 0, max: 999, step: 1 },
      { type: 'text', key: 'prefix', label: '前缀', maxLength: 2 },
      { type: 'text', key: 'suffix', label: '后缀', maxLength: 4 },
      { type: 'text', key: 'description', label: '说明文字', maxLength: 16 },
      { type: 'text', key: 'trend', label: '趋势文字', maxLength: 16 },
      { type: 'number', key: 'decimals', label: '小数位数', min: 0, max: 2, step: 1 },
      { type: 'number', key: 'duration', label: '动画时长', min: 0.6, max: 3, step: 0.1, suffix: 's' },
    ],
  },
  {
    id: 'compare-split',
    index: '02',
    name: 'CompareSplit',
    category: 'DUAL / STUDY',
    description: '左右对比卡',
    component: CompareSplit,
    defaults: {
      title: 'CONVERSION RATE',
      leftLabel: 'BEFORE',
      leftValue: 42,
      rightLabel: 'AFTER',
      rightValue: 86,
      suffix: '%',
      conclusion: '2.05× IMPROVEMENT',
      emphasis: 'right',
      split: 50,
      duration: 1.5,
    },
    controls: [
      { type: 'text', key: 'title', label: '对比标题', maxLength: 24 },
      { type: 'text', key: 'leftLabel', label: '左侧标签', maxLength: 14 },
      { type: 'number', key: 'leftValue', label: '左侧数值', min: 0, max: 100, step: 1 },
      { type: 'text', key: 'rightLabel', label: '右侧标签', maxLength: 14 },
      { type: 'number', key: 'rightValue', label: '右侧数值', min: 0, max: 100, step: 1 },
      { type: 'text', key: 'suffix', label: '数值后缀', maxLength: 4 },
      { type: 'text', key: 'conclusion', label: '结论文字', maxLength: 24 },
      {
        type: 'select',
        key: 'emphasis',
        label: '强调区域',
        options: [
          { label: '左侧', value: 'left' },
          { label: '右侧', value: 'right' },
        ],
      },
      { type: 'number', key: 'split', label: '分割位置', min: 32, max: 68, step: 1, suffix: '%' },
      { type: 'number', key: 'duration', label: '动画时长', min: 0.6, max: 3, step: 0.1, suffix: 's' },
    ],
  },
  {
    id: 'quote-lockup',
    index: '03',
    name: 'QuoteLockup',
    category: 'TYPE / LOCK',
    description: '金句定格卡',
    component: QuoteLockup,
    defaults: {
      eyebrow: 'FIELD NOTE / 08',
      quote: '真正的效率，不是做得更快，而是更少地做错。',
      author: 'JSPANG',
      role: 'INDEPENDENT CREATOR',
      align: 'left',
      maxWidth: 1180,
      duration: 1.6,
    },
    controls: [
      { type: 'text', key: 'eyebrow', label: '眉题', maxLength: 24 },
      { type: 'text', key: 'quote', label: '金句内容', maxLength: 54 },
      { type: 'text', key: 'author', label: '署名', maxLength: 18 },
      { type: 'text', key: 'role', label: '身份说明', maxLength: 28 },
      {
        type: 'select',
        key: 'align',
        label: '文本对齐',
        options: [
          { label: '左对齐', value: 'left' },
          { label: '居中', value: 'center' },
        ],
      },
      { type: 'number', key: 'maxWidth', label: '最大行宽', min: 760, max: 1420, step: 20, suffix: 'px' },
      { type: 'number', key: 'duration', label: '动画时长', min: 0.6, max: 3, step: 0.1, suffix: 's' },
    ],
  },
]

export function getMotionDefinition(id: MotionId) {
  return motionRegistry.find((motion) => motion.id === id) ?? motionRegistry[0]
}
