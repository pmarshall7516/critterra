import { useMemo, useState } from 'react';
import { GameView } from '@/game/engine/GameView';
import { loadSave } from '@/game/saves/saveManager';
import { NewGameSetup } from '@/ui/NewGameSetup';
import { TitleScreen } from '@/ui/TitleScreen';

type ScreenState =
  | {
      screen: 'title';
      sessionId: number;
    }
  | {
      screen: 'new-game';
      sessionId: number;
    }
  | {
      screen: 'game';
      mode: 'new' | 'continue';
      playerName?: string;
      sessionId: number;
    };

function App() {
  const [state, setState] = useState<ScreenState>({ screen: 'title', sessionId: 0 });

  const hasSave = useMemo(() => loadSave() !== null, [state.sessionId]);

  if (state.screen === 'title') {
    return (
      <TitleScreen
        hasSave={hasSave}
        onContinue={() => setState({ screen: 'game', mode: 'continue', sessionId: state.sessionId + 1 })}
        onNewGame={() => setState({ screen: 'new-game', sessionId: state.sessionId + 1 })}
      />
    );
  }

  if (state.screen === 'new-game') {
    return (
      <NewGameSetup
        onStart={(playerName) =>
          setState({
            screen: 'game',
            mode: 'new',
            playerName,
            sessionId: state.sessionId + 1,
          })
        }
        onCancel={() => setState({ screen: 'title', sessionId: state.sessionId + 1 })}
      />
    );
  }

  return (
    <GameView
      key={`game-${state.sessionId}`}
      mode={state.mode}
      playerName={state.playerName}
      onReturnToTitle={() =>
        setState((current) => ({
          screen: 'title',
          sessionId: current.sessionId + 1,
        }))
      }
    />
  );
}

export default App;
