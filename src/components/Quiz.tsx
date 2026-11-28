import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { FACTS } from '../game/facts'

/** Quiz « vrai ou faux » sur les loutres : une bonne réponse rapporte des galets. */
export function Quiz() {
  const quiz = useGame(s => s.quiz)
  const answer = useGame(s => s.answerQuiz)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!quiz) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [quiz])

  if (!quiz) return null
  const f = FACTS.find(x => x.id === quiz.id)
  if (!f) return null
  const left = Math.max(0, quiz.until - now)

  return (
    <div className="quiz" role="dialog" aria-label="Quiz sur les loutres">
      <div className="quiz__head">
        <span>Vrai ou faux ?</span>
        <button className="link-inline" onClick={() => answer(null)}>passer</button>
      </div>
      <div className="quiz__claim">{f.claim}</div>
      <div className="quiz__row">
        <button className="quiz__btn" onClick={() => answer(true)}>vrai</button>
        <button className="quiz__btn" onClick={() => answer(false)}>faux</button>
      </div>
      <div className="quiz__time"><div style={{ width: `${(left / 25000) * 100}%` }} /></div>
    </div>
  )
}
