import { useState, type FormEvent } from 'react'
import { getSettings, GreenApiError, type GreenApiCredentials } from '../api/greenApi'

interface LoginScreenProps {
  onLogin: (creds: GreenApiCredentials) => void
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError('Заполните оба поля: idInstance и apiTokenInstance')
      return
    }

    const creds: GreenApiCredentials = {
      apiUrl: 'https://api.green-api.com',
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    }

    setLoading(true)
    try {
      // Validate credentials: invalid pair returns an API error
      await getSettings(creds)
      onLogin(creds)
    } catch (err) {
      if (err instanceof GreenApiError) {
        setError(
          err.status === 0
            ? `Не удалось связаться с GREEN-API: ${err.message}`
            : `Ошибка проверки данных (${err.status}). Проверьте idInstance и apiTokenInstance.`,
        )
      } else {
        setError('Неизвестная ошибка при проверке данных')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">MAX Chat</h1>
        <p className="login-subtitle">
          Введите учётные данные инстанса GREEN-API
          (личный кабинет <a href="https://console.green-api.com" target="_blank" rel="noreferrer">console.green-api.com</a>)
        </p>

        <label className="login-field">
          <span>idInstance</span>
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="например 110100001"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="login-field">
          <span>apiTokenInstance</span>
          <input
            type="password"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="токен инстанса"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? 'Проверка…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
