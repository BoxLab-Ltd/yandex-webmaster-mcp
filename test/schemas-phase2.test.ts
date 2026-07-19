import { describe, expect, it } from 'bun:test'
import {
    DiagnosticsSchema,
    ExternalLinksSchema,
    IndexingSamplesSchema,
    InSearchSamplesSchema,
    SitemapsSchema,
} from '../src/api/schemas.js'

describe('DiagnosticsSchema', () => {
    it('parses problems keyed by type with a null last_state_update', () => {
        const parsed = DiagnosticsSchema.parse({
            problems: {
                NOT_IN_SPRAV: {
                    severity: 'RECOMMENDATION',
                    state: 'PRESENT',
                    last_state_update: '2026-07-19T05:30:56.157+03:00',
                },
                DNS_ERROR: {
                    severity: 'FATAL',
                    state: 'ABSENT',
                    last_state_update: null,
                },
            },
        })
        expect(parsed.problems.NOT_IN_SPRAV?.state).toBe('PRESENT')
        expect(parsed.problems.DNS_ERROR?.last_state_update).toBeNull()
    })
})

describe('SitemapsSchema', () => {
    it('parses a sitemap with string sources', () => {
        const parsed = SitemapsSchema.parse({
            sitemaps: [
                {
                    sitemap_id: 'c1a1764a',
                    sitemap_url: 'https://boxlab.io/sitemap.xml',
                    errors_count: 0,
                    urls_count: 121,
                    sitemap_type: 'SITEMAP',
                    sources: ['ROBOTS_TXT', 'WEBMASTER'],
                },
            ],
        })
        expect(parsed.sitemaps[0]?.urls_count).toBe(121)
        expect(parsed.sitemaps[0]?.sources).toEqual(['ROBOTS_TXT', 'WEBMASTER'])
    })
})

describe('IndexingSamplesSchema', () => {
    it('parses crawled samples with http codes', () => {
        const parsed = IndexingSamplesSchema.parse({
            count: 9342,
            samples: [
                {
                    status: 'HTTP_2XX',
                    http_code: 200,
                    url: 'https://boxlab.io/ru/',
                    access_date: '2022-07-13T11:05:53.000+03:00',
                },
            ],
        })
        expect(parsed.count).toBe(9342)
        expect(parsed.samples[0]?.http_code).toBe(200)
    })
})

describe('InSearchSamplesSchema', () => {
    it('parses in-search samples with last_access', () => {
        const parsed = InSearchSamplesSchema.parse({
            count: 89,
            samples: [
                {
                    url: 'https://boxlab.io/',
                    title: 'BoxLab',
                    last_access: '2026-07-18T22:31:42.000+03:00',
                },
            ],
        })
        expect(parsed.samples[0]?.title).toBe('BoxLab')
    })
})

describe('ExternalLinksSchema', () => {
    it('parses inbound link samples', () => {
        const parsed = ExternalLinksSchema.parse({
            count: 71,
            links: [
                {
                    source_url: 'https://ctln.ru/page/',
                    destination_url: 'https://boxlab.io/',
                    discovery_date: '2026-06-23',
                    source_last_access_date: '2026-06-23',
                },
            ],
        })
        expect(parsed.count).toBe(71)
        expect(parsed.links[0]?.destination_url).toBe('https://boxlab.io/')
    })
})
