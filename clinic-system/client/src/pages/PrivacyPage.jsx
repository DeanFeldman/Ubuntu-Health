export default function PrivacyPage() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Privacy Policy</h1>

        <p>
          Ubuntu Health is a university software project created for academic
          purposes.
        </p>

        <p>
          This application may collect basic personal information such as a
          user’s name, email address, and role in the system for login,
          authentication, and system functionality.
        </p>

        <p>
          Information entered into the system may also be stored to support
          features such as appointments, queue tracking, and clinic management.
        </p>

        <p>
          We do not sell personal information or intentionally share it with
          unrelated third parties.
        </p>

        <p>
          This project is developed for educational use and may not provide the
          same guarantees as a production healthcare platform.
        </p>

        <p>
          If needed, this policy may be updated as the project develops.
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#f6f8fb',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px',
  },
  card: {
    maxWidth: '800px',
    width: '100%',
    background: '#ffffff',
    padding: '32px',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    lineHeight: 1.7,
  },
  title: {
    marginBottom: '20px',
  },
}