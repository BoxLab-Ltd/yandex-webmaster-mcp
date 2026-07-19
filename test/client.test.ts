import { describe, expect, it } from 'bun:test'
import { WebmasterClient } from '../src/api/client.js'

function client(fetchImpl: typeof fetch): WebmasterClient {
    return new WebmasterClient({
        baseUrl: 'https://api.webmaster.yandex.net',
        getToken: async () => 'tok',
        userAgent: 'test/1.0',
        maxConcurrency: 2,
        requestTimeoutMs: 1000,
        fetchImpl,
        sleep: async () => {},
    })
}

function ok(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('WebmasterClient query building', () => {
    it('sends array params as repeated keys, not CSV', async () => {
        let url = ''
        const c = client((async (u: string) => {
            url = u
            return ok({})
        }) as unknown as typeof fetch)

        await c.request('/x', {
            query_indicator: ['TOTAL_SHOWS', 'TOTAL_CLICKS'],
            order_by: 'TOTAL_SHOWS',
        })

        expect(url).toContain(
            'query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS',
        )
        expect(url).not.toContain('TOTAL_SHOWS%2CTOTAL_CLICKS')
        expect(url).toContain('order_by=TOTAL_SHOWS')
    })

    it('sends a JSON body with Content-Type on POST', async () => {
        let init: RequestInit | undefined
        const c = client((async (_u: string, i: RequestInit) => {
            init = i
            return ok({ task_id: 'abc' })
        }) as unknown as typeof fetch)

        await c.requestJson('/recrawl', {
            method: 'POST',
            body: { url: 'https://example.com/page' },
        })

        expect(init?.method).toBe('POST')
        expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
            'application/json',
        )
        expect(String(init?.body)).toContain('example.com/page')
    })

    it('authorizes with the OAuth scheme, not Bearer', async () => {
        let auth = ''
        const c = client((async (_u: string, i: RequestInit) => {
            auth = String((i.headers as Record<string, string>).Authorization)
            return ok({})
        }) as unknown as typeof fetch)

        await c.request('/x')
        expect(auth).toBe('OAuth tok')
    })
})
