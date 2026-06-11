// GeoWork Go Core - Repository (Git Integration)

package toolregistry

import (
	"fmt"
	"os/exec"
	"strings"
)

// Repository wraps git operations for the GeoWork codebase.
type Repository struct {
	RootPath string
}

// NewRepository creates a new Repository for the given path.
func NewRepository(rootPath string) *Repository {
	return &Repository{RootPath: rootPath}
}

// IsGitRepo checks if the root path is a git repository.
func (r *Repository) IsGitRepo() bool {
	cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
	cmd.Dir = r.RootPath
	output, err := cmd.Output()
	return err == nil && strings.TrimSpace(string(output)) == "true"
}

// Status returns the git status string.
func (r *Repository) Status() (string, error) {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// AddStage adds files to the staging area.
func (r *Repository) AddStage(paths ...string) error {
	args := []string{"add"}
	args = append(args, paths...)
	cmd := exec.Command("git", args...)
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git add: %s: %w", string(output), err)
	}
	return nil
}

// Commit creates a commit with the given message.
func (r *Repository) Commit(message string) error {
	cmd := exec.Command("git", "commit", "-m", message)
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git commit: %s: %w", string(output), err)
	}
	return nil
}

// DiffStaged returns the diff of staged changes.
func (r *Repository) DiffStaged() (string, error) {
	cmd := exec.Command("git", "diff", "--cached")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// Diff returns the diff of working tree changes.
func (r *Repository) Diff() (string, error) {
	cmd := exec.Command("git", "diff")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// Log returns the last n commit messages.
func (r *Repository) Log(n int) ([]string, error) {
	if n <= 0 {
		n = 10
	}
	cmd := exec.Command("git", "log", fmt.Sprintf("--max-count=%d", n), "--oneline")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var result []string
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			result = append(result, line)
		}
	}
	return result, nil
}

// CurrentBranch returns the name of the current branch.
func (r *Repository) CurrentBranch() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = r.RootPath
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

// ResetHard resets the working tree to the last commit.
func (r *Repository) ResetHard() error {
	cmd := exec.Command("git", "reset", "--hard", "HEAD")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git reset: %s: %w", string(output), err)
	}
	return nil
}

// Checkout creates and switches to a new branch.
func (r *Repository) CheckoutNewBranch(branchName string) error {
	cmd := exec.Command("git", "checkout", "-b", branchName)
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout: %s: %w", string(output), err)
	}
	return nil
}

// Stash saves uncommitted changes.
func (r *Repository) Stash(message string) error {
	args := []string{"stash", "save"}
	if message != "" {
		args = append(args, message)
	}
	cmd := exec.Command("git", args...)
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash: %s: %w", string(output), err)
	}
	return nil
}

// StashPop restores stashed changes.
func (r *Repository) StashPop() error {
	cmd := exec.Command("git", "stash", "pop")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git stash pop: %s: %w", string(output), err)
	}
	return nil
}

// Branches lists all local branches.
func (r *Repository) Branches() ([]string, error) {
	cmd := exec.Command("git", "branch", "--list")
	cmd.Dir = r.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	var branches []string
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		line = strings.TrimSpace(line)
		// Remove leading "* " or "  " for current/other branch
		line = strings.TrimPrefix(line, "* ")
		line = strings.TrimPrefix(line, "  ")
		if line != "" {
			branches = append(branches, line)
		}
	}
	return branches, nil
}

// GetRemoteURL returns the URL of the default remote.
func (r *Repository) GetRemoteURL() (string, error) {
	cmd := exec.Command("git", "remote", "get-url", "origin")
	cmd.Dir = r.RootPath
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}
