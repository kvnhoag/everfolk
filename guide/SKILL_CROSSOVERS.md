# Attributes and military crossovers

The main branches are **Physique, Handmade, Knowledge and Trade**. Occupations are outcomes shown in skill details. Strength and Endurance are trainable proficiencies; Health is the current condition of the person, affected by illness, food, injury and recovery.

The 74-node graph keeps ten depths and only two edges between main branches:

| Crossover | What joins |
| --- | --- |
| Reading and questioning → Drill and equipment | Basic Knowledge joins physical conditioning for military foundations. |
| Reading and questioning → Tactical reasoning | The Knowledge foundation joins the existing military lane for command preparation. |

The lane follows Physical work → Strength conditioning → Sustained effort → Drill and equipment → Formation discipline → Field supply accounts → Small-unit coordination → Tactical reasoning → Campaign planning → Strategic command. It never feeds back into an earlier node. Both prerequisites at each crossover are mandatory. Selecting Strategic command highlights both the physical and Knowledge ancestry.

Cultivation and Resilience remain practical paths within Physique. Ordinary farm work develops Farming, Strength and Endurance. Taking every farming specialization is unnecessary for military progression. Handmade contains clothing, ceramics and sculpture; Knowledge contains inquiry and public reasoning; Trade retains commercial planning.

## Careers and demonstrated service

| Career opportunity | Required capability | Additional requirements |
| --- | --- | --- |
| Soldier | Drill and equipment (M4) | Age 18; Strength 16, Endurance 16, Warfare 8, Literacy 8; Health 45 and Knowledge 8. |
| Officer | Small-unit coordination (M7) | Serving as a Soldier; at least 4 proved service years; current Health 45 and the role's proficiency thresholds. |
| General | Strategic command (M10) | Age 28; serving as an Officer; at least 8 proved service years; Warfare 72, Oratory 40, Strength 40, Endurance 48; Health 50 and Knowledge 24. |

These are authored gameplay starting values, not measured mastery rates or historical claims. Qualification opens an opportunity; an available commission or command is still a separate appointment with its disclosed chance. A high score alone cannot award skills or military rank. Random appointments use the same qualification checks.

Each skill requires parents, proficiency and distinct active work years. Pre-service drill consumes the annual action and charges its displayed fee. Military work from Formation discipline onward waits for the actual year's army accounts before accepting proof. The record includes the real wage, ration and before/after army balances. An unfunded or under-rationed year does not satisfy that proof.

Officers and Generals receive wages and rations through the same finite army purse and stores as Soldiers. Their job definitions grant no automatic wealth. Study, physical conditioning and military practice remain available during service; taking civilian production requires leaving service. Knowledge work develops the Knowledge stat, while physical work develops Strength and Endurance without treating them as Health.

The Strategic command assessment reserves its own materials and fees once and counts two active Officer work years, including settled service evidence. Employer money remains outside the household until a real wage is paid.

## Versions and map controls

New births use `alexandria-lives-8`, capability graph version 3 with proof from work (introduced in `alexandria-lives-7`): a settled, fully funded and rationed service year counts toward the next open military step. Earlier lives keep their exact world and proof rules; the original lives-4 graph version 2 retains its Inquiry and ethics prerequisite for Tactical reasoning. The current atlas can show the additional route as Unavailable in a retained world; it does not migrate or replace a saved life.

Scroll to zoom, drag to pan, and click a skill to light every prerequisite path. Crossovers use dashed connectors. Only the two necessary Knowledge links cross the branch boundary; the remaining military nodes form a single chain. Health and Knowledge condition requirements appear alongside trainable proficiency requirements in the inspector.
