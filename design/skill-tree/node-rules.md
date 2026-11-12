# Exact node rules

Design proposal, 2026-11-12. Read [the main design](design.md) for learning, production and availability rules. Every listed parent is required; numeric proficiency gates are additional. Proof grade N always means quality at least N. Eligible paid materials include self-produced, cost-traced intermediates and explicitly employer-owned apprenticeship stock; they need not be repurchased. These are review values, not implemented balance.

## Farming

### F1 · Depth 1 · Fieldwork

- **Path:** Shared foundation.
- **Prerequisites:** Entry node; no skill-node parent. farming ≥ 0.
- **Proof:** Complete 1 annual fieldwork action, hired or on a household plot.
- **Reward:** Unlock ordinary cultivation plan; +3 Farming from each subsequent completed farming work year.

### F2 · Depth 2 · Seed handling

- **Path:** Shared foundation.
- **Prerequisites:** F1. farming ≥ 8.
- **Proof:** Complete 1 sowing cycle with its seed debited from inventory; retain seed for the following cycle.
- **Reward:** Unlock a seed reserve: default 10 grain per grain plot, protected from automatic surplus sales. Flax sowing consumes 2 purchased flax-seed units/plot; reserve that input separately.

### F3S · Depth 3 · Soil knowledge

- **Path:** Shared foundation.
- **Prerequisites:** F2. farming ≥ 16.
- **Proof:** Complete 1 soil-preparation work year; record plot allocation and resulting harvest.
- **Reward:** Unlock soil preparation: spend the annual work action for +5% gross grain/flax yield this year; no automatic bonus.

### F3W · Depth 3 · Water management

- **Path:** Shared foundation.
- **Prerequisites:** F2. farming ≥ 16.
- **Proof:** Complete 1 channel-maintenance work year, including its quoted cost; no low flood required.
- **Reward:** Unlock maintained channels: 8 dr per plot/year; low-flood yield factor becomes 0.55 instead of 0.45 while maintained; other flood factors unchanged.

### F4 · Depth 4 · Seasonal planning

- **Path:** Shared foundation.
- **Prerequisites:** F3S AND F3W. farming ≥ 24.
- **Proof:** Complete 1 planned harvest with recorded plot/labour allocation and seed reserve.
- **Reward:** Unlock annual production-plan preview with rent, rations, seed, feed and remaining saleable surplus; unlock both specializations.

### FC5 · Depth 5 · Sowing methods

- **Path:** Cultivation.
- **Prerequisites:** F4. farming ≥ 32.
- **Proof:** Complete 1 prepared sowing cycle with full seed allocation.
- **Reward:** Unlock dense sowing: consume 20 rather than 10 seed grain per plot; +6% gross yield at normal/high flood, no yield increase at low flood.

### FC6 · Depth 6 · Crop care

- **Path:** Cultivation.
- **Prerequisites:** FC5. farming ≥ 40.
- **Proof:** Complete 2 crop-care work years.
- **Reward:** Crop-care activity gives +8% gross yield in its work year instead of the +5% soil-preparation action; they are alternative annual actions.

### FC7 · Depth 7 · Water allocation

- **Path:** Cultivation.
- **Prerequisites:** FC6. farming ≥ 48.
- **Proof:** Complete 2 maintained-channel harvests, under any flood condition.
- **Reward:** Maintained-channel low-flood factor becomes 0.60; maintenance remains 8 dr/plot/year; replaces the 0.55 effect.

### FC8 · Depth 8 · Crop allocation

- **Path:** Cultivation.
- **Prerequisites:** FC7. farming ≥ 56.
- **Proof:** Complete 2 different single-crop harvest plans (grain then flax, or the reverse), retaining the applicable next-year seed. Mixed allocation is not required before its unlock.
- **Reward:** Unlock coordinated mixed-crop planning; +5% flax yield on assigned flax plots; grain plots and animal feed remain actual resource constraints.

### FC9 · Depth 9 · Yield reliability

- **Path:** Cultivation.
- **Prerequisites:** FC8. farming ≥ 64.
- **Proof:** Complete 2 planned harvests whose household grain ledger reconciles, with full household rations.
- **Reward:** Unlock conservative planting: +15% gross yield during low flood, -5% at normal/high flood; alternative to dense sowing, never stacked with it.

### FC10 · Depth 10 · Integrated cultivation

- **Path:** Cultivation.
- **Prerequisites:** FC9. farming ≥ 72.
- **Proof:** Complete a 2-work-year integrated plan, each year providing full household rations and next-year seed.
- **Reward:** Unlock one integrated annual action combining channel maintenance with crop care within available labour; pay both costs. Combined sowing/crop-care/flax plan bonuses are capped at +20%; flood-factor correction is separate. Qualify for master cultivator work offers.

### FR5 · Depth 5 · Grain preservation

- **Path:** Resilience.
- **Prerequisites:** F4. farming ≥ 32.
- **Proof:** Store at least 240 grain across 1 annual settlement; the household must receive full rations.
- **Reward:** Reduce the configured in-capacity grain spoilage rate by 15% relative: 8% becomes 6.8%; never changes over-capacity spoilage. Apply after existing reductions; total in-capacity reduction cannot exceed 75% of configured base.

### FR6 · Depth 6 · Reserve budgeting

- **Path:** Resilience.
- **Prerequisites:** FR5. farming ≥ 40; reckoning ≥ 16.
- **Proof:** Complete 1 settlement retaining a full coming-year household ration plus seed; food served must be recorded.
- **Reward:** Unlock protected food/seed reserve plans. Voluntary sales below reserve require an explicit override; reserves create no grain.

### FR7 · Depth 7 · Storehouse management

- **Path:** Resilience.
- **Prerequisites:** FR6. farming ≥ 48.
- **Proof:** Complete 1 paid store repair/inspection and 1 annual stock reconciliation.
- **Reward:** Unlock a +500-capacity store extension: 80 dr, 4 timber and 5 clay, 1 work year; upkeep 4 dr/year. Materials and paid work are separate recorded costs; one extension per household.

### FR8 · Depth 8 · Reserve replenishment

- **Path:** Resilience.
- **Prerequisites:** FR7. farming ≥ 56; reckoning ≥ 24.
- **Proof:** Restore the full food/seed reserve in 2 different years after normal household consumption.
- **Reward:** Unlock automatic surplus allocation targets: food, seed, animal feed, then sale. Reduce in-capacity spoilage by 25% relative to base, replacing the earlier 15%.

### FR9 · Depth 9 · Shortage preparedness

- **Path:** Resilience.
- **Prerequisites:** FR8. farming ≥ 64.
- **Proof:** Either feed the household fully during 1 low-flood year using reserves, OR finish 2 years with stored food covering 1.5 annual household rations plus seed.
- **Reward:** Unlock contingency purchase plans capped by player cash and merchant stock; never borrow automatically. Spoilage reduction becomes 30% relative to base, replacing 25%.

### FR10 · Depth 10 · Resilient husbandry

- **Path:** Resilience.
- **Prerequisites:** FR9. farming ≥ 72; reckoning ≥ 32.
- **Proof:** Complete 3 consecutive annual settlements with full rations, seed reserved and no new emergency food debt; the same years may be ordinary flood years.
- **Reward:** Unlock a 2-year reserve/maintenance plan using existing resources; in-capacity spoilage reduction becomes 35% relative to base, replacing 30%. Qualify for master household-farmer work offers.

## Artisan

### A1 · Depth 1 · Safe hand tools

- **Path:** Shared foundation.
- **Prerequisites:** Entry node; no skill-node parent. craft ≥ 0.
- **Proof:** Complete 1 supervised tool-practice work year; workshop-owned practice stock is not player inventory.
- **Reward:** Unlock hired workshop practice and rental tools; introductory access fee 2 dr per work year.

### A2 · Depth 2 · Measuring and cutting

- **Path:** Shared foundation.
- **Prerequisites:** A1. craft ≥ 8; reckoning ≥ 8.
- **Proof:** Complete 1 measurement/cutting exercise within 5% of the stated exercise target dimensions.
- **Reward:** Unlock measured material estimates for recipes and cutting exercises; no material-efficiency discount yet.

### A3 · Depth 3 · Material preparation

- **Path:** Shared foundation.
- **Prerequisites:** A2. craft ≥ 16.
- **Proof:** Complete 2 preparation jobs in any one of textiles, clay or wood/stone. Distinct work years; each job records paid inputs.
- **Reward:** Unlock supervised starter templates for thread, linen, one basic garment, one fired vessel or one clay model. Garment/vessel/model starter batches are limited to 1 output and quality 1, with the normal access fee plus 2 dr supervision. Each specialty can complete its own foundation proof.

### A4 · Depth 4 · Controlled making

- **Path:** Shared foundation.
- **Prerequisites:** A3. craft ≥ 24.
- **Proof:** Complete 2 supervised starter-production jobs in any material line, each in a distinct work year, with paid inputs, reconciled output and at least 1 sellable result.
- **Reward:** Unlock independent basic production: garment batch cap 2, vessel cap 4 and clay-model cap 2, quality cap 1. Remove the 2 dr supervision fee. Unlock optional inspection: +1 quality for 3 dr/batch, still limited by the learned quality cap.

### AT5 · Depth 5 · Garment assembly

- **Path:** Clothing.
- **Prerequisites:** A4. craft ≥ 32.
- **Proof:** Complete 2 basic-garment work years, each producing at least 1 quality-1 garment from paid materials.
- **Reward:** Unlock fitted-garment method, quality cap 2; garment batch limit becomes 4.

### AT6 · Depth 6 · Patterns and dyes

- **Path:** Clothing.
- **Prerequisites:** AT5. craft ≥ 40.
- **Proof:** Complete 2 quality-2 garment batches; each must reconcile cloth/thread consumption.
- **Reward:** Garment quality cap becomes 3. Unlock dyed garments: 1 pigment/garment for +1 recipe quality before cap, base ask 130 dr; dye/colour-specific orders check actual pigment use.

### AT7 · Depth 7 · Tailoring fit

- **Path:** Clothing.
- **Prerequisites:** AT6. craft ≥ 48.
- **Proof:** Complete 2 inspected quality-2 garment orders; all units must meet the quoted specification.
- **Reward:** Garment quality cap becomes 3; batch limit 6. Unlock fit/finish commissions with explicit quoted payment.

### AT8 · Depth 8 · Batch cutting

- **Path:** Clothing.
- **Prerequisites:** AT7. craft ≥ 56; reckoning ≥ 24.
- **Proof:** Complete 2 quality-3 garment batches of at least 4 units each.
- **Reward:** Garment batch limit becomes 8. For batches of at least 4, total base cloth requirement becomes ceil(recipe cloth units * quantity * 7 / 8), applied to the actual recipe base cloth requirement; thread and pigment unchanged.

### AT9 · Depth 9 · Fine finishing

- **Path:** Clothing.
- **Prerequisites:** AT8. craft ≥ 64.
- **Proof:** Deliver 2 quality-3 garment contracts on time, with recorded payment and no unpaid supplier balance.
- **Reward:** Garment quality cap becomes 4; batch limit 10. Unlock ceremonial garment recipe.

### AT10 · Depth 10 · Masterwork tailoring

- **Path:** Clothing.
- **Prerequisites:** AT9. craft ≥ 72.
- **Proof:** Complete 1 registered masterwork assessment over 2 work years: 4 quality-4 ceremonial garments in total, fully paid inputs and accepted inspection.
- **Reward:** Garment quality cap becomes 5; batch limit 12. Qualify for Master Tailor career offers; unlock repair/restoration contracts. No cash awarded solely for learning.

### AC5 · Depth 5 · Vessel forming

- **Path:** Ceramics.
- **Prerequisites:** A4. craft ≥ 32; pottery ≥ 8.
- **Proof:** Complete 2 fired-vessel production years with at least 1 quality-1 sellable vessel each.
- **Reward:** Vessel quality cap 2; batch limit 6.

### AC6 · Depth 6 · Controlled firing

- **Path:** Ceramics.
- **Prerequisites:** AC5. craft ≥ 40; pottery ≥ 16.
- **Proof:** Complete 2 quality-2 fired-vessel batches with fuel and kiln fees recorded.
- **Reward:** Vessel quality cap becomes 3. Unlock controlled firing: consume 1 extra fuel per 4 vessels (round up) for +1 recipe quality before cap; vessel batch limit 8.

### AC7 · Depth 7 · Form and decoration

- **Path:** Ceramics.
- **Prerequisites:** AC6. craft ≥ 48; pottery ≥ 24.
- **Proof:** Complete 2 inspected quality-2 vessel orders.
- **Reward:** Vessel quality cap 3; batch limit 10. Unlock decorated vessels, consuming 1 pigment per 4 vessels (round up).

### AC8 · Depth 8 · Kiln batching

- **Path:** Ceramics.
- **Prerequisites:** AC7. craft ≥ 56; pottery ≥ 32; reckoning ≥ 24.
- **Proof:** Complete 2 quality-3 batches of at least 8 vessels.
- **Reward:** Batch limit 12; base fuel becomes ceil(vessels / 2), replacing 1 fuel/vessel. Controlled-firing extra fuel remains payable.

### AC9 · Depth 9 · Reliable ceramic sets

- **Path:** Ceramics.
- **Prerequisites:** AC8. craft ≥ 64; pottery ≥ 40.
- **Proof:** Deliver 2 quality-3 matched-set contracts on time with reconciled materials.
- **Reward:** Vessel quality cap 4; batch limit 14. Unlock matched sets with a minimum-quality contract check, not automatic extra retail demand.

### AC10 · Depth 10 · Master ceramic work

- **Path:** Ceramics.
- **Prerequisites:** AC9. craft ≥ 72; pottery ≥ 48.
- **Proof:** Complete 1 registered assessment over 2 work years: 12 quality-4 decorated vessels in total, including 1 accepted matched set.
- **Reward:** Vessel quality cap 5; batch limit 16. Qualify for Master Potter career offers; unlock large commission bids.

### AS5 · Depth 5 · Modelling and relief

- **Path:** Sculpture.
- **Prerequisites:** A4. craft ≥ 32; carving ≥ 20; pottery ≥ 10; sculpture ≥ 8.
- **Proof:** Complete 1 clay-model job and 1 wood-relief practice job after A4; both record paid materials.
- **Reward:** Unlock small relief recipe, sculpture quality cap 2; maximum 2 small pieces per work year.

### AS6 · Depth 6 · Stone cutting

- **Path:** Sculpture.
- **Prerequisites:** AS5. craft ≥ 40; sculpture ≥ 16.
- **Proof:** Complete 2 quality-2 relief production jobs with measured material use.
- **Reward:** Unlock stone figurines; 1 stone block + 1 timber support per figurine, maximum 2/year; tool rental 8 dr/work year.

### AS7 · Depth 7 · Proportion and likeness

- **Path:** Sculpture.
- **Prerequisites:** AS6. craft ≥ 48; sculpture ≥ 24; carving ≥ 28.
- **Proof:** Complete 2 inspected quality-2 stone-figure jobs.
- **Reward:** Sculpture quality cap 3. Unlock portrait/bust recipe, maximum 1/year.

### AS8 · Depth 8 · Large-work planning

- **Path:** Sculpture.
- **Prerequisites:** AS7. craft ≥ 56; sculpture ≥ 32; reckoning ≥ 24.
- **Proof:** Complete 1 quality-3 bust and 1 reconciled project budget.
- **Reward:** Unlock 2-work-year large relief projects; inputs reserved at start, progress resumes after interruption without duplicating output.

### AS9 · Depth 9 · Commission execution

- **Path:** Sculpture.
- **Prerequisites:** AS8. craft ≥ 64; sculpture ≥ 40; carving ≥ 36.
- **Proof:** Complete 1 quality-3 large relief project on its agreed work-year deadline; account for every input and payment.
- **Reward:** Sculpture quality cap 4. Unlock monumental-work assessment; the assessment contract is routinely offered when eligible.

### AS10 · Depth 10 · Masterwork sculpture

- **Path:** Sculpture.
- **Prerequisites:** AS9. craft ≥ 72; sculpture ≥ 48.
- **Proof:** Complete 1 registered quality-4 monument assessment over 2 work years, with paid materials and accepted measurement/finish review.
- **Reward:** Sculpture quality cap 5. Qualify for Master Sculptor career offers; unlock monumental/restoration commissions.

## Philosophy

### P1 · Depth 1 · Reading and questioning

- **Path:** Shared foundation.
- **Prerequisites:** Entry node; no skill-node parent. philosophy ≥ 0; literacy ≥ 10.
- **Proof:** Complete 1 guided reading/discussion session; record a question and its stated evidence.
- **Reward:** Unlock guided philosophy practice: 1 papyrus + 1 ink + 2 dr teaching fee per work year.

### P2 · Depth 2 · Reasoned argument

- **Path:** Shared foundation.
- **Prerequisites:** P1. philosophy ≥ 8; literacy ≥ 16; oratory ≥ 8.
- **Proof:** Complete 1 argument exercise with a claim, 2 recorded reasons, 1 counterargument and a response.
- **Reward:** Unlock structured debate activities; each completed ordinary debate grants +3 Philosophy and +2 Oratory, once per work year.

### P3 · Depth 3 · Evidence and comparison

- **Path:** Shared foundation.
- **Prerequisites:** P2. philosophy ≥ 16; reckoning ≥ 8.
- **Proof:** Complete 2 comparisons of distinct observations or accounts; identify at least 1 disagreement.
- **Reward:** Unlock comparison records and fact-checking tasks. Claims are evaluated against recorded world/exercise data, not a random approval roll.

### P4 · Depth 4 · Inquiry and ethics

- **Path:** Shared foundation.
- **Prerequisites:** P3. philosophy ≥ 24; literacy ≥ 24.
- **Proof:** Complete 1 reviewed inquiry and 1 reasoned public dilemma exercise. Review checks evidence/process, not a required moral stance.
- **Reward:** Unlock research and civic specializations; qualify for Philosopher/tutor career offers and paid copying work from finite payer budgets.

### PS5 · Depth 5 · Systematic observation

- **Path:** Research.
- **Prerequisites:** P4. philosophy ≥ 32; reckoning ≥ 16.
- **Proof:** Complete 2 observation projects in different work years, using distinct recorded data.
- **Reward:** Unlock paid observation-record contracts: base fee 20 dr; each project consumes 1 papyrus and 1 ink.

### PS6 · Depth 6 · Measurement and calculation

- **Path:** Research.
- **Prerequisites:** PS5. philosophy ≥ 40; reckoning ≥ 24.
- **Proof:** Complete 2 measurement exercises within 2% of the stated reference, with calculations retained.
- **Reward:** Unlock surveys and calculations: base fee 40 dr/project; 2 papyrus + 1 ink + 5 dr instrument rental.

### PS7 · Depth 7 · Testable explanations

- **Path:** Research.
- **Prerequisites:** PS6. philosophy ≥ 48; reckoning ≥ 28; literacy ≥ 32.
- **Proof:** Complete 1 explanation stating its predicted result before observing the outcome; compare it with recorded results.
- **Reward:** Unlock planned field investigations and competing explanations; accepted investigation base fee 60 dr, costing 2 papyrus + 2 ink + 5 dr instrument rental.

### PS8 · Depth 8 · Independent checking

- **Path:** Research.
- **Prerequisites:** PS7. philosophy ≥ 56; reckoning ≥ 32.
- **Proof:** Complete 2 checked investigations in different work years; an ordinary NPC reviewer reproduces its recorded results within 2%.
- **Reward:** Unlock reviewed-method contracts: base fee 90 dr; investigation inputs plus 5 dr review fee. Reviewer access is regular, never a named-figure lottery.

### PS9 · Depth 9 · Research synthesis

- **Path:** Research.
- **Prerequisites:** PS8. philosophy ≥ 64; reckoning ≥ 40; literacy ≥ 40.
- **Proof:** Complete 1 synthesis of at least 3 earlier distinct records spanning 2 years, with 2 independently checked results.
- **Reward:** Unlock 2-work-year treatise projects: base fee 180 dr on acceptance, total 4 papyrus + 3 ink + 10 dr instrument/review fees.

### PS10 · Depth 10 · Original inquiry

- **Path:** Research.
- **Prerequisites:** PS9. philosophy ≥ 72; reckoning ≥ 48; literacy ≥ 48.
- **Proof:** Complete 1 registered 2-work-year original-inquiry assessment: predeclared question, 2 distinct results, independent check and a defensible conclusion, including a valid negative finding.
- **Reward:** Qualify for Scientist career offers; unlock leading a funded research project, whose complete fee and material budget are quoted before acceptance.

### PP5 · Depth 5 · Public speaking

- **Path:** Civic practice.
- **Prerequisites:** P4. philosophy ≥ 32; oratory ≥ 16.
- **Proof:** Complete 2 public addresses on different local issues, each citing 2 recorded facts and 1 explicit trade-off.
- **Reward:** Unlock civic hearing work: base fee 20 dr, 1 papyrus + 1 ink/project; completed competent service adds +2 district reputation.

### PP6 · Depth 6 · Negotiation

- **Path:** Civic practice.
- **Prerequisites:** PP5. philosophy ≥ 40; oratory ≥ 24; reckoning ≥ 16.
- **Proof:** Complete 2 agreements where each party has the offered stock/cash and accepts the recorded terms.
- **Reward:** Unlock mediation contracts: base fee 40 dr, 1 papyrus + 1 ink/project; fulfilled agreements add +3 district reputation.

### PP7 · Depth 7 · Public accounts

- **Path:** Civic practice.
- **Prerequisites:** PP6. philosophy ≥ 48; oratory ≥ 28; reckoning ≥ 24.
- **Proof:** Complete 1 public budget with all money/materials reconciled and 1 completed service within that budget.
- **Reward:** Unlock administration contracts: base fee 60 dr, 2 papyrus + 1 ink/project; public funds remain a separate ledger, never personal cash. Successful service adds +4 reputation.

### PP8 · Depth 8 · Coalition building

- **Path:** Civic practice.
- **Prerequisites:** PP7. philosophy ≥ 56; oratory ≥ 32; literacy ≥ 32.
- **Proof:** Complete 2 agreements involving at least 2 distinct local groups; fulfill the recorded commitments.
- **Reward:** Unlock multi-party civic projects: base fee 90 dr, 2 papyrus + 2 ink/project; fulfilled projects add +4 reputation and record which groups benefited.

### PP9 · Depth 9 · Policy and consequences

- **Path:** Civic practice.
- **Prerequisites:** PP8. philosophy ≥ 64; oratory ≥ 40; reckoning ≥ 32.
- **Proof:** Complete 1 2-work-year policy project with declared costs, affected groups and 1 follow-up evaluation against actual outcomes.
- **Reward:** Unlock policy proposals and their before/after public ledger preview: base fee 180 dr, 4 papyrus + 3 ink total; fulfilled, evaluated service adds +5 reputation.

### PP10 · Depth 10 · Statesmanship

- **Path:** Civic practice.
- **Prerequisites:** PP9. philosophy ≥ 72; oratory ≥ 48; literacy ≥ 40.
- **Proof:** Complete 1 registered civic assessment: present a funded plan, secure an agreement, deliver it and reconcile the public account across 2 work years. District reputation at least 60.
- **Reward:** Qualify for Politician career offers; unlock seeking public office and proposing district policy. Appointment needs an available funded role; learning grants neither public money nor automatic office.

## Trade

### T1 · Depth 1 · Measures and exchange

- **Path:** Commercial planning.
- **Prerequisites:** Entry node; no skill-node parent. reckoning ≥ 0.
- **Proof:** Complete 1 supervised stock-counting job or recorded purchase/sale with correct quantity and payment.
- **Reward:** Unlock counting practice and a simple lot ledger. Prices, totals and ordinary market access are already visible without this node.

### T2 · Depth 2 · Cost accounting

- **Path:** Commercial planning.
- **Prerequisites:** T1. reckoning ≥ 8; literacy ≥ 8.
- **Proof:** Reconcile 1 paid material basket: cash spent equals item quantities at their accepted quotes plus explicit fees.
- **Reward:** Unlock cost basis per lot and gross-margin previews using the current buyer quote; no guarantee of a future sale price.

### T3 · Depth 3 · Price comparison

- **Path:** Commercial planning.
- **Prerequisites:** T2. reckoning ≥ 16; literacy ≥ 12.
- **Proof:** Record 3 actual item quotes across at least 2 market years and compare each against a recorded acquisition cost.
- **Reward:** Unlock bid/ask target plans for the existing annual market visit; plans cannot spend missing cash or trade with missing stock.

### T4 · Depth 4 · Inventory planning

- **Path:** Commercial planning.
- **Prerequisites:** T3. reckoning ≥ 24; literacy ≥ 16.
- **Proof:** Complete 2 distinct annual stock reconciliations with recorded purchases, sales, consumption and remaining inventory.
- **Reward:** Unlock item-by-item stock targets and costed replenishment plans. Basic baskets remain accessible; replenishment is not an extra market visit.

### T5 · Depth 5 · Commercial production planning

- **Path:** Commercial planning.
- **Prerequisites:** T4. reckoning ≥ 32; literacy ≥ 20; AND either farming ≥ 8 OR craft ≥ 8.
- **Proof:** Complete 2 costed supply plans using either farm output or artisan products; source every input and fulfill the stated output/delivery.
- **Reward:** Unlock demand-led production and purchase plans that compare actual material cost, labour, stock and buyer budget. Farming yield and artisan recipes still require their own skills.

### T6 · Depth 6 · Negotiated supply

- **Path:** Commercial planning.
- **Prerequisites:** T5. reckoning ≥ 40; oratory ≥ 16.
- **Proof:** Fulfill 2 pre-agreed, funded fixed-price orders. Orders are distinct work-year jobs; introductory fixed-price delivery work is available before this node.
- **Reward:** Unlock counteroffers within 10% of the posted reference price in return for quantity or lead-time terms; the NPC acceptance bounds, budget and stock are explicit. No automatic price premium.

### T7 · Depth 7 · Delivery logistics

- **Path:** Commercial planning.
- **Prerequisites:** T6. reckoning ≥ 48; oratory ≥ 20.
- **Proof:** Complete 2 paid delivery work years within the agreed work-year deadline, with cargo and fees reconciled.
- **Reward:** Unlock scheduled deliveries with at most 2 item lines; baseline haulage is 12 dr/order and quantities stay within the market and carrier limits shown before acceptance. Delivery consumes the work action and existing visit; it adds neither a free visit nor unearned soldier capability.

### T8 · Depth 8 · Stock turnover

- **Path:** Commercial planning.
- **Prerequisites:** T7. reckoning ≥ 56; literacy ≥ 28.
- **Proof:** Complete 2 trading work years with non-negative realized gross margin, actual paid receipts and reconciled closing stock.
- **Reward:** Unlock repeat restock/sale plans with user-set cash and quantity caps. Every execution remains subject to current quotes, finite demand and the annual visit budget.

### T9 · Depth 9 · Enterprise accounts

- **Path:** Commercial planning.
- **Prerequisites:** T8. reckoning ≥ 64; literacy ≥ 36; oratory ≥ 28.
- **Proof:** Deliver 2 funded contracts with itemized supplier costs, access/transport fees, final payment and closing stock; no unpaid supplier amount.
- **Reward:** Unlock quoted 2-work-year supply contracts and their cash-flow preview. Payer reserves payment; player does not receive the full future payment in advance.

### T10 · Depth 10 · Commercial stewardship

- **Path:** Commercial planning.
- **Prerequisites:** T9. reckoning ≥ 72; literacy ≥ 40; oratory ≥ 32.
- **Proof:** Complete a 2-work-year assessment delivering 2 funded orders to 2 distinct buyer accounts; reconcile cash, stock, fees and commitments in both years.
- **Reward:** Qualify for Merchant or Trading-house manager career offers. Unlock an integrated 2-year stock/order/delivery plan within the existing action and visit limits; this grants no free goods, price immunity or personal ownership of employer funds.
