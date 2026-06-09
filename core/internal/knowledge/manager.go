package knowledge

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

// Category represents a knowledge category (folder-like hierarchy).
type Category struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	ParentID  *string    `json:"parentId,omitempty"`
	Children  []Category `json:"children,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// Entry represents a single knowledge entry.
type Entry struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Source    string    `json:"source"` // "paper_id", "pdf", "manual"
	Category  string    `json:"category"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// KnowledgeManager handles knowledge base CRUD operations backed by SQLite.
type KnowledgeManager struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewKnowledgeManager creates a new KnowledgeManager with an in-memory SQLite database.
func NewKnowledgeManager(logger *zap.Logger) (*KnowledgeManager, error) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := initSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}

	return &KnowledgeManager{
		db:     db,
		logger: logger,
	}, nil
}

// Close releases all resources held by the KnowledgeManager.
func (m *KnowledgeManager) Close() error {
	if m.db != nil {
		return m.db.Close()
	}
	return nil
}

// initSchema creates the required tables and FTS5 virtual table.
func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS knowledge_categories (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		parent_id  TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (parent_id) REFERENCES knowledge_categories(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS knowledge_entries (
		id         TEXT PRIMARY KEY,
		title      TEXT NOT NULL,
		content    TEXT NOT NULL,
		source     TEXT NOT NULL CHECK(source IN ('paper_id', 'pdf', 'manual')),
		category   TEXT,
		tags       TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (category) REFERENCES knowledge_categories(id) ON DELETE SET NULL
	);

	-- FTS5 full-text search index on title and content
	CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_entries_fts USING fts5(
		title, content,
		content='knowledge_entries',
		content_rowid='id'
	);

	-- Triggers to keep FTS index in sync
	CREATE TRIGGER IF NOT EXISTS knowledge_entries_ai AFTER INSERT ON knowledge_entries BEGIN
		INSERT INTO knowledge_entries_fts(rowid, title, content)
		VALUES (new.id, new.title, new.content);
	END;

	CREATE TRIGGER IF NOT EXISTS knowledge_entries_ad AFTER DELETE ON knowledge_entries BEGIN
		INSERT INTO knowledge_entries_fts(knowledge_entries_fts, rowid, title, content)
		VALUES ('delete', old.id, old.title, old.content);
	END;

	CREATE TRIGGER IF NOT EXISTS knowledge_entries_au AFTER UPDATE ON knowledge_entries BEGIN
		INSERT INTO knowledge_entries_fts(knowledge_entries_fts, rowid, title, content)
		VALUES ('delete', old.id, old.title, old.content);
		INSERT INTO knowledge_entries_fts(rowid, title, content)
		VALUES (new.id, new.title, new.content);
	END;

	CREATE INDEX IF NOT EXISTS idx_entries_category ON knowledge_entries(category);
	CREATE INDEX IF NOT EXISTS idx_entries_source ON knowledge_entries(source);
	`
	_, err := db.Exec(schema)
	return err
}

// GetCategories returns all categories as a tree structure.
func (m *KnowledgeManager) GetCategories() ([]Category, error) {
	return m.buildTree("", nil)
}

// buildTree recursively builds the category tree from a given parent.
func (m *KnowledgeManager) buildTree(parentID string, parent *Category) ([]Category, error) {
	rows, err := m.db.Query(
		`SELECT id, name, parent_id, created_at, updated_at FROM knowledge_categories
		 WHERE parent_id = ? ORDER BY name ASC`,
		parentID,
	)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var cat Category
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.ParentID, &cat.CreatedAt, &cat.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		children, err := m.buildTree(cat.ID, &cat)
		if err != nil {
			return nil, err
		}
		cat.Children = children
		categories = append(categories, cat)
	}
	return categories, rows.Err()
}

// GetEntries returns knowledge entries, optionally filtered by category and search query.
func (m *KnowledgeManager) GetEntries(categoryID string, query string) ([]Entry, error) {
	var entries []Entry

	if query != "" {
		// Use FTS5 for full-text search
		rows, err := m.db.Query(`
			SELECT e.id, e.title, e.content, e.source, e.category, e.tags, e.created_at, e.updated_at
			FROM knowledge_entries e
			INNER JOIN knowledge_entries_fts f ON e.id = f.rowid
			WHERE knowledge_entries_fts MATCH ?
			ORDER BY rank`, query)
		if err != nil {
			return nil, fmt.Errorf("fts search: %w", err)
		}
		defer rows.Close()

		if categoryID != "" {
			// Filter FTS results by category
			filtered := make([]Entry, 0)
			for rows.Next() {
				var entry Entry
				if err := scanEntry(rows, &entry); err != nil {
					return nil, err
				}
				if entry.Category == categoryID {
					filtered = append(filtered, entry)
				}
			}
			return filtered, nil
		}
		return entries, nil
	}

	// Regular query without FTS
	var rows *sql.Rows
	var err error
	if categoryID != "" {
		rows, err = m.db.Query(`
			SELECT id, title, content, source, category, tags, created_at, updated_at
			FROM knowledge_entries
			WHERE category = ?
			ORDER BY created_at DESC`, categoryID)
	} else {
		rows, err = m.db.Query(`
			SELECT id, title, content, source, category, tags, created_at, updated_at
			FROM knowledge_entries
			ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, fmt.Errorf("query entries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var entry Entry
		if err := scanEntry(rows, &entry); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

// scanEntry scans a row into an Entry struct.
func scanEntry(rows *sql.Rows, entry *Entry) error {
	var tagsStr sql.NullString
	err := rows.Scan(&entry.ID, &entry.Title, &entry.Content, &entry.Source,
		&entry.Category, &tagsStr, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return fmt.Errorf("scan entry: %w", err)
	}
	if tagsStr.Valid {
		_ = jsonDecode([]byte(tagsStr.String), &entry.Tags)
	}
	return nil
}

// CreateCategory creates a new knowledge category.
func (m *KnowledgeManager) CreateCategory(name, parentID string) (*Category, error) {
	id := fmt.Sprintf("cat_%s_%d", shortID(), time.Now().UnixNano())
	now := time.Now()

	var parentPtr *string
	if parentID != "" {
		parentPtr = &parentID
	}

	_, err := m.db.Exec(
		`INSERT INTO knowledge_categories (id, name, parent_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id, name, parentPtr, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("create category: %w", err)
	}

	cat := &Category{
		ID:        id,
		Name:      name,
		ParentID:  parentPtr,
		CreatedAt: now,
		UpdatedAt: now,
	}

	m.logger.Info("category created", zap.String("id", id), zap.String("name", name))
	return cat, nil
}

// IndexPaper indexes a paper's content into the knowledge base.
func (m *KnowledgeManager) IndexPaper(paperID string, title, content string, tags []string) error {
	id := fmt.Sprintf("entry_%s_%d", shortID(), time.Now().UnixNano())
	now := time.Now()

	tagsJSON, _ := jsonEncode(tags)

	_, err := m.db.Exec(
		`INSERT INTO knowledge_entries (id, title, content, source, category, tags, created_at, updated_at)
		 VALUES (?, ?, ?, 'paper_id', '', ?, ?, ?)`,
		id, title, content, tagsJSON, now, now,
	)
	if err != nil {
		return fmt.Errorf("index paper: %w", err)
	}

	m.logger.Info("paper indexed", zap.String("paperId", paperID), zap.String("title", title))
	return nil
}

// ImportFile imports a file's content into the knowledge base.
func (m *KnowledgeManager) ImportFile(filePath, title, content string, source string, categoryID string) error {
	id := fmt.Sprintf("entry_%s_%d", shortID(), time.Now().UnixNano())
	now := time.Now()

	_, err := m.db.Exec(
		`INSERT INTO knowledge_entries (id, title, content, source, category, tags, created_at, updated_at)
		 VALUES (?, ?, ?, ?, '', '[]', ?, ?)`,
		id, title, content, source, categoryID, now, now,
	)
	if err != nil {
		return fmt.Errorf("import file: %w", err)
	}

	m.logger.Info("file imported", zap.String("path", filePath), zap.String("title", title))
	return nil
}

// DeleteEntry removes a knowledge entry by ID.
func (m *KnowledgeManager) DeleteEntry(id string) error {
	result, err := m.db.Exec(`DELETE FROM knowledge_entries WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete entry: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("entry not found: %s", id)
	}

	m.logger.Info("entry deleted", zap.String("id", id))
	return nil
}

// UpdateEntry updates editable fields for a knowledge entry.
func (m *KnowledgeManager) UpdateEntry(id, title, content, category string, tags []string) (*Entry, error) {
	current, err := m.GetEntryByID(id)
	if err != nil {
		return nil, err
	}
	if title == "" {
		title = current.Title
	}
	if content == "" {
		content = current.Content
	}
	if category == "" {
		category = current.Category
	}
	if tags == nil {
		tags = current.Tags
	}
	tagsJSON, _ := jsonEncode(tags)
	now := time.Now()
	result, err := m.db.Exec(
		`UPDATE knowledge_entries SET title = ?, content = ?, category = ?, tags = ?, updated_at = ? WHERE id = ?`,
		title, content, category, tagsJSON, now, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update entry: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("entry not found: %s", id)
	}
	m.logger.Info("entry updated", zap.String("id", id), zap.String("title", title))
	return m.GetEntryByID(id)
}

// Search performs a full-text search across all knowledge entries.
func (m *KnowledgeManager) Search(query string) ([]Entry, error) {
	return m.GetEntries("", query)
}

// GetEntryByID returns a single entry by its ID.
func (m *KnowledgeManager) GetEntryByID(id string) (*Entry, error) {
	rows, err := m.db.Query(`
		SELECT id, title, content, source, category, tags, created_at, updated_at
		FROM knowledge_entries WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("query entry: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("entry not found: %s", id)
	}

	var entry Entry
	if err := scanEntry(rows, &entry); err != nil {
		return nil, err
	}
	return &entry, nil
}

// jsonEncode encodes a slice to JSON bytes.
func jsonEncode(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// jsonDecode decodes JSON bytes into a pointer.
func jsonDecode(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// shortID generates a short random ID suffix.
func shortID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano()%0xFFFFFF)
}
