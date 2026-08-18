import { motionRegistry } from '../../motion/registry'
import type { ParameterValues } from '../../motion/types'
import type { OverlayCard, OverlayPosition } from '../../timeline/types'

export type RoiParameterProfile = 'default' | 'minimum' | 'maximum'

export interface RoiStressSample {
  card: OverlayCard
  time: number
  parameterProfile: RoiParameterProfile
}

const CORNER_POSITIONS: OverlayPosition[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
  { x: 100, y: 100 },
]

function extremeParameters(
  definition: (typeof motionRegistry)[number],
  profile: Exclude<RoiParameterProfile, 'default'>,
): ParameterValues {
  const params: ParameterValues = { ...definition.defaults }
  for (const control of definition.controls) {
    if (control.type === 'text' || control.type === 'textarea') {
      params[control.key] = profile === 'minimum'
        ? ''
        : '测'.repeat(control.maxLength)
    } else if (control.type === 'number') {
      params[control.key] = profile === 'minimum' ? control.min : control.max
    } else {
      const option = profile === 'minimum'
        ? control.options[0]
        : control.options.at(-1)
      if (option) params[control.key] = option.value
    }
  }
  return params
}

function motionDuration(definition: (typeof motionRegistry)[number]) {
  const duration = definition.defaults.duration
  return typeof duration === 'number' ? duration : 3
}

export function createRoiStressSamples(): RoiStressSample[] {
  return motionRegistry.flatMap((definition) => {
    const duration = motionDuration(definition)
    const times = [
      0.25,
      Math.max(0.8, duration * 0.25),
      Math.max(1.8, duration * 0.65),
      Math.max(2.5, duration - 0.3),
    ]
    const end = Math.max(10, duration + 1)
    const makeSample = (
      id: string,
      params: ParameterValues,
      position: OverlayPosition,
      time: number,
      parameterProfile: RoiParameterProfile,
    ): RoiStressSample => ({
      card: {
        id: `roi-${definition.id}-${id}`,
        motionId: definition.id,
        start: 0,
        end,
        position,
        zIndex: 0,
        params,
      },
      time: Math.min(time, end - 0.01),
      parameterProfile,
    })

    return [
      ...times.map((time, index) => makeSample(
        `default-${index}`,
        { ...definition.defaults },
        CORNER_POSITIONS[index],
        time,
        'default',
      )),
      makeSample(
        'minimum',
        extremeParameters(definition, 'minimum'),
        CORNER_POSITIONS[3],
        times[1],
        'minimum',
      ),
      makeSample(
        'maximum',
        extremeParameters(definition, 'maximum'),
        CORNER_POSITIONS[0],
        times[2],
        'maximum',
      ),
    ]
  })
}
