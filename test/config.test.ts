import { describe, expect, it } from 'bun:test'
import { EMBEDDED_OAUTH_CLIENT_ID, loadConfig } from '../src/config.js'

describe('loadConfig', () => {
    it('applies Webmaster defaults with an empty environment', () => {
        const cfg = loadConfig({} as NodeJS.ProcessEnv)
        expect(cfg.baseUrl).toBe('https://api.webmaster.yandex.net')
        expect(cfg.oauthBaseUrl).toBe('https://oauth.yandex.ru')
        expect(cfg.oauthClientId).toBe(EMBEDDED_OAUTH_CLIENT_ID)
        expect(cfg.oauthIsCustomApp).toBe(false)
        expect(cfg.token).toBeUndefined()
        expect(cfg.defaultHostId).toBeUndefined()
    })

    it('reads a static token and default host id from the environment', () => {
        const cfg = loadConfig({
            YANDEX_WEBMASTER_TOKEN: 'tok',
            YANDEX_WEBMASTER_HOST_ID: 'https:example.com:443',
        } as NodeJS.ProcessEnv)
        expect(cfg.token).toBe('tok')
        expect(cfg.defaultHostId).toBe('https:example.com:443')
    })

    it('flags a custom app when YANDEX_OAUTH_CLIENT_ID is set', () => {
        const cfg = loadConfig({
            YANDEX_OAUTH_CLIENT_ID: 'mine',
            YANDEX_OAUTH_CLIENT_SECRET: 'shh',
        } as NodeJS.ProcessEnv)
        expect(cfg.oauthClientId).toBe('mine')
        expect(cfg.oauthIsCustomApp).toBe(true)
        expect(cfg.oauthClientSecret).toBe('shh')
    })

    it('strips a trailing slash from the API base URL', () => {
        const cfg = loadConfig({
            YANDEX_WEBMASTER_BASE_URL: 'https://api.webmaster.yandex.net/',
        } as NodeJS.ProcessEnv)
        expect(cfg.baseUrl).toBe('https://api.webmaster.yandex.net')
    })
})
