import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'memo-app-c05-notes'
const EMPTY_TITLE = '\uC81C\uBAA9 \uC5C6\uB294 \uBA54\uBAA8'
const EMPTY_ITEM_TEXT = '\uD56D\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694.'

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
            checked: Boolean(item?.checked),
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
                      checked: !item.checked,
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
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">
          <span className="app-header__title-inner">
            {'\u2665'} {'\uBA54\uBAA8'} check {'\u2665'}
          </span>
        </h1>
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
                    <div className="checklist-row" key={item.id}>
                      <button
                        type="button"
                        className={`check-square ${item.checked ? 'check-square--on' : ''}`}
                        aria-pressed={item.checked}
                        aria-label={item.checked ? '\uC644\uB8CC \uCDE8\uC18C' : '\uC644\uB8CC'}
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

      <footer className="app-footer" aria-hidden="true">
        <div className="app-footer__speech">
          <span>{'\uC624\uB298\uB3C4 \uD654\uC774\uD305!'}</span>
        </div>
        <div className="app-footer__bunny" aria-hidden="true">
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
      </footer>
    </div>
  )
}

