# How to play Everfolk

Everfolk is a life you live from birth to death in Rhakotis, the old Egyptian settlement where Alexander founded Alexandria in 331 BCE. Each year you choose what to focus on; now and then life puts a decision in front of you. Your skills, work, money, health and relationships grow out of those choices.

There are two ways to play:

- **Free play** — no account, no wallet, saved in your browser. Good for learning the game.
- **Ranked life** — the same game, recorded on NEAR. Other players' lives can reach into yours, and when your life ends you can mint it as an NFT: an ordinary person of the city, or, rarely, a famous figure such as Euclid.

## Part 1 — Living a life (free play)

**1. Be born.** Press **Begin a new life**. The game rolls your household (a weaver's, a merchant's, a soldier's, a royal household…), your name and your starting health, knowledge, wealth and bonds. Pick one of three portraits and press **Begin life**. Don't like the roll? **Reborn** rolls again (free play only).

**2. Let the years pass.** Time runs on its own; use **Pause** and the speed buttons (1× to 16×), or **Next decision** to jump straight to the next moment that needs you. Infancy and early childhood mostly happen to you; your choices start to matter from about age six.

**3. Choose this year's focus.** Under **This year's focus**, pick what you spend the year on: *Study*, *Woodwork*, *Pottery*, *Wood carving*, *Stone sculpture*, *Friends*, *Health* or *Everyday life*. Focus is how skills grow. Learning slows as a skill rises, so reaching the top of one takes a lifetime.

**4. Answer decisions.** When **A decision is waiting**, press **Open decision**. Each option shows what it may change before you choose. Some decisions open paths: a place at a copyist's bench, a reader's introduction, an army post, a loan from a moneylender.

**5. Grow a career.** Jobs unlock as your skills meet their requirements, from porter or apprentice up to workshop lead, sky-table calculator, patron-supported reader, court adviser or general. **Skill wiki** shows every skill path and what each one needs. Notable work earns **Works & deeds**: accomplishments named after the route you followed.

**6. Look after yourself.** Health falls with age, hard work and bad luck; illness and debt can end a life early. **Family & life** shows the people around you; **Spend** lets you use your money.

**7. See your life.** The **Life record** lists what happened, newest first; **Full chronicle** shows all of it. When you die, review the life and begin another.

Turn on **Auto mode** to let the game make safe choices for you; it pauses when a decision is risky.

## Part 2 — Ranked lives on NEAR

### Before you start

You need a NEAR **testnet** account in MyNearWallet or Meteor Wallet, with a little test NEAR (minting costs 1 NEAR). Ranked play is only available when the server is set up for it; otherwise the menu says so and free play works as usual.

### Step by step

**1. Start.** On the main menu choose **Ranked life**, then **Connect a NEAR wallet**. Signing in lets the game make the small, free calls a life needs (start, draws, checkpoints) without asking you each time. Anything that costs NEAR still opens your wallet.

**2. See the world you are born into.** The contract chooses your seed, so nobody — not you, not the game — can pick a lucky birth. It also chooses one copy of every famous figure already minted, and shows what each is doing: *"Euclid (alice.testnet) has opened a school."* Press **Begin this life**.

**3. Live it.** Play exactly as in free play. Two things are different:

- At a **key decision** (study, work, war, money, risk, family) the contract may draw another player's minted life into yours. You'll see who reached you and what they did — a teacher who drilled your letters, a veteran who taught you to keep your footing, a merchant who gave you credit. Its owner chose that action; its rarity sets how strong it is.
- Every five years the game posts a **checkpoint** to NEAR. A ranked life can't be rewound or rerolled; there is no **Begin another life** button until it ends.

**4. When you die: "Who shaped your life".** The server replays your whole life against its on-chain record and checks it. Then you see every source that shaped your life and its share — for example *Euclid 40%, a scholar 33%, a scholar 27%*.

**5. Mint it — or not.** Pick what your life will do for others (the menu depends on your career: a scholar can *Teach the young* or *Lend books*; a soldier can *Mentor a recruit* or *Warn of the levy*…) and press **Mint for 1 NEAR**. Half the fee goes to the lives that shaped yours, in proportion to their share.

Prefer not to? **Not this time** lets you **Keep it for later** (mint any time from **Ranked life**) or **Close this life**, after which you can start a new ranked life in 10 minutes.

**6. The reveal.** Randomness on NEAR decides what your life becomes:

- a **person of the city** — a Craftworker, Scholar or Soldier of Alexandria, with a rarity from Common to Legendary and an Affection from 1 to 100; or
- a **famous figure**, if your life met that figure's requirements and wins the roll (about 5%; at most five copies of each figure exist).

**Affection** is how often your life is drawn into other players' stories. **Rarity** is how strongly it acts when it is.

**7. Your NFT's page.** It shows **Lives touched** — how many lives yours has shaped and what it has earned — your balance with a **Withdraw** button, and **What it does**, where you can change its action (**Make this its deed**). The change applies to lives born afterwards, never to lives already lived.

**8. The market.** List your NFT for sale or buy others from **Market**. Every sale pays 5% to the lives that shaped it and 5% to the treasury. Everfolk NFTs follow NEAR's NFT standards, so other marketplaces can trade them too.

### Becoming a famous figure

A figure is a life that went a particular way. Requirements are checked on the verified replay:

| Figure | What the life needs | What its owner can make it do |
|---|---|---|
| **Euclid**, the geometer | Work as a sky-table calculator, patron-supported reader or philosophy tutor; reckoning 80, literacy 70, knowledge 60; a first work in astronomy or philosophy | *Open a school* (children learn letters and figures) · *Keep to the Museum* (gifted readers may get a scholar's post) |
| **Aristotle**, the philosopher | Work as a philosophy tutor or court adviser; literacy 76, philosophy 76, oratory 50, knowledge 60; a philosophy accomplishment | *Found the Lyceum* · *Tutor the court* |
| **Cleomenes**, the grain administrator | Work as a court adviser or shopkeeper; reckoning 80, literacy 50, wealth 90; a commerce accomplishment | *Corner the grain* (merchants profit, the poor go short) · *Fill the granaries* (rations in famine years) |
| **Alexander**, the conqueror | Born into the royal household; become a general; warfare 70, oratory 50; a military accomplishment by age 32 | *Levy the city* (serve, flee or pay) · *Found and build* (new work and plots) |

A player who deliberately follows one of these paths meets the requirements in roughly a fifth to a third of lives; an aimless life almost never does. Royal births are 1 in 100, so Alexander is the rarest.

A real example, step by step: [the life that became Euclid](EXAMPLE_LIFE.md).

## Running the demo

Requirements: Node.js 24 and pnpm 11.25.0. For ranked play, a verifier key in `.dev.vars` (ignored by git):

```dotenv
RANKED_VERIFIER_SECRET=<64 hex characters>
RANKED_CONTRACT_ID=demo.genesis-1794297139-6.testnet   # optional: use the demo contract
```

```sh
pnpm install --frozen-lockfile
pnpm build                       # once, to create the local database config
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_special_blob.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_harsh_charles_xavier.sql
pnpm dev                         # http://localhost:5173
```

- **With a wallet:** open the app, choose **Ranked life** and connect a testnet wallet.
- **Without a wallet:** if the server has no verifier key, **Ranked life** runs on a *Practice ledger* in your browser: the same rules and screens, nothing sent to NEAR.
- **The scripted story:** `scripts/ranked/demo-rehearsal.ts` plays the example life's story on testnet end to end (a copyist mints, Bob becomes Euclid, the copyist is paid, a third player is born into Euclid's school, a fourth buys Euclid). It needs four testnet accounts in `~/.near-credentials/testnet`; set `VERIFY_URL=http://localhost:5173/api/ranked/verify` to verify through your local server.
