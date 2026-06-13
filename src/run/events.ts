import type { RunState } from './runState';
import { rngFromSeed, pick } from '../util/rng';

// Binary-choice events. Each choice returns a mutation + a result message.
export interface EventChoice {
  label: string;
  resolve: (run: RunState) => { message: string };
}
export interface GameEvent {
  title: string;
  text: string;
  choices: EventChoice[];
}

const EVENTS: GameEvent[] = [
  {
    title: 'A Wandering Merchant',
    text: 'A hooded figure offers a gleaming coin — for a price of blood.',
    choices: [
      {
        label: 'Trade a heart for 60 gold',
        resolve: (run) => {
          if (run.lives > 1) {
            run.lives -= 1;
            run.gold += 60;
            return { message: 'You feel weaker, but your purse is heavy. (-1 heart, +60 gold)' };
          }
          return { message: 'You dare not — it would be your last heart.' };
        },
      },
      {
        label: 'Decline and move on',
        resolve: () => ({ message: 'You leave the merchant to the shadows.' }),
      },
    ],
  },
  {
    title: 'An Old Shrine',
    text: 'A mossy shrine hums with quiet power. An offering bowl waits.',
    choices: [
      {
        label: 'Offer 30 gold for a blessing',
        resolve: (run) => {
          if (run.gold >= 30) {
            run.gold -= 30;
            if (run.lives < run.maxLives) {
              run.lives += 1;
              return { message: 'Warmth floods your chest. (+1 heart)' };
            }
            run.maxLives += 1;
            run.lives += 1;
            return { message: 'The shrine swells your vigor. (+1 max heart)' };
          }
          return { message: 'You lack the coin to make an offering.' };
        },
      },
      {
        label: 'Pocket the offering bowl',
        resolve: (run) => {
          run.gold += 25;
          return { message: 'Greed wins. (+25 gold) The shrine goes dark.' };
        },
      },
    ],
  },
  {
    title: 'A Crossroads Gambler',
    text: 'Dice rattle in a cup. "Double or nothing on your luck," he grins.',
    choices: [
      {
        label: 'Gamble 40 gold',
        resolve: (run) => {
          const rng = rngFromSeed(`${run.seed}:gamble:${run.currentNodeId}`);
          if (run.gold < 40) return { message: 'You have nothing to wager.' };
          if (rng() < 0.5) {
            run.gold += 40;
            return { message: 'The dice favor you! (+40 gold)' };
          }
          run.gold -= 40;
          return { message: 'Snake eyes. (-40 gold)' };
        },
      },
      {
        label: 'Keep your coin',
        resolve: () => ({ message: 'You walk past the rattling dice.' }),
      },
    ],
  },
];

export function rollEvent(run: RunState, nodeId: string): GameEvent {
  const rng = rngFromSeed(`${run.seed}:event:${nodeId}`);
  return pick(rng, EVENTS);
}
