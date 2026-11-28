import { useEffect, useState } from 'react'
import { capacity, useGame } from '../game/store'
import { fmt } from '../game/format'
import { sound } from '../game/sound'

// ——— Blackjack, contre le croupier loutre.
// Un sabot de 4 jeux, remélangé quand il s'épuise. Le croupier tire jusqu'à 17 et s'arrête
// sur tous les 17. Blackjack payé 3 pour 2, victoire 1 pour 1, égalité remboursée.
// On peut doubler sur les deux premières cartes (une seule carte de plus). Pas de partage.

type Suit = '♠' | '♣' | '♥' | '♦'
interface Card { rank: string; suit: Suit }
const SUITS: Suit[] = ['♠', '♣', '♥', '♦']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']

const newShoe = () => {
  const shoe: Card[] = []
  for (let d = 0; d < 4; d++) for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit })
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}
const value = (hand: Card[]) => {
  let total = 0, aces = 0
  for (const c of hand) {
    if (c.rank === 'A') { total += 11; aces++ }
    else if (['V', 'D', 'R'].includes(c.rank)) total += 10
    else total += Number(c.rank)
  }
  while (total > 21 && aces) { total -= 10; aces-- }
  return total
}
const isBlackjack = (hand: Card[]) => hand.length === 2 && value(hand) === 21

let shoe = newShoe()
const draw = () => {
  if (shoe.length < 20) shoe = newShoe()
  return shoe.pop()!
}

type Phase = 'bet' | 'play' | 'done'

/** La table : mises, cartes, et le croupier loutre (la scène zoome dessus). */
export function Blackjack() {
  const atTable = useGame(s => s.atTable)
  const galets = useGame(s => s.galets)
  const [bet, setBet] = useState(0)
  const [player, setPlayer] = useState<Card[]>([])
  const [dealer, setDealer] = useState<Card[]>([])
  const [phase, setPhase] = useState<Phase>('bet')
  const [result, setResult] = useState('')
  const [stake, setStake] = useState(0)

  // les cartes de la main sont aussi posées sur le tapis, dans la scène
  useEffect(() => {
    const hide = phase === 'play'
    useGame.setState({ tableCards: { dealer: dealer.map((c, i) => ({ ...c, hidden: hide && i === 1 })), player } })
  }, [dealer, player, phase])

  if (!atTable) return null

  const minBet = 10
  const choices = [0.01, 0.05, 0.1, 0.25].map(k => Math.max(minBet, Math.floor(galets * k)))
  const amount = bet || choices[1]

  // paie (ou non) en galets, dans la limite de la flaque
  const pay = (n: number) => {
    const s = useGame.getState()
    const room = Math.max(0, capacity(s) - s.galets)
    const kept = Math.min(n, room)
    useGame.setState({ galets: s.galets + kept })
  }

  const finish = (p: Card[], d: Card[], wager: number) => {
    const pv = value(p), dv = value(d)
    let text: string, win = 0
    if (pv > 21) { text = `Tu dépasses 21. Le croupier ramasse ${fmt(wager)} galets.` }
    else if (isBlackjack(p) && !isBlackjack(d)) { win = wager * 2.5; text = `Blackjack ! Tu gagnes ${fmt(wager * 1.5)} galets.` }
    else if (dv > 21) { win = wager * 2; text = `Le croupier dépasse 21. Tu gagnes ${fmt(wager)} galets.` }
    else if (pv > dv) { win = wager * 2; text = `${pv} contre ${dv} : tu gagnes ${fmt(wager)} galets.` }
    else if (pv === dv) { win = wager; text = `Égalité à ${pv}. Ta mise t’est rendue.` }
    else { text = `${dv} contre ${pv} : le croupier gagne.` }
    if (win) pay(win)
    if (win > wager) sound.success()
    else if (!win) sound.nope()
    setResult(text)
    setPhase('done')
  }

  const deal = () => {
    const s = useGame.getState()
    if (s.galets < amount) return
    useGame.setState({ galets: s.galets - amount })
    const p = [draw(), draw()], d = [draw(), draw()]
    setStake(amount)
    setPlayer(p)
    setDealer(d)
    setResult('')
    sound.buy(2)
    if (isBlackjack(p) || isBlackjack(d)) finish(p, d, amount)
    else setPhase('play')
  }
  const dealerPlays = (p: Card[], wager: number) => {
    const d = [...dealer]
    if (value(p) <= 21) while (value(d) < 17) d.push(draw())
    setDealer(d)
    finish(p, d, wager)
  }
  const hit = () => {
    const p = [...player, draw()]
    setPlayer(p)
    sound.plop(40)
    if (value(p) >= 21) dealerPlays(p, stake)
  }
  const stand = () => dealerPlays(player, stake)
  const double = () => {
    const s = useGame.getState()
    if (s.galets < stake) return
    useGame.setState({ galets: s.galets - stake })
    const p = [...player, draw()]
    setPlayer(p)
    setStake(stake * 2)
    dealerPlays(p, stake * 2)
  }
  const leave = () => {
    setPhase('bet'); setPlayer([]); setDealer([]); setResult('')
    useGame.setState({ atTable: false })
  }

  const hideHole = phase === 'play'
  return (
    <div className="bj" role="dialog" aria-label="Table de blackjack">
      <div className="bj__head">
        <b>Blackjack</b>
        <span className="bj__rules">le croupier s’arrête à 17 · blackjack payé 3 pour 2</span>
        <button className="link-inline" onClick={leave}>quitter la table</button>
      </div>

      <div className="bj__hand">
        <div className="bj__who">croupier {dealer.length > 0 && <span>· {hideHole ? '?' : value(dealer)}</span>}</div>
        <div className="bj__cards">
          {dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={hideHole && i === 1} />)}
        </div>
      </div>
      <div className="bj__hand">
        <div className="bj__who">toi {player.length > 0 && <span>· {value(player)}</span>}</div>
        <div className="bj__cards">
          {player.map((c, i) => <PlayingCard key={i} card={c} />)}
        </div>
      </div>

      {result && <div className="bj__result">{result}</div>}

      {phase === 'play' ? (
        <div className="bj__row">
          <button className="quiz__btn" onClick={hit}>carte</button>
          <button className="quiz__btn" onClick={stand}>rester</button>
          {player.length === 2 && <button className="quiz__btn" onClick={double} disabled={galets < stake}>doubler</button>}
        </div>
      ) : (
        <>
          <div className="bj__row bj__bets">
            <span className="bj__who">mise</span>
            {choices.map((c, i) => (
              <button key={i} className={'bj__chip' + (amount === c ? ' bj__chip--on' : '')} onClick={() => setBet(c)} disabled={galets < c}>
                {fmt(c)}
              </button>
            ))}
          </div>
          <div className="bj__row">
            <button className="quiz__btn" onClick={deal} disabled={galets < amount}>
              {phase === 'done' ? 'rejouer' : 'distribuer'} · {fmt(amount)} galets
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PlayingCard({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  if (hidden) return <div className="pcard pcard--back" aria-label="carte cachée" />
  const soft = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={'pcard' + (soft ? ' pcard--soft' : '')} aria-label={`${card.rank} ${card.suit}`}>
      <span className="pcard__corner">{card.rank}<br />{card.suit}</span>
      <span className="pcard__suit">{card.suit}</span>
    </div>
  )
}
