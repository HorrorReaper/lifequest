"use client"
import { useState } from "react"

export default function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
        setEmail("")
        setName("")
      } else {
        setError(data.error || 'Submission failed')
      }
    } catch (err) {
      setError('Network error')
    }
    setLoading(false)
  }

  if (success) {
    return <div className="rounded-lg p-6 bg-primary/5 border text-center">Thanks — you're on the list!</div>
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto flex flex-col gap-3 items-center">
      <input
        aria-label="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name (optional)"
        className="w-full px-4 py-2 rounded border"
      />
      <input
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@domain.com"
        required
        className="w-full px-4 py-2 rounded border"
      />
      <button type="submit" disabled={loading} className="px-6 py-2 rounded bg-primary text-primary-foreground w-full">
        {loading ? 'Joining…' : 'Join waitlist'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
