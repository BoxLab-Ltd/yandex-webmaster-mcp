import { describe, expect, it } from 'bun:test'
import { WebmasterClient } from '../src/api/client.js'

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('WebmasterClient reactive auth refresh', () => {
    it('refreshes once on 401 and retries with the new token', async () => {
        let calls = 0
        let token = 'stale'
        let rejectedSeen: string | undefined
        const sentTokens: string[] = []
        const fetchImpl = (async (_url: string, init: RequestInit) => {
            calls += 1
            sentTokens.push(
                String((init.headers as Record<string, string>).Authorization),
            )
            if (calls === 1) {
                return json(401, {
                    error_code: 'INVALID_OAUTH_TOKEN',
                    error_message: 'expired',
                })
            }
            return json(200, { user_id: 42 })
        }) as unknown as typeof fetch

        const client = new WebmasterClient({
            baseUrl: 'https://api.webmaster.yandex.net',
            getToken: async () => token,
            onUnauthorized: async rejected => {
                rejectedSeen = rejected
                token = 'fresh'
                return token
            },
            canRefresh: () => true,
            userAgent: 'test/1.0',
            maxConcurrency: 1,
            requestTimeoutMs: 1000,
            fetchImpl,
            sleep: async () => {},
        })

        const result = await client.request('/v4/user')
        expect(result).toEqual({ user_id: 42 })
        expect(rejectedSeen).toBe('stale')
        expect(calls).toBe(2)
        expect(sentTokens).toEqual(['OAuth stale', 'OAuth fresh'])
    })

    it('does not retry a 401 when the token cannot be refreshed', async () => {
        let calls = 0
        const fetchImpl = (async () => {
            calls += 1
            return json(401, { error_code: 'INVALID_OAUTH_TOKEN' })
        }) as unknown as typeof fetch

        const client = new WebmasterClient({
            baseUrl: 'https://api.webmaster.yandex.net',
            getToken: async () => 'static',
            canRefresh: () => false,
            userAgent: 'test/1.0',
            maxConcurrency: 1,
            requestTimeoutMs: 1000,
            fetchImpl,
            sleep: async () => {},
        })

        await expect(client.request('/v4/user')).rejects.toThrow()
        expect(calls).toBe(1)
    })
})
