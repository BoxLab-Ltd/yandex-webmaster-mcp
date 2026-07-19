import { describe, expect, it } from 'bun:test'
import { errorFromResponse, WebmasterApiError } from '../src/api/errors.js'

describe('errorFromResponse', () => {
    it('parses the Webmaster error_code/error_message envelope', () => {
        const err = errorFromResponse(
            404,
            JSON.stringify({
                error_code: 'RESOURCE_NOT_FOUND',
                error_message: 'no such host',
            }),
        )
        expect(err).toBeInstanceOf(WebmasterApiError)
        expect(err.status).toBe(404)
        expect(err.errorTypes).toEqual(['RESOURCE_NOT_FOUND'])
        expect(err.message).toContain('no such host')
    })

    it('falls back to the raw body when it is not JSON', () => {
        const err = errorFromResponse(500, 'upstream exploded')
        expect(err.errorTypes).toEqual([])
        expect(err.message).toContain('upstream exploded')
    })
})

describe('WebmasterApiError classification', () => {
    it('treats 401 and INVALID_OAUTH_TOKEN as unauthorized', () => {
        expect(new WebmasterApiError(401, 'x').isUnauthorized).toBe(true)
        expect(
            new WebmasterApiError(403, 'x', ['INVALID_OAUTH_TOKEN'])
                .isUnauthorized,
        ).toBe(true)
        expect(new WebmasterApiError(404, 'x').isUnauthorized).toBe(false)
    })

    it('treats 429 and quota/limit codes as throttled and retryable', () => {
        expect(new WebmasterApiError(429, 'x').isThrottled).toBe(true)
        expect(
            new WebmasterApiError(400, 'x', ['TOO_MANY_REQUESTS']).isThrottled,
        ).toBe(true)
        expect(new WebmasterApiError(429, 'x').isRetryable).toBe(true)
    })

    it('marks transport failures (status 0) retryable, plain 404 not', () => {
        expect(new WebmasterApiError(0, 'x', ['timeout']).isRetryable).toBe(
            true,
        )
        expect(new WebmasterApiError(404, 'x').isRetryable).toBe(false)
    })
})
