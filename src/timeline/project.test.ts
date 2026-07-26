import { describe, expect, it } from 'vitest'
import type { MotionId, ParameterValues } from '../motion/types'
import {
  createOverlayCard,
  getActiveCards,
  MIN_CARD_DURATION,
  moveCardTiming,
  parseOverlayProject,
  resizeCardTiming,
  updateCardPosition,
} from './project'
import type { OverlayCard } from './types'

const defaultsByMotion: Record<MotionId, ParameterValues> = {
  'metric-focus': { label: '默认标题', value: 10 },
  'compare-split': {},
  'profile-reveal': {},
  'bar-compare': {},
  'share-ring': {},
  'step-flow': {},
}

function makeCard(overrides: Partial<OverlayCard> = {}): OverlayCard {
  return {
    id: 'card-1',
    motionId: 'metric-focus',
    start: 2,
    end: 5,
    position: { x: 20, y: 30 },
    zIndex: 1,
    params: {},
    ...overrides,
  }
}

describe('createOverlayCard', () => {
  it('creates a three-second card with an explicit id and copied defaults', () => {
    const defaults = { title: '示例', value: 42 }

    const card = createOverlayCard('card-explicit', 'metric-focus', 2, 10, 3, defaults)

    expect(card).toMatchObject({
      id: 'card-explicit',
      motionId: 'metric-focus',
      start: 2,
      end: 5,
      position: { x: 0, y: 0 },
      zIndex: 3,
      params: defaults,
    })
    expect(card.params).not.toBe(defaults)
  })

  it('clamps timing to the video and backs up start near the end', () => {
    expect(createOverlayCard('card-a', 'metric-focus', -2, 2, 0, {}).start).toBe(0)
    expect(createOverlayCard('card-b', 'metric-focus', 1, 2, 0, {}).end).toBe(2)

    expect(createOverlayCard('card-c', 'metric-focus', 9.95, 10, 0, {})).toMatchObject({
      start: 10 - MIN_CARD_DURATION,
      end: 10,
    })
  })

  it.each([0, 0.1])('rejects a video duration of %s seconds', (videoDuration) => {
    expect(() =>
      createOverlayCard('card-a', 'metric-focus', 0, videoDuration, 0, {}),
    ).toThrow(new Error('视频时长不足'))
  })
})

describe('getActiveCards', () => {
  it('uses a half-open time range and sorts active cards by z-index', () => {
    const cards = [
      makeCard({ id: 'high', start: 1, end: 3, zIndex: 5 }),
      makeCard({ id: 'ended', start: 0, end: 2, zIndex: 0 }),
      makeCard({ id: 'low', start: 2, end: 4, zIndex: 1 }),
    ]

    expect(getActiveCards(cards, 2).map(({ id }) => id)).toEqual(['low', 'high'])
  })
})

describe('timing edits', () => {
  it('moves a card without changing its duration and clamps it to the video', () => {
    const card = makeCard()

    expect(moveCardTiming(card, -10, 10)).toMatchObject({ start: 0, end: 3 })
    expect(moveCardTiming(card, 9, 10)).toMatchObject({ start: 7, end: 10 })
    expect(card).toMatchObject({ start: 2, end: 5 })
  })

  it('expands an invalid short card to the minimum duration when moving', () => {
    const moved = moveCardTiming(makeCard({ start: 1, end: 1.1 }), 9.95, 10)

    expect(moved).toMatchObject({ start: 10 - MIN_CARD_DURATION, end: 10 })
  })

  it('resizes either edge within the video while preserving the minimum duration', () => {
    const card = makeCard()

    expect(resizeCardTiming(card, 'start', 4.95, 10)).toMatchObject({
      start: 5 - MIN_CARD_DURATION,
      end: 5,
    })
    expect(resizeCardTiming(card, 'start', -1, 10)).toMatchObject({ start: 0, end: 5 })
    expect(resizeCardTiming(card, 'end', 2.05, 10)).toMatchObject({
      start: 2,
      end: 2 + MIN_CARD_DURATION,
    })
    expect(resizeCardTiming(card, 'end', 20, 10)).toMatchObject({ start: 2, end: 10 })

    expect(
      resizeCardTiming(makeCard({ start: 8, end: 12 }), 'start', 20, 10),
    ).toMatchObject({ start: 10 - MIN_CARD_DURATION, end: 10 })

    expect(
      resizeCardTiming(makeCard({ start: 9.95, end: 10 }), 'end', 10, 10),
    ).toMatchObject({ start: 10 - MIN_CARD_DURATION, end: 10 })
  })

  it.each([0, 0.1])('rejects timing edits for a %s-second video', (videoDuration) => {
    expect(() => moveCardTiming(makeCard(), 0, videoDuration)).toThrow(
      new Error('视频时长不足'),
    )
    expect(() => resizeCardTiming(makeCard(), 'end', 1, videoDuration)).toThrow(
      new Error('视频时长不足'),
    )
  })
})

describe('updateCardPosition', () => {
  it('clamps percentage coordinates without mutating the card', () => {
    const card = makeCard()

    const updated = updateCardPosition(card, { x: -12, y: 140 })

    expect(updated.position).toEqual({ x: 0, y: 100 })
    expect(card.position).toEqual({ x: 20, y: 30 })
  })

  it('keeps the previous coordinate for non-finite input', () => {
    const card = makeCard()

    expect(updateCardPosition(card, { x: Number.NaN, y: Number.POSITIVE_INFINITY }).position)
      .toEqual({ x: 20, y: 30 })
  })
})

describe('parseOverlayProject', () => {
  it('parses a valid project, clamps position, and merges motion defaults', () => {
    const project = parseOverlayProject(
      JSON.stringify({
        version: 1,
        canvas: { width: 1920, height: 1080 },
        cards: [
          {
            id: 'card-1',
            motionId: 'metric-focus',
            start: 1,
            end: 4,
            position: { x: -5, y: 120 },
            zIndex: 2,
            params: { value: 99 },
          },
        ],
      }),
      defaultsByMotion,
    )

    expect(project.cards[0]).toMatchObject({
      position: { x: 0, y: 100 },
      params: { label: '默认标题', value: 99 },
    })
  })

  it('round-trips a minimum-duration card created at the end of the video', () => {
    const card = createOverlayCard(
      'card-round-trip',
      'metric-focus',
      9.95,
      10,
      0,
      defaultsByMotion['metric-focus'],
    )
    const text = JSON.stringify({
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards: [card],
    })

    expect(parseOverlayProject(text, defaultsByMotion).cards[0]).toEqual(card)
  })

  it('accepts a decimal minimum-duration range from 0.1 to 0.3', () => {
    const text = JSON.stringify({
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards: [
        {
          id: 'card-decimal',
          motionId: 'metric-focus',
          start: 0.1,
          end: 0.3,
          position: { x: 0, y: 0 },
          zIndex: 0,
          params: {},
        },
      ],
    })

    expect(parseOverlayProject(text, defaultsByMotion).cards[0]).toMatchObject({
      start: 0.1,
      end: 0.3,
    })
  })

  it('rejects unknown motions', () => {
    const text = JSON.stringify({
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards: [
        {
          id: 'card-1',
          motionId: 'not-registered',
          start: 0,
          end: 1,
          position: { x: 0, y: 0 },
          zIndex: 0,
          params: {},
        },
      ],
    })

    expect(() => parseOverlayProject(text, defaultsByMotion)).toThrow(
      new Error('JSON 项目格式无效'),
    )
  })

  it.each([
    ['number default overridden with string', { value: '99' }],
    ['string default overridden with number', { label: 99 }],
    ['unknown parameter key', { extra: 1 }],
  ])('rejects %s', (_name, params) => {
    const text = JSON.stringify({
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards: [
        {
          id: 'card-1',
          motionId: 'metric-focus',
          start: 0,
          end: 1,
          position: { x: 0, y: 0 },
          zIndex: 0,
          params,
        },
      ],
    })

    expect(() => parseOverlayProject(text, defaultsByMotion)).toThrow(
      new Error('JSON 项目格式无效'),
    )
  })

  it.each([
    ['null defaults', { ...defaultsByMotion, 'metric-focus': null }],
    ['invalid default value', { ...defaultsByMotion, 'metric-focus': { value: true } }],
  ])('rejects %s for a registered motion', (_name, malformedDefaults) => {
    expect(() =>
      parseOverlayProject(
        JSON.stringify({
          version: 1,
          canvas: { width: 1920, height: 1080 },
          cards: [
            {
              id: 'card-1',
              motionId: 'metric-focus',
              start: 0,
              end: 1,
              position: { x: 0, y: 0 },
              zIndex: 0,
              params: {},
            },
          ],
        }),
        malformedDefaults as unknown as Record<MotionId, ParameterValues>,
      ),
    ).toThrow(new Error('JSON 项目格式无效'))
  })

  it.each([
    [
      'empty id',
      [
        {
          id: '',
          motionId: 'metric-focus',
          start: 0,
          end: 1,
          position: { x: 0, y: 0 },
          zIndex: 0,
          params: {},
        },
      ],
    ],
    [
      'duplicate ids',
      [
        {
          id: 'same-id',
          motionId: 'metric-focus',
          start: 0,
          end: 1,
          position: { x: 0, y: 0 },
          zIndex: 0,
          params: {},
        },
        {
          id: 'same-id',
          motionId: 'metric-focus',
          start: 1,
          end: 2,
          position: { x: 0, y: 0 },
          zIndex: 1,
          params: {},
        },
      ],
    ],
  ])('rejects %s', (_name, cards) => {
    expect(() =>
      parseOverlayProject(
        JSON.stringify({
          version: 1,
          canvas: { width: 1920, height: 1080 },
          cards,
        }),
        defaultsByMotion,
      ),
    ).toThrow(new Error('JSON 项目格式无效'))
  })

  it.each([
    ['bad JSON', '{'],
    [
      'wrong version',
      JSON.stringify({ version: 2, canvas: { width: 1920, height: 1080 }, cards: [] }),
    ],
    [
      'wrong canvas',
      JSON.stringify({ version: 1, canvas: { width: 1280, height: 720 }, cards: [] }),
    ],
    [
      'non-finite timing',
      `{"version":1,"canvas":{"width":1920,"height":1080},"cards":[{"id":"card-1","motionId":"metric-focus","start":1e400,"end":2,"position":{"x":0,"y":0},"zIndex":0,"params":{}}]}`,
    ],
    [
      'negative start',
      JSON.stringify({
        version: 1,
        canvas: { width: 1920, height: 1080 },
        cards: [
          {
            id: 'card-1',
            motionId: 'metric-focus',
            start: -0.1,
            end: 1,
            position: { x: 0, y: 0 },
            zIndex: 0,
            params: {},
          },
        ],
      }),
    ],
    [
      'short card',
      JSON.stringify({
        version: 1,
        canvas: { width: 1920, height: 1080 },
        cards: [
          {
            id: 'card-1',
            motionId: 'metric-focus',
            start: 0,
            end: 0.1,
            position: { x: 0, y: 0 },
            zIndex: 0,
            params: {},
          },
        ],
      }),
    ],
  ])('rejects %s', (_name, text) => {
    expect(() => parseOverlayProject(text, defaultsByMotion)).toThrow(
      new Error('JSON 项目格式无效'),
    )
  })
})
