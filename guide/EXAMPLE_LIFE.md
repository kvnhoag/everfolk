# Example: the life that became Euclid

This is a real ranked life, played on NEAR testnet on 10 November 2026 and verified by the Everfolk server. Nothing below is invented: every line comes from replaying the saved life against its on-chain record.

It was played on the **demo contract** [`demo.genesis-1794297139-6.testnet`](https://testnet.nearblocks.io/address/demo.genesis-1794297139-6.testnet), which differs from the main contract in three disclosed ways: a life that meets a figure's requirements always becomes that figure (the main contract rolls 5%), every key decision draws someone if anyone is in the pool, and there is no wait after closing a life. The life was played by the scripted Euclid path in `scripts/ranked/path-policies.ts`, not by a person.

| | |
|---|---|
| Player account | `genesis-1794297139-2.testnet` |
| On-chain life | #12, world `alexandria-ranked-1` |
| Born | 350 BCE, into an artisan household near Rhakotis |
| Died | 272 BCE, aged 78, of physical decline |
| Record | 190 accepted commands, 7 on-chain draws, 15 checkpoints |
| Result | **Euclid, the geometer** (NFT #4, Rare) |
| Evidence | SHA-256 `b3a993e5…199d7ad`, stored at `/api/ranked/evidence/<hash>` |

## 1. Born into a world others already shaped

When the life started, the contract assigned its seed and picked one copy of every famous figure already minted. One existed: an earlier **Euclid** (NFT #2), whose owner had chosen *Open a school*. That choice became the first command of this life, before the player did anything.

Two earlier players had minted ordinary lives as copyists (NFTs #1 and #3), both set to *Teach the young*. They wait in the **education** pool, to be drawn at someone's key decision.

## 2. Childhood: two strangers and a school

| Age | Year | What happened | Who shaped it |
|---|---|---|---|
| 3 | 347 BCE | Balanced scraps on a floating reed in a washing bowl. | — |
| 4 | 346 BCE | Flattened spare clay in the workshop courtyard. | — |
| 6 | 344 BCE | **Key decision (education):** a pretend trade with counters. Chose to read the short record of the exchange. | The draw picked **copyist #3**: *"A teacher took you in hand for a season and drilled your letters."* Knowledge +5, literacy +3. |
| 7 | 343 BCE | Persia reconquers Egypt; news travels the coast. | — |
| 7 | 343 BCE | *"A school of demonstrations: a teacher following Euclid's method has opened a school near the harbour."* Went to the lessons. | **Euclid #2**'s chosen action fired. |
| 12 | 338 BCE | **Key decision (education):** a place at the bench. Chose to practise reading and counting; started an apprenticeship. | The draw picked **copyist #1**: letters drilled again. Knowledge +4, literacy +3. |

## 3. Work and a first accomplishment

| Age | Year | What happened |
|---|---|---|
| 14 | 336 BCE | Alexander becomes king of Macedon. **Key decision (work):** took porter work on the quays. The draw found no one in the work pool. Studied the Moon's positions at night. |
| 16 | 334 BCE | **Key decision (work):** chose the copyist's place over the potter's bench. |
| 18 | 332 BCE | Alexander arrives in Egypt. |
| 19 | 331 BCE | Alexander founds Alexandria beside Rhakotis. Helped check loads for the king's party. Corrected a copy of *Charis's Seasonal Table*: first work in astronomy and calendar tables (**accomplishment**). |
| 22 | 328 BCE | Became a sky-table calculator. |
| 24 | 326 BCE | Became a patron-supported reader, and held that work for life. |

Later key decisions (about family at 65, accounts at 68, a bad season at 73) drew from the spirit and money pools, which were empty on the demo contract.

## 4. The end, and the proof

The player died at 78 with **literacy 85.8, reckoning 85.5, astronomy 85.5 and knowledge 75.7**. The verifier did not take the browser's word for any of it. It:

1. read life #12 from NEAR: seed, figure picks, all 7 draws and 15 checkpoints;
2. checked the save starts with the Euclid activation and contains exactly the drawn influences, at the steps they were drawn;
3. replayed all 190 commands one by one, checking that every key decision had its draw in the right category, that no draw appeared anywhere else, and that a checkpoint was posted every five game years;
4. compared the final state with Euclid's requirements: a scholarly job, reckoning ≥ 80, literacy ≥ 70, knowledge ≥ 60, and an astronomy or philosophy accomplishment. All were met;
5. signed the evidence with its Ed25519 key.

`mint_life` checked that signature on chain, rolled randomness, and minted **Euclid** (Rare, power ×1.5).

## 5. Who got paid

The evidence names three sources, weighted by how much each changed the life:

| Source | Owner | What it did | Impact | Share |
|---|---|---|---|---|
| Euclid #2 | another player | the school (a decision event, weight 3 × Rare 1.5) | 45,000 | 40% |
| Copyist #3 | the copyist's player | letters at age 6 (3 × Uncommon 1.25) | 37,500 | 33.3% |
| Copyist #1 | the copyist's player | letters at age 12 (3 × Common 1.0) | 30,000 | 26.7% |

From the 1 NEAR mint fee, half went to these sources by share: 0.2 NEAR to Euclid #2's owner and 0.3 NEAR to the copyist's player. The rest went to the treasury, after paying for the new token's storage.

Then the new Euclid was listed for 2 NEAR and bought by a fourth account. The in-game market paid 5% to the same sources (the copyist's player got another 0.06 NEAR), 5% to the treasury, and the rest to the seller. Each source owner withdraws their earnings with `withdraw`.

## 6. What happens next

The new Euclid's owner keeps *Open a school*, or switches it to *Keep to the Museum*. Either way, every ranked life born from now on may be shaped by it, and when those lives are minted, this Euclid earns too.

To replay this whole story yourself, see [Running the demo](TUTORIAL.md#running-the-demo).
