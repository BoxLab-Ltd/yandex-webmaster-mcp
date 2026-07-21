import { isCustomApp } from '@boxlab/yandex-mcp-core'
import { describe, expect, it } from 'bun:test'
import {
    EMBEDDED_OAUTH_CLIENT_ID,
    loadAuthConfig,
    loadConfig,
} from '../src/config.js'

describe('loadConfig', () => {
    it('applies Webmaster defaults with an empty environment', () => {
        const cfg = loadConfig({} as NodeJS.ProcessEnv)
        expect(cfg.baseUrl).toBe('https://api.webmaster.yandex.net')
        expect(cfg.defaultHostId).toBeUndefined()
    })

    it('reads the default host id from the environment', () => {
        const cfg = loadConfig({
            YANDEX_WEBMASTER_HOST_ID: 'https:example.com:443',
        } as NodeJS.ProcessEnv)
        expect(cfg.defaultHostId).toBe('https:example.com:443')
    })

    it('strips a trailing slash from the API base URL', () => {
        const cfg = loadConfig({
            YANDEX_WEBMASTER_BASE_URL: 'https://api.webmaster.yandex.net/',
        } as NodeJS.ProcessEnv)
        expect(cfg.baseUrl).toBe('https://api.webmaster.yandex.net')
    })
})

describe('loadAuthConfig', () => {
    it('defaults to the embedded client, Webmaster scopes and oauth.yandex.ru', () => {
        const auth = loadAuthConfig({} as NodeJS.ProcessEnv)
        expect(auth.scope).toBe('webmaster:hostinfo webmaster:verify')
        expect(auth.appName).toBe('yandex-webmaster-mcp')
        expect(auth.embeddedClientId).toBe(EMBEDDED_OAUTH_CLIENT_ID)
        expect(auth.oauthBaseUrl).toBe('https://oauth.yandex.ru')
        expect(auth.staticToken).toBeUndefined()
        expect(isCustomApp(auth)).toBe(false)
    })

    it('reads the static token from YANDEX_WEBMASTER_TOKEN', () => {
        const auth = loadAuthConfig({
            YANDEX_WEBMASTER_TOKEN: 'tok',
        } as NodeJS.ProcessEnv)
        expect(auth.staticToken).toBe('tok')
    })

    it('flags a custom app when YANDEX_OAUTH_CLIENT_ID is set', () => {
        const auth = loadAuthConfig({
            YANDEX_OAUTH_CLIENT_ID: 'mine',
            YANDEX_OAUTH_CLIENT_SECRET: 'shh',
        } as NodeJS.ProcessEnv)
        expect(auth.customClientId).toBe('mine')
        expect(auth.customClientSecret).toBe('shh')
        expect(isCustomApp(auth)).toBe(true)
    })
})
