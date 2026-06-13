import { useGameStore } from './state/useGameStore';
import { EloEntryScreen } from './components/screens/EloEntryScreen';
import { MapScreen } from './components/screens/MapScreen';
import { BattleScreen } from './components/screens/BattleScreen';
import { RewardScreen } from './components/screens/RewardScreen';
import { ShopScreen } from './components/screens/ShopScreen';
import { EventScreen } from './components/screens/EventScreen';
import { EndScreen } from './components/screens/EndScreen';

export function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="logo">
          ♞ GAMBIT <span className="logo-sub">a chess roguelike</span>
        </h1>
      </header>
      <main className="app-main">
        {phase === 'eloEntry' && <EloEntryScreen />}
        {phase === 'map' && <MapScreen />}
        {phase === 'battle' && <BattleScreen />}
        {phase === 'reward' && <RewardScreen />}
        {phase === 'shop' && <ShopScreen />}
        {phase === 'event' && <EventScreen />}
        {phase === 'gameOver' && <EndScreen kind="defeat" />}
        {phase === 'victory' && <EndScreen kind="victory" />}
      </main>
    </div>
  );
}
