import type { RunState } from './runState';
import { rngFromSeed, pick } from '../util/rng';

// Binary-choice events. Each choice returns a mutation + a result message.
export interface EventChoice {
  label: string;
  // Optional gate: when it returns false the choice is shown but disabled
  // (e.g. you can't gamble 40 gold you don't have).
  enabled?: (run: RunState) => boolean;
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
        enabled: (run) => run.lives > 1,
        resolve: (run) => {
          run.lives -= 1;
          run.gold += 60;
          return { message: 'You feel weaker, but your purse is heavy. (-1 heart, +60 gold)' };
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
        enabled: (run) => run.gold >= 30,
        resolve: (run) => {
          run.gold -= 30;
          if (run.lives < run.maxLives) {
            run.lives += 1;
            return { message: 'Warmth floods your chest. (+1 heart)' };
          }
          run.maxLives += 1;
          run.lives += 1;
          return { message: 'The shrine swells your vigor. (+1 max heart)' };
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
        enabled: (run) => run.gold >= 40,
        resolve: (run) => {
          const rng = rngFromSeed(`${run.seed}:gamble:${run.currentNodeId}`);
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
