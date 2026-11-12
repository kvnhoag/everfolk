import assert from "node:assert/strict";
import test from "node:test";
import { getAvatarAppearance, AVATAR_APPEARANCE_ORIGINS } from "../client/models/avatar-appearance.ts";
import { AVATAR_ORIGIN_IDS, AVATAR_STAGES } from "../client/models/life-background.ts";
import type { AvatarSex, AvatarStage } from "../client/models/life-background.ts";
import { renderAvatarPortrait } from "../scripts/build-avatar-assets.mjs";

function pixels(svg: string) {
  const result = Array.from({ length: 40 }, () => Array<string>(32));
  for (const group of svg.matchAll(/<g fill="(#[a-f0-9]{6})">(.*?)<\/g>/g)) {
    for (const cell of group[2].matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g)) {
      const [x, y, w, h] = cell.slice(1).map(Number);
      assert.ok(w > 0 && h > 0 && x + w <= 32 && y + h <= 40);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        assert.equal(result[yy][xx], undefined, "portrait export geometry must not overlap");
        result[yy][xx] = group[1];
      }
    }
  }
  assert.equal(result.flat().filter(Boolean).length, 1280);
  return result;
}

test("the selected appearance keeps its origin, skin and clothing across all six stages", () => {
  assert.deepEqual(AVATAR_APPEARANCE_ORIGINS.map(origin => origin.id), [...AVATAR_ORIGIN_IDS]);
  for (const originId of AVATAR_ORIGIN_IDS) for (const sex of ["male", "female"] as const) for (let variant = 0; variant < 3; variant++) {
    const first = getAvatarAppearance({ originId, sex, variant, stage: "infant" });
    for (const stage of AVATAR_STAGES) {
      const appearance = getAvatarAppearance({ originId, sex, variant, stage });
      for (const key of ["identityKey", "originId", "sex", "variant", "skin", "shade", "baseHair", "robe", "robeDark", "mantle", "accent", "hairStyle", "faceShape"] as const) assert.equal(appearance[key], first[key], `${originId}/${sex}/${variant}/${stage}/${key}`);
      assert.equal(appearance.hair, stage === "elder" ? "#adb4a6" : first.baseHair);
      assert.equal(appearance.mantle, AVATAR_APPEARANCE_ORIGINS.find(origin => origin.id === originId)!.accent);
      assert.ok(Object.isFrozen(appearance));
    }
  }
});

test("recorded male and female identities have different styles without assigning adult facial hair to children", () => {
  for (const stage of AVATAR_STAGES) for (let variant = 0; variant < 3; variant++) {
    const male = getAvatarAppearance({ originId: "merchant-household", sex: "male", stage, variant });
    const female = getAvatarAppearance({ originId: "merchant-household", sex: "female", stage, variant });
    assert.notEqual(male.hairStyle, female.hairStyle);
    assert.equal(male.skin, female.skin, "sex does not change the selected skin palette");
    assert.equal(female.facialHair, "none");
    if (["infant", "child", "youth"].includes(stage)) assert.equal(male.facialHair, "none");
    assert.notEqual(male.infantBinding, female.infantBinding);
  }
  assert.throws(() => getAvatarAppearance({ originId: "merchant-household", sex: "other" as AvatarSex, variant: 0 }), /recorded male or female/);
  assert.throws(() => getAvatarAppearance({ originId: "merchant-household", sex: "male", variant: 3 }), /variant/);
  assert.throws(() => getAvatarAppearance({ originId: "merchant-household", sex: "male", variant: 0, stage: "unknown" as AvatarStage }), /stage/);
});

test("gender differences are drawn pixels, including child hair and infant binding", () => {
  for (const originId of AVATAR_ORIGIN_IDS) for (const stage of AVATAR_STAGES) for (let variant = 0; variant < 3; variant++) {
    const male = pixels(renderAvatarPortrait({ originId, sex: "male", stage, variant }));
    const female = pixels(renderAvatarPortrait({ originId, sex: "female", stage, variant }));
    const femalePixels = female.flat();
    const differences = male.flat().filter((value, index) => value !== femalePixels[index]).length;
    assert.ok(differences >= (stage === "infant" ? 10 : 20), `${originId}/${stage}/${variant}: only ${differences} gender-specific pixels`);
  }
});

test("portrait exports describe the same appearance data the scene builder receives", () => {
  for (const originId of AVATAR_ORIGIN_IDS) for (const sex of ["male", "female"] as const) for (const stage of AVATAR_STAGES) for (let variant = 0; variant < 3; variant++) {
    const appearance = getAvatarAppearance({ originId, sex, stage, variant });
    const xml = renderAvatarPortrait({ originId, sex, stage, variant });
    const expected = {
      "data-origin": originId, "data-sex": sex, "data-avatar-variant": String(variant), "data-life-stage": stage,
      "data-appearance-key": appearance.identityKey, "data-skin": appearance.skin, "data-hair": appearance.hair,
      "data-hair-style": appearance.hairStyle, "data-facial-hair": appearance.facialHair,
      "data-robe": appearance.robe, "data-accent": appearance.accent,
    };
    for (const [key, value] of Object.entries(expected)) assert.ok(xml.includes(`${key}="${value}"`), `${originId}/${sex}/${stage}/${variant}: ${key}`);
    const actual = pixels(xml).flat();
    assert.ok(actual.includes(appearance.skin));
    assert.ok(actual.includes(appearance.robe));
    assert.ok(actual.includes(appearance.mantle));
  }
});
