import test from 'node:test'
import assert from 'node:assert/strict'
import { composerState } from '../src/features/discover/policy.js'

test('unlisted signed-in users see the listing gate', () => {
  assert.equal(composerState({ user: { id: 'one' }, listed: false }), 'listing-required')
})

test('a listing unlocks the composer', () => {
  assert.equal(composerState({ user: { id: 'one' }, listed: true }), 'enabled')
})
