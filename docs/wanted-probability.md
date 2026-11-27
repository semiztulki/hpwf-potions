# Wanted probability model

This note is for maintainers; it is not UI copy.

Duration weights use a frozen calibration of 2,986 distinct recorded sequences from
hpwf-potions-data commit 2365ee429115babee90a16a3148c43f181a7632f. Ordinary new-style
potions and renamed single-positive-effect potions are pooled. Old-style, mana,
custom/multiple-effect and explicitly scripted records are excluded from calibration.
Special levels come from their recorded level or, when absent, recipe ingredients.
Counts are stored in value.discoveryDurationModel in data/mechanics.json. A Jeffreys
half-count per supported duration avoids treating an unobserved duration as impossible.
Weights are normalized across all supported durations before applying result filters.
Effect types retain equal thirds. Actions change sequence identity, not ingredient
value; this Wanted model does not shift duration weights by action level.

Known ordinary effects are keyed by potion level, duration, effect type and magnitude.
Single-effect named cards participate regardless of name/image/description or recipe
availability. Mana/custom/multiple-effect/explicitly scripted cards do not close an
ordinary effect. Their sequences still participate in the common sequence index.

For a grouped composition, count concrete ordered ingredient choices (repetition is
allowed), optional ordinary actions after ingredient slots, and an optional Moon.
With n < 11 ingredients there are n action slots without Moon, and n+1 possible
Moon gaps, each providing one additional action slot. With 11 ingredients brewing
ends immediately on the last ingredient: only 10 action slots and 11 Moon gaps
remain. Moon may be first/last or have actions on either side; adjacent ordinary
actions and an initial ordinary action are not part of this grammar.

Deduplicate all known sequences by ordered (type, ref) pairs, across all categories.
Only valid, fully recognized sequences count. Build a group-count/Moon index so
candidate evaluation does not enumerate the enormous sequence space. A fully used
composition is excluded. For partial coverage, multiply the empirical effect-novelty
estimate by the remaining fraction of sequences. This is an approximation for a
uniform random choice from the composition's entire sequence space, with known
sequences assigned zero chance of a new discovery. It is NOT a measured probability
conditional on deliberately selecting an untried sequence. Neither uniform sampling
of sequences nor independence between sequence novelty and outcome novelty is
established. Percentages keep the existing approximation mark; do not claim exact
or statistically calibrated per-brew odds.

Value ranges retain the existing rarity and Moon assumptions; Moon bonus is 0..450.
Those assumptions, selection bias of the recipe catalogue, and incomplete knowledge
of scripted recipes remain limitations. Calibration is not recomputed on page load:
new recipes update known effects and occupied sequences, without moving the prior
from a small deliberately selected batch.

Validation includes exhaustive enumeration for small compositions, Moon/action
positions, the 11th-ingredient boundary, duplicate recipes, all-category blockers,
partial/full exhaustion, duration weights and named/scripted effect identity.
