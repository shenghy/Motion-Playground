import { CompareSplit } from './CompareSplit'
import { MetricFocus } from './MetricFocus'
import { ProfileReveal } from './ProfileReveal'
import type {
  CompareSplitParams,
  MetricFocusParams,
  MotionDefinition,
  MotionId,
  ProfileRevealParams,
} from './types'

type RegisteredMotion =
  | MotionDefinition<MetricFocusParams>
  | MotionDefinition<CompareSplitParams>
  | MotionDefinition<ProfileRevealParams>

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
    id: 'profile-reveal',
    index: '03',
    name: 'ProfileReveal',
    category: 'STORY / PROFILE',
    description: '逐句动态信息卡',
    component: ProfileReveal,
    defaults: {
      category: 'MAKER / FIELD NOTE',
      descriptor: '独立开发者 · 产品构建者',
      overline: 'BUILD IN PUBLIC',
      title: '公开构建者',
      fact1: '没有庞大团队',
      fact1Note: 'NO LARGE TEAM',
      fact2: '没有巨额预算',
      fact2Note: 'NO MASSIVE BUDGET',
      fact3: '只靠持续交付',
      fact3Note: 'SHIP EVERY WEEK',
      status: 'PROFILE / VERIFIED',
      duration: 6.4,
    },
    controls: [
      { type: 'text', key: 'category', label: '身份眉题', maxLength: 24 },
      { type: 'text', key: 'descriptor', label: '身份说明', maxLength: 24 },
      { type: 'text', key: 'overline', label: '标题引导', maxLength: 24 },
      { type: 'text', key: 'title', label: '核心标题', maxLength: 12 },
      { type: 'text', key: 'fact1', label: '信息一', maxLength: 16 },
      { type: 'text', key: 'fact1Note', label: '信息一注释', maxLength: 20 },
      { type: 'text', key: 'fact2', label: '信息二', maxLength: 16 },
      { type: 'text', key: 'fact2Note', label: '信息二注释', maxLength: 20 },
      { type: 'text', key: 'fact3', label: '信息三', maxLength: 16 },
      { type: 'text', key: 'fact3Note', label: '信息三注释', maxLength: 20 },
      { type: 'text', key: 'status', label: '状态文字', maxLength: 24 },
      { type: 'number', key: 'duration', label: '循环时长', min: 5.2, max: 10, step: 0.2, suffix: 's' },
    ],
  },
]

export function getMotionDefinition(id: MotionId) {
  return motionRegistry.find((motion) => motion.id === id) ?? motionRegistry[0]
}
