import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '../src/index.ts';
import { getNetWorth } from '../src/economy.ts';
import current from '../worlds/alexandria-sample.json' with { type: 'json' };
import previous from '../worlds/alexandria-0.34.0.json' with { type: 'json' };
import { getBirthRollResources } from '../client/birth-stat-roll.ts';

test('WSL current births roll background resources, keep working reserves and replay', () => {
  const engine = createEngine(current);
  const missing = new Set(current.origins.map(origin => origin.id));
  const working = new Set(['tenant-farming-household', 'artisan-household', 'weaver-household', 'boatbuilder-household', 'fishing-household', 'bakery-household']);
  for (let seed = 0; seed < 2048 && missing.size; seed++) {
    const life = engine.start(`wsl-resource-sync-${seed}`);
    missing.delete(life.originId);
    const origin = engine.world.origins.find(origin => origin.id === life.originId)!;
    for (const asset of engine.world.economy!.assets) {
      const range = origin.assetRanges![asset.id];
      assert.ok(life.economy!.assets[asset.id] >= range.min && life.economy!.assets[asset.id] <= range.max);
    }
    if (working.has(life.originId)) {
      assert.ok(life.economy!.cash >= 40 && life.economy!.cash <= 140);
      assert.ok(life.economy!.assets['tool-chest'] >= 1);
    }
    assert.equal(life.stats.wealth, getNetWorth(engine.world, life) / engine.world.economy!.unitsPerPoint);
    assert.deepEqual(engine.load(engine.save(life)), life);
    assert.equal(getBirthRollResources(engine.world, life).length, 2);
  }
  assert.equal(missing.size, 0);
});

test('WSL legacy births keep their exact original zero-resource replay', () => {
  const engine = createEngine(previous);
  const life = engine.advance(engine.start('wsl-legacy-resource-sync'));
  assert.deepEqual(life.economy!.assets, {'tool-chest': 0, 'workshop-share': 0});
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test('WSL old official factory upgrades for a fresh life', async () => {
  const { getArchivedBuiltinWorld, getBuiltinWorld } = await import('../server/content.ts');
  const { selectFactoryWorld } = await import('../client/factory-world-selection.ts');
  const engine = createEngine(previous);
  const old = getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!;
  assert.ok(old);
  assert.equal(selectFactoryWorld(old, {fresh: true}).revisionId, getBuiltinWorld().revisionId);
});
