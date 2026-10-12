import styles from './App.module.css';

// Placeholder until the debate screens land.
export function App() {
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>// Work in progress</p>
      <h1 className={styles.title}>
        Debate <span className={styles.endorse}>— by Plink Labs</span>
      </h1>
      <p className={styles.lede}>
        Topics, teams, timed turns and an audience vote, for running a debate in class. Nothing
        leaves your browser.
      </p>
    </main>
  );
}
