module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'merge', 'revert'],
    ],
    // 中文提交信息常以英文专有名词开头（CI、Go、ChatComposer 等），关闭大小写检查
    'subject-case': [0],
  },
  ignores: [(commit) => /^Merge\s/.test(commit)],
}
