import { describe, expect, it } from 'bun:test'
import type { WebmasterClient } from '../src/api/client.js'
import { createUserIdResolver } from '../src/api/webmaster.js'

// A minimal fake exposing only what getUserId touches: client.request.
function fakeClient(request: () => Promise<unknown>): WebmasterClient {
    return { request } as unknown as WebmasterClient
}

describe('createUserIdResolver', () => {
    it('resolves once and caches the user id across calls', async () => {
        let calls = 0
        const resolve = createUserIdResolver(
            fakeClient(async () => {
                calls += 1
                return { user_id: 42 }
            }),
        )
        expect(await resolve()).toBe(42)
        expect(await resolve()).toBe(42)
        expect(calls).toBe(1)
    })

    it('does NOT cache a rejected lookup, so a later call re-resolves', async () => {
        let calls = 0
        const resolve = createUserIdResolver(
            fakeClient(async () => {
                calls += 1
                if (calls === 1) throw new Error('Not signed in')
                return { user_id: 7 }
            }),
        )
        // First call fails (unauthenticated boot).
        let firstError: unknown
        try {
            await resolve()
        } catch (err) {
            firstError = err
        }
        expect((firstError as Error).message).toContain('Not signed in')
        // The post-`login` retry must hit the client again, not replay the
        // cached rejection.
        expect(await resolve()).toBe(7)
        expect(calls).toBe(2)
    })
})
