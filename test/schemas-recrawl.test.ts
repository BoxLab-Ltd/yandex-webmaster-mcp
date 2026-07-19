import { describe, expect, it } from 'bun:test'
import {
    RecrawlQuotaSchema,
    RecrawlSubmitSchema,
    RecrawlTaskListSchema,
    RecrawlTaskSchema,
} from '../src/api/schemas.js'

describe('recrawl schemas', () => {
    it('parses the quota response', () => {
        const q = RecrawlQuotaSchema.parse({
            daily_quota: 20,
            quota_remainder: 18,
        })
        expect(q.daily_quota).toBe(20)
        expect(q.quota_remainder).toBe(18)
    })

    it('parses the submit response', () => {
        const s = RecrawlSubmitSchema.parse({
            task_id: 'c7fe80c0-36e3-11e6-8b2d-df96aa592c0a',
            quota_remainder: 1,
        })
        expect(s.task_id).toBe('c7fe80c0-36e3-11e6-8b2d-df96aa592c0a')
    })

    it('parses a single task', () => {
        const t = RecrawlTaskSchema.parse({
            task_id: 'abc',
            url: 'https://example.com/page',
            added_time: '2026-07-19T00:00:00.000+03:00',
            state: 'IN_PROGRESS',
        })
        expect(t.state).toBe('IN_PROGRESS')
    })

    it('parses the task list (no count field)', () => {
        const l = RecrawlTaskListSchema.parse({
            tasks: [{ task_id: 'abc', url: 'https://x/', state: 'DONE' }],
        })
        expect(l.tasks).toHaveLength(1)
        expect(l.tasks[0]?.state).toBe('DONE')
    })

    it('defaults to an empty task list when tasks is absent', () => {
        expect(RecrawlTaskListSchema.parse({}).tasks).toEqual([])
    })
})
