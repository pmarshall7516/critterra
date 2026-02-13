import { FormEvent, useState } from 'react';

interface NewGameSetupProps {
  onStart: (playerName: string) => void;
  onCancel: () => void;
}

export function NewGameSetup({ onStart, onCancel }: NewGameSetupProps) {
  const [playerName, setPlayerName] = useState('Player');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = playerName.trim();
    if (!nextName) {
      return;
    }

    onStart(nextName);
  };

  return (
    <section className="title-screen">
      <div className="title-screen__card">
        <p className="title-screen__tag">New Save</p>
        <h1>Name Your Character</h1>
        <p className="title-screen__subtitle">This name is used for your save profile and dialogue.</p>

        <form className="new-game-form" onSubmit={handleSubmit}>
          <label htmlFor="playerName">Trainer Name</label>
          <input
            id="playerName"
            name="playerName"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value.slice(0, 20))}
            placeholder="Enter a name"
            autoFocus
          />

          <div className="title-screen__actions">
            <button type="submit" className="primary" disabled={!playerName.trim()}>
              Start Adventure
            </button>
            <button type="button" className="secondary" onClick={onCancel}>
              Back
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
