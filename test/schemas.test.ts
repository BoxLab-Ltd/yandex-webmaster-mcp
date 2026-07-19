import { describe, expect, it } from 'bun:test'
import {
    AllQueriesHistorySchema,
    HostListSchema,
    PopularQueriesSchema,
    QueryHistorySchema,
} from '../src/api/schemas.js'

describe('HostListSchema', () => {
    it('accepts a null main_mirror (host without a main mirror)', () => {
        const parsed = HostListSchema.parse({
            hosts: [
                {
                    host_id: 'https:example.com:443',
                    unicode_host_url: 'https://example.com/',
                    verified: true,
                    main_mirror: null,
                },
            ],
        })
        expect(parsed.hosts[0]?.main_mirror).toBeNull()
    })
})

describe('PopularQueriesSchema', () => {
    it('parses ranked queries with scalar indicators', () => {
        const parsed = PopularQueriesSchema.parse({
            queries: [
                {
                    query_id: 'a08b',
                    query_text: 'boxlab',
                    indicators: { TOTAL_SHOWS: 19, TOTAL_CLICKS: 6 },
                },
            ],
            date_from: '2026-07-11',
            date_to: '2026-07-17',
            count: 286,
        })
        expect(parsed.count).toBe(286)
        expect(parsed.queries[0]?.indicators.TOTAL_CLICKS).toBe(6)
    })
})

describe('QueryHistorySchema', () => {
    it('parses the single-query object at the top level (no queries wrapper)', () => {
        const parsed = QueryHistorySchema.parse({
            query_id: 'a08b',
            query_text: 'boxlab',
            indicators: {
                TOTAL_SHOWS: [
                    { date: '2026-07-12T00:00:00.000+03:00', value: 2 },
                ],
            },
        })
        expect(parsed.query_text).toBe('boxlab')
        expect(parsed.indicators.TOTAL_SHOWS?.[0]?.value).toBe(2)
    })
})

describe('AllQueriesHistorySchema', () => {
    it('parses indicators as time series', () => {
        const parsed = AllQueriesHistorySchema.parse({
            indicators: {
                TOTAL_SHOWS: [
                    { date: '2026-07-12T00:00:00.000+03:00', value: 38 },
                    { date: '2026-07-13T00:00:00.000+03:00', value: 74 },
                ],
            },
        })
        expect(parsed.indicators.TOTAL_SHOWS).toHaveLength(2)
    })
})
