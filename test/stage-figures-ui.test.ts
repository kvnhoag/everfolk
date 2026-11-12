import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Listing, MintPack as Pack, TokenExtra } from "../chain/types.ts";
import { marketRows, keptRows, tokenPageView, tokenTitle } from "../client/chain/token-page-model.ts";
import type { TokenView } from "../client/chain/types.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: new URL(url).pathname,
      }).outputText,
    };
    return nextLoad(url, context);
  },
});

const { TokenPageBody } = await import("../client/chain/TokenPage.tsx");
const { MarketBody } = await import("../client/chain/Market.tsx");
const { default: MintPack } = await import("../client/chain/MintPack.tsx");
hooks.deregister();

const stageExtra = (patch: Partial<TokenExtra> = {}): TokenExtra => ({
  kind: "npc",
  figure_id: null,
  rarity: 1,
  affection: 65,
  action_id: "craft.weave",
  life_id: "8",
  birth_year: -340,
  death_year: -290,
  career_group: "craft",
  sources: [],
  evidence_hash: "f".repeat(64),
  stage_id: "childhood",
  stage_title: "Child of Rhakotis",
  character_name: "Kallias",
  from_age: 6,
  to_age: 11,
  district: "rhakotis",
  field: "craft",
  tier: 2,
  portrait_media: "/assets/pixel/portraits/court-household/male/child-0.svg",
  ...patch,
});

test("tokenTitle formats generic stage figures as character name and stage title", () => {
  const genericStage = stageExtra();
  assert.equal(tokenTitle(genericStage), "Kallias · Child of Rhakotis");

  const historicalStage = stageExtra({
    kind: "figure",
    figure_id: "alexander",
    stage_id: "youth",
    stage_title: "Cavalry Cadet",
  });
  assert.equal(tokenTitle(historicalStage), "Alexander the Great");
});

test("tokenPageView exposes portrait media and stage information", () => {
  const token: TokenView = { owner_id: "alice.testnet", extra: stageExtra() };
  const view = tokenPageView({
    tokenId: "10",
    token,
    stats: { lives_influenced: 2, earned: "0" },
    viewer: "alice.testnet",
    balance: "0",
    listing: null,
    children: [],
    sourceTokens: {},
  });

  assert.equal(view.title, "Kallias · Child of Rhakotis");
  assert.equal(view.portraitMedia, "/assets/pixel/portraits/court-household/male/child-0.svg");
  assert.ok(view.stageInfo);
  assert.equal(view.stageInfo?.stageId, "childhood");
  assert.equal(view.stageInfo?.stageTitle, "Child of Rhakotis");
  assert.equal(view.stageInfo?.district, "rhakotis");
  assert.equal(view.stageInfo?.fromAge, 6);
  assert.equal(view.stageInfo?.toAge, 11);
});

test("marketRows and keptRows preserve portraitMedia for stage figures", () => {
  const token: TokenView = { owner_id: "alice.testnet", extra: stageExtra() };
  const listings: Listing[] = [{ token_id: "10", seller_id: "alice.testnet", price: "2000000000000000000000" }];

  const rows = marketRows(listings, { "10": token }, "bob.testnet");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Kallias · Child of Rhakotis");
  assert.equal(rows[0].portraitMedia, "/assets/pixel/portraits/court-household/male/child-0.svg");

  const kept = keptRows([{ token_id: "10", ...token }]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].title, "Kallias · Child of Rhakotis");
  assert.equal(kept[0].portraitMedia, "/assets/pixel/portraits/court-household/male/child-0.svg");
});

test("TokenPageBody renders stage figure portrait and stage details", () => {
  const token: TokenView = { owner_id: "alice.testnet", extra: stageExtra() };
  const view = tokenPageView({
    tokenId: "10",
    token,
    stats: { lives_influenced: 0, earned: "0" },
    viewer: null,
    balance: "0",
    listing: null,
    children: [],
    sourceTokens: {},
  });

  const html = renderToStaticMarkup(
    createElement(TokenPageBody, {
      tokenId: "10",
      view,
      onSetAction: () => {},
      onWithdraw: () => {},
      onList: () => {},
      onUnlist: () => {},
      onBuy: () => {},
    }),
  );

  assert.ok(html.includes("/assets/pixel/portraits/court-household/male/child-0.svg"), "Should render portrait media");
  assert.ok(html.includes("Child of Rhakotis"), "Should render stage title");
  assert.ok(html.includes("rhakotis"), "Should render district");
});

test("MintPack renders booster pack seal and stage figure choices", () => {
  const pack: Pack = {
    life_id: "8",
    evidence_hash: "f".repeat(64),
    cards: [
      {
        kind: "npc",
        figure_id: null,
        rarity: 1,
        affection: 60,
        action_id: "craft.weave",
        rerolled: false,
        stage_id: "childhood",
        stage_title: "Child of Rhakotis",
        character_name: "Kallias",
        portrait_media: "/assets/pixel/portraits/court-household/male/child-0.svg",
      },
      {
        kind: "figure",
        figure_id: "alexander",
        rarity: 2,
        affection: 80,
        action_id: "alexander.levy",
        rerolled: false,
        stage_id: "youth",
        stage_title: "Cavalry Cadet",
        character_name: "Alexander the Great",
        portrait_media: "/assets/figures/alexander.png",
      },
    ],
    total_fee: "2000000000000000000000",
    reroll_fee: "10000000000000000000000",
    source_share_bps: 5000,
  };

  const mockContract = {
    mintTerms: async () => ({ mint_fee: "2000000000000000000000", reroll_fee: "10000000000000000000000", source_share_bps: 5000, pack_version: 1 }),
    mintPack: async () => pack,
    openMintPack: async () => pack,
    rerollMintSlot: async () => pack,
    chooseMintSlot: async () => ({ token_id: "1", kind: "npc" as const, figure_id: null, rarity: 1, affection: 60 }),
    getLife: async () => null,
    tokensOf: async () => [],
  } as unknown as Parameters<typeof MintPack>[0]["contract"];

  // Initial state renders the unopened booster pack seal button
  const htmlUnopened = renderToStaticMarkup(
    createElement(MintPack, {
      initialPack: pack,
      contract: mockContract,
      onClose: () => {},
    }),
  );
  assert.ok(htmlUnopened.includes("booster-pack"), "Should render booster pack button");
  assert.ok(htmlUnopened.includes("Open your pack"), "Should show open prompt");
});
