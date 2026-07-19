import { describe, expect, it } from 'bun:test'
import {
    buildAuthorizeUrl,
    exchangeCode,
    refreshToken,
    type OAuthClientConfig,
} from '../src/auth/oauth.js'

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('buildAuthorizeUrl', () => {
    it('includes PKCE params, scope and the OOB redirect', () => {
        const cfg: OAuthClientConfig = { clientId: 'abc' }
        const url = buildAuthorizeUrl(cfg, {
            codeChallenge: 'challenge123',
            scope: 'webmaster:hostinfo webmaster:verify',
        })
        const u = new URL(url)
        expect(u.origin).toBe('https://oauth.yandex.ru')
        expect(u.searchParams.get('response_type')).toBe('code')
        expect(u.searchParams.get('client_id')).toBe('abc')
        expect(u.searchParams.get('code_challenge')).toBe('challenge123')
        expect(u.searchParams.get('code_challenge_method')).toBe('S256')
        expect(u.searchParams.get('scope')).toBe(
            'webmaster:hostinfo webmaster:verify',
        )
        expect(u.searchParams.get('redirect_uri')).toBe(
            'https://oauth.yandex.ru/verification_code',
        )
    })
})

describe('exchangeCode', () => {
    it('sends the PKCE code_verifier and no client_secret for a public client', async () => {
        let sentBody = ''
        const fetchImpl = (async (_url: string, init: RequestInit) => {
            sentBody = String(init.body)
            return jsonResponse(200, {
                access_token: 'tok',
                expires_in: 3600,
            })
        }) as unknown as typeof fetch

        const cfg: OAuthClientConfig = { clientId: 'abc', fetchImpl }
        const set = await exchangeCode(
            cfg,
            { code: 'the-code', codeVerifier: 'the-verifier' },
            1_000,
        )

        const params = new URLSearchParams(sentBody)
        expect(params.get('grant_type')).toBe('authorization_code')
        expect(params.get('code')).toBe('the-code')
        expect(params.get('code_verifier')).toBe('the-verifier')
        expect(params.get('client_secret')).toBeNull()
        expect(set.accessToken).toBe('tok')
        expect(set.expiresAt).toBe(1_000 + 3600 * 1000)
    })
})

describe('refreshToken', () => {
    it('sends grant_type=refresh_token with the client secret', async () => {
        let sentBody = ''
        const fetchImpl = (async (_url: string, init: RequestInit) => {
            sentBody = String(init.body)
            return jsonResponse(200, { access_token: 'new', expires_in: 100 })
        }) as unknown as typeof fetch

        const cfg: OAuthClientConfig = {
            clientId: 'abc',
            clientSecret: 'shh',
            fetchImpl,
        }
        await refreshToken(cfg, 'the-refresh', 0)

        const params = new URLSearchParams(sentBody)
        expect(params.get('grant_type')).toBe('refresh_token')
        expect(params.get('refresh_token')).toBe('the-refresh')
        expect(params.get('client_secret')).toBe('shh')
    })
})
