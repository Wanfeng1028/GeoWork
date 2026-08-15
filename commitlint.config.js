module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'merge', 'revert'],
    ],
  },
  ignores: [(commit) => /^Merge\s/.test(commit)],
}
