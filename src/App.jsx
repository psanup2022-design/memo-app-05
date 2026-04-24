import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'memo-app-c05-notes'
const EMPTY_TITLE = '\uC81C\uBAA9 \uC5C6\uB294 \uBA54\uBAA8'
const EMPTY_ITEM_TEXT = '\uD56D\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694.'

/** 로컬 달력 기준 YYYY-MM-DD */
function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function stableHash32(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const DAILY_QUOTES = [
  '오늘의 한 걸음이 내일의 나를 바꿉니다.',
  '시작이 반입니다. 지금이 가장 빠른 때예요.',
  '포기하지 않는 한, 실패는 없습니다.',
  '작은 진전도 축하할 가치가 있어요.',
  '당신은 생각보다 훨씬 단단합니다.',
  '완벽하지 않아도 괜찮아요. 계속 가면 됩니다.',
  '느려도 멈추지만 않으면 돼요.',
  '오늘 할 수 있는 일에 집중해 보세요.',
  '실수는 배움의 또 다른 이름이에요.',
  '한 번에 다 하려 하지 말고, 한 가지씩.',
  '비교보다는 어제의 나와 비교해 보세요.',
  '쉬는 것도 성장의 일부입니다.',
  '용기는 두려움이 없는 게 아니라 두려움 속에서도 나아가는 거예요.',
  '지금 이 순간에 최선을 다하면 충분해요.',
  '꾸준함이 재능을 이길 때가 많아요.',
  '작은 습관이 큰 결과를 만듭니다.',
  '당신의 속도로 가면 됩니다.',
  '오늘도 스스로를 응원해 주세요.',
  '할 수 있다고 믿는 순간, 이미 절반은 왔어요.',
  '결과가 아니라 과정에서 의미를 찾아보세요.',
  '한 걸음씩이면 충분히 멀리 갈 수 있어요.',
  '지금까지 온 것만으로도 대단해요.',
  '실패는 끝이 아니라 방향을 바꾸는 신호예요.',
  '오늘의 선택이 내일을 만듭니다.',
  '자신에게 친절해지는 연습을 해 보세요.',
  '불안해도 괜찮아요. 그 안에서도 할 수 있어요.',
  '작게라도 매일 쌓아 보세요.',
  '당신의 노력은 분명 빛을 받을 거예요.',
  '다른 사람의 속도에 맞출 필요는 없어요.',
  '오늘 하루, 스스로에게 고마워해 보세요.',
  '의심이 들 때일수록 한 번 더 해보세요.',
  '지금 하는 일에 의미가 있어요.',
  '완벽한 하루보다 진솔한 하루가 더 값져요.',
  '작은 칭찬 한마디가 큰 힘이 됩니다.',
  '당신은 혼자가 아니에요. 오늘도 함께해요.',
  '오늘의 나를 믿고 한 번 더 시도해 보세요.',
  '어려움은 당신을 단단하게 만듭니다.',
  '천천히 가도, 앞으로 가면 됩니다.',
  '오늘의 집중이 내일의 여유를 만들어요.',
  '포기하고 싶은 날일수록 조금만 더 가 보세요.',
  '당신의 가능성은 아직 끝나지 않았어요.',
  '작은 성취도 큰 박수를 보내 주세요.',
  '오늘도 화이팅! 당신은 충분히 잘하고 있어요.',
  '마음이 흔들려도, 다시 세울 수 있어요.',
  '지금 이 길이 당신만의 길이에요.',
  '한숨 쉬고 다시 시작해도 괜찮아요.',
  '오늘의 선택을 후회하지 않게, 정직하게.',
  '당신의 시간은 당신 것이에요. 소중히 써요.',
  '작은 변화가 큰 차이를 만듭니다.',
  '오늘도 멋지게, 당신다운 하루 되세요.',
]

function getQuoteForLocalDay(d = new Date()) {
  if (DAILY_QUOTES.length === 0) return ''
  const i = stableHash32(localDateKey(d)) % DAILY_QUOTES.length
  return DAILY_QUOTES[i]
}

/** localStorage 등에서 문자열로 들어온 값 때문에 체크 UI가 깨지지 않게 함 */
function normalizeChecked(value) {
  if (value === true || value === 1) return true
  if (value === 'true' || value === '1') return true
  return false
}

function createChecklistItem(text = '') {
  return {
    id: crypto.randomUUID(),
    text,
    checked: false,
  }
}

function createBlankNote() {
  return {
    id: crypto.randomUUID(),
    title: '',
    checklist: [createChecklistItem()],
    updatedAt: new Date().toISOString(),
    isEditing: true,
  }
}

function loadNotesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.map((note) => ({
      id: note.id ?? crypto.randomUUID(),
      title: String(note.title ?? ''),
      checklist: Array.isArray(note.checklist)
        ? note.checklist.map((item) => ({
            id: item?.id ?? crypto.randomUUID(),
            text: String(item?.text ?? ''),
            checked: normalizeChecked(item?.checked),
          }))
        : String(note.content ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => createChecklistItem(line)),
      updatedAt: note.updatedAt ?? new Date().toISOString(),
      isEditing: false,
    })).map((note) => ({
      ...note,
      checklist: note.checklist.length > 0 ? note.checklist : [createChecklistItem()],
    }))
  } catch {
    return []
  }
}

export default function App() {
  const [notes, setNotes] = useState(loadNotesFromStorage)
  const [searchKeyword, setSearchKeyword] = useState('')
  const pendingChecklistFocusId = useRef(null)
  const checklistInputRefs = useRef({})

  useEffect(() => {
    const serializableNotes = notes.map(({ isEditing, ...note }) => note)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableNotes))
  }, [notes])

  useEffect(() => {
    const id = pendingChecklistFocusId.current
    if (!id) return
    pendingChecklistFocusId.current = null
    queueMicrotask(() => checklistInputRefs.current[id]?.focus())
  }, [notes])

  const filteredNotes = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) return notes

    return notes.filter((note) => {
      const title = note.title.toLowerCase()
      const checklistText = note.checklist.map((item) => item.text.toLowerCase()).join(' ')
      return title.includes(keyword) || checklistText.includes(keyword)
    })
  }, [notes, searchKeyword])

  const dailyQuote = useMemo(() => getQuoteForLocalDay(new Date()), [])

  const marqueeSegment = useMemo(() => {
    const q = dailyQuote.trim() || '오늘도 화이팅!'
    return `${q}\u3000\u3000\u3000\u2022\u3000\u3000\u3000`
  }, [dailyQuote])

  const marqueeDurationSec = useMemo(() => {
    const len = marqueeSegment.length
    return Math.min(50, Math.max(14, len * 0.32))
  }, [marqueeSegment])

  const handleCreateNote = () => {
    const nextNote = createBlankNote()
    setNotes((prev) => [nextNote, ...prev.map((note) => ({ ...note, isEditing: false }))])
  }

  const handleEditMode = (noteId) => {
    setNotes((prev) =>
      prev.map((note) => ({
        ...note,
        isEditing: note.id === noteId,
      })),
    )
  }

  const handleSave = (noteId) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? (() => {
              const normalizedItems = note.checklist
                .map((item) => ({
                  ...item,
                  text: item.text.trim(),
                }))
                .filter((item) => item.text.length > 0)

              return {
                ...note,
                title: note.title.trim(),
                checklist: normalizedItems.length > 0 ? normalizedItems : [createChecklistItem()],
                updatedAt: new Date().toISOString(),
                isEditing: false,
              }
            })()
          : note,
      ),
    )
  }

  const handleDelete = (noteId) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId))
  }

  const handleChange = (noteId, field, value) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? {
              ...note,
              [field]: value,
            }
          : note,
      ),
    )
  }

  const handleChecklistTextChange = (noteId, itemId, value) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id !== noteId
          ? note
          : {
              ...note,
              checklist: note.checklist.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      text: value,
                    }
                  : item,
              ),
            },
      ),
    )
  }

  const handleChecklistToggle = (noteId, itemId) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id !== noteId
          ? note
          : {
              ...note,
              updatedAt: new Date().toISOString(),
              checklist: note.checklist.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      checked: !normalizeChecked(item.checked),
                    }
                  : item,
              ),
            },
      ),
    )
  }

  const handleAddChecklistItem = (noteId) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id !== noteId
          ? note
          : {
              ...note,
              checklist: [...note.checklist, createChecklistItem()],
            },
      ),
    )
  }

  const handleRemoveChecklistItem = (noteId, itemId) => {
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id !== noteId) return note
        const nextItems = note.checklist.filter((item) => item.id !== itemId)
        return {
          ...note,
          checklist: nextItems.length > 0 ? nextItems : [createChecklistItem()],
        }
      }),
    )
  }

  const handleChecklistKeyDown = (noteId, itemId, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newItem = createChecklistItem()
      pendingChecklistFocusId.current = newItem.id
      setNotes((prev) =>
        prev.map((note) => {
          if (note.id !== noteId) return note
          const idx = note.checklist.findIndex((item) => item.id === itemId)
          if (idx === -1) return note
          const next = [...note.checklist]
          next.splice(idx + 1, 0, newItem)
          return { ...note, checklist: next }
        }),
      )
      return
    }

    if (e.key !== 'Backspace') return

    setNotes((prev) => {
      const target = prev.find((n) => n.id === noteId)
      if (!target) return prev
      const idx = target.checklist.findIndex((item) => item.id === itemId)
      const row = target.checklist[idx]
      if (!row || row.text !== '' || target.checklist.length <= 1) return prev
      e.preventDefault()
      const prevRow = target.checklist[idx - 1]
      if (prevRow) pendingChecklistFocusId.current = prevRow.id
      return prev.map((note) => {
        if (note.id !== noteId) return note
        return {
          ...note,
          checklist: note.checklist.filter((item) => item.id !== itemId),
        }
      })
    })
  }

  return (
    <div className="app-shell">
      <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">
          <span className="app-header__title-inner">Just Do it</span>
        </h1>
        <div className="quote-led" aria-label={dailyQuote}>
          <div className="quote-led__viewport">
            <div
              className="quote-led__track"
              style={{ '--quote-led-dur': `${marqueeDurationSec}s` }}
            >
              <span className="quote-led__segment">{marqueeSegment}</span>
              <span className="quote-led__segment" aria-hidden="true">
                {marqueeSegment}
              </span>
            </div>
          </div>
        </div>
        <p className="app-header__sub">
          {'\uC0C8\uBA54\uBAA8 · \uCCB4\uD06C · \uAC80\uC0C9 · \uBC14\uB85C \uC785\uB825\uD574\uC694'}
        </p>
      </header>

      <section className="toolbar">
        <button type="button" className="primary-btn" onClick={handleCreateNote}>
          {'\uC0C8\uBA54\uBAA8'}
        </button>

        <input
          type="text"
          placeholder={'\uBA54\uBAA8\uAC80\uC0C9: \uC81C\uBAA9 \uB610\uB294 \uB0B4\uC6A9 \uC785\uB825'}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
      </section>

      <p className="cache-hint">
        {
          '\uBC14\uBA74\uC774 \uC608\uC804\uACFC \uAC19\uC73C\uBA74 \uAC15\uB825 \uC0C8\uB85C\uACE0\uCE68(Ctrl+Shift+R)\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694.'
        }
      </p>

      <main className="notes-grid" aria-live="polite">
        {filteredNotes.length === 0 ? (
          <p className="empty-state">
            {'\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uAC70\uB098 \uBA54\uBAA8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8\uBA54\uBAA8\uB97C \uCD94\uAC00\uD574\uBCF4\uC138\uC694.'}
          </p>
        ) : (
          filteredNotes.map((note) => (
            <article key={note.id} className="note-card">
              <div className="note-head">
                <span className="note-date">
                  {'\uCD5C\uADFC \uC218\uC815: '} {new Date(note.updatedAt).toLocaleString('ko-KR')}
                </span>
                <div className="note-actions">
                  {!note.isEditing && (
                    <button type="button" onClick={() => handleEditMode(note.id)}>
                      {'\uC218\uC815'}
                    </button>
                  )}

                  {note.isEditing && (
                    <button type="button" className="save-btn" onClick={() => handleSave(note.id)}>
                      {'\uC800\uC7A5'}
                    </button>
                  )}

                  <button type="button" className="danger-btn" onClick={() => handleDelete(note.id)}>
                    {'\uC0AD\uC81C'}
                  </button>
                </div>
              </div>

              <div className="note-body">
                <input
                  type="text"
                  className="title-pill"
                  placeholder={EMPTY_TITLE}
                  value={note.title}
                  onChange={(e) => handleChange(note.id, 'title', e.target.value)}
                />
                {note.isEditing ? (
                  <p className="checklist-hint">
                    {'Enter: \uC0C8 \uD56D\uBAA9 · \uBE48 \uD589 Backspace: \uD589 \uC0AD\uC81C'}
                  </p>
                ) : null}
                <div className="checklist-editor">
                  {note.checklist.map((item) => (
                    <div className="checklist-row" key={`${note.id}-${item.id}`}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={normalizeChecked(item.checked)}
                        aria-label={normalizeChecked(item.checked) ? '\uC644\uB8CC \uCDE8\uC18C' : '\uC644\uB8CC'}
                        className={`check-square-btn ${normalizeChecked(item.checked) ? 'check-square-btn--on' : ''}`}
                        onClick={() => handleChecklistToggle(note.id, item.id)}
                      />
                      <input
                        type="text"
                        className="checklist-pill"
                        placeholder={EMPTY_ITEM_TEXT}
                        value={item.text}
                        ref={(el) => {
                          checklistInputRefs.current[item.id] = el
                        }}
                        onChange={(e) => handleChecklistTextChange(note.id, item.id, e.target.value)}
                        onKeyDown={(e) => handleChecklistKeyDown(note.id, item.id, e)}
                      />
                      {note.isEditing ? (
                        <button
                          type="button"
                          className="remove-item-btn"
                          aria-label={'\uD56D\uBAA9 \uC0AD\uC81C'}
                          onClick={() => handleRemoveChecklistItem(note.id, item.id)}
                        >
                          {'\u00D7'}
                        </button>
                      ) : (
                        <span className="checklist-row__spacer" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                  <button type="button" className="add-item-btn" onClick={() => handleAddChecklistItem(note.id)}>
                    {'+ \uD56D\uBAA9'}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
      </div>

      <aside className="app-mascot" aria-label={'\uB9C8\uC2A4\uCF54\uD2B8'}>
        <div className="app-mascot__bunny" aria-hidden="true">
          <svg viewBox="0 0 120 100" width="100" height="84" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="58" cy="62" rx="38" ry="32" fill="#fffefb" stroke="#e8d4f0" strokeWidth="2" />
            <ellipse cx="40" cy="58" rx="6" ry="7" fill="#ffd0dc" />
            <ellipse cx="76" cy="58" rx="6" ry="7" fill="#ffd0dc" />
            <circle cx="48" cy="52" r="3" fill="#5c5266" />
            <path d="M72 50 Q78 48 78 52" stroke="#5c5266" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="58" cy="68" rx="4" ry="2.5" fill="#ffd0dc" opacity="0.7" />
            <path
              d="M22 28 Q18 8 38 18 Q48 4 58 20 Q68 4 78 18 Q98 8 94 28 Q88 36 58 32 Q30 36 22 28"
              fill="#c4b5f0"
              stroke="#b8a9e8"
              strokeWidth="1.5"
            />
            <path d="M36 20 Q44 26 52 22" fill="none" stroke="#dfd6f5" strokeWidth="1" opacity="0.8" />
          </svg>
        </div>
        <div className="app-mascot__speech">
          <span>{'\uC548\uB155!'}</span>
        </div>
      </aside>
    </div>
  )
}

